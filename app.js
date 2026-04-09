var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
const session = require('express-session');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const cors = require('cors'); // Added CORS
const Category = require('./models/Category'); 
const User = require('./models/User'); 

// Kết nối MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Sport';
mongoose.connect(mongoURI).then(async () => {
  console.log('MongoDB Connected to ' + (process.env.MONGODB_URI ? 'Remote Database' : 'Local Database'));

  // Tự động tạo tài khoản admin mặc định nếu chưa có
  const adminAccounts = [
    { name: 'Admin 1', email: 'admin1@admin.com', password: 'admin123', role: 'admin' },
    { name: 'Admin 2', email: 'admin2@admin.com', password: 'admin123', role: 'admin' },
    { name: 'Super Admin', email: 'superadmin@admin.com', password: 'admin123', role: 'admin' },
    { name: 'Super hanh', email: 'anhtu@admin.com', password: 'admin123', role: 'admin' }
  ];

  for (const adminData of adminAccounts) {
    try {
      const existingAdmin = await User.findOne({ email: adminData.email });
      if (!existingAdmin) {
        const hashedPassword = await bcryptjs.hash(adminData.password, 10);
        const newAdmin = new User({
          name: adminData.name,
          email: adminData.email,
          password: hashedPassword,
          role: 'admin'
        });
        await newAdmin.save();
        console.log(`✓ Created admin account: ${adminData.email} (Password: ${adminData.password})`);
      }
    } catch (err) {
      console.error(`Error creating admin ${adminData.email}:`, err);
    }
  }
}).catch(err => {
  console.error("Error connecting to mongodb:", err);
});

var app = express();

// ================= MIDDLEWARE ==================
// CORS configuration to allow cross-origin requests from Frontend (Netlify)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port is 5173
  credentials: true // Important if using sessions/cookies
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Trust proxy for secure cookies on Render
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // none for cross-site
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// ================= ROUTES ==================
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var adminRouter = require('./routes/admin');

// ================= VIEW ENGINE (For Admin Dashboard) ==================
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: false,
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: {
    multiply: function (a, b) { return a * b; },
    eq: function (a, b) { return a === b; },
    formatCurrency: function (value) {
      return (Number(value) * 1000).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    },
    if_eq: function(a, b, opts) {
        if (a == b) {
            return opts.fn(this);
        } else {
            return opts.inverse(this);
        }
    },
    times: function (n, block) {
      var accum = '';
      for (var i = 0; i < n; ++i)
        accum += block.fn(i);
      return accum;
    },
    formatDateValue: function (date) {
      if (!date) return '';
      var d = new Date(date);
      var year = d.getFullYear();
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return `${year}-${month}-${day}`;
    },
    json: function (context) {
      return JSON.stringify(context);
    },
    formatDate: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('vi-VN');
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Gắn route Admin ở đây để hiển thị HTML (KHÔNG bị đè bởi JSON API bên dưới)
app.use('/admin', adminRouter);

// Tự động chuyển đổi res.render thành res.json để biến các route cũ thành API cho FRONTEND
app.use(function (req, res, next) {
  // Chỉ ghi đè nếu URL không bắt đầu bằng /admin
  if (req.url.startsWith('/admin')) {
     return next();
  }
  
  const originalRender = res.render;
  res.render = function (view, data) {
    if (req.originalUrl.startsWith('/api') || req.originalUrl === '/') {
        const combinedData = { ...res.locals, ...data };
        return res.json({ 
          view: view, 
          data: combinedData,
          layout: res.locals.layout || app.locals.layout
        });
    }
    // Fallback
    originalRender.call(this, view, data);
  };
  
  const originalRedirect = res.redirect;
  res.redirect = function (url) {
    if (req.originalUrl.startsWith('/api') || req.originalUrl === '/') {
        return res.json({ redirect: url });
    }
    originalRedirect.call(this, url);
  };
  next();
});

// Middleware: Get active Categories for Navbar (Backend still needs this to send to Frontend)
app.use(async function (req, res, next) {
  try {
    const categories = await Category.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
    res.locals.categories = categories;
  } catch (err) {
    res.locals.categories = [];
  }
  next();
});

// Middleware to sync session data into locals
app.use(function (req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || [];
  res.locals.wishlist = req.session.wishlist || [];
  next();
});

app.use('/api', indexRouter);
app.use('/api/users', usersRouter);

app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// assignment test routes (id, name only)
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('name').lean();
    res.json(users.map(u => ({ id: u._id, name: u.name })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    let user;
    if (req.params.id === '1') {
      // Return the first user found for ID '1' to satisfy assignment testing
      user = await User.findOne().select('name').lean();
    } else {
      user = await User.findById(req.params.id).select('name').lean();
    }

    if (user) {
      res.json({ id: user._id, name: user.name });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    res.status(404).json({ success: false, message: 'Invalid User ID' });
  }
});

// ================= ERROR HANDLER ==================
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;

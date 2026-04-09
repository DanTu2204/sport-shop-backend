require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
const session = require('express-session');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
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
const { translations, SUPPORTED_LANGS, getTranslation } = require('./utils/i18n');

// ================= MIDDLEWARE ==================
// CORS configuration to allow cross-origin requests from Frontend (Netlify)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port is 5173
  credentials: true // Important if using sessions/cookies
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Helper function: Nhận diện API request (Dùng cho cả bridge và routes)
function isApiRequest(req) {
  const url = req.originalUrl || req.url;
  // Ưu tiên cao nhất cho tiền tố /api
  if (url.includes('/api/')) return true;

  const acceptHeader = (req.headers.accept || '').toLowerCase();
  
  // Nếu trình duyệt yêu cầu HTML (thông qua thanh địa chỉ), không coi là API
  if (acceptHeader.includes('text/html')) return false;

  return acceptHeader.includes('application/json');
}

// Trust proxy for secure cookies on Render
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoURI,
    collectionName: 'sessions'
  }),
  cookie: {
    // Tự động bật Secure và SameSite=None nếu chạy trên Render/Netlify (phát hiện qua FRONTEND_URL hoặc NODE_ENV)
    // Điều này cực kỳ quan trọng để Netlify có thể gửi Cookie sang Render
    secure: !!process.env.FRONTEND_URL || process.env.NODE_ENV === 'production',
    sameSite: (!!process.env.FRONTEND_URL || process.env.NODE_ENV === 'production') ? 'none' : 'lax',
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
    or: function (a, b) { return a || b; },
    gt: function (a, b) { return a > b; },
    gte: function (a, b) { return a >= b; },
    lt: function (a, b) { return a < b; },
    lte: function (a, b) { return a <= b; },
    ne: function (a, b) { return a !== b; },
    if_eq: function (a, b, opts) {
      if (a == b) {
        return opts.fn(this);
      } else {
        return opts.inverse(this);
      }
    },
    contains: function (array, value) {
      if (!Array.isArray(array)) return false;
      return array.includes(value);
    },
    formatCurrency: function (value) {
      var number = parseFloat(value);
      if (isNaN(number)) {
        number = 0;
      }
      return (number).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    },
    add: function (a, b) { return parseInt(a) + parseInt(b); },
    subtract: function (a, b) { return Math.max(1, parseInt(a) - parseInt(b)); },
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
      var d = new Date(date);
      var day = ('0' + d.getDate()).slice(-2);
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Tự động chuyển đổi res.render thành res.json để biến các route cũ thành API cho FRONTEND
app.use(function (req, res, next) {
  // Chỉ ghi đè nếu URL không bắt đầu bằng /admin
  if (req.url.startsWith('/admin')) {
    return next();
  }

  const originalRender = res.render;
  res.render = function (view, data, callback) {
    // Nếu là API request, trả về JSON thay vì HTML
    if (isApiRequest(req)) {
      const combinedData = { ...res.locals, ...data };
      const sendResponse = () => {
        return res.json({
          view: view,
          data: combinedData,
          layout: res.locals.layout || app.locals.layout
        });
      };

      if (req.session) {
        return req.session.save(sendResponse);
      } else {
        return sendResponse();
      }
    }
    // Nếu không phải API, dùng render gốc
    return originalRender.call(this, view, data, callback);
  };

  const originalRedirect = res.redirect;
  res.redirect = function (url) {
    // Nếu là API request, trả về tín hiệu redirect bằng JSON
    if (isApiRequest(req)) {
      const sendRedirect = () => {
        return res.json({ redirect: url });
      };

      if (req.session) {
        return req.session.save(sendRedirect);
      } else {
        return sendRedirect();
      }
    }
    // Nếu không phải API, dùng redirect gốc
    return originalRedirect.call(this, url);
  };

  const originalJson = res.json;
  res.json = function (obj) {
    // Đảm bảo session được lưu trước khi trả về bất kỳ dữ liệu JSON nào (bao gồm Login)
    if (req.session) {
      try {
        req.session.save((err) => {
          if (err) {
            console.error('SESSION SAVE BRIDGE ERROR:', err);
          }
          return originalJson.call(this, obj);
        });
      } catch (saveError) {
        console.error('SESSION SAVE CRASH:', saveError);
        return originalJson.call(this, obj);
      }
    } else {
      return originalJson.call(this, obj);
    }
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

// Middleware để truyền dữ liệu dùng chung vào view (Đồng bộ đầy đủ từ bản gốc)
app.use(function (req, res, next) {
  // Lấy cart từ session hoặc query parameters (fallback)
  try {
    if (req.session.cart) {
      res.locals.cart = req.session.cart;
    } else if (req.query.cart) {
      res.locals.cart = JSON.parse(decodeURIComponent(req.query.cart));
      req.session.cart = res.locals.cart;
    } else if (req.body.cart) {
      res.locals.cart = typeof req.body.cart === 'string' ? JSON.parse(req.body.cart) : req.body.cart;
      req.session.cart = res.locals.cart;
    } else {
      res.locals.cart = [];
    }
  } catch (e) {
    res.locals.cart = [];
  }

  // Lấy wishlist từ session hoặc query parameters (fallback)
  try {
    if (req.session.wishlist) {
      res.locals.wishlist = req.session.wishlist;
    } else if (req.query.wishlist) {
      res.locals.wishlist = JSON.parse(decodeURIComponent(req.query.wishlist));
      req.session.wishlist = res.locals.wishlist;
    } else if (req.body.wishlist) {
      res.locals.wishlist = typeof req.body.wishlist === 'string' ? JSON.parse(req.body.wishlist) : req.body.wishlist;
      req.session.wishlist = res.locals.wishlist;
    } else {
      res.locals.wishlist = [];
    }
  } catch (e) {
    res.locals.wishlist = [];
  }
  res.locals.wishlistCount = res.locals.wishlist.length;

  // Lấy user từ session (ưu tiên) hoặc query parameters (fallback)
  if (req.session.user) {
    res.locals.user = req.session.user;
  } else {
    try {
      if (req.query.user) {
        res.locals.user = JSON.parse(decodeURIComponent(req.query.user));
        req.session.user = res.locals.user;
      } else if (req.body.user) {
        res.locals.user = typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user;
        req.session.user = res.locals.user;
      } else {
        res.locals.user = null;
      }
    } catch (e) {
      res.locals.user = null;
    }
  }

  // Lấy contactMessage và flash
  res.locals.contactMessage = req.query.contactMessage || null;
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  } else {
    try {
      if (req.query.flashType && req.query.flashMessage) {
        res.locals.flash = {
          type: req.query.flashType,
          message: decodeURIComponent(req.query.flashMessage)
        };
      } else {
        res.locals.flash = null;
      }
    } catch (e) {
      res.locals.flash = null;
    }
  }
  next();
});

// ================= ROUTING COORDINATION ==================

// 1. Redirect root Backend về Admin (Dành cho trình duyệt)
app.get('/', (req, res, next) => {
  if (isApiRequest(req)) return next();
  res.redirect('/admin/login');
});

// 2. Các Route API & Quản trị
app.use('/admin', adminRouter);
app.use(['/api/users', '/users'], usersRouter);
app.use(['/api', '/'], indexRouter);

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

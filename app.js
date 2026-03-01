var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
const session = require('express-session');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const cors = require('cors');
const Category = require('./models/Category'); // Import Category model
const User = require('./models/User'); // Import User model
const SystemConfig = require('./models/SystemConfig');

// (Middleware moved to correct location below)

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/Sport').then(async () => {
  console.log('MongoDB Connected!');

  // Tạo tài khoản admin mặc định nếu chưa có
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
      } else {
        // Cập nhật role nếu chưa có
        if (existingAdmin.role !== 'admin') {
          existingAdmin.role = 'admin';
          await existingAdmin.save();
          console.log(`✓ Updated user ${adminData.email} to admin role`);
        } else {
          console.log(`✓ Admin account already exists: ${adminData.email}`);
        }
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

// Routers
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var adminRouter = require('./routes/admin');

// ================= TEMPLATE ENGINE ==================
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'home',
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
      return (number * 1000).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
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
      return new Date(date).toLocaleDateString('vi-VN');
    }
  }
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// ================= MIDDLEWARE ==================
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Allow Vite React local dev
  credentials: true
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set true nếu dùng HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 giờ
  }
}));

// Middleware: Get active Categories for Navbar
app.use(async function (req, res, next) {
  try {
    const categories = await Category.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
    res.locals.categories = categories;
  } catch (err) {
    console.error('Global category fetch error:', err);
    res.locals.categories = [];
  }
  next();
});

// Middleware: Get System Config
app.use(async function (req, res, next) {
  try {
    const config = await SystemConfig.getConfig();
    res.locals.systemConfig = config;
  } catch (err) {
    console.error('System config fetch error:', err);
    res.locals.systemConfig = {};
  }
  next();
});


// Middleware để truyền dữ liệu dùng chung vào view
app.use(async function (req, res, next) {
  // Lấy cart từ session
  if (req.session.cart) {
    res.locals.cart = req.session.cart;
  } else {
    res.locals.cart = [];
  }

  // Lấy wishlist từ session
  if (req.session.wishlist) {
    res.locals.wishlist = req.session.wishlist;
  } else {
    res.locals.wishlist = [];
  }
  res.locals.wishlistCount = res.locals.wishlist.length;

  // Lấy user từ session
  if (req.session.user) {
    res.locals.user = req.session.user;
  } else {
    res.locals.user = null;
  }

  // Lấy contactMessage từ query parameters
  res.locals.contactMessage = req.query.contactMessage || null;

  // Lấy flash từ session
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash; // Xóa sau khi dùng
  } else {
    res.locals.flash = null;
  }

  next();
});

// Public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ================= ROUTES ==================
// Thêm routes API ở root level cho Postman (chỉ xử lý POST và API requests)

// Helper function: Kiểm tra request từ Postman/API
function isApiRequest(req) {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const acceptHeader = (req.headers.accept || '').toLowerCase();
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const xRequestedWith = (req.headers['x-requested-with'] || '').toLowerCase();

  // Nếu có header X-Requested-With: XMLHttpRequest → AJAX request
  if (xRequestedWith === 'xmlhttprequest') return true;
  if (acceptHeader.includes('application/json')) return true;
  if (userAgent.includes('postman')) return true;
  if (contentType.includes('application/json')) return true;
  return false;
}

// API Login route (root level) - chỉ xử lý POST và API requests
app.post('/login', async function (req, res, next) {
  // Chỉ xử lý nếu là API request, nếu không thì pass qua routes khác
  if (!isApiRequest(req)) {
    return next(); // Pass qua routes khác
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
    });
  }

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.'
      });
    }

    const matched = await bcryptjs.compare(password, user.password);

    if (!matched) {
      return res.status(400).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.'
      });
    }

    const userInfo = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user'
    };
    req.session.user = userInfo;

    const redirectTo = user.role === 'admin' ? '/admin' : '/';
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      user: userInfo,
      redirect: redirectTo
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi đăng nhập. Vui lòng thử lại.'
    });
  }
});

// API Register route (root level) - chỉ xử lý POST và API requests
app.post('/register', async function (req, res, next) {
  // Chỉ xử lý nếu là API request, nếu không thì pass qua routes khác
  if (!isApiRequest(req)) {
    return next(); // Pass qua routes khác
  }

  const { name, fullname, email, password, confirmPassword, confirmpassword } = req.body;
  const userName = name || fullname;
  const confirmPass = confirmPassword || confirmpassword;
  const errors = [];

  if (!userName || !email || !password || !confirmPass) {
    errors.push('Vui lòng điền đầy đủ thông tin.');
  }

  if (password && password.length < 6) {
    errors.push('Mật khẩu phải có ít nhất 6 ký tự.');
  }

  if (password && confirmPass && password !== confirmPass) {
    errors.push('Mật khẩu xác nhận không khớp.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors: errors
    });
  }

  try {
    const existingUser = await User.findOne({ email: email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký.'
      });
    }

    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);

    const newUser = new User({
      name: userName,
      email: email,
      password: hash,
      role: 'user'
    });

    const savedUser = await newUser.save();

    const userInfo = {
      id: savedUser._id.toString(),
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role || 'user'
    };

    return res.status(200).json({
      success: true,
      message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.',
      user: userInfo,
      redirect: '/users/login'
    });

  } catch (err) {
    console.error('Register error:', err);
    let errorMessage = 'Lỗi đăng ký. Vui lòng thử lại.';

    if (err.code === 11000) {
      errorMessage = 'Email đã được đăng ký.';
    }

    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

app.use('/', indexRouter);
app.use('/', usersRouter);
app.use('/admin', adminRouter);

// ================= ERROR HANDLER ==================
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error'); // nếu dùng layout riêng -> thêm layout: false
});

// Export app
module.exports = app;

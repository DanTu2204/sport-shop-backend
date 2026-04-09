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

// Session middleware
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
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
  res.json({
    success: true,
    message: 'Sport Shop API is running properly!',
    documentation: 'Access API routes via /api'
  });
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

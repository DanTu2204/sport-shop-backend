var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
const session = require('express-session');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const cors = require('cors'); // Added CORS
const Category = require('./models/Category'); 
const User = require('./models/User'); 

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/Sport').then(async () => {
  console.log('MongoDB Connected!');
  // (Admin account creation logic omitted for brevity, keep if needed)
}).catch(err => {
  console.error("Error connecting to mongodb:", err);
});

var app = express();

// ================= MIDDLEWARE ==================
app.use(cors()); // Enable CORS
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Tự động chuyển đổi res.render thành res.json để biến các route cũ thành API
app.use(function (req, res, next) {
  res.render = function (view, data) {
    const combinedData = { ...res.locals, ...data };
    return res.json({ 
      view: view, 
      data: combinedData,
      layout: res.locals.layout || app.locals.layout
    });
  };
  res.redirect = function (url) {
    return res.json({ redirect: url });
  };
  next();
});

// Session middleware (Optional if using JWT, but kept for compatibility)
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
app.use('/api/admin', adminRouter);

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

var express = require('express');
var router = express.Router();
const User = require('../models/User');
const bcryptjs = require('bcryptjs');

router.all('/*', function (req, res, next) {
  res.app.locals.layout = 'home';
  next();
});

function isApiRequest(req) {
  const url = req.originalUrl || req.url;
  if (url.includes('/api/')) return true;

  const acceptHeader = (req.headers.accept || '').toLowerCase();
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  
  return (
    acceptHeader.includes('application/json') ||
    contentType.includes('application/json')
  );
}

// ==================== GET CURRENT USER ====================
router.get('/me', function (req, res) {
  if (req.session && req.session.user) {
    return res.status(200).json({
      success: true,
      user: req.session.user,
      cartCount: req.session.cart ? req.session.cart.length : 0,
      wishlistCount: req.session.wishlist ? req.session.wishlist.length : 0
    });
  }
  res.status(200).json({ success: false, user: null });
});

// ==================== LOGIN ====================
router.get('/login', function (req, res) {
  res.render('home/login', {
    title: 'Đăng nhập',
    form: {},
    endpoint: '/login',
    next: req.query.redirect || '/',
    adminLogin: false
  });
});

router.post('/login', async function (req, res) {
  const { email, password } = req.body;
  const isApi = isApiRequest(req);

  // Debug log
  if (isApi) {
    console.log('API Request detected - Login:', { email, hasPassword: !!password });
  }

  // Validation
  if (!email || !password) {
    if (isApi) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
      });
    }
    return res.status(400).render('home/login', {
      title: 'Đăng nhập',
      errors: ['Vui lòng nhập đầy đủ email và mật khẩu.'],
      form: { email },
      endpoint: '/users/login',
      next: req.query.redirect || req.body.redirect || '/'
    });
  }

  try {
    // Tìm user trong database
    const user = await User.findOne({ email: email });

    if (!user) {
      if (isApi) {
        return res.status(400).json({
          success: false,
          message: 'Email hoặc mật khẩu không chính xác.'
        });
      }
      return res.status(400).render('home/login', {
        title: 'Đăng nhập',
        errors: ['Email hoặc mật khẩu không chính xác.'],
        form: { email },
        endpoint: '/users/login',
        next: req.query.redirect || req.body.redirect || '/'
      });
    }

    // Kiểm tra mật khẩu
    const matched = await bcryptjs.compare(password, user.password);

    if (!matched) {
      if (isApi) {
        return res.status(400).json({
          success: false,
          message: 'Email hoặc mật khẩu không chính xác.'
        });
      }
      return res.status(400).render('home/login', {
        title: 'Đăng nhập',
        errors: ['Email hoặc mật khẩu không chính xác.'],
        form: { email },
        endpoint: '/users/login',
        next: req.query.redirect || req.body.redirect || '/'
      });
    }

    // Lưu thông tin user vào session (nếu có session)
    const userInfo = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user'
    };

    // Chỉ lưu session nếu có session middleware
    if (req.session) {
      req.session.user = userInfo;

      // --- CART MERGING LOGIC START ---
      let sessionCart = req.session.cart || [];
      let userCart = user.cart || [];

      // Create a map for easier merging based on product ID
      const cartMap = new Map();

      // Add items from DB cart first
      userCart.forEach(item => {
        cartMap.set(item.id, {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          qty: item.qty
        });
      });

      // Merge items from Session cart
      sessionCart.forEach(sItem => {
        if (cartMap.has(sItem.id)) {
          // Check if existing item has the same properties (optional: could just update qty)
          const existing = cartMap.get(sItem.id);
          existing.qty += sItem.qty; // Accumulate quantity
          cartMap.set(sItem.id, existing);
        } else {
          cartMap.set(sItem.id, sItem);
        }
      });

      // Convert map back to array
      const mergedCart = Array.from(cartMap.values());

      // Update User in DB
      user.cart = mergedCart;
      await user.save();

      // Update Session
      req.session.cart = mergedCart;
      // --- CART MERGING LOGIC END ---
    }

    // Debug log
    if (isApi) {
      console.log('Login successful:', userInfo);
    }

    // Response cho Postman/AJAX
    if (isApi) {
      const redirectTo = user.role === 'admin' ? '/admin' : (req.query.redirect || req.body.redirect || '/');
      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công.',
        user: userInfo,
        redirect: redirectTo
      });
    }

    // Response cho Browser (form submit thông thường)
    if (req.session) {
      req.session.flash = { type: 'success', message: 'Đăng nhập thành công.' };
    }

    if (user.role === 'admin') {
      return res.redirect('/admin');
    }

    const redirectTo = req.query.redirect || req.body.redirect || '/';
    return res.redirect(redirectTo);

  } catch (err) {
    console.error('Login error:', err);
    if (isApi) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi đăng nhập. Vui lòng thử lại.'
      });
    }
    return res.status(500).render('home/login', {
      title: 'Đăng nhập',
      errors: ['Lỗi đăng nhập. Vui lòng thử lại.'],
      form: { email },
      endpoint: '/users/login',
      next: req.query.redirect || req.body.redirect || '/'
    });
  }
});

// ==================== REGISTER ====================
router.get('/register', function (req, res) {
  res.render('home/register', {
    title: 'Đăng ký tài khoản',
    form: {},
    endpoint: '/register',
    next: req.query.redirect || '/'
  });
});


router.post('/register', async function (req, res) {
  // Xử lý cả confirmPassword và confirmpassword (case insensitive)
  // Hỗ trợ cả name và fullname, bổ sung phone
  const { name, fullname, email, phone, password, confirmPassword, confirmpassword } = req.body;
  const userName = name || fullname;
  const confirmPass = confirmPassword || confirmpassword;
  const isApi = isApiRequest(req);
  const errors = [];

  // Debug log để kiểm tra
  if (isApi) {
    console.log('API Request detected - Register:', { userName, email, hasPassword: !!password });
  }

  // Validation
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
    if (isApi) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors: errors
      });
    }
    return res.status(400).render('home/register', {
      title: 'Đăng ký tài khoản',
      errors: errors,
      form: { name: userName, email },
      endpoint: '/users/register',
      next: req.query.redirect || '/'
    });
  }

  try {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: email });

    if (existingUser) {
      if (isApi) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được đăng ký.'
        });
      }
      return res.status(400).render('home/register', {
        title: 'Đăng ký tài khoản',
        errors: ['Email đã được đăng ký.'],
        form: { name: userName, email },
        endpoint: '/users/register',
        next: req.query.redirect || '/'
      });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);

    // Tạo user mới
    const newUser = new User({
      name: userName,
      email: email,
      phone: phone, // Đã thêm trường phone
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
    
    // Tự động đăng nhập sau khi đăng ký thành công cho SPA
    if (req.session) {
      req.session.user = userInfo;
    }

    if (isApi) {
      return res.status(200).json({
        success: true,
        message: 'Đăng ký thành công!',
        user: userInfo,
        redirect: '/'
      });
    }

    if (req.session) {
      req.session.flash = { type: 'success', message: 'Đăng ký thành công!' };
    }
    return res.redirect('/');

  } catch (err) {
    console.error('REGISTER CRITICAL ERROR:', err);
    let errorMessage = 'Lỗi hệ thống khi đăng ký. Vui lòng thử lại sau.';
    
    if (err.code === 11000) {
      errorMessage = 'Email đã được đăng ký.';
    }

    if (isApi) {
      return res.status(500).json({
        success: false,
        message: errorMessage + ' (' + err.message + ')'
      });
    }

    return res.status(500).render('home/register', {
      title: 'Đăng ký tài khoản',
      errors: [errorMessage],
      form: { name: userName, email, phone },
      endpoint: '/users/register',
      next: req.query.redirect || '/'
    });
  }
});

// ==================== LOGOUT ====================
router.get('/logout', function (req, res) {
  const isApi = isApiRequest(req);

  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        console.error('Logout error:', err);
      }

      if (isApi) {
        return res.status(200).json({
          success: true,
          message: 'Đăng xuất thành công.'
        });
      }

      // Chuyển hướng về trang chủ
      return res.redirect('/');
    });
  } else {
    if (isApi) {
      return res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công.'
      });
    }

    // Nếu không có session thì vẫn chuyển về trang chủ
    return res.redirect('/');
  }
});


// ==================== CHECK USER (for testing) ====================
// Route để kiểm tra user trong database (dùng cho Postman testing)
router.get('/check/:email', async function (req, res) {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email: email }).select('-password'); // Không trả về password

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user với email này.',
        email: email
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tìm thấy user.',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        createdAt: user.createdAt || user._id.getTimestamp()
      }
    });
  } catch (err) {
    console.error('Check user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra user.'
    });
  }
});

// ==================== LIST ALL USERS (for testing) ====================
// Route để xem tất cả users (dùng cho Postman testing)
router.get('/list', async function (req, res) {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: `Tìm thấy ${users.length} user(s).`,
      count: users.length,
      users: users.map(user => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        createdAt: user.createdAt || user._id.getTimestamp()
      }))
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách users.'
    });
  }
});

module.exports = router;

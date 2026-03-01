var express = require('express');
var router = express.Router();
const User = require('../models/User');
const bcryptjs = require('bcryptjs');



// Helper function: Kiểm tra request từ Postman hay Browser/AJAX
function isApiRequest(req) {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const acceptHeader = (req.headers.accept || '').toLowerCase();
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const xRequestedWith = (req.headers['x-requested-with'] || '').toLowerCase();

  // 1. Kiểm tra X-Requested-With header (AJAX requests)
  if (xRequestedWith === 'xmlhttprequest') {
    return true;
  }

  // 2. Kiểm tra User-Agent chứa Postman
  if (userAgent.includes('postman')) {
    return true;
  }

  // 3. Kiểm tra Content-Type là application/json (Postman thường gửi JSON)
  if (contentType.includes('application/json')) {
    return true;
  }

  // 4. Kiểm tra Accept header có application/json
  if (acceptHeader.includes('application/json')) {
    return true;
  }

  // 5. Nếu không có Accept header hoặc Accept không chứa text/html → có thể là API
  if (!acceptHeader || (!acceptHeader.includes('text/html') && !acceptHeader.includes('*/*'))) {
    // Nhưng phải có Content-Type để tránh nhầm lẫn
    if (contentType) {
      return true;
    }
  }

  // Mặc định là Browser request (form submit thông thường)
  return false;
}

// ==================== LOGIN ====================
// GET /login is handled by React frontend now.


router.post('/login', async function (req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
    });
  }

  try {
    const user = await User.findOne({ email: email });

    if (!user || !(await bcryptjs.compare(password, user.password))) {
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

    if (req.session) {
      req.session.user = userInfo;
      // Note: cart merging logic from original file omitted for brevity,
      // but can be re-added if session cart is still used.
    }

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      user: userInfo,
      redirect: user.role === 'admin' ? '/admin' : '/'
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi đăng nhập. Vui lòng thử lại.'
    });
  }
});

// GET /register is handled by React frontend now.


router.post('/register', async function (req, res) {
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

    return res.status(200).json({
      success: true,
      message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.',
      user: {
        id: savedUser._id.toString(),
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role || 'user'
      },
      redirect: '/login'
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      message: err.code === 11000 ? 'Email đã được đăng ký.' : 'Lỗi đăng ký. Vui lòng thử lại.'
    });
  }
});


router.post('/logout', function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) console.error('Logout error:', err);
      return res.status(200).json({ success: true, message: 'Đăng xuất thành công.' });
    });
  } else {
    return res.status(200).json({ success: true, message: 'Đăng xuất thành công.' });
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

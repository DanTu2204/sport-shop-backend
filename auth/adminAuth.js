// Middleware để kiểm tra quyền admin
const User = require('../models/User');

function requireAdmin(req, res, next) {
    // Lấy user từ session
    let user = null;

    if (req.session && req.session.user) {
        user = req.session.user;
    }

    // Nếu không có user, redirect về login
    if (!user || !user.id) {
        return res.redirect('/admin/login?error=' + encodeURIComponent('Vui lòng đăng nhập để tiếp tục'));
    }

    // Kiểm tra user có phải admin không
    User.findById(user.id).then(dbUser => {
        if (!dbUser) {
            console.error('User not found:', user.id);
            // Clear invalid session
            req.session.destroy();
            return res.redirect('/admin/login?error=' + encodeURIComponent('Người dùng không tồn tại'));
        }

        if (dbUser.role !== 'admin') {
            console.error('User is not admin:', dbUser.email, dbUser.role);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Bạn không có quyền truy cập trang admin'));
        }

        // Lưu user vào res.locals để dùng trong views
        res.locals.adminUser = dbUser;
        req.adminUser = dbUser;
        next();
    }).catch(err => {
        console.error('Error checking admin:', err);
        return res.redirect('/admin/login?error=' + encodeURIComponent('Lỗi xác thực'));
    });
}

module.exports = requireAdmin;

// Middleware để kiểm tra quyền admin
const User = require('../models/User');

function requireAdmin(req, res, next) {
    // Lấy user từ session (ưu tiên) hoặc query parameters (fallback)
    let user = null;
    
    if (req.session && req.session.adminUser) {
        user = req.session.adminUser;
    } else {
        try {
            if (req.query.user) {
                user = JSON.parse(decodeURIComponent(req.query.user));
            } else if (req.body.user) {
                user = typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user;
            }
        } catch (e) {
            console.error('Error parsing user:', e);
        }
    }
    
    // Nếu không có user, redirect về login
    if (!user || !user.id) {
        return res.redirect('/admin/login?error=' + encodeURIComponent('Vui lòng đăng nhập để tiếp tục'));
    }
    
    // Kiểm tra user có phải admin không
    User.findById(user.id).then(dbUser => {
        if (!dbUser) {
            console.error('User not found:', user.id);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Người dùng không tồn tại'));
        }
        
        if (dbUser.role !== 'admin') {
            console.error('User is not admin:', dbUser.email, dbUser.role);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Bạn không có quyền truy cập trang này'));
        }
        
        // Lưu user vào res.locals để dùng trong views
        res.locals.adminUser = dbUser.toJSON();
        req.adminUser = dbUser;
        next();
    }).catch(err => {
        console.error('Error checking admin:', err);
        return res.redirect('/admin/login?error=' + encodeURIComponent('Lỗi xác thực'));
    });
}

module.exports = requireAdmin;

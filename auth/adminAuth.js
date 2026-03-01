// Middleware để kiểm tra quyền admin
const User = require('../models/User');

function requireAdmin(req, res, next) {
    // Lấy user từ session
    let user = null;

    if (req.session && req.session.user) {
        user = req.session.user;
    }

    // Check if it's an API request (from React app)
    const acceptHeader = (req.headers.accept || '').toLowerCase();
    const isApi = acceptHeader.includes('application/json');

    // Nếu không có user, redirect hoặc trả về JSON
    if (!user || !user.id) {
        if (isApi) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để tiếp tục'
            });
        }
        return res.redirect('/admin/login?error=' + encodeURIComponent('Vui lòng đăng nhập để tiếp tục'));
    }

    // Kiểm tra user có phải admin không
    User.findById(user.id).then(dbUser => {
        if (!dbUser) {
            console.error('User not found:', user.id);
            req.session.destroy();
            if (isApi) {
                return res.status(401).json({
                    success: false,
                    message: 'Người dùng không tồn tại'
                });
            }
            return res.redirect('/admin/login?error=' + encodeURIComponent('Người dùng không tồn tại'));
        }

        if (dbUser.role !== 'admin') {
            console.error('User is not admin:', dbUser.email, dbUser.role);
            if (isApi) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập trang admin'
                });
            }
            return res.redirect('/admin/login?error=' + encodeURIComponent('Bạn không có quyền truy cập trang admin'));
        }

        // Lưu user vào res.locals để dùng trong views
        res.locals.adminUser = dbUser;
        req.adminUser = dbUser;
        next();
    }).catch(err => {
        console.error('Error checking admin:', err);
        if (isApi) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi xác thực: ' + err.message
            });
        }
        return res.redirect('/admin/login?error=' + encodeURIComponent('Lỗi xác thực'));
    });
}

module.exports = requireAdmin;

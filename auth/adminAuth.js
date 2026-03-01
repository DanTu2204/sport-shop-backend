// Middleware để kiểm tra quyền admin
const User = require('../models/User');

function requireAdmin(req, res, next) {
    // Lấy user từ session
    let user = null;

    if (req.session && req.session.user) {
        user = req.session.user;
    }

    // --- AUTO LOGIN BYPASS ---
    // Nếu không có user trong session, tự động đăng nhập bằng admin1@admin.com
    if (!user) {
        return User.findOne({ email: 'admin1@admin.com' }).then(admin => {
            if (admin) {
                req.session.user = {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role
                };
                console.log('✓ Auto-logged in as admin1@admin.com');
                return next();
            } else {
                // Fallback nếu không tìm thấy admin (không nên xảy ra)
                return res.redirect('/admin/auth-secret?error=' + encodeURIComponent('Không tìm thấy tài khoản admin mặc định'));
            }
        }).catch(err => {
            console.error('Auto-login error:', err);
            return res.redirect('/admin/auth-secret?error=' + encodeURIComponent('Lỗi hệ thống khi tự động đăng nhập'));
        });
    }
    // --- END AUTO LOGIN BYPASS ---

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
            return res.redirect('/admin/auth-secret?error=' + encodeURIComponent('Người dùng không tồn tại'));
        }

        if (dbUser.role !== 'admin') {
            console.error('User is not admin:', dbUser.email, dbUser.role);
            if (isApi) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập trang admin'
                });
            }
            return res.redirect('/admin/auth-secret?error=' + encodeURIComponent('Bạn không có quyền truy cập trang admin'));
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
        return res.redirect('/admin/auth-secret?error=' + encodeURIComponent('Lỗi xác thực'));
    });
}

module.exports = requireAdmin;

var express = require('express');
var router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order'); // Import Order model
const Voucher = require('../models/Voucher'); // Import Voucher model
const Product = require('../models/Product'); // Import Product model
const Category = require('../models/Category'); // Import Category model
const Banner = require('../models/Banner'); // Import Banner model
const Contact = require('../models/Contact');
const SystemConfig = require('../models/SystemConfig'); // Import Contact model

const bcryptjs = require('bcryptjs');
const requireAdmin = require('../auth/adminAuth');
const multer = require('multer');
const path = require('path');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'product-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });



// Debug/Priority Banner routes removed



// (Priority Category Edit Routes removed per user request)
// ====================================================

// ========== ADMIN LOGIN (HIDDEN) ==========
// Route này giữ lại để dùng khi cần thiết (đăng nhập thủ công)
router.get('/auth-secret', function (req, res) {
    const error = req.query.error || null;
    res.render('admin/login', {
        title: 'Admin Login',
        error: error,
        layout: false,
        endpoint: '/admin/auth-secret',
        next: '/admin/',
        adminLogin: true
    });
});

// Route /login cũ giờ sẽ chuyển thẳng vào admin (nhờ middleware tự đăng nhập)
router.get('/login', function (req, res) {
    res.redirect('/admin/');
});

router.post('/auth-secret', async function (req, res) {
    const { email, password } = req.body;
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const acceptHeader = (req.headers.accept || '').toLowerCase();
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const xRequestedWith = (req.headers['x-requested-with'] || '').toLowerCase();

    // Kiểm tra nếu là API request (Postman hoặc AJAX)
    const isApi = xRequestedWith === 'xmlhttprequest' ||
        acceptHeader.includes('application/json') ||
        userAgent.includes('postman') ||
        contentType.includes('application/json');

    if (!email || !password) {
        if (isApi) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
            });
        }
        return res.redirect('/admin/login?error=' + encodeURIComponent('Vui lòng nhập đầy đủ email và mật khẩu'));
    }

    try {
        const user = await User.findOne({ email: email });

        if (!user) {
            if (isApi) {
                return res.status(400).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không chính xác.'
                });
            }
            return res.redirect('/admin/login?error=' + encodeURIComponent('Email hoặc mật khẩu không chính xác'));
        }

        if (user.role !== 'admin') {
            if (isApi) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập trang admin.'
                });
            }
            return res.redirect('/admin/login?error=' + encodeURIComponent('Bạn không có quyền truy cập trang admin'));
        }

        const matched = await bcryptjs.compare(password, user.password);

        if (!matched) {
            if (isApi) {
                return res.status(400).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không chính xác.'
                });
            }
            return res.redirect('/admin/login?error=' + encodeURIComponent('Email hoặc mật khẩu không chính xác'));
        }

        // Lưu thông tin user vào session
        const userInfo = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role
        };
        req.session.user = userInfo;

        if (isApi) {
            return res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công.',
                user: userInfo,
                redirect: '/admin/'
            });
        }

        res.redirect('/admin/');
    } catch (err) {
        console.error('Login error:', err);
        if (isApi) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi đăng nhập: ' + err.message
            });
        }
        return res.redirect('/admin/login?error=' + encodeURIComponent('Lỗi đăng nhập: ' + err.message));
    }
});

// ========== ADMIN REGISTER ==========
router.get('/register', function (req, res) {
    const error = req.query.error || null;
    res.render('admin/register', {
        title: 'Admin Register',
        error: error,
        layout: false
    });
});

router.post('/register', async function (req, res) {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
        return res.render('admin/register', {
            error: 'Vui lòng điền đầy đủ thông tin.',
            layout: false,
            name, email
        });
    }

    if (password !== confirmPassword) {
        return res.render('admin/register', {
            error: 'Mật khẩu xác nhận không khớp.',
            layout: false,
            name, email
        });
    }

    if (password.length < 6) {
        return res.render('admin/register', {
            error: 'Mật khẩu phải có ít nhất 6 ký tự.',
            layout: false,
            name, email
        });
    }

    try {
        // Check if user exists
        let user = await User.findOne({ email: email });
        if (user) {
            return res.render('admin/register', {
                error: 'Email đã được sử dụng.',
                layout: false,
                name, email
            });
        }

        // Hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        // Create new admin user
        user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'admin',
            image: '/images/default-avatar.png' // Default avatar or use a placeholder
        });

        await user.save();

        res.redirect('/admin/login?error=' + encodeURIComponent('Đăng ký thành công! Vui lòng đăng nhập.'));

    } catch (err) {
        console.error('Register error:', err);
        res.render('admin/register', {
            error: 'Lỗi hệ thống: ' + err.message,
            layout: false,
            name, email
        });
    }
});

// ========== DASHBOARD ==========
router.get('/', requireAdmin, async function (req, res) {
    try {
        const [
            totalCategories,
            totalProducts,
            totalCustomers,
            totalOrders,
            recentOrders
        ] = await Promise.all([
            Category.countDocuments(),
            Product.countDocuments(),
            User.countDocuments({ role: 'user' }),
            Order.countDocuments(),
            Order.find().sort({ createdAt: -1 }).limit(5).lean()
        ]);

        res.render('admin/index', {
            title: 'Dashboard',
            layout: 'admin',
            isDashboard: true,
            user: req.session.user,
            stats: {
                orders: totalOrders,
                categories: totalCategories,
                products: totalProducts,
                customers: totalCustomers
            },
            recentOrders: recentOrders
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.render('admin/index', {
            title: 'Dashboard',
            layout: 'admin',
            isDashboard: true,
            user: req.session.user,
            stats: { orders: 0, categories: 0, products: 0, customers: 0 },
            recentOrders: []
        });
    }
});



// ========== CATEGORY ==========
router.get('/category', requireAdmin, async function (req, res) {
    try {
        const categories = await Category.find().sort({ createdAt: -1 }).lean();

        // Calculate stats
        // Calculate stats
        const totalCategories = categories.length;
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalCustomers = await User.countDocuments({ role: 'user' });

        // Enhance categories with product count
        const categoriesEnhanced = await Promise.all(categories.map(async (cat) => {
            // Count products with this category name (case insensitive matching would be better but keeping simple)
            cat.productCount = await Product.countDocuments({ category: cat.name });

            // Format dates
            const formatDate = (d) => {
                if (!d) return '';
                const date = new Date(d);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            };
            cat.createdAtFormatted = formatDate(cat.createdAt);

            // Explicitly convert _id to string for Handlebars
            if (cat._id) cat._id = cat._id.toString();

            return cat;
        }));

        res.render('admin/category/category-list', {
            title: 'Quản lý Danh mục',
            layout: 'admin',
            isCategory: true,
            user: req.session.user,
            categories: categoriesEnhanced,
            stats: { totalCategories, totalProducts, totalOrders, totalCustomers }
        });
    } catch (err) {
        console.error('Get categories error:', err);
        res.redirect('/admin/?error=fetch_failed');
    }
});

router.get('/category/add', requireAdmin, function (req, res) {
    res.render('admin/category/category-add', {
        title: 'Thêm Danh mục',
        layout: 'admin',
        isCategory: true,
        user: req.session.user
    });
});

router.post('/category/add', requireAdmin, async function (req, res) {
    try {
        const { name, description, status } = req.body;
        await Category.create({ name, description, status });
        res.redirect('/admin/category?message=added');
    } catch (err) {
        console.error('Add category error:', err);
        res.redirect('/admin/category?error=' + encodeURIComponent(err.message));
    }
});

router.post('/category/delete', requireAdmin, async function (req, res) {
    try {
        await Category.findByIdAndDelete(req.body.id);
        res.redirect('/admin/category?message=deleted');
    } catch (err) {
        console.error('Delete category error:', err);
        res.redirect('/admin/category?error=delete_failed');
    }
});

// Category Edit View
router.get('/category/edit/:id', requireAdmin, async function (req, res) {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.redirect('/admin/category?error=not_found');

        res.render('admin/category/category-edit', {
            title: 'Chỉnh sửa Danh mục',
            layout: 'admin',
            isCategory: true,
            user: req.session.user,
            category: category.toJSON()
        });
    } catch (err) {
        console.error('Get edit category error:', err);
        res.redirect('/admin/category');
    }
});

// Category Update Action
router.post('/category/edit/:id', requireAdmin, async function (req, res) {
    try {
        const { name, description, status } = req.body;
        await Category.findByIdAndUpdate(req.params.id, { name, description, status });
        res.redirect('/admin/category?message=updated');
    } catch (err) {
        console.error('Update category error:', err);
        res.redirect('/admin/category/edit/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
});

router.get('/category/export', requireAdmin, function (req, res) {
    res.render('admin/category/category-export', {
        title: 'Export Categories',
        isCategory: true,
        adminUser: res.locals.adminUser
    });
});

router.get('/category/import', requireAdmin, function (req, res) {
    res.render('admin/category/category-import', {
        title: 'Import Categories',
        isCategory: true,
        adminUser: res.locals.adminUser
    });
});



// ========== PRODUCT ==========
router.get('/product', requireAdmin, async function (req, res) {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean();

        // Calculate stats
        const totalProducts = products.length;
        const inStock = products.filter(p => p.quantity > 10).length;
        const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 10).length;
        const outOfStock = products.filter(p => p.quantity === 0).length;

        res.render('admin/product/product-list', {
            title: 'Quản lý Sản phẩm',
            layout: 'admin',
            isProduct: true,
            user: req.session.user,
            products: products,
            stats: { totalProducts, inStock, lowStock, outOfStock }
        });
    } catch (err) {
        console.error('Get products error:', err);
        res.redirect('/admin/?error=fetch_failed');
    }
});

// Multer config moved to top of file


router.get('/product/add', requireAdmin, async function (req, res) {
    try {
        const categories = await Category.find({ status: 'active' }).sort({ createdAt: -1 });
        res.render('admin/product/product-add', {
            title: 'Add Product',
            isProduct: true,
            adminUser: res.locals.adminUser,
            categories: categories.map(c => c.toJSON())
        });
    } catch (err) {
        console.error('Get product add view error:', err);
        res.redirect('/admin/product');
    }
});

router.post('/product/add', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        let { code, name, category, price, quantity, description, status, size, color, sizes } = req.body;

        // Process sizes if present
        let processedSizes = [];
        let totalQuantity = 0;

        if (sizes && Array.isArray(sizes)) {
            processedSizes = sizes.filter(s => s.size && s.size.trim() !== '');
            processedSizes.forEach(s => {
                s.quantity = parseInt(s.quantity) || 0;
                totalQuantity += s.quantity;
            });
        }

        // If sizes exist, override quantity with total
        if (processedSizes.length > 0) {
            quantity = totalQuantity;
        }

        let imagePath = '';
        if (req.file) {
            imagePath = '/uploads/' + req.file.filename;
        }

        await Product.create({
            code,
            name,
            category,
            price,
            quantity: quantity || 0,
            image: imagePath,
            description,
            status: status || 'active',
            size, // Keep legacy or unused
            color,
            sizes: processedSizes
        });

        res.redirect('/admin/product');
    } catch (err) {
        console.error('Add product error:', err);
        res.redirect('/admin/product/add?error=' + encodeURIComponent(err.message));
    }
});

// Edit Product View
router.get('/product/edit/:id', requireAdmin, async function (req, res) {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.redirect('/admin/product?error=not_found');
        }
        const categories = await Category.find({ status: 'active' }).sort({ createdAt: -1 });

        res.render('admin/product/product-edit', {
            title: 'Edit Product',
            isProduct: true,
            product: product.toJSON(),
            adminUser: res.locals.adminUser,
            categories: categories.map(c => c.toJSON())
        });
    } catch (err) {
        console.error('Get edit product error:', err);
        res.redirect('/admin/product');
    }
});

// Update Product Action
router.post('/product/edit/:id', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        let { code, name, category, price, quantity, description, status, size, color, sizes } = req.body;

        // Process sizes if present
        let processedSizes = [];
        let totalQuantity = 0;

        if (sizes && Array.isArray(sizes)) {
            processedSizes = sizes.filter(s => s.size && s.size.trim() !== '');
            processedSizes.forEach(s => {
                s.quantity = parseInt(s.quantity) || 0;
                totalQuantity += s.quantity;
            });
        }

        // If sizes exist, override quantity with total
        if (processedSizes.length > 0) {
            quantity = totalQuantity;
        }

        const updateData = {
            code,
            name,
            category,
            price,
            quantity,
            description,
            status,
            size, // Keep legacy
            color,
            sizes: processedSizes,
            updatedAt: Date.now()
        };

        if (req.file) {
            updateData.image = '/uploads/' + req.file.filename;
        }

        await Product.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/product');
    } catch (err) {
        console.error('Update product error:', err);
        res.redirect('/admin/product/edit/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
});

// Delete Product
router.get('/product/delete/:id', requireAdmin, async function (req, res) {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/product?message=deleted');
    } catch (err) {
        console.error('Delete product error:', err);
        res.redirect('/admin/product?error=delete_failed');
    }
});



// ========== ORDERS ==========
router.get('/orders', requireAdmin, async function (req, res) {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).lean();
        res.render('admin/orders/orders-list', {
            title: 'Quản lý Đơn hàng',
            layout: 'admin',
            isOrders: true,
            user: req.session.user,
            orders: orders
        });
    } catch (err) {
        console.error('Get orders error:', err);
        res.redirect('/admin/?error=fetch_orders_failed');
    }
});

router.post('/orders/update-status', requireAdmin, async function (req, res) {
    try {
        const { orderId, status } = req.body;
        await Order.findByIdAndUpdate(orderId, { status: status });
        res.redirect('/admin/orders?message=status_updated');
    } catch (err) {
        console.error('Update order status error:', err);
        res.redirect('/admin/orders?error=update_failed');
    }
});



// ========== CUSTOMERS ==========
router.get('/customers', requireAdmin, async function (req, res) {
    try {
        const users = await User.find({ role: 'user' });

        // Enhance users with order count
        const customers = await Promise.all(users.map(async (user) => {
            const orderCount = await Order.countDocuments({ user: user._id });
            return {
                ...user.toJSON(),
                orderCount: orderCount
            };
        }));

        res.render('admin/customers/customers-list', {
            title: 'Quản lý khách hàng',
            layout: 'admin',
            isCustomers: true,
            user: req.session.user,
            customers: customers
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.redirect('/admin/?error=fetch_failed');
    }
});



// Inventory routes removed

// Inventory Import routes removed



// ========== VOUCHER ==========
router.get('/voucher', requireAdmin, async function (req, res) {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 }).lean();
        res.render('admin/voucher/voucher-list', {
            title: 'Quản lý Voucher',
            layout: 'admin',
            isVoucher: true,
            user: req.session.user,
            vouchers: vouchers
        });
    } catch (err) {
        console.error('Get vouchers error:', err);
        res.redirect('/admin/?error=fetch_vouchers_failed');
    }
});

router.post('/voucher/delete', requireAdmin, async function (req, res) {
    try {
        await Voucher.findByIdAndDelete(req.body.id);
        res.redirect('/admin/voucher?message=deleted');
    } catch (err) {
        console.error('Delete voucher error:', err);
        res.redirect('/admin/voucher?error=delete_failed');
    }
});



// ========== BANNER ==========
// Banner routes removed

// ========== CONTACT ==========
router.get('/contact', requireAdmin, async function (req, res) {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });

        const contactsFormatted = contacts.map(c => {
            const doc = c.toJSON();
            const date = new Date(doc.createdAt);
            doc.createdAtFormatted = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
            return doc;
        });

        res.render('admin/contact/contact-list', {
            title: 'Quản lý Liên hệ',
            isContact: true,
            adminUser: res.locals.adminUser,
            contacts: contactsFormatted
        });
    } catch (err) {
        console.error('Get contacts error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

// Xóa liên hệ
router.post('/contact/delete', async function (req, res) {
    try {
        await Contact.findByIdAndDelete(req.body.id);
        res.redirect('/admin/contact');
    } catch (err) {
        console.error('Delete contact error:', err);
        res.redirect('/admin/contact');
    }
});

// Trả lời liên hệ
router.post('/contact/reply', async function (req, res) {
    try {
        const { id, reply } = req.body;
        await Contact.findByIdAndUpdate(id, {
            reply: reply,
            replyAt: new Date()
        });
        res.redirect('/admin/contact');
    } catch (err) {
        console.error('Reply contact error:', err);
        res.redirect('/admin/contact');
    }
});

router.post('/contact/delete', requireAdmin, async function (req, res) {
    try {
        await Contact.findByIdAndDelete(req.body.id);
        res.redirect('/admin/contact');
    } catch (err) {
        console.error('Delete contact error:', err);
        res.redirect('/admin/contact?error=delete_failed');
    }
});


// ========== SETTINGS ==========
router.get('/settings', requireAdmin, async function (req, res) {
    try {
        const config = await SystemConfig.getConfig();
        res.render('admin/settings', {
            title: 'Cài đặt hệ thống',
            layout: 'admin',
            isSettings: true,
            user: req.session.user,
            config: config.toJSON()
        });
    } catch (err) {
        console.error('Get settings error:', err);
        res.redirect('/admin/?error=fetch_settings_failed');
    }
});

router.post('/settings', requireAdmin, async function (req, res) {
    try {
        await SystemConfig.findOneAndUpdate({}, req.body, { upsert: true });
        res.redirect('/admin/settings?message=updated');
    } catch (err) {
        console.error('Update settings error:', err);
        res.redirect('/admin/settings?error=update_failed');
    }
});



// ========== ADMIN PROFILE ==========
router.get('/profile', requireAdmin, function (req, res) {
    const adminUser = res.locals.adminUser;
    res.render('admin/profile/profile', {
        title: 'Admin Profile',
        isProfile: true,
        adminUser: adminUser
    });
});

// Update Profile Action
router.post('/profile/update', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        const { name, phone, address, birthday, intro } = req.body;
        const userId = res.locals.adminUser._id;

        const updateData = {
            name,
            phone,
            address,
            intro
        };

        if (birthday) {
            updateData.birthday = new Date(birthday);
        }

        if (req.file) {
            updateData.image = '/uploads/' + req.file.filename;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        // Update session if needed
        req.session.user = {
            ...req.session.user,
            name: updatedUser.name,
            image: updatedUser.image // If you add image to session
        };

        res.redirect('/admin/profile');
    } catch (err) {
        console.error('Update profile error:', err);
        res.redirect('/admin/profile?error=' + encodeURIComponent(err.message));
    }
});

// Change Password Action
router.post('/profile/password', requireAdmin, async function (req, res) {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = res.locals.adminUser._id;

        const user = await User.findById(userId);

        // Verify current password
        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.redirect('/admin/profile?error=' + encodeURIComponent('Mật khẩu hiện tại không đúng'));
        }

        // Validate new password
        if (newPassword !== confirmPassword) {
            return res.redirect('/admin/profile?error=' + encodeURIComponent('Mật khẩu mới không khớp'));
        }

        if (newPassword.length < 6) {
            return res.redirect('/admin/profile?error=' + encodeURIComponent('Mật khẩu mới phải có ít nhất 6 ký tự'));
        }

        // Hash new password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(newPassword, salt);

        await User.findByIdAndUpdate(userId, { password: hashedPassword });

        res.redirect('/admin/profile?message=' + encodeURIComponent('Đổi mật khẩu thành công'));
    } catch (err) {
        console.error('Change password error:', err);
        res.redirect('/admin/profile?error=' + encodeURIComponent(err.message));
    }
});



// ========== LOGOUT ==========
router.get('/logout', function (req, res) {
    // Xóa session và redirect về trang login
    req.session.destroy(function (err) {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/admin/login');
    });
});



// ========== FIX LỖI ANTITIES (SỬA CHÍNH TẢ) ==========
router.get('/entities', requireAdmin, function (req, res) {
    res.render('admin/entities/entities-list', {
        title: 'Entities Management',
        adminUser: res.locals.adminUser
    });
});



// ========================== SETTINGS ==========================
router.get('/settings', async function (req, res) {
    try {
        const config = await SystemConfig.getConfig();
        res.render('admin/settings', {
            title: 'Cấu hình hệ thống',
            layout: 'admin',
            isSettings: true,
            config: config,
            user: req.session.user,
            message: req.query.message
        });
    } catch (err) {
        console.error('Settings error:', err);
        res.redirect('/admin');
    }
});

router.post('/settings', async function (req, res) {
    try {
        let config = await SystemConfig.findOne();
        if (!config) config = new SystemConfig();

        // Update fields if they exist in the request body
        if (req.body.companyName !== undefined) config.companyName = req.body.companyName;
        if (req.body.address !== undefined) config.address = req.body.address;
        if (req.body.email !== undefined) config.email = req.body.email;
        if (req.body.phone !== undefined) config.phone = req.body.phone;
        if (req.body.workingHours !== undefined) config.workingHours = req.body.workingHours;

        if (req.body.aboutUsRef !== undefined) config.aboutUsRef = req.body.aboutUsRef;

        await config.save();

        // Update session to reflect changes immediately
        if (req.session) {
            req.session.systemConfig = config.toObject ? config.toObject() : config;
        }

        res.redirect('/admin/settings?message=Cập nhật thành công');
    } catch (err) {
        console.error('Update settings error:', err);
        res.redirect('/admin/settings?message=Lỗi cập nhật');
    }
});

module.exports = router;

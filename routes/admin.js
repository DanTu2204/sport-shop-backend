var express = require('express');
var router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order'); // Import Order model
const Voucher = require('../models/Voucher'); // Import Voucher model
const Product = require('../models/Product'); // Import Product model
const Category = require('../models/Category'); // Import Category model
const Banner = require('../models/Banner'); // Import Banner model
const Contact = require('../models/Contact'); // Import Contact model

const bcryptjs = require('bcryptjs');
const requireAdmin = require('../middleware/adminAuth');
const multer = require('multer');
const path = require('path');

// Cloudinary upload (dùng khi đã cài và cấu hình biến môi trường)
// Fallback về local storage nếu chưa cấu hình Cloudinary
let upload;
try {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        const { uploadProduct } = require('../utils/cloudinary');
        upload = uploadProduct;
    } else {
        throw new Error('Cloudinary not configured');
    }
} catch (e) {
    // Fallback: lưu local
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../public/uploads/'));
        },
        filename: function (req, file, cb) {
            cb(null, 'product-' + Date.now() + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
}

// Set layout for ALL admin routes (trừ login)
router.all('/*', function (req, res, next) {
    // Không set layout cho trang login
    if (req.path !== '/login') {
        res.app.locals.layout = 'admin';
    }
    next();
});

// ========== DEBUG / PRIORITY BANNER ROUTES ==========
router.get('/banner/edit/:id', requireAdmin, async function (req, res) {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.redirect('/admin/banner');

        const formatDate = (d) => {
            if (!d) return '';
            const date = new Date(d);
            return date.toISOString().split('T')[0];
        };

        const bannerDoc = banner.toJSON();
        bannerDoc.startDateValue = formatDate(banner.startDate);
        // endDate might be 23:59
        bannerDoc.endDateValue = formatDate(banner.endDate);

        res.render('admin/banner/banner-edit', {
            title: 'Edit Banner',
            isBanner: true,
            adminUser: res.locals.adminUser,
            banner: bannerDoc
        });
    } catch (err) {
        console.error('Edit banner view error:', err);
        res.redirect('/admin/banner');
    }
});

router.post('/banner/edit/:id', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        const { title, position, order, link, openInNewTab, startDate, endDate, status, description } = req.body;

        const updateData = {
            title,
            position,
            order: order || 0,
            link,
            openInNewTab: openInNewTab === '1',
            startDate,
            status,
            description
        };

        if (req.file) {
            updateData.image = req.file.path || ('/uploads/' + req.file.filename);
        }

        if (endDate) {
            const endDataObj = new Date(endDate);
            endDataObj.setHours(23, 59, 59, 999);
            updateData.endDate = endDataObj;
        }

        await Banner.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/banner');
    } catch (err) {
        console.error('Edit banner error:', err);
        res.redirect('/admin/banner');
    }
});
// ====================================================

// (Priority Category Edit Routes removed per user request)
// ====================================================

// ========== ADMIN LOGIN ==========
router.get('/login', function (req, res) {
    const error = req.query.error || null;
    res.render('admin/login', {
        title: 'Admin Login',
        error: error,
        layout: false,  // Không dùng layout admin cho trang login
        endpoint: '/admin/login',
        next: '/admin/',
        adminLogin: true
    });
});

router.post('/login', async function (req, res) {
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

        // Lưu thông tin admin vào session riêng biệt
        const userInfo = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role
        };
        req.session.adminUser = userInfo;

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
            totalOrders,
            totalCategories,
            totalProducts,
            totalCustomers,
            recentOrders
        ] = await Promise.all([
            Order.countDocuments(), // Using total orders count
            Category.countDocuments(),
            Product.countDocuments(),
            User.countDocuments({ role: 'user' }),
            Order.find().sort({ createdAt: -1 }).limit(5).populate('user').lean()
        ]);

        const recentOrdersFormatted = recentOrders.map(order => {
            const date = new Date(order.createdAt);
            return {
                ...order,
                createdAtFormatted: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
            };
        });

        res.render('admin/index', {
            title: 'Admin Dashboard',
            isDashboard: true,
            adminUser: res.locals.adminUser,
            stats: {
                orders: totalOrders,
                categories: totalCategories,
                products: totalProducts,
                customers: totalCustomers
            },
            recentOrders: recentOrdersFormatted
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.render('admin/index', {
            title: 'Admin Dashboard',
            isDashboard: true,
            adminUser: res.locals.adminUser,
            stats: { orders: 0, categories: 0, products: 0, customers: 0 },
            recentOrders: []
        });
    }
});



// ========== THỐNG KÊ (STATISTICS) ==========
router.get('/statistics', requireAdmin, async function (req, res) {
    try {
        const period = req.query.period || 'all';
        let matchQuery = { status: 'completed' }; // Chỉ lấy đơn hoàn thành

        // Lọc theo thời gian
        const now = new Date();
        let startDate;

        if (period === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'week') {
            const firstDay = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
            startDate = new Date(now.getFullYear(), now.getMonth(), firstDay);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        if (startDate) {
            matchQuery.createdAt = { $gte: startDate };
        }

        const orders = await Order.find(matchQuery).lean();

        let totalRevenue = 0;
        let totalItemsSold = 0;
        let productSales = {};

        orders.forEach(order => {
            totalRevenue += order.totalPrice;
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = {
                            id: item.productId,
                            name: item.name,
                            image: item.image,
                            price: item.price,
                            quantitySold: 0,
                            revenue: 0
                        };
                    }
                    productSales[item.productId].quantitySold += item.quantity;
                    totalItemsSold += item.quantity;
                    
                    // Doanh thu tương đối cho từng sản phẩm = số lượng * giá (lưu ý giá có thể thay đổi sau khi giảm, nhưng ở đây tính ước lượng từ giá lúc mua)
                    // Hoặc đơn giản là dùng giá trị ghi trong order item
                    const itemPrice = item.price || 0;
                    productSales[item.productId].revenue += (item.quantity * itemPrice);
                });
            }
        });

        // Sắp xếp sản phẩm bán chạy nhất
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, 10);

        res.render('admin/statistics/index', {
            title: 'Thống kê Doanh thu & Sản phẩm',
            isStatistics: true,
            adminUser: res.locals.adminUser,
            totalRevenue: totalRevenue,
            totalOrders: orders.length,
            totalItemsSold: totalItemsSold,
            topProducts: topProducts,
            period: period
        });
    } catch (err) {
        console.error('Statistics error:', err);
        res.redirect('/admin/?error=server_error');
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
            title: 'Category Management',
            isCategory: true,
            adminUser: res.locals.adminUser,
            categories: categoriesEnhanced,
            stats: { totalCategories, totalProducts, totalOrders, totalCustomers }
        });
    } catch (err) {
        console.error('Get categories error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

router.get('/category/add', requireAdmin, function (req, res) {
    res.render('admin/category/category-add', {
        title: 'Add Category',
        isCategory: true,
        adminUser: res.locals.adminUser
    });
});

router.post('/category/add', requireAdmin, async function (req, res) {
    try {
        const { name, description, status } = req.body;
        await Category.create({ name, description, status });
        res.redirect('/admin/category');
    } catch (err) {
        console.error('Add category error:', err);
        res.redirect('/admin/category/add?error=' + encodeURIComponent(err.message));
    }
});

router.post('/category/delete', requireAdmin, async function (req, res) {
    try {
        await Category.findByIdAndDelete(req.body.id);
        res.redirect('/admin/category');
    } catch (err) {
        console.error('Delete category error:', err);
        res.redirect('/admin/category');
    }
});

// (Original Category Edit Routes removed per user request)

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
        const { category, status, stock, search } = req.query;
        let query = {};

        // Lọc theo từ khóa tìm kiếm
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        // Lọc theo danh mục
        if (category && category !== 'all') {
            query.category = category;
        }

        // Lọc theo trạng thái active/inactive
        if (status && status !== 'all') {
            query.status = status;
        }

        // Lọc theo tình trạng kho
        if (stock) {
            if (stock === 'out') {
                query.quantity = 0;
            } else if (stock === 'low') {
                query.quantity = { $gt: 0, $lte: 10 };
            } else if (stock === 'in') {
                query.quantity = { $gt: 10 };
            }
        }

        const [products, categories] = await Promise.all([
            Product.find(query).sort({ createdAt: -1 }).lean(),
            Category.find({ status: 'active' }).lean()
        ]);

        // Tính toán thống kê (Dựa trên toàn bộ sản phẩm để đồng nhất với các card overview)
        const allProductsStats = await Product.find({}, 'quantity');
        const totalProducts = allProductsStats.length;
        const inStock = allProductsStats.filter(p => p.quantity > 10).length;
        const lowStock = allProductsStats.filter(p => p.quantity > 0 && p.quantity <= 10).length;
        const outOfStock = allProductsStats.filter(p => p.quantity === 0).length;

        res.render('admin/product/product-list', {
            title: 'Product Management',
            isProduct: true,
            adminUser: res.locals.adminUser,
            products: products,
            categories: categories,
            stats: { totalProducts, inStock, lowStock, outOfStock },
            filter: { category, status, stock, search }
        });
    } catch (err) {
        console.error('Get products error:', err);
        res.redirect('/admin/?error=server_error');
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
            updateData.image = req.file.path || ('/uploads/' + req.file.filename);
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
        const orders = await Order.find().sort({ createdAt: -1 });
        const ordersFormatted = orders.map(order => {
            const doc = order.toJSON();
            const date = new Date(doc.createdAt);
            doc.createdAtFormatted = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            return doc;
        });

        res.render('admin/orders/orders-list', {
            title: 'Orders Management',
            isOrders: true,
            adminUser: res.locals.adminUser,
            orders: ordersFormatted
        });
    } catch (err) {
        console.error('Get orders error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

// Update Order Status
router.post('/orders/update-status', requireAdmin, async function (req, res) {
    try {
        await Order.findByIdAndUpdate(orderId, { status: status });
        res.redirect('/admin/orders?success=updated');
    } catch (err) {
        console.error('Update status error:', err);
        res.redirect('/admin/orders?error=update_failed');
    }
});

router.post('/orders/delete', requireAdmin, async function (req, res) {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.redirect('/admin/orders?error=missing_id');

        // Tìm đơn hàng trước khi xóa để kiểm tra voucher
        const order = await Order.findById(orderId);
        if (order) {
            // Hoàn trả lượt dùng voucher nếu đơn hàng có áp dụng mã giảm giá
            if (order.voucherCode) {
                await Voucher.findOneAndUpdate(
                    { code: order.voucherCode, usedCount: { $gt: 0 } },
                    { $inc: { usedCount: -1 } }
                );
            }
            await order.deleteOne();
        }

        res.redirect('/admin/orders?success=deleted');
    } catch (err) {
        console.error('Delete order error:', err);
        res.redirect('/admin/orders?error=delete_failed');
    }
});



// ========== CUSTOMERS ==========
router.get('/customers', requireAdmin, async function (req, res) {
    try {
        const users = await User.find({ role: 'user' });

        // Enhance users with order count
        const customers = await Promise.all(users.map(async (user) => {
            const orderCount = await Order.countDocuments({ user: user._id });
            const doc = user.toJSON();
            const date = new Date(doc.createdAt);
            doc.createdAtFormatted = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            return {
                ...doc,
                orderCount: orderCount
            };
        }));

        res.render('admin/customers/customers-list', {
            title: 'Customers Management',
            isCustomers: true,
            adminUser: res.locals.adminUser,
            customers: customers
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.redirect('/admin/?error=fetch_customers_failed');
    }
});



// ========== INVENTORY ==========
router.get('/inventory', requireAdmin, async function (req, res) {
    try {
        const { search, category, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) {
            query.category = category;
        }

        if (status) {
            if (status === 'out') {
                query.quantity = 0;
            } else if (status === 'low') {
                query.quantity = { $gt: 0, $lte: 10 };
            } else if (status === 'in') {
                query.quantity = { $gt: 10 };
            }
        }

        const [products, categories] = await Promise.all([
            Product.find(query).sort({ quantity: 1 }),
            Category.find({ status: 'active' })
        ]);

        // Calculate functionality stats (GLOBAL stats, regardless of filter, or filtered stats? User usually wants filtered stats table but Global counts card? Or filtered counts? Let's keep global counts for the top cards as they represent "Overview", and filtered results for table.)
        // Actually, usually "Overview" cards show global state. Let's do separate queries for stats if needed, or just calculate from the FULL list if not too big. 
        // For efficiency, let's keep stats based on the *current filtered View* OR fetch global stats separately.
        // Let's fetch GLOBAL stats for the card tiles (so users know total health) and displaying FILTERED products in table.

        const allProducts = await Product.find({}, 'quantity'); // Light query for stats
        const totalProducts = allProducts.length;
        const inStock = allProducts.filter(p => p.quantity > 10).length;
        const lowStock = allProducts.filter(p => p.quantity > 0 && p.quantity <= 10).length;
        const outOfStock = allProducts.filter(p => p.quantity === 0).length;

        const productsFormatted = products.map(p => {
            const doc = p.toJSON();
            if (doc.quantity === 0) {
                doc.stockStatus = 'Hết hàng';
                doc.stockClass = 'bg-danger';
            } else if (doc.quantity <= 10) {
                doc.stockStatus = 'Sắp hết hàng';
                doc.stockClass = 'bg-warning';
            } else {
                doc.stockStatus = 'Còn hàng';
                doc.stockClass = 'bg-success';
            }
            return doc;
        });

        res.render('admin/inventory/inventory-list', {
            title: 'Inventory Management',
            isInventory: true,
            adminUser: res.locals.adminUser,
            products: productsFormatted,
            categories: categories.map(c => c.toJSON()),
            stats: { totalProducts, inStock, lowStock, outOfStock },
            filter: { search, category, status }
        });
    } catch (err) {
        console.error('Get inventory error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

router.get('/inventory/import', requireAdmin, async function (req, res) {
    try {
        const products = await Product.find({}, 'code name quantity'); // Get list for selection
        res.render('admin/inventory/inventory-import', {
            title: 'Import Goods',
            isInventory: true,
            adminUser: res.locals.adminUser,
            products: products.map(p => p.toJSON())
        });
    } catch (err) {
        console.error('Get import view error:', err);
        res.redirect('/admin/inventory');
    }
});

router.post('/inventory/import', requireAdmin, async function (req, res) {
    const { productId, quantity } = req.body;
    try {
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            throw new Error('Số lượng phải lớn hơn 0');
        }

        if (!productId) {
            throw new Error('Vui lòng chọn sản phẩm');
        }

        const product = await Product.findById(productId);
        if (!product) {
            throw new Error('Sản phẩm không tồn tại');
        }

        await Product.findByIdAndUpdate(productId, {
            $inc: { quantity: qty },
            updatedAt: Date.now()
        });

        res.redirect('/admin/inventory');
    } catch (err) {
        console.error('Import goods error:', err);
        res.redirect('/admin/inventory/import?error=' + encodeURIComponent(err.message));
    }
});



// ========== VOUCHER ==========
// const Voucher = require('../models/Voucher'); // Moved to top

router.get('/voucher', requireAdmin, async function (req, res) {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        
        // Calculate dynamic stats
        const now = new Date();
        const stats = {
            total: vouchers.length,
            active: 0,
            usedTotal: 0,
            expired: 0
        };

        const vouchersFormatted = vouchers.map(v => {
            const doc = v.toJSON();
            const start = new Date(doc.startDate);
            const end = new Date(doc.endDate);
            
            // Format dates
            const formatDateDisplay = (d) => {
                if (!d) return '';
                const date = new Date(d);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            };
            doc.startDateFormatted = formatDateDisplay(doc.startDate);
            doc.endDateFormatted = formatDateDisplay(doc.endDate);

            // Accumulate usedCount
            stats.usedTotal += (doc.usedCount || 0);

            // Logic to determine status
            if (now > end) {
                doc.status = 'expired';
                stats.expired++;
            } else if (doc.status === 'active') {
                stats.active++;
            } else if (doc.status === 'inactive') {
                // Do not increment active or expired
            }

            return doc;
        });

        res.render('admin/voucher/voucher-list', {
            title: 'Quản lý Mã giảm giá',
            isVoucher: true,
            adminUser: res.locals.adminUser,
            vouchers: vouchersFormatted,
            stats: stats
        });
    } catch (err) {
        console.error('Get vouchers error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

router.get('/voucher/add', requireAdmin, function (req, res) {
    res.render('admin/voucher/voucher-add', {
        title: 'Add Voucher',
        isVoucher: true,
        adminUser: res.locals.adminUser
    });
});

router.post('/voucher/add', requireAdmin, async function (req, res) {
    try {
        const data = { ...req.body };
        // Chuẩn hóa ngày: startDate từ đầu ngày, endDate đến cuối ngày (tránh lệch timezone)
        if (data.startDate) {
            const d = new Date(data.startDate);
            d.setHours(0, 0, 0, 0);
            data.startDate = d;
        }
        if (data.endDate) {
            const d = new Date(data.endDate);
            d.setHours(23, 59, 59, 999);
            data.endDate = d;
        }
        await Voucher.create(data);
        res.redirect('/admin/voucher');
    } catch (err) {
        console.error('Add voucher error:', err);
        res.redirect('/admin/voucher/add?error=create_failed');
    }
});

router.get('/voucher/edit/:id', requireAdmin, async function (req, res) {
    try {
        const voucher = await Voucher.findById(req.params.id);
        if (!voucher) return res.redirect('/admin/voucher');

        // Format dates for input type="date" (YYYY-MM-DD)
        const formatDate = (d) => {
            if (!d) return '';
            const date = new Date(d);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const voucherDoc = voucher.toJSON();
        voucherDoc.startDateValue = formatDate(voucherDoc.startDate);
        voucherDoc.endDateValue = formatDate(voucherDoc.endDate);

        res.render('admin/voucher/voucher-edit', {
            title: 'Edit Voucher',
            isVoucher: true,
            adminUser: res.locals.adminUser,
            voucher: voucherDoc
        });
    } catch (err) {
        console.error('Edit voucher view error:', err);
        res.redirect('/admin/voucher');
    }
});

router.post('/voucher/edit/:id', requireAdmin, async function (req, res) {
    try {
        const data = { ...req.body };
        // Chuẩn hóa ngày
        if (data.startDate) {
            const d = new Date(data.startDate);
            d.setHours(0, 0, 0, 0);
            data.startDate = d;
        }
        if (data.endDate) {
            const d = new Date(data.endDate);
            d.setHours(23, 59, 59, 999);
            data.endDate = d;
        }
        await Voucher.findByIdAndUpdate(req.params.id, data);
        res.redirect('/admin/voucher');
    } catch (err) {
        console.error('Update voucher error:', err);
        res.redirect('/admin/voucher');
    }
});

router.post('/voucher/delete', requireAdmin, async function (req, res) {
    try {
        await Voucher.findByIdAndDelete(req.body.id);
        res.redirect('/admin/voucher');
    } catch (err) {
        console.error('Delete voucher error:', err);
        res.redirect('/admin/voucher');
    }
});



// ========== BANNER ==========
router.get('/banner', requireAdmin, async function (req, res) {
    try {
        const banners = await Banner.find().sort({ order: 1, createdAt: -1 });

        // Calculate stats
        const totalBanners = banners.length;
        const activeBanners = banners.filter(b => b.status === 'active' && new Date() >= b.startDate && new Date() <= b.endDate).length;
        const inactiveBanners = banners.filter(b => b.status === 'inactive').length;
        const expiredBanners = banners.filter(b => new Date() > b.endDate).length;

        const bannersFormatted = banners.map(b => {
            const doc = b.toJSON();
            const formatDate = (d) => {
                if (!d) return '';
                const date = new Date(d);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            };
            doc.period = `${formatDate(doc.startDate)} - ${formatDate(doc.endDate)}`;

            // Check if expired but status is active
            if (doc.status === 'active' && new Date() > doc.endDate) {
                doc.statusDisplay = 'Hết hạn';
                doc.statusClass = 'badge-secondary';
            } else if (doc.status === 'active') {
                doc.statusDisplay = 'Đang hiển thị';
                doc.statusClass = 'badge-success';
            } else {
                doc.statusDisplay = 'Tạm dừng';
                doc.statusClass = 'badge-warning';
            }
            return doc;
        });

        res.render('admin/banner/banner-list', {
            title: 'Banner Management',
            isBanner: true,
            adminUser: res.locals.adminUser,
            banners: bannersFormatted,
            stats: { totalBanners, activeBanners, inactiveBanners, expiredBanners }
        });
    } catch (err) {
        console.error('Get banners error:', err);
        res.redirect('/admin/?error=server_error');
    }
});

router.get('/banner/add', requireAdmin, function (req, res) {
    res.render('admin/banner/banner-add', {
        title: 'Add Banner',
        isBanner: true,
        adminUser: res.locals.adminUser
    });
});

router.post('/banner/add', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        const { title, position, order, link, openInNewTab, startDate, endDate, status, description } = req.body;

        if (!req.file) {
            throw new Error('Vui lòng chọn hình ảnh banner');
        }

        const imagePath = req.file.path || ('/uploads/' + req.file.filename);

        // Set endDate to end of day (23:59:59.999)
        const endDataObj = new Date(endDate);
        endDataObj.setHours(23, 59, 59, 999);

        await Banner.create({
            title,
            position,
            order: order || 0,
            image: imagePath,
            link,
            openInNewTab: openInNewTab === '1',
            startDate,
            endDate: endDataObj,
            status,
            description
        });

        res.redirect('/admin/banner');
    } catch (err) {
        console.error('Add banner error:', err);
        res.redirect('/admin/banner/add?error=' + encodeURIComponent(err.message));
    }
});

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

router.post('/contact/reply', requireAdmin, async function (req, res) {
    try {
        const { contactId, reply } = req.body;
        
        if (!contactId || !reply) {
            return res.redirect('/admin/contact?error=missing_data');
        }

        await Contact.findByIdAndUpdate(contactId, {
            reply: reply,
            status: 'replied'
        });

        res.redirect('/admin/contact?success=replied');
    } catch (err) {
        console.error('Reply contact error:', err);
        res.redirect('/admin/contact?error=server_error');
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


router.get('/banner/edit/:id', requireAdmin, async function (req, res) {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.redirect('/admin/banner');

        const formatDate = (d) => {
            if (!d) return '';
            const date = new Date(d);
            return date.toISOString().split('T')[0];
        };

        const bannerDoc = banner.toJSON();
        bannerDoc.startDateValue = formatDate(banner.startDate);
        // endDate might be 23:59, but date input just needs YYYY-MM-DD which toISOString gives correctly (in UTC, careful with timezone)
        bannerDoc.endDateValue = formatDate(banner.endDate);

        res.render('admin/banner/banner-edit', {
            title: 'Edit Banner',
            isBanner: true,
            adminUser: res.locals.adminUser,
            banner: bannerDoc
        });
    } catch (err) {
        console.error('Edit banner view error:', err);
        res.redirect('/admin/banner');
    }
});

router.post('/banner/edit/:id', requireAdmin, upload.single('image'), async function (req, res) {
    try {
        const { title, position, order, link, openInNewTab, startDate, endDate, status, description } = req.body;

        const updateData = {
            title,
            position,
            order: order || 0,
            link,
            openInNewTab: openInNewTab === '1',
            startDate,
            status,
            description
        };

        // Update image only if new one uploaded
        if (req.file) {
            updateData.image = req.file.path || ('/uploads/' + req.file.filename);
        }

        // Set endDate to end of day
        if (endDate) {
            const endDataObj = new Date(endDate);
            endDataObj.setHours(23, 59, 59, 999);
            updateData.endDate = endDataObj;
        }

        await Banner.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/banner');
    } catch (err) {
        console.error('Edit banner error:', err);
        res.redirect('/admin/banner');
    }
});

router.post('/banner/toggle-status', requireAdmin, async function (req, res) {
    try {
        const banner = await Banner.findById(req.body.id);
        if (banner) {
            banner.status = banner.status === 'active' ? 'inactive' : 'active';
            await banner.save();
        }
        res.redirect('/admin/banner');
    } catch (err) {
        console.error('Toggle banner status error:', err);
        res.redirect('/admin/banner');
    }
});

router.post('/banner/delete', requireAdmin, async function (req, res) {
    try {
        await Banner.findByIdAndDelete(req.body.id);
        res.redirect('/admin/banner');
    } catch (err) {
        console.error('Delete banner error:', err);
        res.redirect('/admin/banner');
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
            updateData.image = req.file.path || ('/uploads/' + req.file.filename);
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        // Update session if needed
        req.session.adminUser = {
            ...req.session.adminUser,
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
    // Xóa admin session và redirect về trang login
    if (req.session) {
        delete req.session.adminUser;
        req.session.save(function (err) {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/admin/login');
        });
    } else {
        res.redirect('/admin/login');
    }
});



// ========== FIX LỖI ANTITIES (SỬA CHÍNH TẢ) ==========
router.get('/entities', requireAdmin, function (req, res) {
    res.render('admin/entities/entities-list', {
        title: 'Entities Management',
        adminUser: res.locals.adminUser
    });
});



module.exports = router;

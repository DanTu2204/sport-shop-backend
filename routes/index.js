var express = require('express');
var router = express.Router();
const Order = require('../models/Order'); // Import Order model
const User = require('../models/User'); // Import User model
const Voucher = require('../models/Voucher'); // Import Voucher
const Category = require('../models/Category'); // Import Category model
const Product = require('../models/Product'); // Import Product
const Review = require('../models/Review'); // Import Review
const Contact = require('../models/Contact'); // Import Contact
const multer = require('multer');
const path = require('path');
const bcryptjs = require('bcryptjs');

// Cloudinary upload (dùng khi đã cài và cấu hình biến môi trường)
// Fallback về local storage nếu chưa cấu hình Cloudinary
let upload;
try {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        const { uploadAvatar } = require('../utils/cloudinary');
        upload = uploadAvatar;
    } else {
        throw new Error('Cloudinary not configured');
    }
} catch (e) {
    // Fallback: lưu local
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../public/uploads/users/'));
        },
        filename: function (req, file, cb) {
            cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
}

// Middleware: Get Category & Count (Example placeholder)
router.use(async function (req, res, next) {
    // ... code that might be here or keep exiting ...
    next();
});

// Helper: Calculate Cart Total
function calculateCartTotal(cart) {
    return cart.reduce((total, item) => total + (item.price * item.qty), 0);
}

// Set layout cho toàn bộ trang Home
router.all('/*', function (req, res, next) {
    res.app.locals.layout = 'home';
    next();
});

// Mock Products Data
const PRODUCTS = [
    { id: 'p1', name: 'Áo Thun Thể Thao Nike', price: 123, oldPrice: 150, image: 'img/product-1.jpg', category: 'cat1', color: 'black', size: 'M', stars: 5, reviews: 99 },
    { id: 'p2', name: 'Quần Short Tập Gym Adidas', price: 123, oldPrice: 140, image: 'img/product-2.jpg', category: 'cat2', color: 'blue', size: 'L', stars: 4.5, reviews: 85 },
    { id: 'p3', name: 'Giày Chạy Bộ Puma', price: 200, oldPrice: 250, image: 'img/product-3.jpg', category: 'cat3', color: 'white', size: '42', stars: 5, reviews: 120 },
    { id: 'p4', name: 'Găng Tay Tập Gym', price: 45, oldPrice: 60, image: 'img/product-4.jpg', category: 'cat4', color: 'black', size: 'M', stars: 4, reviews: 45 },
    { id: 'p5', name: 'Bình Nước Thể Thao 1L', price: 30, image: 'img/product-5.jpg', category: 'cat5', color: 'blue', size: 'one', stars: 4.5, reviews: 210 },
    { id: 'p6', name: 'Túi Đeo Chéo Thể Thao', price: 80, image: 'img/product-6.jpg', category: 'cat6', color: 'black', size: 'one', stars: 4, reviews: 30 },
    { id: 'p7', name: 'Mũ Lưỡi Trai Thể Thao', price: 25, image: 'img/product-7.jpg', category: 'cat7', color: 'red', size: 'one', stars: 5, reviews: 150 },
    { id: 'p8', name: 'Bóng Đá Chất Lượng Cao', price: 150, image: 'img/product-8.jpg', category: 'cat8', color: 'white', size: '5', stars: 5, reviews: 60 },
    { id: 'p9', name: 'Vợt Cầu Lông Carbon', price: 180, image: 'img/product-9.jpg', category: 'cat9', color: 'red', size: 'one', stars: 4.5, reviews: 40 }
];

// ========================= HOME PAGE =========================
// ========== GET CATEGORIES FOR NAVBAR ==========
router.get('/categories', async function (req, res) {
    try {
        const categories = await Category.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
        res.json({ categories: categories });
    } catch (err) {
        res.json({ categories: [] });
    }
});

// ========== HOME PAGE ==========
router.get('/', async function (req, res) {

    try {
        // Fetch products from DB
        const featuredProducts = await Product.find({ status: 'active' }).limit(8).sort({ stars: -1 }).lean();
        const recentProducts = await Product.find({ status: 'active' }).limit(8).sort({ createdAt: -1 }).lean();

        // Fetch active banners for Home Carousel (Check status AND date)
        const now = new Date();
        const banners = await require('../models/Banner').find({
            position: 'home-carousel',
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).sort({ order: 1 }).lean();

        // Fetch Categories with Product Count & Image
        const categories = await Category.find({ status: 'active' }).lean();
        for (let cat of categories) {
            const count = await Product.countDocuments({ category: cat.name, status: 'active' });
            cat.productCount = count;

            const product = await Product.findOne({ category: cat.name, status: 'active', image: { $exists: true, $ne: '' } }).select('image').lean();
            cat.image = product ? product.image : 'img/cat-1.jpg';
        }

        // Map _id to id for compatibility if needed, though handlebars can access _id
        const mapProducts = (products) => products.map(p => ({ ...p, id: p._id.toString() }));

        res.render('home/index', {
            title: 'Sport Shop - Trang chủ',
            featuredProducts: mapProducts(featuredProducts),
            recentProducts: mapProducts(recentProducts),
            banners: banners,
            categories: categories
        });
    } catch (err) {
        console.error('Home page error:', err);
        res.render('home/index', { title: 'Home Page', featuredProducts: [], recentProducts: [], banners: [] });
    }
});

// ========== USER ORDERS (Moved to top for priority) ==========
// ========== USER PROFILE & ORDERS ==========
router.get('/profile', async function (req, res) {
    const userSession = getUser(req);
    if (!userSession) return res.redirect('/login');

    try {
        const userId = userSession.id || userSession._id;
        const [user, orders, contacts] = await Promise.all([
            User.findById(userId).lean(),
            Order.find({ user: userId }).sort({ createdAt: -1 }).lean(),
            Contact.find({ user: userId }).sort({ createdAt: -1 }).lean()
        ]);

        if (!user) {
            return res.redirect('/logout');
        }

        res.render('home/profile', {
            title: 'Tài khoản của tôi',
            user: user,
            orders: orders,
            contacts: contacts
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.redirect('/');
    }
});

// Update Profile
router.post('/profile/update', upload.single('image'), async function (req, res) {
    const userSession = getUser(req);
    if (!userSession) return res.redirect('/login');

    try {
        const { name, phone, address, birthday } = req.body;
        const userId = userSession.id || userSession._id;

        const updateData = { name, phone, address };
        if (birthday) {
            updateData.birthday = new Date(birthday);
        }
        if (req.file) {
            // Cloudinary trả về secure_url, local storage trả về filename
            updateData.image = req.file.path || ('/uploads/users/' + req.file.filename);
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
        
        // Update session
        if (req.session.user) {
            req.session.user.name = updatedUser.name;
            if (updatedUser.image) req.session.user.image = updatedUser.image;
        }

        req.session.flash = { type: 'success', message: 'Cập nhật thông tin thành công!' };
        res.redirect('/profile');
    } catch (err) {
        console.error('Update profile error:', err);
        req.session.flash = { type: 'danger', message: 'Lỗi cập nhật. Vui lòng thử lại.' };
        res.redirect('/profile');
    }
});

// Change Password
router.post('/profile/password', async function (req, res) {
    const userSession = getUser(req);
    if (!userSession) return res.redirect('/login');

    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = userSession.id || userSession._id;
        const user = await User.findById(userId);

        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) {
            req.session.flash = { type: 'danger', message: 'Mật khẩu hiện tại không đúng.' };
            return res.redirect('/profile');
        }

        if (newPassword !== confirmPassword) {
            req.session.flash = { type: 'danger', message: 'Mật khẩu xác nhận không khớp.' };
            return res.redirect('/profile');
        }

        if (newPassword.length < 6) {
            req.session.flash = { type: 'danger', message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
            return res.redirect('/profile');
        }

        const salt = await bcryptjs.genSalt(10);
        user.password = await bcryptjs.hash(newPassword, salt);
        await user.save();

        req.session.flash = { type: 'success', message: 'Đổi mật khẩu thành công!' };
        res.redirect('/profile');
    } catch (err) {
        console.error('Change password error:', err);
        req.session.flash = { type: 'danger', message: 'Lỗi hệ thống.' };
        res.redirect('/profile');
    }
});


// Get user's orders list
router.get('/orders', async function (req, res) {
    const user = getUser(req);
    if (!user) {
        if (res.render.originalRender) { // Check if we are in Bridge mode
            return res.redirect('/login');
        }
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const userId = user.id || user._id;
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
        
        res.render('home/orders', {
            title: 'Đơn hàng của tôi',
            orders: orders,
            user: user
        });
    } catch (err) {
        console.error('Get orders error:', err);
        res.redirect('/');
    }
});

router.get('/orders/:id', async function (req, res) {
    const user = getUser(req);
    if (!user) return res.redirect('/login');

    try {
        const orderIndex = req.params.id;
        // Ensure we find by Order ID AND User ID for security
        const order = await Order.findOne({ _id: orderIndex, user: user.id || user._id }).lean();

        if (!order) {
            return res.redirect('/orders');
        }

        res.render('home/order-detail', {
            title: 'Chi tiết đơn hàng',
            user: user,
            order: order
        });
    } catch (err) {
        console.error('Get order detail error:', err);
        res.redirect('/orders');
    }
});

router.post('/orders/:id/confirm', async function (req, res) {
    const user = getUser(req);
    if (!user) return res.redirect('/login');

    try {
        await Order.findOneAndUpdate(
            { _id: req.params.id, user: user.id || user._id },
            { status: 'confirmed' }
        );
        res.redirect('/orders/' + req.params.id);
    } catch (err) {
        console.error('Confirm order error:', err);
        res.redirect('/orders');
    }
});

// User Cancel Order & Return Stock
router.post('/orders/:id/cancel', async function (req, res) {
    const user = getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' });

    try {
        const orderId = req.params.id;
        const userId = user.id || user._id;

        // Find order and check ownership
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
        }

        // Check if status is cancellation-eligible
        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Đơn hàng đang giao hoặc đã hoàn thành, không thể hủy.' });
        }

        // Return stock
        const stockPromises = order.items.map(async (item) => {
            return Product.findByIdAndUpdate(item.productId, {
                $inc: { quantity: item.quantity }
            });
        });
        await Promise.all(stockPromises);

        // Update status to cancelled
        order.status = 'cancelled';
        await order.save();

        res.json({ success: true, message: 'Đã hủy đơn hàng và hoàn trả kho thành công.' });
    } catch (err) {
        console.error('Cancel order error:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
    }
});

router.post('/orders/:id/review/:productId', async function (req, res) {
    const user = getUser(req);
    if (!user) return res.redirect('/login');

    const { stars, comment } = req.body;
    const rating = parseInt(stars) || 5;

    try {
        // Create new Review
        const newReview = new Review({
            user: user.id || user._id,
            product: req.params.productId,
            stars: rating,
            comment: comment
        });
        await newReview.save();

        // Update Product stats
        const product = await Product.findById(req.params.productId);
        if (product) {
            // Recalculate average
            const allReviews = await Review.find({ product: req.params.productId });
            const totalStars = allReviews.reduce((acc, r) => acc + r.stars, 0);
            const avgStars = totalStars / allReviews.length;

            product.stars = avgStars;
            product.reviews = allReviews.length;
            await product.save();
        }

        res.redirect('/detail?id=' + req.params.productId);
    } catch (err) {
        console.error('Review error:', err);
        res.redirect('/detail?id=' + req.params.productId);
    }
});

// ========================= CART HELPERS ======================
function getCart(req) {
    // Ưu tiên lấy từ session
    if (req.session && req.session.cart) {
        return req.session.cart;
    }
    // Fallback: lấy từ query parameters
    try {
        if (req.query.cart) {
            return JSON.parse(decodeURIComponent(req.query.cart));
        } else if (req.body.cart) {
            return typeof req.body.cart === 'string' ? JSON.parse(req.body.cart) : req.body.cart;
        }
    } catch (e) {
        // Ignore parse errors
    }
    return [];
}

function encodeCart(cart) {
    return encodeURIComponent(JSON.stringify(cart));
}

function getWishlist(req) {
    // Ưu tiên lấy từ session
    if (req.session && req.session.wishlist) {
        return req.session.wishlist;
    }
    // Fallback: lấy từ query parameters
    try {
        if (req.query.wishlist) {
            return JSON.parse(decodeURIComponent(req.query.wishlist));
        } else if (req.body.wishlist) {
            return typeof req.body.wishlist === 'string' ? JSON.parse(req.body.wishlist) : req.body.wishlist;
        }
    } catch (e) {
        // Ignore parse errors
    }
    return [];
}

function encodeWishlist(wishlist) {
    return encodeURIComponent(JSON.stringify(wishlist));
}

function getUser(req) {
    // Ưu tiên lấy từ session
    if (req.session && req.session.user) {
        return req.session.user;
    }
    // Fallback: lấy từ query parameters (cho tương thích ngược)
    try {
        if (req.query.user) {
            return JSON.parse(decodeURIComponent(req.query.user));
        } else if (req.body.user) {
            return typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user;
        }
    } catch (e) {
        // Ignore parse errors
    }
    return null;
}

function buildQueryParams(params) {
    const query = [];
    if (params.cart && params.cart.length > 0) query.push('cart=' + encodeCart(params.cart));
    if (params.wishlist && params.wishlist.length > 0) query.push('wishlist=' + encodeWishlist(params.wishlist));
    if (params.user) query.push('user=' + encodeURIComponent(JSON.stringify(params.user)));
    if (params.contactMessage) query.push('contactMessage=' + encodeURIComponent(params.contactMessage));
    if (params.flash) {
        query.push('flashType=' + encodeURIComponent(params.flash.type));
        query.push('flashMessage=' + encodeURIComponent(params.flash.message));
    }
    if (params.orderSuccess) query.push('orderSuccess=true');
    return query.length > 0 ? '?' + query.join('&') : '';
}

// Helper để giữ user info khi redirect
function preserveUser(req, additionalParams = {}) {
    const params = { ...additionalParams };
    const user = getUser(req);
    if (user) {
        params.user = user;
    }
    return params;
}

// ========================= CART PAGE =========================
router.get('/cart', function (req, res) {
    const cart = getCart(req);
    const wishlist = getWishlist(req);
    const user = getUser(req);

    let subtotal = 0;
    cart.forEach(item => subtotal += item.price * item.qty);

    const shipping = 0;
    const grandTotal = subtotal + shipping;

    res.render('home/cart', {
        title: 'Your Cart',
        cart,
        subtotal,
        shipping,
        grandTotal,
        user: user
    });
});

// ========================= ADD TO CART =======================
router.post('/cart/add', function (req, res) {
    const cart = getCart(req);

    const { id, name, price, image } = req.body;
    const qty = parseInt(req.body.qty) || 1;

    if (!id || !name || !price) {
        return res.redirect('/');
    }

    const existing = cart.find(p => p.id === id);

    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({
            id,
            name,
            price: parseFloat(price),
            image: image || '',
            qty
        });
    }

    // Lưu cart vào session
    req.session.cart = cart;

    // If user is logged in, sync with DB
    if (req.session.user && req.session.user.id) {
        User.findById(req.session.user.id).then(user => {
            if (user) {
                user.cart = cart;
                user.save().catch(err => console.error('Error saving cart to DB:', err));
            }
        });
    }

    res.redirect('/cart');
});

// ========== VOUCHER APPLICATION ==========
router.post('/cart/apply-voucher', async function (req, res) {
    const { code } = req.body;
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.json({ success: false, message: 'Giỏ hàng trống.' });
    }

    try {
        const voucher = await Voucher.findOne({ code: code.toUpperCase() });
        if (!voucher) {
            return res.json({ success: false, message: 'Mã giảm giá không tồn tại.' });
        }
        if (voucher.status !== 'active') {
            return res.json({ success: false, message: 'Mã giảm giá không khả dụng.' });
        }
        const now = new Date();
        if (now < voucher.startDate || now > voucher.endDate) {
            return res.json({ success: false, message: 'Mã giảm giá đã hết hạn.' });
        }
        if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
            return res.json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng.' });
        }

        const subtotal = calculateCartTotal(req.session.cart);
        if (voucher.minOrderValue && subtotal < voucher.minOrderValue) {
            return res.json({ success: false, message: `Đơn hàng tối thiểu ${voucher.minOrderValue}đ để sử dụng mã này.` });
        }

        // Save voucher to session
        req.session.voucher = {
            code: voucher.code,
            type: voucher.type,
            value: voucher.value,
            _id: voucher._id
        };

        res.json({ success: true, message: 'Áp dụng mã giảm giá thành công!' });
    } catch (err) {
        console.error('Apply voucher error:', err);
        res.json({ success: false, message: 'Lỗi server.' });
    }
});

// Orders route moved to top

// ========================= REMOVE FROM CART ==================
router.post('/cart/remove', function (req, res) {
    const cart = getCart(req);
    const id = req.body.id;

    const updatedCart = cart.filter(p => p.id !== id);

    // Lưu cart vào session
    req.session.cart = updatedCart;

    // If user is logged in, sync with DB
    if (req.session.user && req.session.user.id) {
        User.findById(req.session.user.id).then(user => {
            if (user) {
                user.cart = updatedCart;
                user.save().catch(err => console.error('Error saving cart to DB:', err));
            }
        });
    }

    res.redirect('/cart');
});

// ========================= SEARCH ============================
router.get('/search', function (req, res) {
    const query = req.query.q || '';
    res.redirect('/shop?q=' + encodeURIComponent(query));
});

router.post('/search', function (req, res) {
    const query = req.body.q || '';
    res.redirect('/search?q=' + encodeURIComponent(query));
});

// ========================= CONTACT ===========================
router.get('/contact', function (req, res) {
    res.render('home/contact', { title: 'Contact Page' });
});

router.post('/contact', async function (req, res) {
    const { name, email, subject, message } = req.body;

    try {
        const user = getUser(req);
        const newContact = new Contact({
            name,
            email,
            subject,
            message,
            user: user ? (user.id || user._id) : null
        });

        await newContact.save();

        req.session.flash = {
            type: 'success',
            message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.'
        };

        // Nếu là yêu cầu từ API (React SPA), trả về JSON thay vì redirect
        if (req.xhr || req.path.startsWith('/api')) {
            return res.json({ 
                success: true, 
                message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.' 
            });
        }
    } catch (err) {
        console.error('Contact save error:', err);
        req.session.flash = {
            type: 'danger',
            message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.'
        };
        
        if (req.xhr || req.path.startsWith('/api')) {
            return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
        }
    }

    res.redirect('/contact');
});

// ========================= ABOUT & SUPPORT ====================
router.get('/about', function (req, res) {
    res.render('home/about', {
        title: 'Về chúng tôi'
    });
});

router.get('/help', function (req, res) {
    res.render('home/help', {
        title: 'Trợ giúp',
        helpTopics: [
            { title: 'Tình trạng đơn hàng', content: 'Truy cập trang hồ sơ để theo dõi đơn và cập nhật giao hàng.' },
            { title: 'Đổi trả sản phẩm', content: 'Bạn có 7 ngày để đổi trả miễn phí cho các sản phẩm chưa qua sử dụng.' },
            { title: 'Phương thức thanh toán', content: 'Hỗ trợ COD, chuyển khoản và các ví điện tử phổ biến.' }
        ],
        supportChannels: [
            { label: 'Hotline', value: '0909 123 456 (8h00 - 22h00)' },
            { label: 'Email', value: 'support@sportshop.vn' },
            { label: 'Live chat', value: 'Phản hồi trong vòng 5 phút' }
        ]
    });
});

router.get('/faq', function (req, res) {
    res.render('home/faq', {
        title: 'Câu hỏi thường gặp',
        faqs: [
            { question: 'Thời gian giao hàng bao lâu?', answer: 'Đơn nội thành 1-2 ngày, toàn quốc từ 3-5 ngày làm việc.' },
            { question: 'Làm sao để đổi size?', answer: 'Liên hệ hotline hoặc chat để được cấp mã đổi size miễn phí.' },
            { question: 'Tôi có thể kiểm tra hàng trước khi thanh toán không?', answer: 'Có, bạn được kiểm tra sản phẩm trước khi thanh toán COD.' }
        ]
    });
});

// ========================= CHECKOUT ==========================
router.get('/checkout', async function (req, res) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const cart = getCart(req);
    // Calculate subtotal manually as calculateCartTotal is not defined in the provided context
    let subtotal = 0;
    cart.forEach(item => subtotal += item.price * item.qty);

    let shipping = 0; // Free shipping
    let discountAmount = 0;
    let grandTotal = subtotal + shipping;
    let voucherCode = '';

    // Apply Voucher if in session
    if (req.session.voucher) {
        const v = req.session.voucher;
        voucherCode = v.code;
        if (v.type === 'percent') {
            discountAmount = (subtotal * v.value) / 100;
        } else {
            discountAmount = v.value;
        }
        // Ensure discount doesn't exceed subtotal
        if (discountAmount > subtotal) discountAmount = subtotal;

        grandTotal = subtotal + shipping - discountAmount;
    }

    res.render('home/checkout', {
        title: 'Thanh toán',
        cart: cart,
        user: req.session.user,
        subtotal: subtotal,
        shipping: shipping,
        discountAmount: discountAmount,
        grandTotal: grandTotal,
        voucherCode: voucherCode
    });
});

router.post('/checkout', async function (req, res) {


    const { firstName, lastName, email, phone, address, city, district, paymentMethod } = req.body;
    const cart = getCart(req);


    if (cart.length === 0) {
        return res.redirect('/cart');
    }

    const subtotal = calculateCartTotal(cart);
    let shipping = 0;
    let discountAmount = 0;
    let voucherCode = null;

    // Recalculate if voucher exists
    if (req.session.voucher) {
        const v = req.session.voucher;
        voucherCode = v.code;
        if (v.type === 'percent') {
            discountAmount = (subtotal * v.value) / 100;
        } else {
            discountAmount = v.value;
        }
        if (discountAmount > subtotal) discountAmount = subtotal;
    }

    const grandTotal = subtotal + shipping - discountAmount;

    // Map cart items to Order schema
    const orderItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        image: item.image
    }));

    // Tạo đơn hàng mới trong MongoDB
    try {
        const newOrder = new Order({
            user: req.session.user ? req.session.user.id : null,
            contact: { firstName, lastName, email, phone, address, city, district },
            items: orderItems,
            subtotal: subtotal,
            shipping: shipping,
            discount: discountAmount,
            voucherCode: voucherCode,
            totalPrice: grandTotal,
            paymentMethod: paymentMethod,
            status: 'pending'
        });

        await newOrder.save();

        // Update Voucher Used Count
        if (req.session.voucher && req.session.voucher._id) {
            await Voucher.findByIdAndUpdate(req.session.voucher._id, { $inc: { usedCount: 1 } });
            req.session.voucher = null; // Clear voucher from session
        }

        // Clear cart
        req.session.cart = [];
        if (req.session.user) {
            await User.findByIdAndUpdate(req.session.user.id, { cart: [] });
        }

        res.redirect('/checkout/success');

    } catch (err) {
        console.error('Error saving order:', err);
        const fs = require('fs');
        const logData = `Date: ${new Date().toISOString()}\nError: ${err.message}\nValidation: ${JSON.stringify(err.errors || {}, null, 2)}\nBody: ${JSON.stringify(req.body, null, 2)}\n\n`;
        fs.appendFileSync(path.join(__dirname, '../checkout_error.log'), logData);

        res.render('home/checkout', {
            title: 'Thanh toán',
            cart: cart,
            user: req.session.user,
            subtotal: subtotal,
            shipping: shipping,
            discountAmount: discountAmount,
            grandTotal: grandTotal,
            error: 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại. Chi tiết: ' + err.message
        });
    }
});

router.get('/checkout/success', function (req, res) {
    const user = getUser(req);
    res.render('home/checkout-success', {
        title: 'Đặt hàng thành công',
        user: user
    });
});

// ========================= OTHER PAGES =======================
// ========================= OTHER PAGES =======================
// ========================= DETAIL PAGE =======================
const mongoose = require('mongoose');

router.get('/detail', async function (req, res) {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../detail_debug.log');

    const log = (msg) => {
        try {
            fs.appendFileSync(logFile, new Date().toISOString() + ': ' + msg + '\n');
        } catch (e) { }
    };

    log(`Accessing /detail page. Query ID: ${req.query.id}`);

    try {
        let productId = req.query.id;
        let product;

        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            log(`Searching for ID: ${productId}`);
            product = await Product.findById(productId).lean();
            log(`Search result: ${product ? 'Found' : 'Not Found'}`);
            if (product) log(`Product Name: ${product.name}`);
        } else if (!productId) {
            log('No ID provided, fetching default product...');
            product = await Product.findOne({ status: 'active' }).lean();
            if (product) {
                productId = product._id;
                log(`Default product found: ${productId}`);
            } else {
                log('No active products found for default.');
            }
        } else {
            log(`Invalid Product ID provided: "${productId}"`);
        }

        // Ensure id property exists
        if (product) {
            product.id = product._id.toString();
        } else {
            log(`Product is null at render time for ID: ${productId}`);
        }

        let relatedProducts = [];
        if (product) {
            relatedProducts = await Product.find({
                category: product.category,
                _id: { $ne: product._id },
                status: 'active'
            }).limit(6).lean();
        }

        const mapProducts = (products) => products.map(p => ({ ...p, id: p._id.toString() }));

        let reviews = [];
        if (product) {
            reviews = await Review.find({ product: product._id }).populate('user', 'name').sort({ createdAt: -1 }).lean();
        }

        res.render('home/detail', {
            title: product ? product.name : 'Chi tiết sản phẩm',
            product: product || null, // Ensure explicit null if undefined
            productId: productId,
            relatedProducts: mapProducts(relatedProducts),
            reviews: reviews,
            reviewCount: reviews.length
        });
    } catch (err) {
        console.error('Detail page error:', err);
        res.redirect('/');
    }
});

// POST review directly from Detail Page
router.post('/products/:id/review', async function (req, res) {
    const user = getUser(req);
    if (!user) return res.redirect('/login');

    const productId = req.params.id;
    const { comment, stars } = req.body;
    const rating = parseInt(stars) || 5;

    try {
        // Create new Review
        const newReview = new Review({
            user: user.id || user._id,
            product: productId,
            stars: rating,
            comment: comment
        });
        await newReview.save();

        // Update Product stats
        const product = await Product.findById(productId);
        if (product) {
            const allReviews = await Review.find({ product: productId });
            const totalStars = allReviews.reduce((acc, r) => acc + r.stars, 0);
            const avgStars = totalStars / allReviews.length;

            product.stars = avgStars;
            product.reviews = allReviews.length;
            await product.save();
        }

        res.redirect('/detail?id=' + productId);
    } catch (err) {
        console.error('Public review error:', err);
        res.redirect('/detail?id=' + productId);
    }
});

// ========================= WISHLIST ==========================
router.get('/wishlist', async function (req, res) {
    let wishlistIds = getWishlist(req);
    const user = getUser(req);

    if (req.query.add) {
        const productId = req.query.add;
        const existingIndex = wishlistIds.indexOf(productId);
        if (existingIndex === -1) {
            wishlistIds.push(productId);
        } else {
            // Optional: Toggle behavior (remove if exists) - currently just ensure it's there
            // If already exists, do nothing or move to top?
            // Let's keep logic simple: add if not present
        }
        // Removing duplications if any logic changes
        // wishlistIds.splice(existingIndex, 1); // This would be toggle

        // Lưu wishlist vào session
        req.session.wishlist = wishlistIds;

        const back = req.get('referer') || '/wishlist';
        return res.redirect(back);
    }

    if (req.query.remove) {
        const productId = req.query.remove;
        wishlistIds = wishlistIds.filter(id => id !== productId);

        // Lưu wishlist vào session
        req.session.wishlist = wishlistIds;

        return res.redirect('/wishlist');
    }

    // Fetch actual products from DB
    let products = [];
    try {
        const validIds = wishlistIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length > 0) {
            const productsData = await Product.find({
                _id: { $in: validIds },
                status: 'active'
            }).lean();

            // Map to ensure 'id' property exists and order matches (optional, but good)
            products = productsData.map(p => ({ ...p, id: p._id.toString() }));
        }
    } catch (err) {
        console.error('Error fetching wishlist products:', err);
    }

    res.render('home/wishlist', {
        title: 'Yêu thích',
        wishlist: products,
        user: user
    });
});

// ========================= SHOP ==============================
// ========================= SHOP ==============================
router.get('/shop', async function (req, res) {
    try {
        const category = req.query.category || '';
        const price = req.query.price || '';
        const color = req.query.color || '';
        const size = req.query.size || '';
        const sort = req.query.sort || 'newest';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const searchQuery = req.query.q || '';

        // Build Query
        const query = { status: 'active' };

        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        if (category) {
            query.category = { $regex: category, $options: 'i' }; // Use regex for simpler matching or exact match if preferred
        }

        if (price) {
            switch (price) {
                case 'under-100': query.price = { $lt: 100 }; break; // 100 = 100.000 VND
                case '100-200': query.price = { $gte: 100, $lte: 200 }; break;
                case '200-300': query.price = { $gt: 200, $lte: 300 }; break;
                case '300-400': query.price = { $gt: 300, $lte: 400 }; break;
                case 'over-400': query.price = { $gt: 400 }; break;
            }
        }

        if (color) query.color = color;
        if (size) {
            query.$or = [
                { size: size },
                { 'sizes.size': size }
            ];
        }

        // Sort
        let sortOption = {};
        switch (sort) {
            case 'price-low': sortOption = { price: 1 }; break;
            case 'price-high': sortOption = { price: -1 }; break;
            case 'popular': sortOption = { stars: -1 }; break;
            case 'newest': default: sortOption = { createdAt: -1 }; break;
        }

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Fetch Shop Banners
        const banners = await require('../models/Banner').find({
            position: 'shop-top',
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }).sort({ order: 1 }).lean();

        const totalPages = Math.ceil(totalProducts / limit);

        // Map _id for view
        const mapProducts = (list) => list.map(p => ({ ...p, id: p._id.toString() }));

        res.render('home/shop', {
            title: 'Shop Page',
            products: mapProducts(products),
            banners, // Pass banners to view
            category,
            price,
            color,
            size,
            sort,
            page,
            limit,
            totalProducts,
            totalPages,
            searchQuery
        });
    } catch (err) {
        console.error('Shop page error:', err);
        res.redirect('/');
    }
});

module.exports = router;

var express = require('express');
var router = express.Router();
const Order = require('../models/Order'); // Import Order model
const User = require('../models/User'); // Import User model
const Voucher = require('../models/Voucher'); // Import Voucher
const Category = require('../models/Category'); // Import Category model
const Product = require('../models/Product'); // Import Product
const Review = require('../models/Review'); // Import Review
const Contact = require('../models/Contact'); // Import Contact


// Middleware: Get Category & Count (Example placeholder)
router.use(async function (req, res, next) {
    // ... code that might be here or keep exiting ...
    next();
});

// Helper: Calculate Cart Total
// Helper: Calculate Cart Total (Removed)



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
// ========================= HOME PAGE =========================
// ========== HOME PAGE ==========
router.get('/', async function (req, res) {
    try {
        // Fetch products from DB
        const featuredProducts = await Product.find({ status: 'active' }).limit(8).sort({ stars: -1 }).lean();
        const recentProducts = await Product.find({ status: 'active' }).limit(8).sort({ createdAt: -1 }).lean();

        // Fetch active banners for Home Carousel
        const banners = await require('../models/Banner').find({
            position: 'home-carousel',
            status: 'active'
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

        res.status(200).json({
            success: true,
            title: 'Sport Shop - Trang chủ',
            featuredProducts: mapProducts(featuredProducts),
            recentProducts: mapProducts(recentProducts),
            banners: banners,
            categories: categories
        });
    } catch (err) {
        console.error('Home page error:', err);
        res.status(500).json({ success: false, message: 'Lỗi tải trang chủ', error: err.message });
    }
});

// ========== USER ORDERS (Moved to top for priority) ==========
// ========== USER ORDERS (Moved to top for priority) ==========


// Cart helpers removed

// Wishlist helper removed

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

// buildQueryParams updated to remove cart
function buildQueryParams(params) {
    const query = [];
    if (params.user) query.push('user=' + encodeURIComponent(JSON.stringify(params.user)));
    if (params.contactMessage) query.push('contactMessage=' + encodeURIComponent(params.contactMessage));
    if (params.flash) {
        query.push('flashType=' + encodeURIComponent(params.flash.type));
        query.push('flashMessage=' + encodeURIComponent(params.flash.message));
    }
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

// Cart and Voucher routes removed

// ========================= SEARCH ============================
router.get('/search', function (req, res) {
    const query = req.query.q || '';
    res.status(200).json({ success: true, query });
});

router.post('/search', function (req, res) {
    const query = req.body.q || '';
    res.status(200).json({ success: true, query });
});

// ========================= MY MESSAGES =======================
router.get('/my-messages', async function (req, res) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const messages = await Contact.find({ email: req.session.user.email })
            .sort({ createdAt: -1 })
            .lean();

        // Format dates
        messages.forEach(msg => {
            msg.createdAtFormatted = msg.createdAt.toLocaleString('vi-VN');
            if (msg.replyAt) {
                msg.replyAtFormatted = msg.replyAt.toLocaleString('vi-VN');
            }
        });

        res.status(200).json({
            success: true,
            title: 'Tin nhắn của tôi',
            messages: messages
        });
    } catch (err) {
        console.error('My messages error:', err);
        res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn' });
    }
});

// ========================= CONTACT ===========================
router.get('/contact', function (req, res) {
    res.status(200).json({ success: true, title: 'Contact Page' });
});

router.post('/contact', async function (req, res) {
    const { name, email, subject, message } = req.body;

    try {
        const newContact = new Contact({
            name,
            email,
            subject,
            message
        });

        await newContact.save();

        res.status(200).json({
            success: true,
            message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.'
        });
    } catch (err) {
        console.error('Contact save error:', err);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.',
            error: err.message
        });
    }
});

// ========================= ABOUT & SUPPORT ====================
router.get('/about', function (req, res) {
    res.status(200).json({ success: true, title: 'Về chúng tôi' });
});

router.get('/help', function (req, res) {
    res.status(200).json({
        success: true,
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
    res.status(200).json({
        success: true,
        title: 'Câu hỏi thường gặp',
        faqs: [
            { question: 'Thời gian giao hàng bao lâu?', answer: 'Đơn nội thành 1-2 ngày, toàn quốc từ 3-5 ngày làm việc.' },
            { question: 'Làm sao để đổi size?', answer: 'Liên hệ hotline hoặc chat để được cấp mã đổi size miễn phí.' },
            { question: 'Tôi có thể kiểm tra hàng trước khi thanh toán không?', answer: 'Có, bạn được kiểm tra sản phẩm trước khi thanh toán COD.' }
        ]
    });
});

// Checkout routes removed

// ========================= OTHER PAGES =======================
// ========================= OTHER PAGES =======================
// Detail route removed

// ========================= WISHLIST ==========================
// Wishlist route removed

// ========================= SHOP ==============================
// ========================= SHOP ==============================
router.get('/shop', async function (req, res) {
    try {
        const category = req.query.category || '';
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



        // Sort default to newest
        let sortOption = { createdAt: -1 };

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Fetch Shop Banners
        // Banner fetch removed

        const totalPages = Math.ceil(totalProducts / limit);

        // Map _id for view
        const mapProducts = (list) => list.map(p => ({ ...p, id: p._id.toString() }));

        res.status(200).json({
            success: true,
            title: 'Shop Page',
            products: mapProducts(products),
            category,
            page,
            limit,
            totalProducts,
            totalPages,
            searchQuery
        });
    } catch (err) {
        console.error('Shop page error:', err);
        res.status(500).json({ success: false, message: 'Lỗi tải trang cửa hàng', error: err.message });
    }
});

module.exports = router;

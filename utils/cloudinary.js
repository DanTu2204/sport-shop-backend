const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cấu hình Cloudinary với thông tin từ biến môi trường
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage cho ảnh sản phẩm / banner
const productStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sport-shop/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
});

// Storage cho avatar người dùng
const avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sport-shop/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face', quality: 'auto' }],
    },
});

const uploadProduct = multer({ storage: productStorage });
const uploadAvatar = multer({ storage: avatarStorage });

module.exports = { cloudinary, uploadProduct, uploadAvatar };

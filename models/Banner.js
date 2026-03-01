const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BannerSchema = new Schema({
    title: { type: String, required: true },
    position: {
        type: String,
        required: true,
        enum: ['home-carousel', 'home-sidebar', 'shop-top', 'shop-sidebar']
    }, // E.g., 'home-main', 'sidebar', etc.
    order: { type: Number, default: 0 },
    image: { type: String, required: true }, // Path to image
    link: { type: String },
    openInNewTab: { type: Boolean, default: false },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('banners', BannerSchema);

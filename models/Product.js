const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
    code: { type: String, required: true, unique: true }, // Mã SP (SP01, SP02...)
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    image: { type: String },
    description: { type: String },
    oldPrice: { type: Number },
    stars: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    color: { type: String },
    sizes: [{
        size: { type: String, required: true },
        quantity: { type: Number, required: true, default: 0 }
    }],
    size: { type: String }, // support legacy single size string if needed, or display string
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance optimization
ProductSchema.index({ status: 1, category: 1 });
ProductSchema.index({ status: 1, stars: -1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ name: 'text' }); // For faster search

module.exports = mongoose.model('products', ProductSchema);

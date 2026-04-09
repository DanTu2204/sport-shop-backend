const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VoucherSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    type: {
        type: String,
        enum: ['percent', 'fixed'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    maxUsage: {
        type: Number,
        default: null // null implies unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    description: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('vouchers', VoucherSchema);

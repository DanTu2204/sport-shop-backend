const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    companyName: { type: String, default: 'SportShop' },
    address: { type: String, default: '123 Street, City, Country' },
    email: { type: String, default: 'info@example.com' },
    phone: { type: String, default: '+012 345 6789' },
    workingHours: { type: String, default: 'Mon - Fri: 8AM - 5PM' },

    // Page Content
    aboutUsRef: { type: String, default: '' }, // We can store HTML or text here
    commitmentRef: { type: String, default: '' }, // New field for Commitment section
    helpContent: { type: String, default: '' },
    faqContent: { type: String, default: '' },
    contactInfoRef: { type: String, default: '' }, // Additional contact info text

    updatedAt: { type: Date, default: Date.now }
});

// Singleton pattern helper
systemConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne().lean();
    if (!config) {
        const newConfig = await this.create({});
        return newConfig.toObject();
    }
    return config;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

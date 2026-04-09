const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');

mongoose.connect('mongodb://localhost:27017/Sport')
    .then(async () => {
        try {
            console.log('Fetching active categories...');
            const categories = await Category.find({ status: 'active' });
            console.log(`Found ${categories.length} active categories.`);

            for (let cat of categories) {
                const count = await Product.countDocuments({ category: cat.name, status: 'active' });
                const product = await Product.findOne({ category: cat.name, status: 'active', image: { $exists: true, $ne: '' } });
                console.log(`- Name: ${cat.name}, Products: ${count}, Image: ${product ? 'Yes' : 'No'}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            mongoose.disconnect();
        }
    });

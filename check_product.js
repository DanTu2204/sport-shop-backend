const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect('mongodb://localhost:27017/Sport')
    .then(async () => {
        try {
            console.log('Finding product 694bf2202ef55f73769a7b38...');
            const product = await Product.findById('694bf2202ef55f73769a7b38');
            console.log(JSON.stringify(product, null, 2));
        } catch (e) {
            console.error(e);
        } finally {
            mongoose.disconnect();
        }
    });

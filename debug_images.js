const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect('mongodb://localhost:27017/Sport').then(async () => {
    console.log('Connected to DB');

    // Check Featured Products (Active, limited to 8, sorted by stars)
    const featured = await Product.find({ status: 'active' }).limit(8).sort({ stars: -1 });

    console.log('--- FEATURED PRODUCTS IMAGE PATHS ---');
    featured.forEach(p => {
        console.log(`[${p.name}] Image: "${p.image}"`);
    });

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});

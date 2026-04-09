const mongoose = require('mongoose');
const Review = require('./models/Review');

mongoose.connect('mongodb://localhost:27017/Sport')
    .then(async () => {
        try {
            console.log('Fetching all reviews...');
            const reviews = await Review.find().lean();
            console.log(`Found ${reviews.length} reviews.`);
            reviews.forEach(r => {
                console.log(`Review ID: ${r._id}`);
                console.log(`Product ID: ${r.product} (Type: ${typeof r.product})`);
                console.log(`Stars: ${r.stars}, Comment: ${r.comment}`);
                console.log('---');
            });
        } catch (e) {
            console.error(e);
        } finally {
            mongoose.disconnect();
        }
    });

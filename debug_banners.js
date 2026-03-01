const mongoose = require('mongoose');
const Banner = require('./models/Banner');

mongoose.connect('mongodb://localhost:27017/Sport').then(async () => {
    console.log('Connected to DB');

    const allBanners = await Banner.find({});
    console.log('--- ALL BANNERS ---');
    console.log(JSON.stringify(allBanners, null, 2));

    const query = {
        position: 'home-carousel',
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    };

    console.log('--- QUERY PARAMS ---');
    console.log('Now:', new Date());
    console.log('Query:', JSON.stringify(query, null, 2));

    const matchedBanners = await Banner.find(query);
    console.log('--- MATCHED BANNERS ---');
    console.log(JSON.stringify(matchedBanners, null, 2));

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});

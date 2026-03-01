// Update to be robust
const mongoose = require('mongoose');
const User = require('./models/User'); // Registers 'users'
const Review = require('./models/Review'); // Registers 'Review' and refs 'users'

mongoose.connect('mongodb://localhost:27017/Sport')
    .then(async () => {
        try {
            console.log('Fetching reviews with user population...');
            const reviews = await Review.find().populate('user').lean();

            if (reviews.length === 0) {
                console.log('No reviews found.');
            } else {
                console.log(`Found ${reviews.length} reviews.`);
                reviews.forEach((r, index) => {
                    console.log(`[Review ${index + 1}]`);
                    console.log(`  ID: ${r._id}`);
                    console.log(`  Current User Field Value:`, r.user);
                    if (r.user) {
                        console.log(`  User Name: '${r.user.name}'`);
                        console.log(`  User Email: '${r.user.email}'`);
                    } else {
                        console.log('  CRITICAL: User field is null/undefined after populate!');
                    }
                    console.log(`  Comment: ${r.comment}`);
                });
            }

        } catch (e) {
            console.error(e);
        } finally {
            mongoose.disconnect();
        }
    });

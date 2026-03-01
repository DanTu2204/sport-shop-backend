const mongoose = require('mongoose');
const Contact = require('./models/Contact'); // Adjust path as needed

// Connect to MongoDB (Copy connection string from app.js or similar if known, assuming default or finding it)
// Looking at previous context or files, I should find the connection string.
// Let's assume standard local connection or wait for user to run it.
// Actually, better to check app.js first to get connection string.
// For now, I'll put a placeholder or try to read app.js.
// Wait, I can't check app.js in this same turn effectively without delaying writing this.
// I will create a focused script that connects, finds documents, and exits.

// NOTE: Please ensure the MongoDB URI matches your configuration.
const mongoURI = 'mongodb://localhost:27017/Sport';

mongoose.connect(mongoURI)
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            const contacts = await Contact.find().sort({ createdAt: -1 }).limit(5);
            console.log('Latest 5 Contacts:');
            console.log(JSON.stringify(contacts, null, 2));
        } catch (err) {
            console.error('Error fetching contacts:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error('Connection error:', err));

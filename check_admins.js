const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Sport';

async function check() {
    await mongoose.connect(URI);
    console.log('Connected');

    const admins = await User.find({ role: 'admin' });
    console.log('Admin accounts found:', admins.length);

    for (const admin of admins) {
        const isMatch = await bcrypt.compare('admin123', admin.password);
        console.log(`Email: ${admin.email}, Role: ${admin.role}, Password Match (admin123): ${isMatch}`);
    }

    await mongoose.disconnect();
}

check();

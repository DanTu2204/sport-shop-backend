const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcryptjs = require('bcryptjs');

// GET /demo - Danh sách người dùng
router.get('/', async (req, res) => {
    try {
        const users = await User.find().lean();
        res.render('demo', {
            layout: false, // Không dùng layout mặc định để tránh lỗi giao diện
            users: users,
            title: 'Backend Demo - User Management'
        });
    } catch (err) {
        console.error('Demo page error:', err);
        res.status(500).send('Lỗi tải trang demo: ' + err.message);
    }
});

// POST /demo/add - Thêm người dùng
router.post('/add', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        const hashedPassword = await bcryptjs.hash(password || '123456', 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: role || 'user'
        });

        await newUser.save();
        res.redirect('/demo');
    } catch (err) {
        console.error('Add user error:', err);
        res.status(500).send('Lỗi thêm người dùng: ' + err.message);
    }
});

// POST /demo/edit/:id - Sửa người dùng
router.post('/edit/:id', async (req, res) => {
    try {
        const { name, email, phone, role } = req.body;
        await User.findByIdAndUpdate(req.params.id, {
            name,
            email,
            phone,
            role
        });
        res.redirect('/demo');
    } catch (err) {
        console.error('Edit user error:', err);
        res.status(500).send('Lỗi cập nhật người dùng: ' + err.message);
    }
});

// POST /demo/delete/:id - Xóa người dùng
router.post('/delete/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/demo');
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).send('Lỗi xóa người dùng: ' + err.message);
    }
});

module.exports = router;

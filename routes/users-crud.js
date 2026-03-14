const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET BASE_API/users -> hiển thị danh sách users
router.get('/', async (req, res) => {
    try {
        // Find users that have a numeric id and return only id and name
        const users = await User.find({ id: { $exists: true } }, 'id name -_id').sort({ id: 1 }).lean();

        // Return standard JSON array
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// GET BASE_API/users/:id -> users có id=:id
router.get('/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const user = await User.findOne({ id: userId }, 'id name -_id').lean();

        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;

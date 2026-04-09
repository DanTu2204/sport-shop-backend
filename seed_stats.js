const mongoose = require('mongoose');
const Order = require('./models/Order');
const Product = require('./models/Product');

mongoose.connect('mongodb://localhost:27017/sportshop')
    .then(async () => {
        console.log('Connected. Seeding statistics data...');
        
        // Check products
        let products = await Product.find().limit(5);
        if (products.length === 0) {
            console.log('No products found. Creating fake products...');
            await Product.insertMany([
                { code: 'SP001', name: 'Giày Thể Thao Pro', price: 1500000, quantity: 100, category: 'Giày', image: '/images/default.jpg', status: 'active' },
                { code: 'SP002', name: 'Áo Thun Run', price: 350000, quantity: 200, category: 'Áo', image: '/images/default.jpg', status: 'active' },
                { code: 'SP003', name: 'Balo Thể Thao', price: 500000, quantity: 50, category: 'Phụ kiện', image: '/images/default.jpg', status: 'active' }
            ]);
            products = await Product.find().limit(5);
        }

        const fakeData = [
            {
                contact: {
                    firstName: "Nguyễn", lastName: "Văn A", email: "a@gmail.com", phone: "0123456789", address: "123 Street", city: "HCM", district: "Q1"
                },
                items: [
                    { productId: products[0]._id, name: products[0].name, price: products[0].price, quantity: 2, image: products[0].image },
                    ...(products.length > 1 ? [{ productId: products[1]._id, name: products[1].name, price: products[1].price, quantity: 1, image: products[1].image }] : [])
                ],
                subtotal: products[0].price * 2 + (products.length > 1 ? products[1].price : 0),
                totalPrice: products[0].price * 2 + (products.length > 1 ? products[1].price : 0),
                paymentMethod: 'cod',
                status: 'completed',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
            },
            {
                contact: {
                    firstName: "Trần", lastName: "Thị B", email: "b@gmail.com", phone: "0987654321", address: "456 Street", city: "HN", district: "Q Đống Đa"
                },
                items: [
                    { productId: products[0]._id, name: products[0].name, price: products[0].price, quantity: 5, image: products[0].image },
                ],
                subtotal: products[0].price * 5,
                totalPrice: products[0].price * 5,
                paymentMethod: 'momo',
                status: 'completed',
                createdAt: new Date() // Today
            }
        ];

        if (products.length > 2) {
             fakeData.push({
                contact: {
                    firstName: "Lê", lastName: "Văn C", email: "c@gmail.com", phone: "0123999999", address: "789 Street", city: "DN", district: "Q Hải Châu"
                },
                items: [
                    { productId: products[2]._id, name: products[2].name, price: products[2].price, quantity: 3, image: products[2].image },
                ],
                subtotal: products[2].price * 3,
                totalPrice: products[2].price * 3,
                paymentMethod: 'banktransfer',
                status: 'completed',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
            });
        }

        await Order.insertMany(fakeData);
        console.log('Seeded completely! You can view statistics now.');
        process.exit(0);
    }).catch(e => {
        console.error(e);
        process.exit(1);
    });

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const UserSchema = new Schema({
    id: { type: Number },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 5,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    phone: { type: String },
    address: { type: String },
    birthday: { type: Date },
    intro: { type: String },
    image: { type: String },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    cart: [{
        id: String,
        name: String,
        price: Number,
        image: String,
        qty: Number
    }]

});
//const User = mongoose.model('User', userSchema);
//module.exports = User;
module.exports = mongoose.model('users', UserSchema);
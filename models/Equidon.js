const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    city: String,
    location: String,
    equipment: [{
        category: String,
        item: String,
        quantity: Number,
        status: String,
        situation: String,
    }],
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
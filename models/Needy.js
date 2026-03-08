const mongoose = require('mongoose');

const needySchema = new mongoose.Schema({
    emailId: { type: String, required: true, unique: true },
    contactNumber: { type: String, required: true },
    name: String,
    dob: String,
    gender: String,
    address: String,
    frontAdharUrl: String,
    backAdharUrl: String
});

module.exports = mongoose.model('needy', needySchema);
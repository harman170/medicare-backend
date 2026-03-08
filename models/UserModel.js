const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    userType: {
        type: String,
        enum: ['donor', 'needy'],
        required: true
    },
    status: {
        type: String,
        enum: ['unblock', 'blocked'],
        default: 'unblock'
    },
    dos: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// // Index for faster queries
// UserSchema.index({ email: 1 });
// UserSchema.index({ userType: 1 });
// UserSchema.index({ status: 1 });


module.exports = mongoose.model('users', UserSchema);
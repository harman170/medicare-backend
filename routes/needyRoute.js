const express = require('express');
const router = express.Router();
const Needy = require('../models/Needy');

// Create new profile
router.post('/create', async(req, res) => {
    try {
        const { emailId } = req.body;
        const existing = await Needy.findOne({ emailId });
        if (existing) return res.status(400).json({ message: 'Profile already exists' });

        const needy = new Needy(req.body);
        await needy.save();
        res.status(201).json({ message: 'Profile created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error saving profile', error: err.message });
    }
});

// Update existing profile
router.put('/update/:emailId', async(req, res) => {
    try {
        const { emailId } = req.params;
        const updated = await Needy.findOneAndUpdate({ emailId }, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Profile not found' });

        res.status(200).json({ message: 'Profile updated', profile: updated });
    } catch (err) {
        res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
});

// Fetch profile by email
router.get('/get/:emailId', async(req, res) => {
    try {
        const profile = await Needy.findOne({ emailId: req.params.emailId });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        res.status(200).json(profile);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching profile', error: err.message });
    }
});

module.exports = router;
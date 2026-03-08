const express = require("express");
const router = express.Router();
const Donor = require("../models/DonorModel");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const donorController = require("../controllers/donorController");
const { findDonorsByCityAndMedicine } = require('../controllers/donorController');
const cloudinary = require("cloudinary").v2;
const Donation = require('../models/Equidon');

cloudinary.config({
    cloud_name: 'dfyxjh3ff', // Cloudinary cloud name
    api_key: '261964541512685', // ✅ Cloudinary API key
    api_secret: 'PfRVIo1IagO5z_ZnNFI1TQ7DOLc'
});
router.use("/uploads", express.static("uploads"));

//  Utility function to save uploaded file
const saveFile = async(file) => {
    const tempPath = path.join(__dirname, "..", "uploads", `${Date.now()}_${file.name}`);
    await file.mv(tempPath); // save temp locally

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(tempPath);

    // Optionally delete temp file
    fs.unlinkSync(tempPath);

    return result.secure_url; // ✅ Return hosted URL
};

// SAVE new donor only (no update here)
router.post("/save", async(req, res) => {
    try {
        const { emailid } = req.body;

        const existing = await Donor.findOne({ emailid });
        if (existing) {
            return res.json({ status: false, msg: "Donor already exists. Use Update instead." });
        }

        let donorData = {...req.body, status: 1 };
        if (req.files && req.files.adhaarpic) {
            donorData.adhaarpic = await saveFile(req.files.adhaarpic);
        }

        if (req.files && req.files.profilepic) {
            donorData.profilepic = await saveFile(req.files.profilepic);
        }


        const newDonor = new Donor(donorData);
        await newDonor.save();

        return res.json({ status: true, msg: "Donor saved successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, msg: "Save failed" });
    }
});

// UPDATE existing donor only (emailid must match an existing donor)
router.post("/update", async(req, res) => {
    try {
        const { emailid } = req.body;

        const existing = await Donor.findOne({ emailid });
        if (!existing) {
            return res.json({ status: false, msg: "Donor not found. Use Save instead." });
        }

        let updateData = {...req.body };
        if ("medicines" in updateData) delete updateData.medicines;

        if (req.files && req.files.adhaarpic) {
            updateData.adhaarpic = await saveFile(req.files.adhaarpic);
        }

        if (req.files && req.files.profilepic) {
            updateData.profilepic = await saveFile(req.files.profilepic);
        }


        await Donor.updateOne({ emailid }, { $set: updateData });

        return res.json({ status: true, msg: "Donor updated successfully" });
    } catch (err) {
        console.error("❌ Error during update:", err);
        res.status(500).json({ status: false, msg: "Update failed", error: err.message });
    }
});



//  FETCH donor by email
router.get("/fetch/:email", async(req, res) => {
    try {
        const donor = await Donor.findOne({ emailid: req.params.email });
        if (donor) return res.json({ status: true, donor });
        else return res.json({ status: false, msg: "No donor found" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, msg: "Fetch error" });
    }
});


router.post('/', async(req, res) => {
    try {
        const { email } = req.body;

        //  Checking if donation already exists for this email
        const existing = await Donation.findOne({ email });

        if (existing) {
            return res.status(400).json({ error: 'Donation with this email already exists. Use update instead.' });
        }

        const newDonation = new Donation(req.body);
        await newDonation.save();

        res.status(201).json({ message: 'Donation saved' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save' });
    }
});


router.get('/', async(req, res) => {
    try {
        const donations = await Donation.find();
        res.json(donations);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch' });
    }
});

// PUT /api/donations/:id
router.put('/:id', async(req, res) => {
    try {
        const updated = await Donation.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) {
            return res.status(404).json({ message: 'Donation not found' });
        }
        console.log('Updated in DB:', updated);
        res.json(updated);
    } catch (err) {
        console.error('DB update error:', err.message);
        res.status(500).json({ message: 'Internal error' });
    }

});


// GET /api/donations/search?city=Nagpur&equipment=Wheelchairs
router.get('/search-equipment', async(req, res) => {
    const { city, equipment } = req.query;

    if (!city && !equipment) {
        return res.status(400).json({ message: 'City or equipment is required' });
    }

    try {
        let query = {};

        if (city && city !== 'All Cities') {
            query.city = city;
        }

        if (equipment && equipment !== 'All Equipment') {
            query.equipment = { $elemMatch: { item: equipment } };
        }

        const results = await Donation.find(query).sort({ createdAt: -1 });

        if (!results.length) {
            return res.status(404).json({ message: 'No matching donors found' });
        }

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});






router.post("/availmed", donorController.addMedicine);
// router.put("/availmed/:id", donorController.addMedicine);
router.put('/availmed/:id', donorController.updateMedicine);
router.delete('/availmed/:id', donorController.deleteMedicineById);
router.get('/availmed/:emailid', donorController.getMedicinesByEmail);
// Test endpoint to check database contents
router.get('/test-db', async(req, res) => {
  try {
    const donors = await Donor.find({});
    console.log('=== DATABASE TEST ===');
    console.log('Total donors found:', donors.length);

    donors.forEach((donor, index) => {
      console.log(`Donor ${index + 1}:`, {
        emailid: donor.emailid,
        curcity: donor.curcity,
        medicinesCount: donor.medicines?.length || 0,
        medicines: donor.medicines?.map(med => ({
          medicine: med.medicine,
          company: med.company,
          expiryDate: med.expiryDate
        }))
      });
    });

    res.json({
      totalDonors: donors.length,
      donors: donors.map(d => ({
        emailid: d.emailid,
        curcity: d.curcity,
        medicinesCount: d.medicines?.length || 0
      }))
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/donors/search?city=Indore&medicine=paracetamol
router.get('/search', findDonorsByCityAndMedicine);

// GET /api/donors/cities - Get all available cities
router.get('/cities', async(req, res) => {
    try {
        // Get all unique cities from donors
        const donorCities = await Donor.distinct('curcity').filter(city => city && city !== '');

        // Get all unique cities from donations
        const donationCities = await Donation.distinct('city').filter(city => city && city !== '');

        // Combine and deduplicate cities
        const allCities = [...new Set([...donorCities, ...donationCities])].sort();

        res.json({ cities: allCities });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ message: 'Failed to fetch cities' });
    }
});

// GET /api/donors/medicines - Get all available medicines
router.get('/medicines', async(req, res) => {
    try {
        // Get all unique medicines from donors
        const medicines = await Donor.aggregate([
            { $unwind: '$medicines' },
            { $group: { _id: null, medicines: { $addToSet: '$medicines.medicine' } } },
            { $project: { _id: 0, medicines: 1 } }
        ]);

        const allMedicines = medicines.length > 0 ? medicines[0].medicines.sort() : [];

        res.json({ medicines: allMedicines });
    } catch (error) {
        console.error('Error fetching medicines:', error);
        res.status(500).json({ message: 'Failed to fetch medicines' });
    }
});

module.exports = router;
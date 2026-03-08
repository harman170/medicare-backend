const Donor = require("../models/DonorModel");

exports.addMedicine = async(req, res) => {
    try {
        console.log('=== ADD MEDINE DEBUG ===');
        console.log('Request body:', req.body);

        const { emailid, city, _id, createdAt, updatedAt, ...medData } = req.body;

        console.log('Extracted emailid:', emailid);
        console.log('Extracted city:', city);
        console.log('Medicine data:', medData);

        //  Check if donor exists, if not → create one
        let donor = await Donor.findOne({ emailid });
        if (!donor) {
            console.log('Creating new donor with emailid:', emailid);
            donor = new Donor({ emailid, curcity: city, medicines: [] }); // Create new donor with city
        } else {
            // Update existing donor's city if provided
            if (city && city !== donor.curcity) {
                console.log('Updating donor city from', donor.curcity, 'to', city);
                donor.curcity = city;
            }
        }

        // ✅  Add medicine (addedAt is handled by schema)
        donor.medicines.push(medData);

        console.log('Medicine to add:', medData);
        console.log('Donor medicines before save:', donor.medicines.length);

        await donor.save(); // Save to DB

        console.log('Donor saved successfully');
        console.log('Total medicines after save:', donor.medicines.length);

        res.status(200).json({
            success: true,
            medicine: medData,
            message: "Medicine added successfully"
        });

    } catch (error) {
        console.error('=== ADD MEDICINE ERROR ===');
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            error: "Failed to add medicine",
            details: error.message
        });
    }
};

exports.updateMedicine = async(req, res) => {
    const medId = req.params.id;

    try {
        const donor = await Donor.findOneAndUpdate({ "medicines._id": medId }, {
            $set: {
                "medicines.$": req.body
            }
        }, { new: true });

        if (!donor) {
            return res.status(404).json({ message: "Medicine not found" });
        }

        res.json({ message: "Medicine updated successfully", medicine: req.body });

    } catch (error) {
        console.error("Error during update:", error);
        res.status(500).json({ message: "Update failed", error: error.message });
    }
};

exports.deleteMedicineById = async(req, res) => {
    const medId = req.params.id;

    try {
        // Find the donor who has this medicine (by checking subdocument _id)
        const donor = await Donor.findOne({ "medicines._id": medId });

        if (!donor) {
            return res.status(404).json({ message: "Medicine not found" });
        }

        // Remove the medicine from the medicines array
        donor.medicines = donor.medicines.filter(med => med._id.toString() !== medId);
        await donor.save();

        res.json({ message: "Medicine deleted successfully" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Error deleting medicine" });
    }
};

exports.getMedicinesByEmail = async(req, res) => {
    try {
        const donor = await Donor.findOne({ emailid: req.params.emailid });
        if (!donor) return res.status(404).json({ message: "No donor found" });

        res.status(200).json({ medicines: donor.medicines });
    } catch (err) {
        res.status(500).json({ message: "Error fetching medicines", error: err.message });
    }
};

exports.findDonorsByCityAndMedicine = async(req, res) => {
    try {
        const { city, medicine } = req.query;

        console.log('=== SEARCH CONTROLLER DEBUG ===');
        console.log('Search params:', { city, medicine });

        if (!city || !medicine) {
            return res.status(400).json({ message: "City and medicine are required" });
        }

        const donors = await Donor.find({
            curcity: city,
            medicines: {
                $elemMatch: {
                    medicine: { $regex: new RegExp(medicine, 'i') }
                }
            }
        }).select('emailid name curcity curaddress contact medicines adhaarpic profilepic');

        console.log('Found donors:', donors.length);

        // Filter medicines to only show matching ones
        const results = donors.map(donor => {
            const matchingMedicines = donor.medicines.filter(med =>
                med.medicine.toLowerCase().includes(medicine.toLowerCase())
            );

            console.log(`Donor ${donor.emailid}:`, {
                name: donor.name,
                city: donor.curcity,
                totalMedicines: donor.medicines?.length || 0,
                matchingMedicines: matchingMedicines.length
            });

            return {
                ...donor.toObject(),
                medicines: matchingMedicines
            };
        }).filter(donor => donor.medicines && donor.medicines.length > 0);

        console.log('Final results:', results);

        res.status(200).json(results);
    } catch (error) {
        console.error('Error searching donors:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


exports.getDonorProfile = async(req, res) => {
    try {
        const donor = await Donor.findById(req.params.id).lean();

        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }

        // Process image URL
        if (donor.frontAdharUrl) {
            donor.frontAdharUrl = donor.frontAdharUrl.startsWith('http') ?
                donor.frontAdharUrl :
                `https://res.cloudinary.com/YOUR_CLOUD_NAME/${donor.frontAdharUrl}`;
        }

        res.status(200).json(donor);

    } catch (error) {
        console.error("Error fetching donor profile:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};
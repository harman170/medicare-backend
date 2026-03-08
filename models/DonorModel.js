const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({
    medicine: String,
    company: String,
    expiryDate: String,
    packing: String,
    qty: String,
    otherInfo: String,
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const donorSchema = new mongoose.Schema({
    emailid: String,
    name: String,
    age: Number,
    gender: String,
    curaddress: String,
    curcity: String,
    contact: String,
    qualification: String,
    occupation: String,
    adhaarpic: String,
    profilepic: String,
    status: { type: Number, default: 1 },
    // donor fields...
    medicines: [medicineSchema]
});







module.exports = mongoose.model("donors", donorSchema);
// Collection name = donors
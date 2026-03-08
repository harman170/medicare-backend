const express = require("express");
const mongoose = require("mongoose");
require('dotenv').config();
const cors = require("cors");
const fileUpload = require("express-fileupload");
const userRoutes = require('./routes/userRoutes');
const donorRoutes = require("./routes/donorRoutes");
const needyRoutes = require('./routes/needyRoute');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use("/uploads", express.static("uploads"));


//  Use routes
app.use("/api/users", userRoutes);
app.use("/api/donors", donorRoutes);
app.use('/api/needy', needyRoutes);
app.use('/api/donations', donorRoutes);


// Default route
app.get("/", (req, res) => {
    res.send("🚀 MediShare backend running...");
});

//  Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
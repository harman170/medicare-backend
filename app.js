const express = require("express");
const mongoose = require("mongoose");
require('dotenv').config();
const cors = require("cors");
const fileUpload = require("express-fileupload");
const userRoutes = require('./routes/userRoutes');
const donorRoutes = require("./routes/donorRoutes");
const needyRoutes = require('./routes/needyRoute');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
if (!mongoUri) {
  throw new Error('Missing MongoDB URI. Set MONGODB_URI or MONGO_URL.');
}

if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  throw new Error('Invalid MongoDB URI format. It must start with "mongodb://" or "mongodb+srv://".');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Simple wildcard CORS - should allow all origins
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

// Simple health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Backend is healthy",
        timestamp: new Date().toISOString()
    });
});

// Debug route
app.get("/debug", (req, res) => {
    res.json({
        status: true,
        msg: "Backend is working!",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        routes: {
            users: "/api/users",
            donors: "/api/donors",
            needy: "/api/needy",
            donations: "/api/donations"
        }
    });
});

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to MongoDB Atlas (db: ${mongoose.connection.name})`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message || err);
    process.exit(1);
  }
};

startServer();
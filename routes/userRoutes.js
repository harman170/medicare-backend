const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const UserModel = require("../models/UserModel");
const nodemailer = require("nodemailer");

// JWT Secrets
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Enhanced token expiry times
const ACCESS_TOKEN_EXPIRY = '5s'; // 30 minutes - good balance
const REFRESH_TOKEN_EXPIRY = '1m'; // 7 days

// In-memory refresh token store (in production, use Redis or database)
const refreshTokenStore = new Map();

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ status: false, msg: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ status: false, msg: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });
};

// Helper function to generate tokens with rotation
const generateTokens = (userId, email, userType) => {


    const accessToken = jwt.sign({ id: userId, email, userType },
        JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign({ id: userId, email, tokenVersion: Date.now() },
        JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY } // Ensure this line uses REFRESH_TOKEN_EXPIRY
    );

    refreshTokenStore.set(userId.toString(), refreshToken);
    return { accessToken, refreshToken };
};

// Helper function to invalidate refresh token
const invalidateRefreshToken = (userId) => {
    refreshTokenStore.delete(userId.toString());
};

// Helper function to validate refresh token
const isValidRefreshToken = (userId, token) => {
    const storedToken = refreshTokenStore.get(userId.toString());
    return storedToken === token;
};

// --- Signup Route ---
router.post("/signup", async(req, res) => {
    try {
        const { email, password, userType } = req.body;

        // Input validation
        if (!email || !password || !userType) {
            return res.status(400).json({
                status: false,
                msg: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: false,
                msg: "Password must be at least 6 characters long"
            });
        }

        // Check if user already exists
        const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                status: false,
                msg: "User with this email already exists"
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new UserModel({
            email: email.toLowerCase(),
            password: hashedPassword,
            userType,
            status: "unblock",
            dos: new Date()
        });

        await newUser.save();

        // Send welcome email (non-blocking)
        setImmediate(async () => {
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER || "harmanjotk173@gmail.com",
                        pass: process.env.EMAIL_PASS || "wyvl vodv nzzr rwfg"
                    }
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER || "harmanjotk173@gmail.com",
                    to: email,
                    subject: "Welcome to MediShare - Signup Successful",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #3B82F6;">Welcome to MediShare!</h2>
                            <p>Dear ${email.split('@')[0]},</p>
                            <p>You have successfully signed up on MediShare as a <strong>${userType}</strong>.</p>
                            <p>You can now login to your account and start connecting with healthcare professionals worldwide.</p>
                            <p>Thank you for joining our community!</p>
                            <p>Best regards,<br>The MediShare Team</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log("Welcome email sent successfully to:", email);
            } catch (emailError) {
                console.error("Email send error (non-blocking):", emailError);
            }
        });

        res.status(201).json({
            status: true,
            msg: "Signup successful! Welcome email sent."
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            status: false,
            msg: "Signup failed",
            error: error.message
        });
    }
});

// --- Login Route ---
router.post("/login", async(req, res) => {
    const { email, password } = req.body;

    try {
        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                status: false,
                msg: "Email and password are required"
            });
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({
                status: false,
                msg: "Invalid email or password"
            });
        }

        // Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: false,
                msg: "Invalid email or password"
            });
        }

        // Check if user is blocked
        if (user.status === "blocked") {
            return res.status(403).json({
                status: false,
                msg: "Your account has been blocked. Please contact support."
            });
        }

        // Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(user._id, user.email, user.userType);

        // Update last login
        await UserModel.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        console.log("✅ User logged in successfully:", user.email);

        return res.json({
            status: true,
            msg: "Login successful",
            token: accessToken,
            refreshToken: refreshToken,
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType,
                status: user.status,
                dos: user.dos
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            status: false,
            msg: "Server error during login"
        });
    }
});

// --- Enhanced Refresh Token Route ---
router.post("/refresh-token", async(req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({
            status: false,
            msg: "Refresh token required"
        });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Check if refresh token is still valid in our store
        if (!isValidRefreshToken(decoded.id, refreshToken)) {
            return res.status(403).json({
                status: false,
                msg: "Invalid refresh token"
            });
        }

        // Get user from database
        const user = await UserModel.findById(decoded.id);
        if (!user || user.status === "blocked") {
            invalidateRefreshToken(decoded.id);
            return res.status(403).json({
                status: false,
                msg: "User not found or blocked"
            });
        }

        // Generate new tokens (including new refresh token for rotation)
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(
            user._id,
            user.email,
            user.userType
        );

        console.log("🔄 Token refreshed for user:", user.email);

        res.json({
            status: true,
            token: accessToken,
            refreshToken: newRefreshToken, // Return new refresh token
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType,
                status: user.status
            }
        });
    } catch (error) {
        console.error("Refresh token error:", error);

        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(403).json({
                status: false,
                msg: "Invalid or expired refresh token"
            });
        }

        res.status(500).json({
            status: false,
            msg: "Server error"
        });
    }
});

// --- Enhanced Logout Route ---
router.post("/logout", authenticateToken, async(req, res) => {
    try {
        // Invalidate refresh token
        invalidateRefreshToken(req.user.id);

        console.log("👋 User logged out:", req.user.email);

        res.json({
            status: true,
            msg: "Logged out successfully"
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            status: false,
            msg: "Server error during logout"
        });
    }
});

// --- Get User Profile (Protected Route) ---
router.get("/profile", authenticateToken, async(req, res) => {
    try {
        const user = await UserModel.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        res.json({
            status: true,
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType,
                status: user.status,
                dos: user.dos,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            status: false,
            msg: "Server error"
        });
    }
});

// --- Forgot Password Route ---
router.post("/forgot-password", async(req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({
                status: false,
                msg: "Email is required"
            });
        }

        const user = await UserModel.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User with this email does not exist"
            });
        }

        // Generate reset token (expires in 1 hour)
        const resetToken = jwt.sign({ id: user._id, email: user.email, purpose: 'password_reset' },
            JWT_SECRET, { expiresIn: '1h' }
        );

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "harmanjotk173@gmail.com",
                pass: "wyvl vodv nzzr rwfg"
            }
        });

        const mailOptions = {
            from: "harmanjotk173@gmail.com",
            to: email,
            subject: "MediShare - Password Reset Request",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3B82F6;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password for your MediShare account.</p>
                    <p>Your password reset token is:</p>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 16px; word-break: break-all;">
                        ${resetToken}
                    </div>
                    <p><strong>This token will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <p>Best regards,<br>The MediShare Team</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            status: true,
            msg: "Password reset token sent to your email"
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            status: false,
            msg: "Failed to send reset email"
        });
    }
});

// --- Reset Password Route ---
router.post("/reset-password", async(req, res) => {
    const { token, newPassword } = req.body;

    try {
        if (!token || !newPassword) {
            return res.status(400).json({
                status: false,
                msg: "Token and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: false,
                msg: "Password must be at least 6 characters long"
            });
        }

        // Verify the reset token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Ensure it's a password reset token
        if (decoded.purpose !== 'password_reset') {
            return res.status(400).json({
                status: false,
                msg: "Invalid reset token"
            });
        }

        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password and invalidate all refresh tokens
        await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword });
        invalidateRefreshToken(user._id);

        // Send confirmation email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "harmanjotk173@gmail.com",
                pass: "wyvl vodv nzzr rwfg"
            }
        });

        const mailOptions = {
            from: "harmanjotk173@gmail.com",
            to: user.email,
            subject: "MediShare - Password Reset Successful",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10B981;">Password Reset Successful</h2>
                    <p>Hello,</p>
                    <p>Your password has been successfully reset for your MediShare account.</p>
                    <p>You can now login with your new password.</p>
                    <p>If you didn't make this change, please contact support immediately.</p>
                    <p>Best regards,<br>The MediShare Team</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            status: true,
            msg: "Password reset successfully"
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(400).json({
                status: false,
                msg: "Invalid or expired reset token"
            });
        }

        console.error("Reset password error:", error);
        res.status(500).json({
            status: false,
            msg: "Failed to reset password"
        });
    }
});

// --- Update Profile Route (Protected) ---
router.put("/profile", authenticateToken, async(req, res) => {
    try {
        const { userType } = req.body;

        const updatedUser = await UserModel.findByIdAndUpdate(
            req.user.id, { userType, updatedAt: new Date() }, { new: true, select: '-password' }
        );

        res.json({
            status: true,
            msg: "Profile updated successfully",
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
                userType: updatedUser.userType,
                status: updatedUser.status,
                dos: updatedUser.dos
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            status: false,
            msg: "Failed to update profile"
        });
    }
});

// --- Token Status Route (for debugging) ---
router.get("/token-status", authenticateToken, (req, res) => {
    res.json({
        status: true,
        msg: "Token is valid",
        user: req.user,
        serverTime: new Date().toISOString()
    });
});

module.exports = router;

const express = require('express');
const router = express.Router();   
const User = require('../models/User.js');
const { generateToken, generateTokens } = require('../utils/generateToken.js');
const { protect, refreshToken } = require('../middleware/authMiddleware.js');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Validasi input asas
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    try {
        // Semak jika pengguna sudah wujud
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Cipta pengguna baru (password akan di-hash oleh pre-save hook)
        const user = await User.create({
            name,
            email,
            password,
            // Role dan Plan akan menggunakan default dari skema
        });

        // Jika berjaya cipta, kembalikan data pengguna dan token
        if (user) {
            const tokens = generateTokens(user._id);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                plan: user.plan,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Error during registration:', error);
         // Handle validation errors from Mongoose
         if (error.name === 'ValidationError') {
             const messages = Object.values(error.errors).map(val => val.message);
             return res.status(400).json({ message: messages.join('. ') });
         }
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validasi input asas
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        // Cari pengguna berdasarkan email (termasuk password untuk perbandingan)
        const user = await User.findOne({ email }).select('+password');

        // Semak jika pengguna wujud dan password sepadan
        if (user && (await user.matchPassword(password))) {
            // Jika sepadan, hantar data pengguna dan token
            const tokens = generateTokens(user._id);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                plan: user.plan,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        } else {
            // Jika tidak wujud atau password salah
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    // Data pengguna (tanpa password) sudah ada dalam req.user dari middleware protect
     if (req.user) {
         // Boleh tambah data lain jika perlu, cth: settings
        // const settings = await Setting.findOne({ userId: req.user.id });
         res.json({
             _id: req.user._id,
             name: req.user.name,
             email: req.user.email,
             role: req.user.role,
             plan: req.user.plan,
             // settings: settings // contoh
         });
     } else {
         res.status(404).json({ message: 'User not found' }); // Sepatutnya tidak berlaku jika protect berjaya
     }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', refreshToken);

module.exports = router; 
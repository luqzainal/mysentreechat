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
                success: true,
                message: 'User registered successfully',
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    membershipPlan: user.membershipPlan,
                    createdAt: user.createdAt
                },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        } else {
            res.status(400).json({ 
                success: false,
                message: 'Invalid user data' 
            });
        }
    } catch (error) {
        console.error('Error during registration:', error);
         // Handle validation errors from Mongoose
         if (error.name === 'ValidationError') {
             const messages = Object.values(error.errors).map(val => val.message);
             return res.status(400).json({ 
                success: false,
                message: messages.join('. '),
                errorType: 'VALIDATION_ERROR'
             });
         }
         
         // Handle duplicate key errors (email already exists)
         if (error.code === 11000) {
             return res.status(400).json({ 
                success: false,
                message: 'This email is already registered. Please use a different email.',
                errorType: 'EMAIL_ALREADY_EXISTS'
             });
         }
         
        res.status(500).json({ 
            success: false,
            message: 'Server error occurred during registration. Please try again later.',
            errorType: 'SERVER_ERROR'
        });
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

        // Check if user exists first
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'This email is not registered yet. Please sign up first.',
                errorType: 'EMAIL_NOT_FOUND'
            });
        }

        // Check if password matches
        const isPasswordMatch = await user.matchPassword(password);
        if (!isPasswordMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Incorrect password. Please try again.',
                errorType: 'WRONG_PASSWORD'
            });
        }

        // If everything is correct, send user data and tokens
        const tokens = generateTokens(user._id);
        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                membershipPlan: user.membershipPlan,
                createdAt: user.createdAt
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error occurred. Please try again later.',
            errorType: 'SERVER_ERROR'
        });
    }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    // Data pengguna (tanpa password) sudah ada dalam req.user dari middleware protect
     if (req.user) {
         // Get fresh user data from database to ensure latest plan info
         const freshUser = await User.findById(req.user._id);
         
         // Boleh tambah data lain jika perlu, cth: settings
        // const settings = await Setting.findOne({ userId: req.user.id });
         res.json({
             success: true,
             user: {
                 _id: freshUser._id,
                 name: freshUser.name,
                 email: freshUser.email,
                 role: freshUser.role,
                 membershipPlan: freshUser.membershipPlan,
                 createdAt: freshUser.createdAt,
                 updatedAt: freshUser.updatedAt
                 // settings: settings // contoh
             }
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
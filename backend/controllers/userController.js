const User = require('../models/User.js');
// Tukar import io kepada require jika server.js guna module.exports
// const { io } = require('../server.js'); // Sesuaikan jika perlu
const jwt = require('jsonwebtoken'); // Tukar ke require untuk konsistensi
// Tukar import asyncHandler kepada require
const asyncHandler = require('../middleware/asyncHandler.js');
// Tukar import generateToken kepada require jika utils adalah CommonJS
const generateToken = require('../utils/generateToken.js');

// @desc    Register pengguna baru
// @route   POST /users/register
// @access  Public
// Gunakan asyncHandler untuk membungkus fungsi async
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400); // Set status dahulu
    throw new Error('Pengguna sudah wujud'); // Guna error handler
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipPlan: user.membershipPlan,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Data pengguna tidak sah');
  }
});

// @desc    Log masuk pengguna
// @route   POST /users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password'); // Pilih password untuk banding

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipPlan: user.membershipPlan,
      token: generateToken(user._id),
    });
  } else {
    res.status(401); // Unauthorized
    throw new Error('Email atau kata laluan tidak sah');
  }
});

// @desc    Dapatkan profil pengguna
// @route   GET /users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  // req.user didapatkan dari middleware protect
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipPlan: user.membershipPlan,
      createdAt: user.createdAt
    });
  } else {
    res.status(404);
    throw new Error('Pengguna tidak ditemui');
  }
});

// @desc    Kemas kini profil pengguna
// @route   PUT /users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    // Kemaskini email perlu perhatian khas (unique, etc.)
    // user.email = req.body.email || user.email;
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

     res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      membershipPlan: updatedUser.membershipPlan,
      token: generateToken(updatedUser._id),
    });

  } else {
    res.status(404);
    throw new Error('Pengguna tidak ditemui');
  }
});

// Export fungsi
// Gunakan module.exports jika fail ini dianggap CommonJS
module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile };
// Hapus export ES6
// export { registerUser, loginUser, getUserProfile, updateUserProfile }; 
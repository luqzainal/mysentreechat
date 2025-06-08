const User = require('../models/User.js');
// Tukar import io kepada require jika server.js guna module.exports
// const { io } = require('../server.js'); // Sesuaikan jika perlu
const jwt = require('jsonwebtoken'); // Tukar ke require untuk konsistensi
// Tukar import asyncHandler kepada require
const asyncHandler = require('../middleware/asyncHandler.js');
// Tukar import generateToken kepada require jika utils adalah CommonJS
const generateToken = require('../utils/generateToken.js');

// Fungsi untuk menjana kata laluan rawak
const generateRandomPassword = (length = 12) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
};

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

  // Semak jika ini adalah pengguna pertama
  const userCount = await User.countDocuments();
  const isFirstUser = userCount === 0;

  const user = await User.create({
    name,
    email,
    password,
    role: isFirstUser ? 'admin' : 'user', // Jadikan admin jika pengguna pertama
    isAdmin: isFirstUser, // Set isAdmin juga untuk pengguna pertama
    membershipPlan: isFirstUser ? 'Premium' : 'Standard', // Set membershipPlan juga untuk pengguna pertama
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

// @desc    Register pengguna baru melalui Webhook (cth: dari Make.com)
// @route   POST /api/users/register-via-webhook
// @access  Public (dilindungi oleh secret key)
const registerUserFromWebhook = asyncHandler(async (req, res) => {
  // Dapatkan secret key dari environment variable
  const WEBHOOK_SECRET_KEY = process.env.MAKE_WEBHOOK_SECRET;
  const incomingSecret = req.headers['x-webhook-secret'];

  if (!WEBHOOK_SECRET_KEY) {
    console.error("MAKE_WEBHOOK_SECRET tidak ditetapkan dalam environment variables.");
    // Jangan dedahkan masalah konfigurasi kepada client secara terus dalam production
    // res.status(500).json({ message: 'Konfigurasi pelayan tidak lengkap.' }); 
    // Sebaliknya, log ralat dan hantar mesej generik atau terima sahaja request jika dalam mod pembangunan.
    // Untuk tujuan demonstrasi, kita akan teruskan jika key tidak ditetapkan, tetapi log amaran.
    // Dalam production, anda mungkin mahu mengembalikan ralat 500 atau 401 jika key tidak ada.
  }

  if (WEBHOOK_SECRET_KEY && incomingSecret !== WEBHOOK_SECRET_KEY) {
    res.status(401);
    throw new Error('Unauthorized: Secret key tidak sah.');
  }

  const { name, email, phone } = req.body; // Anda boleh tambah field lain jika perlu

  if (!name || !email) {
    res.status(400);
    throw new Error('Nama dan emel diperlukan.');
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    // Jika pengguna sudah wujud, kita boleh pilih untuk mengembalikan ralat
    // atau mengembalikan mesej "Pengguna sudah wujud" dengan status 200/202
    // untuk menunjukkan webhook telah diterima tetapi tiada tindakan lanjut.
    // Untuk kesederhanaan, kita anggap ini bukan ralat untuk webhook.
    console.log(`Webhook: Pengguna dengan emel ${email} sudah wujud. Tiada tindakan diambil.`);
    res.status(200).json({ message: 'Pengguna sudah wujud, tiada pendaftaran baru.' });
    return;
  }

  const password = generateRandomPassword(); // Jana kata laluan rawak

  const user = await User.create({
    name,
    email,
    password, // Kata laluan yang dijana
    phone, // Simpan nombor telefon jika ada
    role: 'user', // Default role untuk pendaftaran webhook
    isAdmin: false, // Default isAdmin
    membershipPlan: 'Standard', // Default membership plan
    isVerified: true, // Anggap pengguna disahkan kerana datang dari sumber yang dipercayai (selepas pengesahan secret key)
    // Anda mungkin mahu tambah satu field untuk menandakan pengguna ini didaftar melalui webhook
    // registeredVia: 'webhook_gohighlevel' 
  });

  if (user) {
    console.log(`Pengguna baru ${email} berjaya didaftarkan melalui webhook.`);
    // Untuk webhook, kita mungkin tidak perlu hantar token JWT.
    // Cukup hantar mesej kejayaan.
    res.status(201).json({
      message: 'Pengguna berjaya didaftarkan melalui webhook.',
      userId: user._id,
      name: user.name,
      email: user.email,
    });
  } else {
    res.status(400);
    throw new Error('Data pengguna tidak sah semasa pendaftaran webhook.');
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
module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile, registerUserFromWebhook };
// Hapus export ES6
// export { registerUser, loginUser, getUserProfile, updateUserProfile }; 
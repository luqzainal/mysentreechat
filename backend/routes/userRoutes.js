const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
} = require('../controllers/userController.js');
const { protect, admin } = require('../middleware/authMiddleware.js');

router.post('/register', registerUser);
router.post('/login', loginUser);

// Laluan untuk profil pengguna
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

module.exports = router; 
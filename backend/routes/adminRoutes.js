const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById
} = require('../controllers/adminController.js');
const { protect, admin } = require('../middleware/authMiddleware.js');

// Semua laluan admin dilindungi oleh 'protect' dan 'admin' middleware
router.use(protect, admin);

// GET /api/admin/users - Dapatkan semua pengguna
router.get('/users', getAllUsers);

// Operasi pada pengguna spesifik by ID
router.route('/users/:id')
  .get(getUserById) // GET /api/admin/users/:id
  .put(updateUserById) // PUT /api/admin/users/:id
  .delete(deleteUserById); // DELETE /api/admin/users/:id

// Tambah laluan admin lain di sini nanti...

module.exports = router; 
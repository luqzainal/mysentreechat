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

// PUT /api/admin/users/:id/password - Set password untuk user
router.put('/users/:id/password', async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.params.id;

    // Validation
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters long.'
        });
    }

    try {
        const User = require('../models/User.js');
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Prevent admin from changing their own password via this endpoint
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own password using this method.'
            });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: `Password for ${user.name} has been updated successfully.`
        });

    } catch (error) {
        console.error('Error setting user password:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while setting password.'
        });
    }
});

// Tambah laluan admin lain di sini nanti...

module.exports = router; 
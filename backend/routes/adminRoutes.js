import express from 'express';
const router = express.Router();
import { getAllUsers, updateUserPlan, changeUserRole } from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js'; // Middleware pengesahan token
import { isAdmin } from '../middleware/adminMiddleware.js'; // Middleware pengesahan admin

// Laluan untuk mendapatkan semua pengguna
// Dilindungi oleh protect (mesti log masuk) dan isAdmin (mesti admin)
router.get('/users', protect, isAdmin, getAllUsers);

// Laluan baru untuk mengemaskini pelan pengguna
// :id merujuk kepada user ID yang akan dikemaskini
router.put('/users/:id/plan', protect, isAdmin, updateUserPlan);

// PUT baru untuk kemaskini role pengguna
router.put('/users/:id/role', protect, isAdmin, changeUserRole);

// Tambah laluan admin lain di sini nanti...

export default router; 
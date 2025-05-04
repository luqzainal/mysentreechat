const User = require('../models/User.js');
const WhatsappConnection = require('../models/WhatsappConnection.js');
const Campaign = require('../models/Campaign.js');
const Message = require('../models/Message.js');
const asyncHandler = require('../middleware/asyncHandler.js');

// @desc    Dapatkan semua pengguna (Admin sahaja)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
    // Pastikan hanya admin yang boleh akses (perlu middleware admin)
    const users = await User.find({}).select('-password'); // Jangan hantar password
    res.json(users);
});

// @desc    Dapatkan data pengguna spesifik by ID (Admin sahaja)
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('Pengguna tidak ditemui');
    }
});

// @desc    Kemas kini data pengguna (Admin sahaja)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.role = req.body.role || user.role;
        user.membershipPlan = req.body.membershipPlan || user.membershipPlan;
        // Kemaskini password jika ada (akan di-hash oleh pre-save hook)
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
        });
    } else {
        res.status(404);
        throw new Error('Pengguna tidak ditemui');
    }
});

// @desc    Padam pengguna (Admin sahaja)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // TODO: Pertimbangkan apa yang perlu berlaku pada data berkaitan pengguna ini
        // (devices, campaigns, messages, etc.) - Perlu cascade delete atau set null?
        // Ini operasi berbahaya, mungkin lebih baik deactivate dari delete?
        
        // Contoh: Padam semua data berkaitan (PERLU HATI-HATI)
        /*
        await WhatsappConnection.deleteMany({ userId: user._id });
        await Campaign.deleteMany({ userId: user._id });
        await Message.deleteMany({ user: user._id });
        // Padam juga settings jika ada
        await Setting.deleteOne({ userId: user._id }); 
        */

        await User.deleteOne({ _id: user._id }); // Padam pengguna
        res.json({ message: 'Pengguna berjaya dipadam' });
    } else {
        res.status(404);
        throw new Error('Pengguna tidak ditemui');
    }
});

// Guna module.exports
module.exports = {
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById
}; 
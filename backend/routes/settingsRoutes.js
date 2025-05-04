const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Middleware untuk proteksi
const Setting = require('../models/Settings');

// @desc    Get AI settings for the logged in user
// @route   GET /api/settings/ai
// @access  Private
router.get('/ai', protect, async (req, res) => {
  try {
    let settings = await Setting.findOne({ userId: req.user.id }).select('openaiApiKey');
    if (!settings) {
      // Jika tiada settings, cipta satu dokumen kosong (atau kembalikan default)
      // settings = await Setting.create({ userId: req.user.id }); 
       return res.json({ openaiApiKey: '' }); // Kembalikan string kosong jika tiada
    }
     // Perlu ambil balik field openaiApiKey kerana ia `select: false`
    settings = await Setting.findById(settings._id).select('openaiApiKey');
    res.json({ openaiApiKey: settings.openaiApiKey || '' });
  } catch (error) {
    console.error('Error getting AI settings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update AI settings for the logged in user
// @route   PUT /api/settings/ai
// @access  Private
router.put('/ai', protect, async (req, res) => {
  const { openaiApiKey } = req.body;

  if (typeof openaiApiKey === 'undefined') {
      return res.status(400).json({ message: 'openaiApiKey is required' });
  }

  try {
    let settings = await Setting.findOne({ userId: req.user.id });

    if (!settings) {
      // Jika tiada, cipta baru
      settings = await Setting.create({
        userId: req.user.id,
        openaiApiKey: openaiApiKey
      });
    } else {
      // Jika ada, kemaskini
      settings.openaiApiKey = openaiApiKey;
      await settings.save();
    }

    res.json({ message: 'AI settings updated successfully' });

  } catch (error) {
    console.error('Error updating AI settings:', error);
     if (error.code === 11000) { // Duplicate key error (sepatutnya tidak berlaku jika logik findOneAndUpdate betul)
         return res.status(400).json({ message: 'Settings already exist for user' });
     }
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router; 
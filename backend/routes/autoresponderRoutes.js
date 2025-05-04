const express = require('express');
const router = express.Router();
const {
  getAutoresponderSettings,
  updateAutoresponderSettings,
  addSavedResponse,
  removeSavedResponse
} = require('../controllers/autoresponderController.js');
const { protect } = require('../middleware/authMiddleware.js');

// Lindungi semua laluan ini
router.use(protect);

// Laluan untuk tetapan utama
router.route('/settings')
  .get(getAutoresponderSettings)
  .put(updateAutoresponderSettings);

// Laluan untuk respons tersimpan
router.route('/responses')
    .post(addSavedResponse) // Tambah respons baru
    .delete(removeSavedResponse); // Gunakan nama yang betul

module.exports = router; 
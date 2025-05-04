const express = require('express');
const router = express.Router();
const {
    getMediaList,
    uploadMedia,
    deleteMedia
} = require('../controllers/mediaController.js');
const { protect } = require('../middleware/authMiddleware.js');
const { uploadMedia: uploadMiddleware } = require('../middleware/uploadMiddleware.js');

// Lindungi semua laluan media
router.use(protect);

// Laluan untuk mendapatkan semua fail media pengguna & muat naik
router.route('/')
    .get(getMediaList)
    .post(uploadMiddleware, uploadMedia);

// Laluan untuk memadam fail media spesifik
router.route('/:id')
    .delete(deleteMedia);

module.exports = router; 
import express from 'express';
const router = express.Router();
import { getAutoresponderSettings, updateAutoresponderSettings, addSavedResponse, removeSavedResponse } from '../controllers/autoresponderController.js';
import { protect } from '../middleware/authMiddleware.js';

// Laluan untuk mendapatkan dan mengemaskini tetapan
router.route('/settings')
  .get(protect, getAutoresponderSettings)
  .put(protect, updateAutoresponderSettings);

// POST /api/autoresponder/responses - Tambah satu saved response
router.post('/responses', addSavedResponse);

// DELETE /api/autoresponder/responses - Padam satu saved response (guna query string)
router.delete('/responses', removeSavedResponse);

export default router; 
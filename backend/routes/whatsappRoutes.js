import express from 'express';
const router = express.Router();
import { sendBulkMessage } from '../controllers/whatsappController.js';
import { protect } from '../middleware/authMiddleware.js';

// Laluan untuk menghantar mesej pukal
router.post('/bulk', protect, sendBulkMessage);

export default router; 
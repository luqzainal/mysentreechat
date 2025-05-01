import express from 'express';
const router = express.Router();
import { sendBulkMessage, getChatHistory, sendMessage } from '../controllers/whatsappController.js';
import { protect } from '../middleware/authMiddleware.js';

// Laluan untuk menghantar mesej pukal
router.post('/bulk', protect, sendBulkMessage);

// Laluan baru untuk chat individu
router.get('/chat/:phoneNumber', protect, getChatHistory);
router.post('/send', protect, sendMessage);

export default router; 
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getAiDeviceSummary, updateAiDeviceStatus } = require('../controllers/aiChatbotController');

// Semua laluan di sini dilindungi
router.use(protect);

// @desc    Get summary of AI-enabled devices/numbers for AI Chatbot page
// @route   GET /api/ai-chatbot/devices-summary
// @access  Private
router.get('/devices-summary', getAiDeviceSummary);

// @desc    Update AI status for a specific device
// @route   PUT /api/ai-chatbot/devices/:deviceId/status
// @access  Private
router.put('/devices/:deviceId/status', updateAiDeviceStatus);

module.exports = router; 
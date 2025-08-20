const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadMediaAi } = require('../middleware/uploadMiddleware');
const {
    getAiDeviceSummary,
    checkAiUsage,
    getAvailableFlows,
    updateAiDeviceStatus,
    getAiCampaigns,
    getAiCampaign,
    createAiCampaign,
    updateAiCampaign,
    deleteAiCampaign,
    toggleAiCampaignStatus,
    addAiLog,
    getAiLogs,
    getAiStats,
    updateAiSettings
} = require('../controllers/aiChatbotController');

// Device routes
router.get('/devices-summary', protect, getAiDeviceSummary);
router.get('/check-ai-usage/:userId', protect, checkAiUsage);
router.get('/available-flows/:userId', protect, getAvailableFlows);
router.put('/devices/:deviceId/status', protect, updateAiDeviceStatus);

// Campaign routes
router.get('/:deviceId/campaigns', protect, getAiCampaigns);
router.get('/:deviceId/campaigns/:campaignId', protect, getAiCampaign);
router.post('/:deviceId/campaigns', protect, uploadMediaAi, createAiCampaign);
router.put('/:deviceId/campaigns/:campaignId', protect, uploadMediaAi, updateAiCampaign);
router.delete('/:deviceId/campaigns/:campaignId', protect, deleteAiCampaign);
router.put('/:deviceId/campaigns/:campaignId/status', protect, toggleAiCampaignStatus);

// AI Logs & Stats routes
router.post('/:deviceId/campaigns/:campaignId/logs', protect, addAiLog);
router.get('/:deviceId/campaigns/:campaignId/logs', protect, getAiLogs);
router.get('/:deviceId/campaigns/:campaignId/stats', protect, getAiStats);
router.put('/:deviceId/campaigns/:campaignId/settings', protect, updateAiSettings);

module.exports = router; 
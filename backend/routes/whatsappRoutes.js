const express = require('express');
const router = express.Router();
const { sendBulkMessage, getChatHistory, sendMessage, getChats } = require('../controllers/whatsappController.js');
const { protect } = require('../middleware/authMiddleware.js');
const WhatsappDevice = require('../models/WhatsappDevice.js');

// Laluan untuk mendapatkan senarai perbualan
router.get('/chats', protect, getChats);

// Laluan untuk menghantar mesej pukal
router.post('/bulk', protect, sendBulkMessage);

// Laluan baru untuk chat individu
router.get('/chat/:phoneNumber', protect, getChatHistory);
router.post('/send', protect, sendMessage);

// Debug endpoint untuk check AI campaigns
router.get('/debug/ai-campaigns', protect, async (req, res) => {
    try {
        const Campaign = require('../models/Campaign.js');
        const campaigns = await Campaign.find({ 
            userId: req.user.id, 
            type: 'ai_chatbot',
            status: 'executed'
        });
        
        res.json({
            success: true,
            count: campaigns.length,
            campaigns: campaigns.map(c => ({
                id: c._id,
                name: c.name,
                keywords: c.keywords,
                status: c.status,
                executedAt: c.executedAt,
                lastExecutedAt: c.lastExecutedAt
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// @desc    Get list of connected devices for the user
// @route   GET /api/whatsapp/devices
// @access  Private
router.get('/devices', protect, async (req, res) => {
    // TODO: Implement logic to get devices, potentially filter by connectionStatus
    try {
        const devices = await WhatsappDevice.find({ userId: req.user.id })
            // .select('-sessionData'); // Jangan hantar session data ke frontend
         // Format data mengikut keperluan frontend (cth: rename _id to id)
         const formattedDevices = devices.map(d => ({
             id: d.deviceId, // Guna deviceId sebagai ID utama di frontend
             name: d.name || `Device ${d.deviceId.substring(0, 6)}`, // Nama default
             number: d.number || 'Not Available',
             connected: d.connectionStatus === 'connected', 
             // Tambah field lain jika perlu
         }));
        res.json(formattedDevices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update the status of a specific device (contoh: enable/disable)
// @route   PUT /api/whatsapp/devices/:deviceId/status 
// @access  Private 
router.put('/devices/:deviceId/status', protect, async (req, res) => {
    const { deviceId } = req.params;
    const { isEnabled } = req.body; // Status yang dihantar dari frontend

    // TODO: Implement logic to update device status
    // Ini mungkin lebih kompleks, mungkin perlu trigger stop/start client WhatsApp
     console.log(`Received status update for device ${deviceId} to ${isEnabled}`);
    res.status(501).json({ message: `Updating status for device ${deviceId} not implemented yet` });
});

// @desc    Remove/Delete a specific device registration
// @route   DELETE /api/whatsapp/devices/:deviceId
// @access  Private
router.delete('/devices/:deviceId', protect, async (req, res) => {
    const { deviceId } = req.params;

    // TODO: Implement logic to:
    // 1. Disconnect WhatsApp client if running
    // 2. Delete device record from DB
    // 3. Possibly clean up session files
    try {
        const device = await WhatsappDevice.findOneAndDelete({ userId: req.user.id, deviceId: deviceId });
        if (!device) {
            return res.status(404).json({ message: 'Device not found or unauthorized' });
        }
         // TODO: Trigger disconnection logic here if needed
        res.json({ message: `Device ${deviceId} registration removed` });
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router; 
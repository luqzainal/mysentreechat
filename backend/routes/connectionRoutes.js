const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const connectionMonitor = require('../services/connectionMonitor.js');
const { connectToWhatsApp, destroyClientByUserId } = require('../services/baileysService.js');

// All routes are protected
router.use(protect);

// @desc    Get connection monitor status
// @route   GET /api/connection/status
// @access  Private
router.get('/status', async (req, res) => {
    try {
        const status = connectionMonitor.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting connection monitor status:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Force reconnect WhatsApp for current user
// @route   POST /api/connection/reconnect
// @access  Private
router.post('/reconnect', async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[ConnectionAPI] Manual reconnect requested for user ${userId}`);
        
        // First destroy existing connection
        await destroyClientByUserId(userId);
        
        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force reconnect
        const success = await connectionMonitor.forceReconnect(userId);
        
        if (success) {
            res.json({ 
                message: 'Reconnection initiated successfully',
                userId: userId 
            });
        } else {
            res.status(500).json({ 
                message: 'Failed to initiate reconnection' 
            });
        }
        
    } catch (error) {
        console.error('Error during manual reconnect:', error);
        res.status(500).json({ message: 'Server Error during reconnection' });
    }
});

// @desc    Reset reconnect attempts for current user
// @route   POST /api/connection/reset-attempts
// @access  Private
router.post('/reset-attempts', async (req, res) => {
    try {
        const userId = req.user.id;
        connectionMonitor.resetReconnectAttempts(userId);
        res.json({ 
            message: 'Reconnect attempts reset successfully',
            userId: userId 
        });
    } catch (error) {
        console.error('Error resetting reconnect attempts:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
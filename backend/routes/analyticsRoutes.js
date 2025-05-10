const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get chat analytics data for dashboard
// @route   GET /api/analytics/chat
// @access  Private
router.get('/chat', protect, async (req, res) => {
    // TODO: Implement logic to calculate/fetch analytics for the user
    // - Total messages sent (mungkin dari log atau collection lain)
    // - Monthly usage (perlukan data dari Campaign/Message logs dan user plan limit)
    // - Bulk messaging stats (count dari Campaign logs?)

    // Contoh data statik (gantikan dengan logik sebenar)
    const analyticsData = {
        totalSent: 10293,
        monthlyUsagePercent: 75,
        monthlyUsed: 7500,
        // Ambil had dari user plan (perlu akses data user)
        // const user = await User.findById(req.user.id);
        // monthlyLimit: user.getPlanMessageLimit(), // Anda perlu fungsi helper ini
        monthlyLimit: 10000, // Hardcoded limit
        bulkTotal: 1250,
        bulkSent: 1200,
        bulkFailed: 50,
    };

    res.json(analyticsData);
});

// @desc    Get bulk campaign summary for dashboard
// @route   GET /api/analytics/dashboard/bulk-campaign-summary
// @access  Private
router.get('/dashboard/bulk-campaign-summary', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const campaigns = await Campaign.find({
        userId: userId,
        campaignType: 'bulk' // Hanya ambil kempen pukal
    })
    .sort({ createdAt: -1 })
    .select('campaignName sentCount failedCount createdAt'); // Pilih medan yang diperlukan

    // Format data jika perlu, atau terus kembalikan
    const formattedCampaigns = campaigns.map(campaign => ({
        id: campaign._id, // Mungkin diperlukan oleh frontend untuk key
        name: campaign.campaignName,
        sent: campaign.sentCount,
        failed: campaign.failedCount,
        // date: campaign.createdAt // Boleh tambah jika mahu papar tarikh
    }));

    res.json(formattedCampaigns);
}));

// @desc    Get overall message analytics summary for dashboard
// @route   GET /api/analytics/dashboard/overall-summary
// @access  Private
router.get('/dashboard/overall-summary', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Kira Total Messages (fromMe: true)
    const totalMessages = await Message.countDocuments({
        user: userId,
        fromMe: true 
    });

    // Kira Sent Messages (status: sent, delivered, read dan fromMe: true)
    const sentMessages = await Message.countDocuments({
        user: userId,
        fromMe: true,
        status: { $in: ['sent', 'delivered', 'read'] } 
    });

    // Kira Failed Messages (status: failed dan fromMe: true)
    const failedMessages = await Message.countDocuments({
        user: userId,
        fromMe: true,
        status: 'failed' 
    });

    res.json({
        totalMessages, // Ini mungkin total semua mesej keluar, bukan total keseluruhan sistem seperti dalam imej.
                       // Imej menunjukkan "Total 31,845 Messages" yang mungkin termasuk mesej masuk atau had pelan.
                       // Untuk sekarang, kita kira mesej keluar.
        sentMessages,
        failedMessages
    });
}));

module.exports = router; 
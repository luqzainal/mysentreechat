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
    .select('campaignName sentCount failedCount createdAt deviceId'); // TAMBAH deviceId

    // Format data jika perlu, atau terus kembalikan
    const formattedCampaigns = campaigns.map(campaign => ({
        id: campaign._id, // Mungkin diperlukan oleh frontend untuk key
        name: campaign.campaignName,
        sent: campaign.sentCount,
        failed: campaign.failedCount,
        deviceId: campaign.deviceId, // TAMBAH deviceId
        // date: campaign.createdAt // Boleh tambah jika mahu papar tarikh
    }));

    res.json(formattedCampaigns);
}));

// @desc    Get overall message analytics summary for dashboard
// @route   GET /api/analytics/dashboard/overall-summary
// @access  Private
router.get('/dashboard/overall-summary', protect, asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Method 1: Count from Message model (individual message records)
    const messageStats = await Message.aggregate([
        {
            $match: {
                user: userId,
                fromMe: true
            }
        },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                sentMessages: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['sent', 'delivered', 'read']] },
                            1,
                            0
                        ]
                    }
                },
                failedFromMessages: {
                    $sum: {
                        $cond: [
                            { $eq: ['$status', 'failed'] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    // Method 2: Count from Campaign model (aggregated counts)
    const campaignStats = await Campaign.aggregate([
        {
            $match: {
                userId: userId
            }
        },
        {
            $group: {
                _id: null,
                totalFromCampaigns: { $sum: { $add: ['$sentCount', '$failedCount'] } },
                sentFromCampaigns: { $sum: '$sentCount' },
                failedFromCampaigns: { $sum: '$failedCount' }
            }
        }
    ]);

    // Use data from both sources, prioritizing campaign data for accuracy
    const messageData = messageStats[0] || { totalMessages: 0, sentMessages: 0, failedFromMessages: 0 };
    const campaignData = campaignStats[0] || { totalFromCampaigns: 0, sentFromCampaigns: 0, failedFromCampaigns: 0 };

    // Combine results - use campaign data as primary source since it's more reliable
    const totalMessages = Math.max(messageData.totalMessages, campaignData.totalFromCampaigns);
    const sentMessages = Math.max(messageData.sentMessages, campaignData.sentFromCampaigns);
    const failedMessages = Math.max(messageData.failedFromMessages, campaignData.failedFromCampaigns);

    console.log('[Analytics] Dashboard Summary:', {
        messageData,
        campaignData,
        result: { totalMessages, sentMessages, failedMessages }
    });

    res.json({
        totalMessages,
        sentMessages,
        failedMessages
    });
}));

module.exports = router; 
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

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

module.exports = router; 
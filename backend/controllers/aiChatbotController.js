const WhatsappDevice = require('../models/WhatsappDevice');
const Campaign = require('../models/Campaign');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get summary of AI-enabled devices/numbers for AI Chatbot page
// @route   GET /api/ai-chatbot/devices-summary
// @access  Private
const getAiDeviceSummary = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const devices = await WhatsappDevice.find({ userId: userId });

    const summary = await Promise.all(devices.map(async (device) => {
        const aiCampaignCount = await Campaign.countDocuments({
            userId: userId,
            deviceId: device.deviceId,
            campaignType: 'ai_chatbot'
        });

        const needsSetup = !device.isAiEnabled || (device.isAiEnabled && aiCampaignCount === 0);

        return {
            id: device.deviceId,
            name: device.name || `Device ${device.deviceId.substring(0,6)}`,
            number: device.number || 'N/A',
            avatarUrl: '',
            stats: {
                sent: 0,
                items: aiCampaignCount
            },
            statusEnabled: device.isAiEnabled,
            needsSetup: needsSetup,
            deviceConnected: device.connectionStatus === 'connected'
        };
    }));

    res.json(summary);
});

// @desc    Update AI status for a specific device
// @route   PUT /api/ai-chatbot/devices/:deviceId/status
// @access  Private
const updateAiDeviceStatus = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const { isEnabled } = req.body;
    const userId = req.user.id;

    if (typeof isEnabled !== 'boolean') {
        res.status(400);
        throw new Error('isEnabled (boolean) is required in the request body.');
    }

    const device = await WhatsappDevice.findOne({ userId: userId, deviceId: deviceId });

    if (!device) {
        res.status(404);
        throw new Error('Device not found or not authorized for this user.');
    }

    device.isAiEnabled = isEnabled;
    await device.save();

    const aiCampaignCount = await Campaign.countDocuments({
        userId: userId,
        deviceId: device.deviceId,
        campaignType: 'ai_chatbot',
        statusEnabled: true
    });
    const needsSetup = !device.isAiEnabled || (device.isAiEnabled && aiCampaignCount === 0);

    res.json({
        id: device.deviceId,
        name: device.name || `Device ${device.deviceId.substring(0,6)}`,
        number: device.number || 'N/A',
        avatarUrl: '',
        stats: {
            sent: 0,
            items: aiCampaignCount 
        },
        statusEnabled: device.isAiEnabled,
        needsSetup: needsSetup,
        deviceConnected: device.connectionStatus === 'connected'
    });
});

// @desc    Get all AI chatbot campaigns for a device
// @route   GET /api/ai-chatbot/:deviceId/campaigns
// @access  Private
const getAiCampaigns = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const userId = req.user.id;

    const campaigns = await Campaign.find({
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    }).sort({ createdAt: -1 });

    res.json(campaigns);
});

// @desc    Create new AI chatbot campaign
// @route   POST /api/ai-chatbot/:deviceId/campaigns
// @access  Private
const createAiCampaign = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const userId = req.user.id;

    // Validate device ownership
    const device = await WhatsappDevice.findOne({ userId: userId, deviceId: deviceId });
    if (!device) {
        res.status(404);
        throw new Error('Device not found or not authorized for this user.');
    }

    // Process keywords if provided as string
    if (req.body.keywords && typeof req.body.keywords === 'string') {
        req.body.keywords = req.body.keywords.split(',').map(k => k.trim()).filter(k => k);
    }

    const campaign = await Campaign.create({
        ...req.body,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    });

    res.status(201).json(campaign);
});

// @desc    Update AI chatbot campaign
// @route   PUT /api/ai-chatbot/:deviceId/campaigns/:campaignId
// @access  Private
const updateAiCampaign = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;

    // Validate device ownership
    const device = await WhatsappDevice.findOne({ userId: userId, deviceId: deviceId });
    if (!device) {
        res.status(404);
        throw new Error('Device not found or not authorized for this user.');
    }

    // Process keywords if provided as string
    if (req.body.keywords && typeof req.body.keywords === 'string') {
        req.body.keywords = req.body.keywords.split(',').map(k => k.trim()).filter(k => k);
    }

    const campaign = await Campaign.findOneAndUpdate(
        { _id: campaignId, userId: userId, deviceId: deviceId, campaignType: 'ai_chatbot' },
        req.body,
        { new: true, runValidators: true }
    );

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    res.json(campaign);
});

// @desc    Delete AI chatbot campaign
// @route   DELETE /api/ai-chatbot/:deviceId/campaigns/:campaignId
// @access  Private
const deleteAiCampaign = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;

    const campaign = await Campaign.findOneAndDelete({
        _id: campaignId,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    });

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    res.json({ message: 'Campaign deleted successfully' });
});

// @desc    Toggle AI chatbot campaign status
// @route   PUT /api/ai-chatbot/:deviceId/campaigns/:campaignId/status
// @access  Private
const toggleAiCampaignStatus = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['enable', 'disable'].includes(status)) {
        res.status(400);
        throw new Error('Status must be either "enable" or "disable"');
    }

    const campaign = await Campaign.findOneAndUpdate(
        { _id: campaignId, userId: userId, deviceId: deviceId, campaignType: 'ai_chatbot' },
        { status: status },
        { new: true }
    );

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    res.json(campaign);
});

// @desc    Add AI interaction log
// @route   POST /api/ai-chatbot/:deviceId/campaigns/:campaignId/logs
// @access  Private
const addAiLog = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const { input, output, tokens, duration } = req.body;
    const userId = req.user.id;

    const campaign = await Campaign.findOne({
        _id: campaignId,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    });

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    // Tambah log baru
    campaign.aiLogs.push({
        input,
        output,
        tokens,
        duration
    });

    // Kemaskini statistik
    campaign.aiStats.totalInteractions += 1;
    campaign.aiStats.totalTokens += tokens;
    campaign.aiStats.averageResponseTime = 
        (campaign.aiStats.averageResponseTime * (campaign.aiStats.totalInteractions - 1) + duration) / 
        campaign.aiStats.totalInteractions;
    campaign.aiStats.successRate = 
        (campaign.aiStats.successRate * (campaign.aiStats.totalInteractions - 1) + (output ? 1 : 0)) / 
        campaign.aiStats.totalInteractions;

    await campaign.save();

    res.status(201).json(campaign.aiLogs[campaign.aiLogs.length - 1]);
});

// @desc    Get AI interaction logs
// @route   GET /api/ai-chatbot/:deviceId/campaigns/:campaignId/logs
// @access  Private
const getAiLogs = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const campaign = await Campaign.findOne({
        _id: campaignId,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    });

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const logs = campaign.aiLogs.slice(startIndex, endIndex);

    res.json({
        logs,
        currentPage: page,
        totalPages: Math.ceil(campaign.aiLogs.length / limit),
        totalLogs: campaign.aiLogs.length,
        stats: campaign.aiStats
    });
});

// @desc    Get AI campaign statistics
// @route   GET /api/ai-chatbot/:deviceId/campaigns/:campaignId/stats
// @access  Private
const getAiStats = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;

    const campaign = await Campaign.findOne({
        _id: campaignId,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    });

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    res.json(campaign.aiStats);
});

// @desc    Update AI campaign settings
// @route   PUT /api/ai-chatbot/:deviceId/campaigns/:campaignId/settings
// @access  Private
const updateAiSettings = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;
    const {
        aiModel,
        aiTemperature,
        aiMaxTokens,
        aiSystemPrompt,
        aiContextWindow
    } = req.body;

    const campaign = await Campaign.findOneAndUpdate(
        { _id: campaignId, userId: userId, deviceId: deviceId, campaignType: 'ai_chatbot' },
        {
            aiModel,
            aiTemperature,
            aiMaxTokens,
            aiSystemPrompt,
            aiContextWindow
        },
        { new: true, runValidators: true }
    );

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    res.json(campaign);
});

module.exports = {
    getAiDeviceSummary,
    updateAiDeviceStatus,
    getAiCampaigns,
    createAiCampaign,
    updateAiCampaign,
    deleteAiCampaign,
    toggleAiCampaignStatus,
    addAiLog,
    getAiLogs,
    getAiStats,
    updateAiSettings
}; 
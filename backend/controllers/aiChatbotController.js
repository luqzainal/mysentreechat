const WhatsappDevice = require('../models/WhatsappDevice');
const Campaign = require('../models/Campaign');
const Media = require('../models/Media');
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

    console.log(`[getAiCampaigns] Fetching campaigns for userId: ${userId}, deviceId: ${deviceId}`);

    // Validate device ownership first
    const device = await WhatsappDevice.findOne({ userId: userId, deviceId: deviceId });
    if (!device) {
        console.log(`[getAiCampaigns] Device ${deviceId} not found or not authorized for user ${userId}`);
        res.status(404);
        throw new Error('Device not found or not authorized for this user.');
    }

    const campaigns = await Campaign.find({
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot'
    }).sort({ createdAt: -1 });

    console.log(`[getAiCampaigns] Found ${campaigns.length} campaigns for device ${deviceId}`);

    // Format data for frontend consistency
    const formattedCampaigns = campaigns.map(c => ({
        _id: c._id,
        id: c._id, // For compatibility
        name: c.name || c.campaignName,
        status: c.status === 'enable' ? 'Enabled' : 'Disabled',
        useAI: c.useAiFeature === 'use_ai',
        media: !!(c.mediaAttachments && c.mediaAttachments.length > 0),
        link: c.enableLink || false,
        lastEdited: c.updatedAt.toISOString().split('T')[0], // Format YYYY-MM-DD
        // Include other fields that might be needed
        description: c.description,
        keywords: c.keywords,
        captionAi: c.captionAi,
        type: c.type,
        sendTo: c.sendTo,
        presenceDelayStatus: c.presenceDelayStatus,
        saveData: c.saveData,
        apiRestDataStatus: c.apiRestDataStatus
    }));

    res.json(formattedCampaigns);
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

    // Handle media file if uploaded
    let finalMediaAttachmentIds = [];
    if (req.file) {
        try {
            const newMediaRecord = await Media.create({
                user: userId,
                originalName: req.file.originalname,
                fileName: req.file.filename,
                filePath: `/uploads/media/${req.file.filename}`,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
            });
            finalMediaAttachmentIds.push(newMediaRecord._id);
            console.log("New Media record created for AI chatbot:", newMediaRecord._id);
        } catch (mediaCreationError) {
            console.error("Error creating Media record for AI chatbot:", mediaCreationError);
            res.status(500);
            throw new Error('Failed to process uploaded media file.');
        }
    }

    const campaignData = {
        ...req.body,
        userId: userId,
        deviceId: deviceId,
        campaignType: 'ai_chatbot',
        mediaAttachments: finalMediaAttachmentIds,
        // Set campaignName to name for compatibility if needed
        campaignName: req.body.name
    };

    const campaign = await Campaign.create(campaignData);

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

    // Get existing campaign
    let campaign = await Campaign.findOne({
        _id: campaignId, 
        userId: userId, 
        deviceId: deviceId, 
        campaignType: 'ai_chatbot'
    });

    if (!campaign) {
        res.status(404);
        throw new Error('Campaign not found or not authorized for this user.');
    }

    // Process keywords if provided as string
    if (req.body.keywords && typeof req.body.keywords === 'string') {
        req.body.keywords = req.body.keywords.split(',').map(k => k.trim()).filter(k => k);
    }

    // Handle media file if uploaded
    let finalMediaAttachmentIds = [...(campaign.mediaAttachments || [])];
    if (req.file) {
        try {
            const newMediaRecord = await Media.create({
                user: userId,
                originalName: req.file.originalname,
                fileName: req.file.filename,
                filePath: `/uploads/media/${req.file.filename}`,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
            });
            finalMediaAttachmentIds = [newMediaRecord._id]; // Replace existing media
            console.log("New Media record created for AI chatbot update:", newMediaRecord._id);
        } catch (mediaCreationError) {
            console.error("Error creating Media record for AI chatbot update:", mediaCreationError);
            res.status(500);
            throw new Error('Failed to process uploaded media file.');
        }
    }

    const updatedCampaign = await Campaign.findOneAndUpdate(
        { _id: campaignId, userId: userId, deviceId: deviceId, campaignType: 'ai_chatbot' },
        { 
            ...req.body, 
            mediaAttachments: finalMediaAttachmentIds,
            // Set campaignName to name for compatibility if needed
            campaignName: req.body.name 
        },
        { new: true, runValidators: true }
    );

    res.json(updatedCampaign);
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
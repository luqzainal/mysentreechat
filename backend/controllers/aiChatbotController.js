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
            deviceId: device.deviceId, // Padankan dengan deviceId dari WhatsappDevice
            campaignType: 'ai_chatbot'
        });

        // Tentukan needsSetup: jika AI tidak aktif ATAU (AI aktif TAPI tiada kempen AI)
        const needsSetup = !device.isAiEnabled || (device.isAiEnabled && aiCampaignCount === 0);

        return {
            id: device.deviceId,
            name: device.name || `Device ${device.deviceId.substring(0,6)}`,
            number: device.number || 'N/A',
            avatarUrl: '', // Kekal kosong buat masa ini
            stats: {
                sent: 0, // TODO: Logik untuk kira mesej AI yang dihantar
                items: aiCampaignCount // Bilangan kempen AI
            },
            statusEnabled: device.isAiEnabled, // Dari medan baru WhatsappDevice
            needsSetup: needsSetup,
            deviceConnected: device.connectionStatus === 'connected' // Status sambungan peranti sebenar
        };
    }));

    res.json(summary);
});

// @desc    Update AI status for a specific device
// @route   PUT /api/ai-chatbot/devices/:deviceId/status
// @access  Private
const updateAiDeviceStatus = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    const { isEnabled } = req.body; // isEnabled adalah status AI baru (true/false)
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
    // Jika AI dinyahaktifkan, mungkin kita mahu juga nyahaktifkan semua kempen AI yang berkaitan?
    // if (!isEnabled) {
    //    await Campaign.updateMany({ userId: userId, deviceId: deviceId, campaignType: 'ai_chatbot' }, { statusEnabled: false });
    // }
    await device.save();

    // Kira semula needsSetup selepas kemas kini
    const aiCampaignCount = await Campaign.countDocuments({
        userId: userId,
        deviceId: device.deviceId,
        campaignType: 'ai_chatbot',
        statusEnabled: true // Hanya kira kempen AI yang aktif untuk menentukan needsSetup
    });
    const needsSetup = !device.isAiEnabled || (device.isAiEnabled && aiCampaignCount === 0);

    res.json({
        id: device.deviceId,
        name: device.name || `Device ${device.deviceId.substring(0,6)}`,
        number: device.number || 'N/A',
        avatarUrl: '',
        stats: {
            sent: 0, // Kekal 0
            items: aiCampaignCount 
        },
        statusEnabled: device.isAiEnabled,
        needsSetup: needsSetup,
        deviceConnected: device.connectionStatus === 'connected'
    });
});

module.exports = {
    getAiDeviceSummary,
    updateAiDeviceStatus
}; 
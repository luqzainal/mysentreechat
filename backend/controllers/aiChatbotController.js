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

// @desc    Check if user has AI-powered campaigns (for limiting AI usage)
// @route   GET /api/ai-chatbot/check-ai-usage/:userId
// @access  Private
const checkAiUsage = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`[checkAiUsage] Checking AI usage for userId: ${userId}, request user: ${req.user?.id}`);
        
        // Ensure user can only check their own usage
        if (req.user.id !== userId) {
            console.warn(`[checkAiUsage] Unauthorized access attempt. Request user: ${req.user.id}, target user: ${userId}`);
            res.status(403);
            throw new Error('Not authorized to check AI usage for this user.');
        }

        const existingAiCampaign = await Campaign.findOne({
            userId: userId,
            campaignType: 'ai_chatbot',
            useAiFeature: 'use_ai',
            $or: [
                { status: 'enable', statusEnabled: true },
                { status: 'enable' },
                { statusEnabled: true }
            ]
        }).select('_id name campaignName status statusEnabled');

        console.log(`[checkAiUsage] Found existing AI campaign:`, existingAiCampaign ? existingAiCampaign._id : 'None');

        const hasAiCampaign = !!existingAiCampaign;
        
        const response = {
            hasAiCampaign,
            aiCampaign: existingAiCampaign ? {
                id: existingAiCampaign._id,
                name: existingAiCampaign.name || existingAiCampaign.campaignName,
                status: existingAiCampaign.status,
                statusEnabled: existingAiCampaign.statusEnabled
            } : null,
            canCreateAi: !hasAiCampaign
        };
        
        console.log(`[checkAiUsage] Returning response:`, response);
        res.json(response);
    } catch (error) {
        console.error(`[checkAiUsage] Error:`, error);
        res.status(500).json({ 
            error: 'Failed to check AI usage',
            message: error.message,
            hasAiCampaign: false,
            canCreateAi: true,
            aiCampaign: null
        });
    }
});

// @desc    Get available flow IDs for nextBotAction dropdown
// @route   GET /api/ai-chatbot/available-flows/:userId
// @access  Private
const getAvailableFlows = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Ensure user can only get their own flows
    if (req.user.id !== userId) {
        res.status(403);
        throw new Error('Not authorized to get flows for this user.');
    }

    try {
        // Get all AI chatbot campaigns for the user
        const campaigns = await Campaign.find({
            userId: userId,
            campaignType: 'ai_chatbot',
            status: 'enable'
        }).select('_id flowId name campaignName useAiFeature').sort({ createdAt: -1 });

        const availableFlows = campaigns.map(campaign => ({
            flowId: campaign.flowId,
            campaignId: campaign._id,
            name: campaign.name || campaign.campaignName || `Campaign ${campaign.flowId}`,
            type: campaign.useAiFeature === 'use_ai' ? 'AI-Powered' : 'Static Response'
        }));

        // Add special AI_REPLY option
        availableFlows.unshift({
            flowId: 'AI_REPLY',
            campaignId: null,
            name: '🤖 AI Response (Use AI for dynamic reply)',
            type: 'AI-Powered'
        });

        res.json({
            userId,
            flows: availableFlows,
            totalFlows: availableFlows.length
        });
    } catch (error) {
        console.error('[getAvailableFlows] Error:', error);
        res.status(500).json({ 
            error: 'Failed to get available flows',
            message: error.message
        });
    }
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
        flowId: c.flowId,
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
        appointmentLink: c.appointmentLink,
        apiRestDataStatus: c.apiRestDataStatus,
        // Conversation Flow Features
        conversationMode: c.conversationMode,
        maxConversationBubbles: c.maxConversationBubbles,
        endConversationKeywords: c.endConversationKeywords,
        bubbleOptions: c.bubbleOptions
    }));

    res.json(formattedCampaigns);
});

// @desc    Get single AI chatbot campaign for editing
// @route   GET /api/ai-chatbot/:deviceId/campaigns/:campaignId
// @access  Private
const getAiCampaign = asyncHandler(async (req, res) => {
    const { deviceId, campaignId } = req.params;
    const userId = req.user.id;

    console.log(`[getAiCampaign] Fetching campaign ${campaignId} for userId: ${userId}, deviceId: ${deviceId}`);

    // Validate ObjectId format for campaignId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        console.log(`[getAiCampaign] Invalid campaignId format: ${campaignId}`);
        res.status(400);
        throw new Error('Invalid campaign ID format.');
    }

    let device, campaign;
    
    try {
        // Validate device ownership first
        device = await WhatsappDevice.findOne({ userId: userId, deviceId: deviceId });
        if (!device) {
            console.log(`[getAiCampaign] Device ${deviceId} not found or not authorized for user ${userId}`);
            res.status(404);
            throw new Error('Device not found or not authorized for this user.');
        }

        campaign = await Campaign.findOne({
            _id: campaignId,
            userId: userId,
            deviceId: deviceId,
            campaignType: 'ai_chatbot'
        }).populate('mediaAttachments');

        if (!campaign) {
            console.log(`[getAiCampaign] Campaign ${campaignId} not found for device ${deviceId}`);
            res.status(404);
            throw new Error('Campaign not found or not authorized for this user.');
        }
    } catch (error) {
        console.error(`[getAiCampaign] Database error: ${error.message}`);
        if (error.name === 'CastError') {
            res.status(400);
            throw new Error('Invalid campaign ID format.');
        }
        throw error;
    }

    console.log(`[getAiCampaign] Found campaign: ${campaign.name}`);
    console.log(`[getAiCampaign] Media attachments:`, {
        count: campaign.mediaAttachments?.length || 0,
        attachments: campaign.mediaAttachments,
        populatedMedia: campaign.mediaAttachments?.map(media => ({
            id: media._id,
            fileName: media.fileName,
            originalName: media.originalName,
            filePath: media.filePath
        }))
    });

    // Return campaign data in the format expected by frontend
    res.json({
        _id: campaign._id,
        flowId: campaign.flowId,
        name: campaign.name,
        status: campaign.status,
        isNotMatchDefaultResponse: campaign.isNotMatchDefaultResponse,
        sendTo: campaign.sendTo,
        type: campaign.type,
        description: campaign.description,
        keywords: campaign.keywords,
        nextBotAction: campaign.nextBotAction,
        presenceDelayTime: campaign.presenceDelayTime,
        presenceDelayStatus: campaign.presenceDelayStatus,
        appointmentLink: campaign.appointmentLink,
        apiRestDataStatus: campaign.apiRestDataStatus,
        captionAi: campaign.captionAi,
        useAiFeature: campaign.useAiFeature,
        aiSpintax: campaign.aiSpintax,
        // Conversation Flow Features
        conversationMode: campaign.conversationMode,
        maxConversationBubbles: campaign.maxConversationBubbles,
        endConversationKeywords: campaign.endConversationKeywords,
        bubbleOptions: campaign.bubbleOptions,
        // API Rest Config
        apiRestConfig: campaign.apiRestConfig,
        mediaAttachments: campaign.mediaAttachments,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
    });
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
    console.log(`[createAiCampaign] Raw keywords received:`, {
        keywords: req.body.keywords,
        type: typeof req.body.keywords,
        length: req.body.keywords ? req.body.keywords.length : 0
    });
    
    if (req.body.keywords && typeof req.body.keywords === 'string') {
        const originalKeywords = req.body.keywords;
        req.body.keywords = req.body.keywords.split(',').map(k => k.trim()).filter(k => k);
        console.log(`[createAiCampaign] Processed keywords:`, {
            original: originalKeywords,
            processed: req.body.keywords,
            count: req.body.keywords.length
        });
    } else if (req.body.keywords && Array.isArray(req.body.keywords)) {
        console.log(`[createAiCampaign] Keywords already array:`, req.body.keywords);
    } else {
        console.log(`[createAiCampaign] No keywords or invalid format`);
    }

    // Process API Rest Config if provided
    if (req.body.apiRestConfig && typeof req.body.apiRestConfig === 'string') {
        try {
            req.body.apiRestConfig = JSON.parse(req.body.apiRestConfig);
        } catch (error) {
            console.error('Error parsing apiRestConfig:', error);
            req.body.apiRestConfig = null;
        }
    }

    // Process Bubble Options if provided
    if (req.body.bubbleOptions && typeof req.body.bubbleOptions === 'string') {
        try {
            req.body.bubbleOptions = JSON.parse(req.body.bubbleOptions);
        } catch (error) {
            console.error('Error parsing bubbleOptions:', error);
            req.body.bubbleOptions = [];
        }
    }

    // Process End Conversation Keywords if provided as string
    if (req.body.endConversationKeywords && typeof req.body.endConversationKeywords === 'string') {
        req.body.endConversationKeywords = req.body.endConversationKeywords.split(',').map(k => k.trim()).filter(k => k).join(',');
    }

    // Check if user is trying to use AI feature and already has an AI-powered campaign
    if (req.body.useAiFeature === 'use_ai') {
        const existingAiCampaign = await Campaign.findOne({
            userId: userId,
            campaignType: 'ai_chatbot',
            useAiFeature: 'use_ai',
            $or: [
                { status: 'enable', statusEnabled: true },
                { status: 'enable' },
                { statusEnabled: true }
            ]
        });

        if (existingAiCampaign) {
            res.status(400);
            throw new Error('You can only have one AI-powered campaign at a time. Please disable your existing AI campaign first or use keyword-only response for this campaign.');
        }

        console.log(`[createAiCampaign] User ${userId} is creating their first AI-powered campaign`);
    }

    // Handle media file if uploaded OR selected from library
    let finalMediaAttachmentIds = [];
    
    console.log(`[createAiCampaign] Media processing:`, {
        hasUploadedFile: !!req.file,
        selectedMediaLibraryId: req.body.selectedMediaLibraryId,
        reqBodyKeys: Object.keys(req.body)
    });
    
    if (req.file) {
        // Handle uploaded file using S3 service (same logic as campaign routes)
        try {
            const s3Service = require('../services/s3Service.js');
            const mediaCompressionService = require('../services/mediaCompressionService.js');
            
            // Compress media if needed
            let finalBuffer = req.file.buffer;
            let compressionInfo = { compressionApplied: false };
            
            try {
                const compressionResult = await mediaCompressionService.compressMedia(
                    req.file.buffer, 
                    req.file.mimetype,
                    req.file.originalname
                );
                
                if (compressionResult.compressed) {
                    finalBuffer = compressionResult.buffer;
                    compressionInfo = {
                        originalSize: req.file.size,
                        compressedSize: compressionResult.buffer.length,
                        compressionRatio: ((req.file.size - compressionResult.buffer.length) / req.file.size * 100),
                        compressionApplied: true
                    };
                    console.log("[createAiCampaign] Compression applied:", compressionInfo);
                } else {
                    console.log("[createAiCampaign] No compression applied - file under threshold or unsupported format");
                }
            } catch (compressionError) {
                console.warn("[createAiCampaign] Compression failed, using original file:", compressionError.message);
            }

            // Upload to S3
            const uploadResult = await s3Service.uploadFile(finalBuffer, req.file.originalname, req.file.mimetype, userId);
            
            if (!uploadResult.success) {
                console.error("[createAiCampaign] S3 upload failed:", uploadResult.error);
                throw new Error('S3 upload failed');
            }

            console.log("S3 upload successful for AI chatbot creation:", uploadResult.fileName);

            // Create media record
            const mediaData = {
                user: userId,
                originalName: req.file.originalname,
                fileName: uploadResult.fileName,
                filePath: uploadResult.filePath,
                fileType: req.file.mimetype,
                fileSize: finalBuffer.length, // Use compressed size if compression was applied
                storageType: 's3',
                fileUrl: uploadResult.fileUrl,
                s3Metadata: {
                    bucket: uploadResult.bucket,
                    key: uploadResult.key,
                    eTag: uploadResult.eTag
                },
                compressionInfo: compressionInfo
            };

            const newMediaRecord = await Media.create(mediaData);
            finalMediaAttachmentIds.push(newMediaRecord._id);
            console.log("[createAiCampaign] New Media record created for AI chatbot:", newMediaRecord._id);
        } catch (mediaCreationError) {
            console.error("Error creating Media record for AI chatbot:", mediaCreationError);
            res.status(500);
            throw new Error('Failed to process uploaded media file.');
        }
    } else if (req.body.selectedMediaLibraryId) {
        // Handle selected media from library
        console.log("[createAiCampaign] Using selected media from library:", req.body.selectedMediaLibraryId);
        
        // Verify media exists and belongs to user
        const selectedMedia = await Media.findOne({
            _id: req.body.selectedMediaLibraryId,
            user: userId
        });
        
        if (selectedMedia) {
            finalMediaAttachmentIds.push(selectedMedia._id);
            console.log("[createAiCampaign] Selected media from library verified:", selectedMedia._id);
        } else {
            console.warn("[createAiCampaign] Selected media not found or not authorized:", req.body.selectedMediaLibraryId);
        }
    } else {
        console.log("[createAiCampaign] No media file uploaded or selected from library");
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

    console.log(`[createAiCampaign] Final campaign data before save:`, {
        name: campaignData.name,
        keywords: campaignData.keywords,
        keywordsType: typeof campaignData.keywords,
        keywordsLength: Array.isArray(campaignData.keywords) ? campaignData.keywords.length : 'not array',
        type: campaignData.type,
        useAiFeature: campaignData.useAiFeature,
        captionAi: campaignData.captionAi ? campaignData.captionAi.substring(0, 50) + '...' : null
    });

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

    // Process API Rest Config if provided
    if (req.body.apiRestConfig && typeof req.body.apiRestConfig === 'string') {
        try {
            req.body.apiRestConfig = JSON.parse(req.body.apiRestConfig);
        } catch (error) {
            console.error('Error parsing apiRestConfig:', error);
            req.body.apiRestConfig = null;
        }
    }

    // Process Bubble Options if provided
    if (req.body.bubbleOptions && typeof req.body.bubbleOptions === 'string') {
        try {
            req.body.bubbleOptions = JSON.parse(req.body.bubbleOptions);
        } catch (error) {
            console.error('Error parsing bubbleOptions:', error);
            req.body.bubbleOptions = [];
        }
    }

    // Process End Conversation Keywords if provided as string
    if (req.body.endConversationKeywords && typeof req.body.endConversationKeywords === 'string') {
        req.body.endConversationKeywords = req.body.endConversationKeywords.split(',').map(k => k.trim()).filter(k => k).join(',');
    }

    // Check if user is trying to switch to AI feature and already has another AI-powered campaign
    if (req.body.useAiFeature === 'use_ai' && campaign.useAiFeature !== 'use_ai') {
        const existingAiCampaign = await Campaign.findOne({
            userId: userId,
            campaignType: 'ai_chatbot',
            useAiFeature: 'use_ai',
            _id: { $ne: campaignId }, // Exclude current campaign
            $or: [
                { status: 'enable', statusEnabled: true },
                { status: 'enable' },
                { statusEnabled: true }
            ]
        });

        if (existingAiCampaign) {
            res.status(400);
            throw new Error('You can only have one AI-powered campaign at a time. Please disable your existing AI campaign first or keep this campaign as keyword-only response.');
        }

        console.log(`[updateAiCampaign] User ${userId} is switching campaign ${campaignId} to AI-powered`);
    }

    // Handle media file if uploaded OR selected from library
    let finalMediaAttachmentIds = [...(campaign.mediaAttachments || [])];
    
    console.log(`[updateAiCampaign] Media processing for campaign ${campaignId}:`, {
        hasUploadedFile: !!req.file,
        selectedMediaLibraryId: req.body.selectedMediaLibraryId,
        existingMediaAttachments: campaign.mediaAttachments,
        reqBodyKeys: Object.keys(req.body)
    });
    
    if (req.file) {
        // Handle uploaded file using S3 service (same logic as campaign routes)
        try {
            const s3Service = require('../services/s3Service.js');
            const mediaCompressionService = require('../services/mediaCompressionService.js');
            
            // Compress media if needed
            let finalBuffer = req.file.buffer;
            let compressionInfo = { compressionApplied: false };
            
            try {
                const compressionResult = await mediaCompressionService.compressMedia(
                    req.file.buffer, 
                    req.file.mimetype,
                    req.file.originalname
                );
                
                if (compressionResult.compressed) {
                    finalBuffer = compressionResult.buffer;
                    compressionInfo = {
                        originalSize: req.file.size,
                        compressedSize: compressionResult.buffer.length,
                        compressionRatio: ((req.file.size - compressionResult.buffer.length) / req.file.size * 100),
                        compressionApplied: true
                    };
                    console.log("[updateAiCampaign] Compression applied:", compressionInfo);
                } else {
                    console.log("[updateAiCampaign] No compression applied - file under threshold or unsupported format");
                }
            } catch (compressionError) {
                console.warn("[updateAiCampaign] Compression failed, using original file:", compressionError.message);
            }

            // Upload to S3
            const uploadResult = await s3Service.uploadFile(finalBuffer, req.file.originalname, req.file.mimetype, userId);
            
            if (!uploadResult.success) {
                console.error("[updateAiCampaign] S3 upload failed:", uploadResult.error);
                throw new Error('S3 upload failed');
            }

            console.log("S3 upload successful for AI chatbot update:", uploadResult.fileName);

            // Create media record
            const mediaData = {
                user: userId,
                originalName: req.file.originalname,
                fileName: uploadResult.fileName,
                filePath: uploadResult.filePath,
                fileType: req.file.mimetype,
                fileSize: finalBuffer.length, // Use compressed size if compression was applied
                storageType: 's3',
                fileUrl: uploadResult.fileUrl,
                s3Metadata: {
                    bucket: uploadResult.bucket,
                    key: uploadResult.key,
                    eTag: uploadResult.eTag
                },
                compressionInfo: compressionInfo
            };

            const newMediaRecord = await Media.create(mediaData);
            finalMediaAttachmentIds = [newMediaRecord._id]; // Replace existing media
            console.log("[updateAiCampaign] New Media record created for AI chatbot update:", newMediaRecord._id);
        } catch (mediaCreationError) {
            console.error("Error creating Media record for AI chatbot update:", mediaCreationError);
            res.status(500);
            throw new Error('Failed to process uploaded media file.');
        }
    } else if (req.body.selectedMediaLibraryId) {
        // Handle selected media from library
        console.log("[updateAiCampaign] Using selected media from library:", req.body.selectedMediaLibraryId);
        
        // Verify media exists and belongs to user
        const selectedMedia = await Media.findOne({
            _id: req.body.selectedMediaLibraryId,
            user: userId
        });
        
        if (selectedMedia) {
            finalMediaAttachmentIds = [selectedMedia._id]; // Replace existing media
            console.log("[updateAiCampaign] Selected media from library verified:", selectedMedia._id);
        } else {
            console.warn("[updateAiCampaign] Selected media not found or not authorized:", req.body.selectedMediaLibraryId);
            // Keep existing media if selected media not found
        }
    } else {
        console.log("[updateAiCampaign] No new media file uploaded or selected - keeping existing media");
        // Keep existing media attachments
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
}; 
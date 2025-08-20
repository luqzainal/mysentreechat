const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams diperlukan untuk akses :deviceId dari parent router
const { protect } = require('../middleware/authMiddleware');
const { uploadMedia } = require('../middleware/uploadMiddleware'); // Import middleware upload
const Campaign = require('../models/Campaign');
const WhatsappDevice = require('../models/WhatsappDevice'); // Diperlukan untuk validasi deviceId
const Media = require('../models/Media'); // Import model Media

// Middleware untuk validasi deviceId dan kepunyaan user
const validateDeviceAccess = async (req, res, next) => {
  console.log('[validateDeviceAccess] Triggered. Path:', req.path, 'Original URL:', req.originalUrl); // Log path
  console.log('[validateDeviceAccess] Raw req.params:', JSON.stringify(req.params)); // Log baru
  const { deviceId } = req.params;
  // Pastikan req.user wujud (dari middleware protect)
  if (!req.user || !req.user.id) {
    console.error('[validateDeviceAccess] User not found on request. Ensure protect middleware is used before this.');
    return res.status(401).json({ message: 'Not authorized, user information missing.' });
  }
  console.log(`[validateDeviceAccess] Attempting to validate deviceId: ${deviceId} for user: ${req.user.id}`);
  try {
    const device = await WhatsappDevice.findOne({ deviceId: deviceId, userId: req.user.id });
    if (!device) {
      console.log(`[validateDeviceAccess] Device ${deviceId} not found or access denied for user ${req.user.id}. Returning 404.`);
      return res.status(404).json({ message: 'Device not found or access denied' });
    }
    console.log(`[validateDeviceAccess] Device ${deviceId} validated successfully for user ${req.user.id}.`);
    req.device = device; // Simpan device info dalam request jika perlu
    next();
  } catch (error) {
    console.error('Error validating device access:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Middleware untuk validasi deviceId tanpa memerlukan connection status (untuk delete operations)
const validateDeviceAccessForDelete = async (req, res, next) => {
  console.log('[validateDeviceAccessForDelete] Triggered. Path:', req.path, 'Original URL:', req.originalUrl);
  const { deviceId } = req.params;
  
  if (!req.user || !req.user.id) {
    console.error('[validateDeviceAccessForDelete] User not found on request.');
    return res.status(401).json({ message: 'Not authorized, user information missing.' });
  }
  
  console.log(`[validateDeviceAccessForDelete] Validating deviceId: ${deviceId} for user: ${req.user.id}`);
  try {
    // First try to find device with exact deviceId match
    let device = await WhatsappDevice.findOne({ deviceId: deviceId, userId: req.user.id });
    
    if (!device) {
      console.log(`[validateDeviceAccessForDelete] Exact deviceId ${deviceId} not found, trying fallback...`);
      
      // Fallback: Find any device for this user (for backward compatibility)
      device = await WhatsappDevice.findOne({ userId: req.user.id });
      
      if (!device) {
        console.log(`[validateDeviceAccessForDelete] No device found for user ${req.user.id}.`);
        return res.status(404).json({ message: 'No device found for user' });
      }
      
      console.log(`[validateDeviceAccessForDelete] Using fallback device ${device.deviceId} for user ${req.user.id}`);
    }
    
    console.log(`[validateDeviceAccessForDelete] Device validated for deletion by user ${req.user.id}.`);
    req.device = device;
    next();
  } catch (error) {
    console.error('Error validating device access for delete:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Semua route di bawah ini dilindungi
router.use(protect); // Hanya protect digunakan secara global di sini

// @desc    Get all campaigns for a specific device
// @route   GET /api/campaigns/:deviceId
// @access  Private
router.get('/:deviceId', validateDeviceAccess, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user.id, deviceId: req.params.deviceId }).sort({ createdAt: -1 });
    // Format data untuk frontend (contoh: status, features)
     const formattedCampaigns = campaigns.map(c => ({
         id: c._id,
         name: c.campaignName,
         status: c.statusEnabled ? 'Enabled' : 'Disabled',
         useAI: c.useAI,
         media: !!c.mediaPath,
         link: c.enableLink,
         lastEdited: c.updatedAt.toISOString().split('T')[0], // Format YYYY-MM-DD
     }));
    res.json(formattedCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Create a new campaign for a specific device
// @route   POST /api/campaigns/:deviceId
// @access  Private
router.post('/:deviceId', validateDeviceAccess, uploadMedia, async (req, res) => {
  const { deviceId } = req.params;
  const {
    campaignName,
    statusEnabled,
    enableLink,
    urlLink,
    caption,
    aiAgentTraining,
    useAI,
    presenceDelay,
    campaignType,
    contactGroupId,
    scheduledAt,
    minIntervalSeconds,
    maxIntervalSeconds,
    campaignScheduleType,
    campaignScheduleDetails,
    mediaAttachments, // Array of media IDs from library
    // AI Chatbot specific fields
    status,
    isNotMatchDefaultResponse,
    sendTo,
    type,
    name,
    description,
    keywords,
    nextBotAction,
    presenceDelayTime,
    presenceDelayStatus,
    saveData,
    apiRestDataStatus,
    mediaFileAi,
    captionAi,
    useAiFeature,
    aiSpintax
  } = req.body;

  // Log input untuk debugging
  // console.log("Request Body:", req.body);
  // console.log("Request File:", req.file);
  // console.log("Received mediaAttachments:", mediaAttachments);

  // Validate based on campaign type
  if (campaignType === 'bulk') {
    if (!campaignName) {
      return res.status(400).json({ message: 'Campaign name is required for bulk campaigns' });
    }
    if (!contactGroupId) {
      return res.status(400).json({ message: 'Contact Group ID is required for bulk campaigns' });
    }
  } else if (campaignType === 'ai_chatbot') {
    if (!name) {
      return res.status(400).json({ message: 'Name is required for AI chatbot campaigns' });
    }
    if (!captionAi) {
      return res.status(400).json({ message: 'Caption/Text Message is required for AI chatbot campaigns' });
    }
  } else if (!campaignName) {
    return res.status(400).json({ message: 'Campaign name is required' });
  }
  
  if (campaignType && !['bulk', 'ai_chatbot'].includes(campaignType)) {
      return res.status(400).json({ message: 'Invalid campaignType. Must be bulk or ai_chatbot.' });
  }

  try {
    const newCampaignData = {
      userId: req.user.id,
      deviceId: deviceId,
      campaignType: campaignType || 'bulk', // Default type logic
      sentCount: 0, 
      failedCount: 0,
      mediaAttachments: [] // Inisialisasi sebagai array kosong
    };

    // Add fields based on campaign type
    if (campaignType === 'bulk') {
      newCampaignData.campaignName = campaignName;
      newCampaignData.statusEnabled = statusEnabled === 'true';
      newCampaignData.enableLink = enableLink === 'true';
      newCampaignData.urlLink = enableLink === 'true' ? urlLink : '';
      newCampaignData.caption = caption;
      newCampaignData.contactGroupId = contactGroupId;
    } else if (campaignType === 'ai_chatbot') {
      newCampaignData.name = name;
      newCampaignData.campaignName = name; // Fallback for compatibility
      newCampaignData.status = status || 'enable';
      newCampaignData.isNotMatchDefaultResponse = isNotMatchDefaultResponse === 'yes';
      newCampaignData.sendTo = sendTo || 'all';
      newCampaignData.type = type || 'message_contains_keyword';
      newCampaignData.description = description;
      newCampaignData.keywords = keywords ? (typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()) : keywords) : [];
      newCampaignData.nextBotAction = nextBotAction;
      newCampaignData.presenceDelayTime = presenceDelayTime;
      newCampaignData.presenceDelayStatus = presenceDelayStatus || 'disable';
      newCampaignData.saveData = saveData || 'no_save_response';
      newCampaignData.apiRestDataStatus = apiRestDataStatus || 'disabled';
      newCampaignData.captionAi = captionAi;
      newCampaignData.useAiFeature = useAiFeature || 'not_use_ai';
      newCampaignData.aiSpintax = aiSpintax;
    }

    // Add bulk-specific scheduling fields
    if (campaignType === 'bulk') {
        if (scheduledAt) newCampaignData.scheduledAt = new Date(scheduledAt);
        if (minIntervalSeconds) newCampaignData.minIntervalSeconds = parseInt(minIntervalSeconds, 10);
        if (maxIntervalSeconds) newCampaignData.maxIntervalSeconds = parseInt(maxIntervalSeconds, 10);
        if (campaignScheduleType) newCampaignData.campaignScheduleType = campaignScheduleType;
        
        // Kendalikan campaignScheduleDetails: parse jika ia string JSON
        if (campaignScheduleDetails) {
            if (typeof campaignScheduleDetails === 'string') {
                try {
                    const parsedDetails = JSON.parse(campaignScheduleDetails);
                    // Hanya tetapkan jika ia adalah array (seperti yang dijangka dari definedHours)
                    if (Array.isArray(parsedDetails)) {
                         newCampaignData.campaignScheduleDetails = parsedDetails;
                    } else {
                        console.warn('campaignScheduleDetails diparsing tetapi bukan array, menggunakan nilai asal (string).');
                        newCampaignData.campaignScheduleDetails = campaignScheduleDetails; 
                    }
                } catch (parseError) {
                    console.error("Error parsing campaignScheduleDetails JSON string:", parseError);
                    // Simpan string asal jika parse gagal dan logik hiliran boleh mengendalikannya atau ia akan menjadi ralat validasi kemudian
                    newCampaignData.campaignScheduleDetails = campaignScheduleDetails; 
                }
            } else {
                 // Jika sudah objek/array (mungkin dari body parser yang lebih canggih atau ujian Postman)
                 newCampaignData.campaignScheduleDetails = campaignScheduleDetails;
            }
        } else {
            newCampaignData.campaignScheduleDetails = null; // Atau biarkan default model jika itu yang dimahukan
        }
    }

    // Kendalikan media dari pustaka (mediaAttachments) atau fail yang dimuat naik (req.file)
    let finalMediaAttachmentIds = [];

    // Log untuk debugging
    console.log('Received mediaAttachments:', mediaAttachments);
    console.log('Type of mediaAttachments:', typeof mediaAttachments);
    console.log('Is Array:', Array.isArray(mediaAttachments));

    if (mediaAttachments) {
        // Handle different formats of mediaAttachments
        let mediaIds = [];
        
        console.log(`[Campaign Creation] mediaAttachments received:`, {
            type: typeof mediaAttachments,
            value: mediaAttachments,
            isArray: Array.isArray(mediaAttachments)
        });
        
        if (Array.isArray(mediaAttachments)) {
            mediaIds = mediaAttachments;
            console.log(`[Campaign Creation] Using array mediaAttachments: ${mediaIds.length} items`);
        } else if (typeof mediaAttachments === 'string') {
            if (mediaAttachments.trim() === '' || mediaAttachments.trim() === '[]') {
                mediaIds = [];
                console.log(`[Campaign Creation] Empty mediaAttachments string`);
            } else if (mediaAttachments.startsWith('[') && mediaAttachments.endsWith(']')) {
                // Looks like JSON array string
                try {
                    const parsed = JSON.parse(mediaAttachments);
                    if (Array.isArray(parsed)) {
                        mediaIds = parsed;
                        console.log(`[Campaign Creation] Parsed JSON array mediaAttachments: ${mediaIds.length} items`);
                    } else {
                        mediaIds = [mediaAttachments];
                        console.log(`[Campaign Creation] Parsed value not array, using as single ID: ${mediaAttachments}`);
                    }
                } catch (e) {
                    console.warn(`[Campaign Creation] JSON array parse failed:`, {
                        value: mediaAttachments,
                        error: e.message
                    });
                    mediaIds = [mediaAttachments];
                    console.log(`[Campaign Creation] Fallback to single ID: ${mediaAttachments}`);
                }
            } else {
                // Single media ID string (most common case)
                mediaIds = [mediaAttachments];
                console.log(`[Campaign Creation] Single media ID string: ${mediaAttachments}`);
            }
        } else {
            // If it's a single value
            mediaIds = [mediaAttachments];
        }

        console.log('Processed mediaIds:', mediaIds);

        if (mediaIds.length > 0) {
            // Sahkan semua ID media dan pastikan ia milik pengguna
            const validUserMedia = await Media.find({ 
                _id: { $in: mediaIds }, 
                user: req.user.id 
            }).select('_id');
            
            finalMediaAttachmentIds = validUserMedia.map(media => media._id);

            if (finalMediaAttachmentIds.length !== mediaIds.length) {
                console.warn(`Beberapa ID media tidak sah atau bukan milik pengguna ${req.user.id}. Hanya ID yang sah akan digunakan.`);
                // Jika fail turut dimuat naik, ia akan diabaikan kerana kita utamakan dari pustaka jika ada
                if (req.file && req.file.buffer) {
                    console.log("File buffer ignored - library selection took precedence (memory storage)");
                    // No need to delete file since it's memory storage
                }
            }
        }
    } else if (req.file) {
      // Jika tiada mediaAttachments dari pustaka, tapi ada fail diupload, cipta rekod Media baru
      try {
        console.log("Processing uploaded file for campaign creation (memory storage):", {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer
        });

        // Use S3 service for file upload (same logic as media controller)
        const s3Service = require('../services/s3Service.js');
        const mediaCompressionService = require('../services/mediaCompressionService.js');
        
        // Compress media if needed
        let finalBuffer = req.file.buffer;
        let finalMimeType = req.file.mimetype;
        let finalFileName = req.file.originalname;
        let compressionInfo = null;
        
        if (mediaCompressionService.needsCompression(req.file.buffer.length, req.file.mimetype)) {
            console.log("File needs compression for campaign creation");
            try {
                const compressionResult = await mediaCompressionService.compressMedia(
                    req.file.buffer, 
                    req.file.mimetype, 
                    req.file.originalname
                );
                
                finalBuffer = compressionResult.buffer;
                finalMimeType = compressionResult.mimeType;
                finalFileName = compressionResult.fileName;
                compressionInfo = {
                    originalSize: compressionResult.originalSize,
                    compressedSize: compressionResult.compressedSize,
                    compressionRatio: compressionResult.compressionRatio,
                    compressionApplied: compressionResult.compressionApplied
                };
                console.log("Compression completed for campaign creation:", compressionInfo);
            } catch (compressionError) {
                console.warn("Compression failed for campaign creation, using original file:", compressionError.message);
            }
        }

        // Upload to S3
        const uploadResult = await s3Service.uploadFile(
            finalBuffer, 
            finalFileName, 
            finalMimeType, 
            req.user.id.toString()
        );
        
        if (!uploadResult.success) {
            throw new Error('S3 upload failed');
        }

        console.log("S3 upload successful for campaign creation:", uploadResult.fileName);

        // Create media record
        const mediaData = {
            user: req.user.id,
            originalName: req.file.originalname,
            fileName: uploadResult.fileName,
            filePath: uploadResult.filePath,
            fileType: finalMimeType,
            fileSize: uploadResult.fileSize,
            storageType: uploadResult.storageType,
            fileUrl: uploadResult.fileUrl
        };

        // Add compression info if available
        if (compressionInfo) {
            mediaData.compressionInfo = compressionInfo;
        }

        // Add S3 metadata
        if (uploadResult.storageType === 's3' && uploadResult.metadata) {
            mediaData.s3Metadata = {
                bucket: uploadResult.metadata.bucket,
                key: uploadResult.metadata.key,
                eTag: uploadResult.metadata.eTag
            };
        }

        const newMediaRecord = await Media.create(mediaData);
        finalMediaAttachmentIds.push(newMediaRecord._id);
        console.log("New Media record created for campaign creation:", newMediaRecord._id);
      } catch (mediaCreationError) {
        console.error("Error creating Media record for uploaded file:", mediaCreationError);
        // No need to delete file since it's memory storage
        return res.status(500).json({ message: 'Failed to process uploaded media file.' });
      }
    }

    newCampaignData.mediaAttachments = finalMediaAttachmentIds;

    // Buang logik mediaId tunggal yang lama
    /*
    if (mediaId) {
        const storedMedia = await Media.findOne({ _id: mediaId, user: req.user.id });
        if (storedMedia) {
            newCampaignData.mediaPath = storedMedia.filePath;
            newCampaignData.mediaOriginalName = storedMedia.originalName;
            newCampaignData.mediaMimeType = storedMedia.fileType;
            if (req.file && req.file.buffer) {
                console.log("File buffer ignored when mediaId is used (memory storage)");
                // No need to delete file since it's memory storage
            }
        } else {
            console.warn(`Media with ID ${mediaId} not found for user ${req.user.id}. Campaign will be created without media.`);
        }
    } else if (req.file) {
      // This old logic is replaced by the S3 upload logic above
      console.warn("Old single media logic detected - this should not be reached");
    }
    */

    const campaign = await Campaign.create(newCampaignData);
    res.status(201).json(campaign); 

  } catch (error) {
    console.error('Error creating campaign:', error);
    // For memory storage, no need to delete files on error
    if (req.file && req.file.buffer && !res.headersSent) {
        console.log("Campaign creation failed, file buffer will be garbage collected (memory storage)");
    }
    if (!res.headersSent) {
       res.status(500).json({ message: 'Server Error creating campaign' });
    }
  }
});

// @desc    Get a single campaign details
// @route   GET /api/campaigns/:deviceId/:campaignId
// @access  Private
router.get('/:deviceId/:campaignId', validateDeviceAccess, async (req, res) => {
  try {
    let campaign = await Campaign.findOne({ 
      _id: req.params.campaignId, 
      userId: req.user.id, 
      deviceId: req.params.deviceId 
    })
    .populate('mediaAttachments');

    // Conditionally populate contactGroupId only if it's not "all_contacts"
    if (campaign && campaign.contactGroupId && campaign.contactGroupId !== 'all_contacts') {
      campaign = await Campaign.findOne({ 
        _id: req.params.campaignId, 
        userId: req.user.id, 
        deviceId: req.params.deviceId 
      })
      .populate('mediaAttachments')
      .populate({
        path: 'contactGroupId',
        populate: {
          path: 'contacts',
          select: 'name phoneNumber'
        }
      });
    }

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update campaign status
// @route   PUT /api/campaigns/:deviceId/:campaignId/status
// @access  Private
router.put('/:deviceId/:campaignId/status', validateDeviceAccess, async (req, res) => {
  const { status } = req.body; // status dijangka 'Enabled' atau 'Disabled'
  const statusBoolean = status === 'Enabled'; // Tukar ke boolean

  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.campaignId, userId: req.user.id, deviceId: req.params.deviceId },
      { statusEnabled: statusBoolean },
      { new: true } // Kembalikan dokumen yang telah dikemaskini
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json({ status: campaign.statusEnabled ? 'Enabled' : 'Disabled' }); // Kembalikan status baru
  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete a campaign
// @route   DELETE /api/campaigns/:deviceId/:campaignId
// @access  Private
router.delete('/:deviceId/:campaignId', validateDeviceAccessForDelete, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.campaignId, userId: req.user.id, deviceId: req.params.deviceId });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // TODO: Padam fail media berkaitan jika ada
    if (campaign.mediaPath) {
        const fs = require('fs');
         fs.unlink(campaign.mediaPath, (err) => {
            if (err) console.error(`Error deleting media file ${campaign.mediaPath} for deleted campaign ${campaign._id}:`, err);
            else console.log(`Deleted media file ${campaign.mediaPath} for campaign ${campaign._id}`);
        });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update campaign details (for editing)
// @route   PUT /api/campaigns/:deviceId/:campaignId
// @access  Private
router.put('/:deviceId/:campaignId', validateDeviceAccess, uploadMedia, async (req, res) => {
    const { campaignId } = req.params;
    const {
        campaignName,
        statusEnabled,
        enableLink,
        urlLink,
        caption,
        // aiAgentTraining, // Tidak relevan untuk bulk
        // useAI, // Tidak relevan untuk bulk
        // presenceDelay, // Tidak relevan untuk bulk
        contactGroupId,
        scheduledAt,
        minIntervalSeconds,
        maxIntervalSeconds,
        campaignScheduleType,
        campaignScheduleDetails, // String JSON array jam
        mediaAttachments // Array of media IDs from library, atau string "[]" jika mahu kosongkan
    } = req.body;

    try {
        let campaign = await Campaign.findOne({ 
            _id: campaignId, 
            userId: req.user.id, 
            deviceId: req.params.deviceId 
        });

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Kemaskini field asas
        if (campaignName) campaign.campaignName = campaignName;
        if (typeof statusEnabled !== 'undefined') campaign.statusEnabled = (statusEnabled === 'true' || statusEnabled === true);
        if (typeof enableLink !== 'undefined') campaign.enableLink = (enableLink === 'true' || enableLink === true);
        
        campaign.urlLink = (campaign.enableLink && urlLink) ? urlLink : '';
        if (caption) campaign.caption = caption;
        if (contactGroupId) campaign.contactGroupId = contactGroupId; // Pastikan contactGroupId dihantar jika kempen pukal

        // Kemaskini field penjadualan (hanya untuk bulk, tapi model campaign ada field ini)
        if (scheduledAt) {
            campaign.scheduledAt = new Date(scheduledAt);
        } else if (scheduledAt === '' || scheduledAt === null) { // Jika dihantar kosong, buang penjadualan
            campaign.scheduledAt = null;
        }
        // Untuk interval, pastikan ia adalah nombor
        if (minIntervalSeconds) campaign.minIntervalSeconds = parseInt(minIntervalSeconds, 10);
        if (maxIntervalSeconds) campaign.maxIntervalSeconds = parseInt(maxIntervalSeconds, 10);
        
        if (campaignScheduleType) campaign.campaignScheduleType = campaignScheduleType;
        
        if (campaignScheduleDetails) {
            if (typeof campaignScheduleDetails === 'string') {
                try {
                    const parsedDetails = JSON.parse(campaignScheduleDetails);
                    campaign.campaignScheduleDetails = Array.isArray(parsedDetails) ? parsedDetails : [];
                } catch (e) {
                    console.warn("Failed to parse campaignScheduleDetails, will be saved as empty array or null based on type");
                    campaign.campaignScheduleDetails = (campaignScheduleType && campaignScheduleType !== 'anytime') ? [] : null;
                }
            } else if (Array.isArray(campaignScheduleDetails)) {
                campaign.campaignScheduleDetails = campaignScheduleDetails;
            } else {
                 campaign.campaignScheduleDetails = (campaignScheduleType && campaignScheduleType !== 'anytime') ? [] : null;
            }
        } else if (campaignScheduleType === 'anytime') {
            campaign.campaignScheduleDetails = null; // Kosongkan jika anytime
        }
        // Jika campaignScheduleDetails tidak dihantar tetapi type bukan anytime, mungkin mahu kekalkan nilai sedia ada atau kosongkan
        // Untuk sekarang, ia hanya akan dikemaskini jika dihantar.

        // Kendalikan media
        let finalMediaAttachmentIds = [...campaign.mediaAttachments]; // Mulakan dengan yang sedia ada

        if (mediaAttachments !== undefined) { // Jika ada arahan dari body untuk mediaAttachments
            let newAttachmentIds = [];
            
            console.log(`[Campaign Update] mediaAttachments received:`, {
                type: typeof mediaAttachments,
                value: mediaAttachments,
                isArray: Array.isArray(mediaAttachments)
            });
            
            if (Array.isArray(mediaAttachments)) { 
                // Jika ia array ID
                newAttachmentIds = mediaAttachments;
                console.log(`[Campaign Update] Using array mediaAttachments: ${newAttachmentIds.length} items`);
            } else if (typeof mediaAttachments === 'string') {
                if (mediaAttachments.trim() === '' || mediaAttachments.trim() === '[]') {
                    // Empty string or empty array string
                    newAttachmentIds = [];
                    console.log(`[Campaign Update] Empty mediaAttachments string, clearing media`);
                } else if (mediaAttachments.startsWith('[') && mediaAttachments.endsWith(']')) {
                    // Looks like JSON array string
                    try {
                        const parsed = JSON.parse(mediaAttachments);
                        if (Array.isArray(parsed)) {
                            newAttachmentIds = parsed;
                            console.log(`[Campaign Update] Parsed JSON array mediaAttachments: ${newAttachmentIds.length} items`);
                        } else {
                            console.warn(`[Campaign Update] Parsed value is not an array:`, parsed);
                            newAttachmentIds = [mediaAttachments]; // Fallback to single ID
                        }
                    } catch(e) {
                        console.warn(`[Campaign Update] JSON array parse failed:`, {
                            value: mediaAttachments,
                            error: e.message
                        });
                        newAttachmentIds = [mediaAttachments]; // Fallback to single ID
                    }
                } else {
                    // Single media ID string (most common case)
                    newAttachmentIds = [mediaAttachments];
                    console.log(`[Campaign Update] Single media ID string: ${mediaAttachments}`);
                }
            } else if (mediaAttachments === null) {
                // Explicitly clear media
                newAttachmentIds = [];
                console.log(`[Campaign Update] mediaAttachments is null, clearing media`);
            }
            
            // Sahkan semua ID media baru dan pastikan ia milik pengguna
            if (newAttachmentIds.length > 0) {
                const validUserMedia = await Media.find({ 
                    _id: { $in: newAttachmentIds }, 
                    user: req.user.id 
                }).select('_id');
                finalMediaAttachmentIds = validUserMedia.map(media => media._id);
            } else {
                // Jika newAttachmentIds adalah array kosong (e.g. dari "[]"), maka kosongkan media
                finalMediaAttachmentIds = [];
            }
            
            // Jika mediaAttachments dari library digunakan, dan ada req.file, fail baru diabaikan.
            if (req.file && req.file.buffer) {
                console.log("New file uploaded but mediaAttachments (library) provided. File buffer will be ignored (memory storage).");
                // No need to delete file since it's in memory storage
            }
        } else if (req.file) {
            // Jika tiada arahan mediaAttachments dari body, TAPI ada fail baru diupload
            // Ini bermakna pengguna mahu gantikan semua media lama dengan fail baru ini.
            try {
                console.log("Processing uploaded file for campaign update (memory storage):", {
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    hasBuffer: !!req.file.buffer
                });

                // Use S3 service for file upload (same logic as media controller)
                const s3Service = require('../services/s3Service.js');
                const mediaCompressionService = require('../services/mediaCompressionService.js');
                
                // Compress media if needed
                let finalBuffer = req.file.buffer;
                let finalMimeType = req.file.mimetype;
                let finalFileName = req.file.originalname;
                let compressionInfo = null;
                
                if (mediaCompressionService.needsCompression(req.file.buffer.length, req.file.mimetype)) {
                    console.log("File needs compression for campaign update");
                    try {
                        const compressionResult = await mediaCompressionService.compressMedia(
                            req.file.buffer, 
                            req.file.mimetype, 
                            req.file.originalname
                        );
                        
                        finalBuffer = compressionResult.buffer;
                        finalMimeType = compressionResult.mimeType;
                        finalFileName = compressionResult.fileName;
                        compressionInfo = {
                            originalSize: compressionResult.originalSize,
                            compressedSize: compressionResult.compressedSize,
                            compressionRatio: compressionResult.compressionRatio,
                            compressionApplied: compressionResult.compressionApplied
                        };
                        console.log("Compression completed for campaign update:", compressionInfo);
                    } catch (compressionError) {
                        console.warn("Compression failed for campaign update, using original file:", compressionError.message);
                    }
                }

                // Upload to S3
                const uploadResult = await s3Service.uploadFile(
                    finalBuffer, 
                    finalFileName, 
                    finalMimeType, 
                    req.user.id.toString()
                );
                
                if (!uploadResult.success) {
                    throw new Error('S3 upload failed');
                }

                console.log("S3 upload successful for campaign update:", uploadResult.fileName);

                // Create media record
                const mediaData = {
                    user: req.user.id,
                    originalName: req.file.originalname,
                    fileName: uploadResult.fileName,
                    filePath: uploadResult.filePath,
                    fileType: finalMimeType,
                    fileSize: uploadResult.fileSize,
                    storageType: uploadResult.storageType,
                    fileUrl: uploadResult.fileUrl
                };

                // Add compression info if available
                if (compressionInfo) {
                    mediaData.compressionInfo = compressionInfo;
                }

                // Add S3 metadata
                if (uploadResult.storageType === 's3' && uploadResult.metadata) {
                    mediaData.s3Metadata = {
                        bucket: uploadResult.metadata.bucket,
                        key: uploadResult.metadata.key,
                        eTag: uploadResult.metadata.eTag
                    };
                }

                const newMediaRecord = await Media.create(mediaData);
                finalMediaAttachmentIds = [newMediaRecord._id]; // Gantikan dengan media baru
                console.log("New Media record created and replaced attachments for campaign update:", newMediaRecord._id);
            } catch (mediaCreationError) {
                console.error("Error creating Media record for uploaded file during campaign update:", mediaCreationError);
                // No need to delete file since it's memory storage
                return res.status(500).json({ message: 'Failed to process uploaded media file for update.' });
            }
        }
        // Jika tiada mediaAttachments dan tiada req.file, finalMediaAttachmentIds kekal dengan nilai asal.

        campaign.mediaAttachments = finalMediaAttachmentIds;

        const updatedCampaign = await campaign.save();
        res.json(updatedCampaign);

    } catch (error) {
        console.error('Error updating campaign:', error);
        // For memory storage, no need to delete files on error
        if (req.file && req.file.buffer) {
            console.log("Campaign update failed, file buffer will be garbage collected (memory storage)");
        }
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server Error updating campaign' });
        }
    }
});

// @desc    Duplicate a campaign
// @route   POST /api/campaigns/:deviceId/:campaignId/duplicate
// @access  Private
router.post('/:deviceId/:campaignId/duplicate', validateDeviceAccess, async (req, res) => {
    const { campaignId } = req.params;
    const userId = req.user.id;
    const deviceId = req.params.deviceId;

    try {
        const originalCampaign = await Campaign.findOne({
            _id: campaignId,
            userId: userId,
            deviceId: deviceId
        });

        if (!originalCampaign) {
            return res.status(404).json({ message: 'Original campaign not found' });
        }

        // Buat data untuk kempen baru
        const newCampaignData = {
            userId: userId,
            deviceId: deviceId,
            campaignName: `Copy of ${originalCampaign.campaignName.substring(0, 200)}`, // Hadkan panjang nama
            campaignType: originalCampaign.campaignType,
            statusEnabled: false, // Duplicate biasanya tidak aktif secara lalai
            
            // Salin field berkaitan kempen pukal jika ia kempen pukal
            contactGroupId: originalCampaign.campaignType === 'bulk' ? originalCampaign.contactGroupId : null,
            scheduledAt: originalCampaign.scheduledAt, // Mungkin mahu set null atau biarkan pengguna set semula
            minIntervalSeconds: originalCampaign.minIntervalSeconds,
            maxIntervalSeconds: originalCampaign.maxIntervalSeconds,
            campaignScheduleType: originalCampaign.campaignScheduleType,
            campaignScheduleDetails: originalCampaign.campaignScheduleDetails ? [...originalCampaign.campaignScheduleDetails] : null,
            
            caption: originalCampaign.caption,
            mediaAttachments: originalCampaign.mediaAttachments ? [...originalCampaign.mediaAttachments] : [], // Salin rujukan media
            
            // Field AI (jika ia kempen AI, salin juga)
            aiAgentTraining: originalCampaign.campaignType === 'ai_chatbot' ? originalCampaign.aiAgentTraining : '',
            useAI: originalCampaign.campaignType === 'ai_chatbot' ? originalCampaign.useAI : false,
            presenceDelay: originalCampaign.campaignType === 'ai_chatbot' ? originalCampaign.presenceDelay : 'typing',
            
            enableLink: originalCampaign.enableLink,
            urlLink: originalCampaign.urlLink,
            
            // Reset statistik
            sentCount: 0,
            failedCount: 0,
            // createdAt dan updatedAt akan dijanakan secara automatik
        };

        const duplicatedCampaign = await Campaign.create(newCampaignData);
        res.status(201).json(duplicatedCampaign);

    } catch (error) {
        console.error('Error duplicating campaign:', error);
        res.status(500).json({ message: 'Server Error duplicating campaign' });
    }
});

// @desc    Execute a campaign (bulk or AI chatbot)
// @route   POST /api/campaigns/:deviceId/:campaignId/execute
// @access  Private
router.post('/:deviceId/:campaignId/execute', validateDeviceAccess, async (req, res) => {
    const { campaignId, deviceId } = req.params;
    const userId = req.user.id;

    try {
        // Load campaign to determine type
        const campaign = await Campaign.findOne({
            _id: campaignId,
            userId: userId,
            deviceId: deviceId
        });

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Import controller functions
        const { executeCampaign } = require('../controllers/whatsappController.js');
        
        // Execute the campaign using the controller function
        return await executeCampaign(req, res);

    } catch (error) {
        console.error('Error executing campaign:', error);
        res.status(500).json({ message: 'Server Error executing campaign' });
    }
});

// @desc    Debug endpoint - Get campaign with full details
// @route   GET /api/campaigns/:deviceId/:campaignId/debug
// @access  Private
router.get('/:deviceId/:campaignId/debug', validateDeviceAccess, async (req, res) => {
    try {
        let campaign = await Campaign.findOne({ 
            _id: req.params.campaignId, 
            userId: req.user.id, 
            deviceId: req.params.deviceId 
        })
        .populate('mediaAttachments');

        // Conditionally populate contactGroupId only if it's not "all_contacts"
        if (campaign && campaign.contactGroupId && campaign.contactGroupId !== 'all_contacts') {
            campaign = await Campaign.findOne({ 
                _id: req.params.campaignId, 
                userId: req.user.id, 
                deviceId: req.params.deviceId 
            })
            .populate('mediaAttachments')
            .populate({
                path: 'contactGroupId',
                populate: {
                    path: 'contacts',
                    select: 'name phoneNumber'
                }
            });
        }

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Get all contact groups for dropdown
        const ContactGroup = require('../models/ContactGroup.js');
        const allContactGroups = await ContactGroup.find({ user: req.user.id })
            .populate('contacts', 'name phoneNumber')
            .sort({ groupName: 1 });

        res.json({
            campaign: campaign,
            availableContactGroups: allContactGroups.map(group => ({
                _id: group._id,
                groupName: group.groupName,
                contactCount: group.contacts.length,
                contacts: group.contacts
            })),
            debugInfo: {
                campaignType: campaign.campaignType,
                hasContactGroup: !!campaign.contactGroupId,
                isAllContactsMode: campaign.contactGroupId === 'all_contacts',
                contactGroupPopulated: campaign.contactGroupId === 'all_contacts' ? false : !!campaign.contactGroupId?.contacts,
                contactCount: campaign.contactGroupId === 'all_contacts' ? 'All contacts will be used' : (campaign.contactGroupId?.contacts?.length || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching campaign debug details:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Debug user devices and campaigns
// @route   GET /api/campaigns/debug/devices/:userId
// @access  Private
router.get('/debug/devices/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get all devices for user
        const devices = await WhatsappDevice.find({ userId: userId });
        
        // Get all campaigns for user to see what deviceIds are used
        const campaigns = await Campaign.find({ userId: userId }).select('deviceId campaignName campaignType');
        
        res.json({
            userId: userId,
            deviceCount: devices.length,
            devices: devices.map(d => ({
                _id: d._id,
                deviceId: d.deviceId,
                name: d.name,
                number: d.number,
                connectionStatus: d.connectionStatus,
                createdAt: d.createdAt,
                lastConnectedAt: d.lastConnectedAt
            })),
            campaignCount: campaigns.length,
            campaignDeviceIds: [...new Set(campaigns.map(c => c.deviceId))], // Unique device IDs used in campaigns
            campaigns: campaigns.map(c => ({
                _id: c._id,
                name: c.campaignName,
                type: c.campaignType,
                deviceId: c.deviceId
            }))
        });
    } catch (error) {
        console.error('Error debugging user devices:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Debug AI chatbot campaigns for user
// @route   GET /api/campaigns/debug/ai-chatbot/:userId
// @access  Private
router.get('/debug/ai-chatbot/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get all AI chatbot campaigns for user
        const aiCampaigns = await Campaign.find({
            userId: userId,
            campaignType: 'ai_chatbot'
        }).sort({ createdAt: -1 });

        // Get only active campaigns
        const activeCampaigns = await Campaign.find({
            userId: userId,
            campaignType: 'ai_chatbot',
            status: 'enable',
            statusEnabled: true
        });

        res.json({
            userId: userId,
            totalAICampaigns: aiCampaigns.length,
            activeCampaigns: activeCampaigns.length,
            allCampaigns: aiCampaigns.map(c => ({
                id: c._id,
                name: c.name || c.campaignName,
                status: c.status,
                statusEnabled: c.statusEnabled,
                keywords: c.keywords,
                type: c.type,
                captionAi: c.captionAi,
                createdAt: c.createdAt
            })),
            activeCampaignsDetails: activeCampaigns.map(c => ({
                id: c._id,
                name: c.name || c.campaignName,
                keywords: c.keywords,
                type: c.type,
                captionAi: c.captionAi
            }))
        });
    } catch (error) {
        console.error('Error debugging AI chatbot campaigns:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// Migration endpoint to fix existing campaigns with 'all_contacts' stored as ObjectId
router.post('/migrate/fix-all-contacts', protect, async (req, res) => {
    try {
        // Find campaigns with contactGroupId that might represent 'all_contacts' 
        const campaigns = await Campaign.find({
            campaignType: 'bulk'
        });
        
        let fixedCount = 0;
        const fixes = [];
        
        for (const campaign of campaigns) {
            if (campaign.contactGroupId) {
                const hex = campaign.contactGroupId.toString();
                
                // Check if this ObjectId represents 'all_contacts'
                if (hex === '616c6c5f636f6e7461637473') {
                    console.log(`[Migration] Fixing campaign ${campaign._id}: ${hex} -> 'all_contacts'`);
                    
                    await Campaign.findByIdAndUpdate(campaign._id, {
                        contactGroupId: 'all_contacts'
                    });
                    
                    fixedCount++;
                    fixes.push({
                        campaignId: campaign._id,
                        campaignName: campaign.campaignName,
                        before: hex,
                        after: 'all_contacts'
                    });
                }
            }
        }
        
        res.json({
            success: true,
            message: `Migration completed. Fixed ${fixedCount} campaigns.`,
            fixedCount,
            fixes
        });
        
    } catch (error) {
        console.error('Error in migration:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    }
});

// Debug endpoint untuk check user contacts dan campaign readiness
router.get('/debug/user-contacts', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get all user contacts
        const Contact = require('../models/Contact');
        const ContactGroup = require('../models/ContactGroup');
        
        const userContacts = await Contact.find({ user: userId });
        const userContactGroups = await ContactGroup.find({ user: userId }).populate('contacts');
        
        const contactsData = userContacts.map(contact => ({
            id: contact._id,
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            createdAt: contact.createdAt
        }));
        
        const groupsData = userContactGroups.map(group => ({
            id: group._id,
            name: group.groupName,
            contactCount: group.contacts?.length || 0,
            contacts: group.contacts?.map(c => ({ name: c.name, phone: c.phoneNumber })) || []
        }));
        
        res.json({
            success: true,
            userId: userId,
            summary: {
                totalContacts: userContacts.length,
                totalGroups: userContactGroups.length,
                canUseAllContacts: userContacts.length > 0
            },
            contacts: contactsData,
            contactGroups: groupsData,
            recommendations: {
                useAllContacts: userContacts.length > 0 ? 'Available - you can use "Send to all contacts" option' : 'Not available - please add contacts first',
                addContacts: userContacts.length === 0 ? 'Go to Upload Contacts page to add contacts' : null
            }
        });
        
    } catch (error) {
        console.error('Error in debug user contacts:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
});

module.exports = router; 
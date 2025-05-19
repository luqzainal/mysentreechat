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
    mediaAttachments // Array of media IDs from library
  } = req.body;

  // Log input untuk debugging
  // console.log("Request Body:", req.body);
  // console.log("Request File:", req.file);
  // console.log("Received mediaAttachments:", mediaAttachments);

  if (!campaignName) {
      return res.status(400).json({ message: 'Campaign name is required' });
  }
  if (campaignType && !['bulk', 'ai_chatbot'].includes(campaignType)) {
      return res.status(400).json({ message: 'Invalid campaignType. Must be bulk or ai_chatbot.' });
  }
  if (campaignType === 'bulk' && !contactGroupId) {
      return res.status(400).json({ message: 'Contact Group ID is required for bulk campaigns.' });
  }

  try {
    const newCampaignData = {
      userId: req.user.id,
      deviceId: deviceId,
      campaignName,
      campaignType: campaignType || (useAI === 'true' ? 'ai_chatbot' : 'bulk'), // Default type logic
      statusEnabled: statusEnabled === 'true',
      enableLink: enableLink === 'true',
      urlLink: enableLink === 'true' ? urlLink : '',
      caption,
      aiAgentTraining,
      useAI: useAI === 'true',
      presenceDelay,
      sentCount: 0, 
      failedCount: 0,
      mediaAttachments: [] // Inisialisasi sebagai array kosong
    };

    if (campaignType === 'bulk') {
        newCampaignData.contactGroupId = contactGroupId;
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

    if (mediaAttachments && Array.isArray(mediaAttachments) && mediaAttachments.length > 0) {
        // Sahkan semua ID media dan pastikan ia milik pengguna
        const validUserMedia = await Media.find({ 
            _id: { $in: mediaAttachments }, 
            user: req.user.id 
        }).select('_id');
        
        finalMediaAttachmentIds = validUserMedia.map(media => media._id);

        if (finalMediaAttachmentIds.length !== mediaAttachments.length) {
            // Tidak semua mediaId yang dihantar adalah sah atau milik pengguna
            // Mungkin log amaran atau hantar ralat separa? Buat masa ini kita guna yang sah sahaja.
            console.warn(`Beberapa ID media tidak sah atau bukan milik pengguna ${req.user.id}. Hanya ID yang sah akan digunakan.`);
            // Jika fail turut dimuat naik, padamkannya kerana kita utamakan dari pustaka jika ada
            if (req.file && req.file.path) {
                const fs = require('fs');
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error deleting redundant uploaded file (library selection took precedence):", err);
                });
            }
        }
    } else if (req.file) {
      // Jika tiada mediaAttachments dari pustaka, tapi ada fail diupload, cipta rekod Media baru
      try {
        const newMediaRecord = await Media.create({
            user: req.user.id,
            originalName: req.file.originalname,
            fileName: req.file.filename, // Nama fail yang disimpan oleh Multer
            filePath: `/uploads/media/${req.file.filename}`, // Path relatif
            fileType: req.file.mimetype,
            fileSize: req.file.size,
        });
        finalMediaAttachmentIds.push(newMediaRecord._id);
        console.log("New Media record created for uploaded file:", newMediaRecord._id);
      } catch (mediaCreationError) {
        console.error("Error creating Media record for uploaded file:", mediaCreationError);
        // Jika gagal cipta rekod Media, padam fail yang telah dimuat naik
        const fs = require('fs');
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting uploaded file after Media record creation failure:", err);
        });
        // Hantar ralat atau teruskan tanpa media?
        // Untuk sekarang, kita hantar ralat kerana media dijangka ada jika fail diupload.
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
            if (req.file && req.file.path) {
                const fs = require('fs');
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error deleting redundant uploaded file when mediaId is used:", err);
                    else console.log("Redundant uploaded file deleted as mediaId was provided.");
                });
            }
        } else {
            console.warn(`Media with ID ${mediaId} not found for user ${req.user.id}. Campaign will be created without media.`);
        }
    } else if (req.file) {
      newCampaignData.mediaPath = `/uploads/media/${req.file.filename}`; 
      newCampaignData.mediaOriginalName = req.file.originalname;
      newCampaignData.mediaMimeType = req.file.mimetype;
    }
    */

    const campaign = await Campaign.create(newCampaignData);
    res.status(201).json(campaign); 

  } catch (error) {
    console.error('Error creating campaign:', error);
    // Jika ralat berlaku selepas fail mungkin telah dimuat naik (dan belum diuruskan), padamkannya
    if (req.file && req.file.path && !res.headersSent) { // Semak jika belum ada Media record dibuat untuknya
        // Lebih selamat jika kita tahu Media record tidak sempat dibuat atau gagal.
        // Jika Media record berjaya dibuat (dalam kes req.file), ia tidak perlu dipadam di sini.
        // Logik pemadaman sudah ada dalam blok catch mediaCreationError.
        // Jadi, di sini hanya jika ralat umum berlaku SEBELUM media diproses.
        // Untuk lebih mudah, jika req.file ada dan ralat umum, kita boleh cuba padam.
        const fs =require('fs');
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting uploaded file after failed campaign creation (general error):", err);
        });
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
    const campaign = await Campaign.findOne({ _id: req.params.campaignId, userId: req.user.id, deviceId: req.params.deviceId });
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
router.delete('/:deviceId/:campaignId', validateDeviceAccess, async (req, res) => {
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

        if (mediaAttachments) { // Jika ada arahan dari body untuk mediaAttachments
            let newAttachmentIds = [];
            if (Array.isArray(mediaAttachments)) { // Jika ia array ID
                newAttachmentIds = mediaAttachments;
            } else if (typeof mediaAttachments === 'string') {
                try {
                    const parsed = JSON.parse(mediaAttachments); // Cuba parse jika string "[]" atau "[id1, id2]"
                    if (Array.isArray(parsed)) {
                        newAttachmentIds = parsed;
                    }
                } catch(e) {
                    console.warn("mediaAttachments string could not be parsed as JSON array. Ignoring.");
                }
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
            if (req.file && req.file.path) {
                const fs = require('fs');
                console.log("New file uploaded but mediaAttachments (library) provided. Deleting uploaded file:", req.file.path);
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error deleting redundant uploaded file during campaign update:", err);
                });
            }
        } else if (req.file) {
            // Jika tiada arahan mediaAttachments dari body, TAPI ada fail baru diupload
            // Ini bermakna pengguna mahu gantikan semua media lama dengan fail baru ini.
            try {
                const newMediaRecord = await Media.create({
                    user: req.user.id,
                    originalName: req.file.originalname,
                    fileName: req.file.filename,
                    filePath: `/uploads/media/${req.file.filename}`,
                    fileType: req.file.mimetype,
                    fileSize: req.file.size,
                });
                finalMediaAttachmentIds = [newMediaRecord._id]; // Gantikan dengan media baru
                console.log("New Media record created and replaced attachments for campaign update:", newMediaRecord._id);
            } catch (mediaCreationError) {
                console.error("Error creating Media record for uploaded file during campaign update:", mediaCreationError);
                // Padam fail yang diupload jika rekod Media gagal dicipta
                const fs = require('fs');
                fs.unlink(req.file.path, (errUnlink) => {
                    if (errUnlink) console.error("Error deleting uploaded file after Media creation failure during update:", errUnlink);
                });
                // Jangan teruskan jika ada ralat kritikal pemprosesan media
                return res.status(500).json({ message: 'Failed to process uploaded media file for update.' });
            }
        }
        // Jika tiada mediaAttachments dan tiada req.file, finalMediaAttachmentIds kekal dengan nilai asal.

        campaign.mediaAttachments = finalMediaAttachmentIds;

        const updatedCampaign = await campaign.save();
        res.json(updatedCampaign);

    } catch (error) {
        console.error('Error updating campaign:', error);
        // Padam fail yang mungkin telah dimuat naik jika ralat berlaku dan belum diuruskan
        if (req.file && req.file.path) {
            // Semak jika fail telah diproses (contohnya, jika newMediaRecord telah dicipta)
            // Ini agak sukar untuk ditentukan di sini tanpa state tambahan.
            // Sebagai langkah selamat, kita cuba padam jika ada ralat umum.
            const fs = require('fs');
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting uploaded file after failed campaign update (general error):", err);
            });
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

module.exports = router; 
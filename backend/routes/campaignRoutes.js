const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams diperlukan untuk akses :deviceId dari parent router
const { protect } = require('../middleware/authMiddleware');
const { uploadMedia } = require('../middleware/uploadMiddleware'); // Import middleware upload
const Campaign = require('../models/Campaign');
const WhatsappDevice = require('../models/WhatsappDevice'); // Diperlukan untuk validasi deviceId

// Middleware untuk validasi deviceId dan kepunyaan user
const validateDeviceAccess = async (req, res, next) => {
  const { deviceId } = req.params;
  try {
    const device = await WhatsappDevice.findOne({ deviceId: deviceId, userId: req.user.id });
    if (!device) {
      return res.status(404).json({ message: 'Device not found or access denied' });
    }
    req.device = device; // Simpan device info dalam request jika perlu
    next();
  } catch (error) {
    console.error('Error validating device access:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Semua route di bawah ini dilindungi dan memerlukan deviceId yang sah
router.use(protect, validateDeviceAccess);

// @desc    Get all campaigns for a specific device
// @route   GET /api/campaigns/:deviceId
// @access  Private
router.get('/', async (req, res) => {
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
router.post('/', uploadMedia, async (req, res) => { // Guna middleware uploadMedia
  const { deviceId } = req.params;
  const {
    campaignName,
    statusEnabled,
    enableLink,
    urlLink,
    caption,
    aiAgentTraining,
    useAI,
    presenceDelay
  } = req.body;

  // Validasi input asas
  if (!campaignName) {
      return res.status(400).json({ message: 'Campaign name is required' });
  }

  try {
    const newCampaignData = {
      userId: req.user.id,
      deviceId: deviceId,
      campaignName,
      // Pastikan nilai boolean ditukar dari string jika perlu
      statusEnabled: statusEnabled === 'true',
      enableLink: enableLink === 'true',
      urlLink: enableLink === 'true' ? urlLink : '',
      caption,
      aiAgentTraining,
      useAI: useAI === 'true',
      presenceDelay,
    };

    // Jika ada fail media diupload
    if (req.file) {
      newCampaignData.mediaPath = req.file.path; // Simpan path relatif/absolut dari multer
      newCampaignData.mediaOriginalName = req.file.originalname;
      newCampaignData.mediaMimeType = req.file.mimetype;
    }

    const campaign = await Campaign.create(newCampaignData);
    res.status(201).json(campaign); // Kembalikan data kempen yang baru dibuat

  } catch (error) {
    console.error('Error creating campaign:', error);
    // Jika error disebabkan fail upload (contoh: saiz terlalu besar), multer mungkin dah hantar response
    if (!res.headersSent) {
       // Padam fail yang mungkin separuh diupload jika error berlaku selepas upload
       if (req.file && req.file.path) {
           const fs = require('fs');
           fs.unlink(req.file.path, (err) => {
               if (err) console.error("Error deleting uploaded file after failed campaign creation:", err);
           });
       }
       res.status(500).json({ message: 'Server Error creating campaign' });
    }
  }
});

// @desc    Get a single campaign details
// @route   GET /api/campaigns/:deviceId/:campaignId
// @access  Private
router.get('/:campaignId', async (req, res) => {
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
router.put('/:campaignId/status', async (req, res) => {
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
router.delete('/:campaignId', async (req, res) => {
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
router.put('/:campaignId', uploadMedia, async (req, res) => {
     // TODO: Implement campaign update logic
     // - Dapatkan data dari req.body dan req.file (jika ada)
     // - Cari kempen sedia ada
     // - Kemaskini field
     // - Jika ada fail baru, padam fail lama (jika ada)
     // - Simpan perubahan
     res.status(501).json({ message: `Campaign update for ${req.params.campaignId} not implemented yet` });
});


module.exports = router; 
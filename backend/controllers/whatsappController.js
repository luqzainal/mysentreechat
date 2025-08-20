const Contact = require('../models/Contact.js');
const ContactGroup = require('../models/ContactGroup.js');
const Message = require('../models/Message.js');
const Campaign = require('../models/Campaign.js');
const Media = require('../models/Media.js');
const WhatsappDevice = require('../models/WhatsappDevice.js');
const baileysService = require('../services/baileysService.js');
const { processSpintax } = require('../utils/spintaxUtils.js');

// Fungsi helper untuk format nombor ke JID WhatsApp (sesuai untuk Baileys)
const formatToJid = (number) => {
  const digits = number.replace(/\D/g, '');
  if (digits.endsWith('@g.us')) { // Jika sudah format group JID
    return digits;
  }
  return `${digits}@s.whatsapp.net`; // Untuk chat individu dengan Baileys
};

// Fungsi helper untuk menambah delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// @desc    Hantar mesej pukal
// @route   POST /whatsapp/bulk
// @access  Private
const sendBulkMessage = async (req, res) => {
  const { message, contactIds, campaignId, deviceId } = req.body;
  const userId = req.user._id.toString();

  if (!message || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Message and at least one contact ID are required.' });
  }
  if (!campaignId) {
    return res.status(400).json({ message: 'campaignId is required for bulk messaging.' });
  }
  if (!deviceId) { // deviceId dari frontend merujuk kepada rekod WhatsappDevice
    return res.status(400).json({ message: 'deviceId is required.'});
  }

  const sock = baileysService.getWhatsAppSocket(userId); // Dapatkan klien Baileys (sock)

  if (!sock || !sock.user) { // Semak jika sock wujud dan ada user (menandakan sambungan aktif)
     console.warn(`[sendBulkMessage] Baileys client not found or not connected for user ${userId}. Attempting to check DB status for deviceId ${deviceId}`);
     try {
        const deviceStatus = await WhatsappDevice.findOne({ userId, deviceId, connectionStatus: 'connected' });
        if (!deviceStatus) {
            return res.status(400).json({ message: `WhatsApp connection (Baileys) is not active for device ${deviceId}. Please connect first via Scan QR page.` });
        }
        return res.status(400).json({ message: `Baileys client for device ${deviceId} not found in memory, though DB indicates connection. Please try reconnecting the device.`});
     } catch (dbError) {
        console.error("[sendBulkMessage] DB Error checking device status:", dbError);
        return res.status(500).json({ message: 'Server error checking Baileys connection status.' });
     }
  }

  try {
    // Muatkan kempen untuk dapatkan minIntervalSeconds dan maxIntervalSeconds
    const currentCampaign = await Campaign.findById(campaignId);
    if (!currentCampaign) {
        console.error(`[sendBulkMessage] Campaign with ID ${campaignId} not found.`);
        // Teruskan tanpa interval spesifik kempen, atau kembalikan ralat?
        // Untuk sekarang, guna default jika kempen tidak ditemui.
    }

    const minInterval = currentCampaign?.minIntervalSeconds || 5;
    const maxInterval = currentCampaign?.maxIntervalSeconds || 10;

    const contacts = await Contact.find({ 
      _id: { $in: contactIds }, 
      user: userId 
    }).select('phoneNumber name');

    if (contacts.length === 0) {
      return res.status(404).json({ message: 'No valid contacts found for the provided IDs.' });
    }

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const contact of contacts) {
      const targetJid = formatToJid(contact.phoneNumber);
      try {
        const spunMessage = processSpintax(message);
        console.log(`[sendBulkMessage] Sending (via Baileys) to ${contact.name} (${targetJid}) for campaign ${campaignId}, user ${userId}`);
        
        // Hantar mesej menggunakan Baileys: sock.sendMessage(jid, content, options)
        // Untuk mesej teks biasa:
        const sentMessageDetails = await sock.sendMessage(targetJid, { text: spunMessage });
        
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Success', messageId: sentMessageDetails?.key?.id });
        successCount++;
      } catch (error) {
        console.error(`[sendBulkMessage] Failed to send (via Baileys) to ${targetJid} for campaign ${campaignId}, user ${userId}:`, error);
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Failed', error: error.message });
        failCount++;
      }
      // Interval penghantaran
      const randomDelay = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      await delay(randomDelay * 1000); 
    }

    if (campaignId) {
        try {
            await Campaign.findByIdAndUpdate(campaignId, {
                $inc: { sentCount: successCount, failedCount: failCount }
            });
            console.log(`[sendBulkMessage] Campaign ${campaignId} stats updated: ${successCount} sent, ${failCount} failed.`);
        } catch (campaignUpdateError) {
            console.error(`[sendBulkMessage] Failed to update campaign stats for ${campaignId}:`, campaignUpdateError);
        }
    }

    res.json({
        message: `Bulk sending process completed. Success: ${successCount}, Failed: ${failCount}`,
        results: results
    });

  } catch (error) {
    console.error("[sendBulkMessage] Error in bulk send process:", error);
    res.status(500).json({ message: 'Server error during bulk message sending.' });
  }
};

// @desc    Dapatkan sejarah chat dengan nombor telefon tertentu
// @route   GET /whatsapp/chat/:phoneNumber
// @access  Private
const getChatHistory = async (req, res) => {
  const { phoneNumber } = req.params;
  const { deviceId } = req.query; // Terima deviceId dari query parameter
  const userId = req.user._id;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number parameter is required.' });
  }
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId query parameter is required.' });
  }

  const chatJid = formatToJid(phoneNumber);

  try {
    const messages = await Message.find({
      user: userId,
      chatJid: chatJid, 
      sourceDeviceId: deviceId // Tapis berdasarkan deviceId
    })
    .sort({ timestamp: 1 })
    .limit(100); 

    const formattedMessages = messages.map(msg => ({
        id: msg._id, 
        body: msg.body,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        // sourceDeviceId: msg.sourceDeviceId // Boleh sertakan jika frontend perlukannya
    }));

    res.json(formattedMessages);

  } catch (error) {
    console.error(`Error fetching chat history for ${chatJid}, device ${deviceId}:`, error);
    res.status(500).json({ message: 'Server error fetching chat history.' });
  }
};

// @desc    Hantar mesej individu
// @route   POST /whatsapp/send
// @access  Private
const sendMessageIndividual = async (req, res) => {
  const { to, message, deviceId } = req.body;
  const userId = req.user._id.toString();

  if (!to || !message) {
    return res.status(400).json({ message: 'Recipient number (to) and message are required.' });
  }
  if (!deviceId) { 
    return res.status(400).json({ message: 'deviceId is required.' });
  }

  const targetJid = formatToJid(to);
  const sock = baileysService.getWhatsAppSocket(userId);

  if (!sock || !sock.user) {
    return res.status(400).json({ message: 'WhatsApp connection (Baileys) is not active for this user. Please connect first.' });
  }

  try {
    console.log(`[sendMessageIndividual] Sending (via Baileys) to ${targetJid} for user ${userId}`);
    const sentMessageDetails = await sock.sendMessage(targetJid, { text: message });
    const messageId = sentMessageDetails?.key?.id;

    try {
        const newMessage = new Message({
            user: userId,
            chatJid: targetJid,
            body: message,
            timestamp: new Date(sentMessageDetails?.messageTimestamp ? parseInt(sentMessageDetails.messageTimestamp) * 1000 : Date.now()),
            fromMe: true,
            messageId: messageId || `baileys-${Date.now()}`,
            status: 'sent',
            sourceDeviceId: deviceId 
        });
        await newMessage.save();
        console.log(`[sendMessageIndividual] Sent message to ${targetJid} (Baileys) saved to DB. Message ID: ${messageId}`);
    } catch (dbError) {
        console.error(`[sendMessageIndividual] Failed to save sent message for ${targetJid} (Baileys) to DB:`, dbError);
    }

    res.status(200).json({ message: 'Message sent successfully.', messageId: messageId });

  } catch (error) {
    console.error(`[sendMessageIndividual] Error sending message (Baileys) to ${targetJid}:`, error);
    res.status(500).json({ message: error.message || 'Failed to send message.' });
  }
};

// @desc    Dapatkan senarai perbualan (chats)
// @route   GET /api/whatsapp/chats
// @access  Private
const getChats = async (req, res) => {
    const userId = req.user._id;
    const { deviceId } = req.query; // Terima deviceId dari query parameter

    if (!deviceId) {
        return res.status(400).json({ message: 'deviceId query parameter is required.' });
    }

    try {
        const matchCriteria = {
            user: userId,
            sourceDeviceId: deviceId // Tapis berdasarkan deviceId
        };

        const latestMessages = await Message.aggregate([
            { $match: matchCriteria }, 
            { $sort: { timestamp: -1 } }, 
            {
                $group: {
                    _id: "$chatJid", 
                    lastMessageTimestamp: { $first: "$timestamp" },
                    lastMessageBody: { $first: "$body" },
                    lastMessageFromMe: { $first: "$fromMe" },
                }
            },
            { $sort: { lastMessageTimestamp: -1 } } 
        ]);

        const chatJids = latestMessages.map(msg => msg._id);
        const contacts = await Contact.find({ user: userId, phoneNumber: { $in: chatJids } }).select('phoneNumber name');
        const contactMap = contacts.reduce((map, contact) => {
            map[contact.phoneNumber] = contact.name;
            return map;
        }, {});

        const chats = latestMessages.map(chat => ({
            jid: chat._id,
            name: contactMap[chat._id] || chat._id.split('@')[0],
            lastMessageTimestamp: chat.lastMessageTimestamp,
            lastMessageBody: chat.lastMessageBody,
            lastMessageFromMe: chat.lastMessageFromMe
        }));

        res.json(chats);

    } catch (error) {
        console.error(`Error fetching chats for user ${userId}, device ${deviceId}:`, error);
        res.status(500).json({ message: 'Server error fetching chats.' });
    }
};

// @desc    Execute bulk campaign - send messages to all contacts in contact group
// @route   POST /api/campaigns/:deviceId/:campaignId/execute
// @access  Private
const executeBulkCampaign = async (req, res) => {
  const { campaignId, deviceId } = req.params;
  const userId = req.user._id.toString();

  try {
    // Load campaign details
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: userId,
      deviceId: deviceId,
      campaignType: 'bulk'
    }).populate('mediaAttachments');

    if (!campaign) {
      return res.status(404).json({ message: 'Bulk campaign not found' });
    }

    if (!campaign.statusEnabled) {
      return res.status(400).json({ message: 'Campaign is disabled' });
    }

    // Check if WhatsApp is connected
    const sock = baileysService.getWhatsAppSocket(userId);
    if (!sock || !sock.user) {
      return res.status(400).json({ 
        message: 'WhatsApp connection is not active. Please connect first.' 
      });
    }

    // Handle "all_contacts" special value or load specific contact group
    let contactsToSend = [];
    
    console.log(`[executeBulkCampaign] Processing contactGroupId: "${campaign.contactGroupId}" (type: ${typeof campaign.contactGroupId})`);
    
    if (campaign.contactGroupId === 'all_contacts') {
      console.log(`[executeBulkCampaign] Using all contacts mode for user: ${userId}`);
      
      // Get all user contacts directly
      const allUserContacts = await Contact.find({ user: userId });
      console.log(`[executeBulkCampaign] Raw contact query result:`, allUserContacts);
      
      if (allUserContacts.length === 0) {
        // Check if any contacts exist at all for debugging
        const totalContactsInDb = await Contact.countDocuments();
        console.log(`[executeBulkCampaign] No contacts found for user ${userId}. Total contacts in DB: ${totalContactsInDb}`);
        
        return res.status(400).json({ 
          success: false,
          message: 'No contacts found in your account. Please add contacts first by going to Upload Contacts page.',
          debug: {
            userId: userId,
            totalContactsInSystem: totalContactsInDb,
            searchCriteria: { user: userId }
          }
        });
      }
      
      contactsToSend = allUserContacts;
      console.log(`[executeBulkCampaign] Found ${contactsToSend.length} total contacts for all contacts mode`);
      console.log(`[executeBulkCampaign] Sample contacts:`, contactsToSend.slice(0, 3).map(c => ({ name: c.name, phone: c.phoneNumber })));
      
    } else {
      // Check if contactGroupId is actually 'all_contacts' (edge case handling)
      if (campaign.contactGroupId === 'all_contacts') {
        console.log(`[executeBulkCampaign] Found 'all_contacts' in else branch - redirecting to all contacts mode`);
        
        // Get all user contacts directly
        const allUserContacts = await Contact.find({ user: userId });
        if (allUserContacts.length === 0) {
          return res.status(400).json({ 
            success: false,
            message: 'No contacts found in your account. Please add contacts first by going to Upload Contacts page.'
          });
        }
        
        contactsToSend = allUserContacts;
        console.log(`[executeBulkCampaign] Redirected to all contacts mode: ${contactsToSend.length} contacts`);
      } else {
        // Load specific contact group
        let contactGroup = await ContactGroup.findOne({
          _id: campaign.contactGroupId,
          user: userId
        }).populate('contacts');

        if (!contactGroup) {
          console.log(`[executeBulkCampaign] Contact group not found for ID: ${campaign.contactGroupId}`);
          return res.status(400).json({ 
            message: 'Contact group not found' 
          });
        }

        // If contact group exists but has no contacts, try to auto-assign all user contacts
        if (!contactGroup.contacts || contactGroup.contacts.length === 0) {
          console.log(`[executeBulkCampaign] Contact group ${contactGroup.groupName} is empty. Auto-assigning all user contacts...`);
          
          // Get all user contacts
          const allUserContacts = await Contact.find({ user: userId });
          
          if (allUserContacts.length === 0) {
            return res.status(400).json({ 
              message: 'No contacts found. Please add contacts first.' 
            });
          }

          // Add all contacts to the group
          contactGroup.contacts = allUserContacts.map(contact => contact._id);
          contactGroup.contactCount = allUserContacts.length;
          await contactGroup.save();
          
          // Reload with populated contacts
          contactGroup = await ContactGroup.findOne({
            _id: campaign.contactGroupId,
            user: userId
          }).populate('contacts');

          console.log(`[executeBulkCampaign] Auto-assigned ${allUserContacts.length} contacts to group ${contactGroup.groupName}`);
        }
        
        contactsToSend = contactGroup.contacts;
      }
    }

    const contacts = contactsToSend;
    const minInterval = campaign.minIntervalSeconds || 5;
    const maxInterval = campaign.maxIntervalSeconds || 10;

    let successCount = 0;
    let failCount = 0;
    const results = [];

    console.log(`[executeBulkCampaign] Starting execution for campaign ${campaignId}, ${contacts.length} contacts`);

    for (const contact of contacts) {
      const targetJid = formatToJid(contact.phoneNumber);
      
      try {
        // Process message content with spintax
        const messageContent = processSpintax(campaign.caption || '');
        
        // Prepare message object
        let messageData = {};

        // Handle media attachments
        if (campaign.mediaAttachments && campaign.mediaAttachments.length > 0) {
          const mediaFile = campaign.mediaAttachments[0]; // Use first media for now
          const s3Service = require('../services/s3Service.js');
          
          console.log(`[WhatsApp] Processing media file: ${mediaFile.fileName}, type: ${mediaFile.fileType}, storage: ${mediaFile.storageType}`);
          
          try {
            // Get file info with proper URL (S3 or local)
            const fileInfo = await s3Service.getFileInfo(mediaFile);
            
            console.log(`[WhatsApp] File info received:`, {
              isS3: fileInfo.isS3,
              accessUrl: fileInfo.accessUrl,
              fileName: mediaFile.fileName
            });
            
            if (fileInfo.isS3) {
              // For S3 files, download the file first, then send as buffer
              // Baileys works better with buffers than URLs for media
              console.log(`[WhatsApp] Downloading S3 file: ${mediaFile.fileName}`);
              
              const https = require('https');
              const http = require('http');
              const url = require('url');
              
              const downloadBuffer = await new Promise((resolve, reject) => {
                const parsedUrl = url.parse(fileInfo.accessUrl);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                
                client.get(fileInfo.accessUrl, (response) => {
                  if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download: ${response.statusCode}`));
                  }
                  
                  const chunks = [];
                  response.on('data', (chunk) => chunks.push(chunk));
                  response.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', reject);
              });
              
              console.log(`[WhatsApp] Downloaded ${downloadBuffer.length} bytes from S3`);
              
              if (mediaFile.fileType.startsWith('image/')) {
                messageData = {
                  image: downloadBuffer,
                  caption: messageContent
                };
              } else if (mediaFile.fileType.startsWith('video/')) {
                messageData = {
                  video: downloadBuffer,
                  caption: messageContent
                };
              } else if (mediaFile.fileType.startsWith('audio/')) {
                messageData = {
                  audio: downloadBuffer,
                  caption: messageContent
                };
              } else {
                // Document/file
                messageData = {
                  document: downloadBuffer,
                  mimetype: mediaFile.fileType,
                  fileName: mediaFile.originalName,
                  caption: messageContent
                };
              }
            } else {
              // For local files, read as Buffer
              const fs = require('fs');
              const path = require('path');
              const localPath = path.join(__dirname, '..', mediaFile.filePath);
              
              console.log(`[WhatsApp] Reading local file as Buffer: ${localPath}`);
              
              if (fs.existsSync(localPath)) {
                const mediaBuffer = fs.readFileSync(localPath);
                console.log(`[WhatsApp] Read ${mediaBuffer.length} bytes from local file`);
                
                if (mediaFile.fileType.startsWith('image/')) {
                  messageData = {
                    image: mediaBuffer,
                    caption: messageContent
                  };
                } else if (mediaFile.fileType.startsWith('video/')) {
                  messageData = {
                    video: mediaBuffer,
                    caption: messageContent
                  };
                } else if (mediaFile.fileType.startsWith('audio/')) {
                  messageData = {
                    audio: mediaBuffer,
                    caption: messageContent
                  };
                } else {
                  // Document/file
                  messageData = {
                    document: mediaBuffer,
                    mimetype: mediaFile.fileType,
                    fileName: mediaFile.originalName,
                    caption: messageContent
                  };
                }
              } else {
                throw new Error(`Local media file not found: ${localPath}`);
              }
            }
          } catch (error) {
            console.error(`[WhatsApp] Error processing media file:`, error);
            console.warn(`Media file processing failed, sending text only`);
            messageData = { text: messageContent };
          }
        } else {
          // Text only message
          messageData = { text: messageContent };
        }

        // Add link if enabled
        if (campaign.enableLink && campaign.urlLink) {
          const textContent = messageData.text || messageData.caption || '';
          const messageWithLink = `${textContent}\n\n${campaign.urlLink}`;
          
          if (messageData.text) {
            messageData.text = messageWithLink;
          } else if (messageData.caption) {
            messageData.caption = messageWithLink;
          }
        }

        console.log(`[executeBulkCampaign] Sending to ${contact.name} (${targetJid})`);
        
        // Send message via Baileys
        const sentMessageDetails = await sock.sendMessage(targetJid, messageData);
        
        results.push({ 
          name: contact.name, 
          number: contact.phoneNumber, 
          status: 'Success', 
          messageId: sentMessageDetails?.key?.id 
        });
        successCount++;

        // Save to message history
        try {
          const newMessage = new Message({
            user: userId,
            chatJid: targetJid,
            body: messageData.text || messageData.caption || '[Media message]',
            timestamp: new Date(),
            fromMe: true,
            messageId: sentMessageDetails?.key?.id || `campaign-${Date.now()}`,
            status: 'sent',
            sourceDeviceId: deviceId,
            campaignId: campaignId
          });
          await newMessage.save();
        } catch (dbError) {
          console.error(`Failed to save message to DB for ${targetJid}:`, dbError);
        }

      } catch (error) {
        console.error(`Failed to send to ${targetJid}:`, error);
        results.push({ 
          name: contact.name, 
          number: contact.phoneNumber, 
          status: 'Failed', 
          error: error.message 
        });
        failCount++;
      }

      // Random interval between messages
      const randomDelay = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      await delay(randomDelay * 1000);
    }

    // Update campaign statistics
    try {
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { sentCount: successCount, failedCount: failCount }
      });
      console.log(`[executeBulkCampaign] Campaign ${campaignId} stats updated: ${successCount} sent, ${failCount} failed`);
    } catch (campaignUpdateError) {
      console.error(`Failed to update campaign stats for ${campaignId}:`, campaignUpdateError);
    }

    res.json({
      message: `Bulk campaign execution completed. Success: ${successCount}, Failed: ${failCount}`,
      results: results,
      campaign: {
        id: campaignId,
        name: campaign.campaignName,
        totalContacts: contacts.length,
        successCount,
        failCount
      }
    });

  } catch (error) {
    console.error("[executeBulkCampaign] Error in campaign execution:", error);
    res.status(500).json({ message: 'Server error during campaign execution.' });
  }
};

// @desc    Execute AI Chatbot campaign - activate/enable the chatbot
// @route   POST /api/campaigns/:deviceId/:campaignId/execute
// @access  Private
const executeAIChatbotCampaign = async (req, res) => {
  const { campaignId, deviceId } = req.params;
  const userId = req.user._id.toString();

  try {
    // Load campaign details
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: userId,
      deviceId: deviceId,
      campaignType: 'ai_chatbot'
    });

    if (!campaign) {
      return res.status(404).json({ message: 'AI Chatbot campaign not found' });
    }

    // Check if WhatsApp is connected
    const sock = baileysService.getWhatsAppSocket(userId);
    if (!sock || !sock.user) {
      return res.status(400).json({ 
        message: 'WhatsApp connection is not active. Please connect first.' 
      });
    }

    // Enable the campaign
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'enable',
      statusEnabled: true
    });

    // Clear AI chatbot processor cache to pick up changes
    try {
      const aiChatbotProcessor = require('../services/aiChatbotProcessor.js');
      aiChatbotProcessor.clearCache(userId);
    } catch (error) {
      console.warn(`[executeAIChatbotCampaign] Could not clear AI chatbot cache:`, error.message);
    }

    console.log(`[executeAIChatbotCampaign] AI Chatbot campaign ${campaignId} activated for user ${userId}`);

    res.json({
      message: 'AI Chatbot campaign activated successfully',
      campaign: {
        id: campaignId,
        name: campaign.name || campaign.campaignName,
        status: 'enabled',
        keywords: campaign.keywords,
        type: campaign.type
      }
    });

  } catch (error) {
    console.error("[executeAIChatbotCampaign] Error activating AI chatbot campaign:", error);
    res.status(500).json({ message: 'Server error during AI chatbot campaign activation.' });
  }
};

// @desc    Execute campaign (auto-detect type)
// @route   POST /api/campaigns/:deviceId/:campaignId/execute
// @access  Private
const executeCampaign = async (req, res) => {
  const { campaignId, deviceId } = req.params;
  const userId = req.user._id.toString();

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

    // Route to appropriate execution function based on campaign type
    if (campaign.campaignType === 'bulk') {
      return await executeBulkCampaign(req, res);
    } else if (campaign.campaignType === 'ai_chatbot') {
      return await executeAIChatbotCampaign(req, res);
    } else {
      return res.status(400).json({ message: 'Unknown campaign type' });
    }

  } catch (error) {
    console.error("[executeCampaign] Error determining campaign type:", error);
    res.status(500).json({ message: 'Server error during campaign execution.' });
  }
};

module.exports = {
  // Export semua fungsi controller di sini
  // getContacts, // Dipindahkan ke contactController.js
  sendMessage: sendMessageIndividual,
  // getMessages, // Nampaknya tidak digunakan/didefinisikan
  // getChats, // Nampaknya tidak digunakan/didefinisikan
  // getScanQRCode, // Nampaknya tidak digunakan/didefinisikan
  // disconnectWhatsapp, // Nampaknya tidak digunakan/didefinisikan
  sendBulkMessage,
  getChatHistory,
  getChats, // Tambah fungsi baru
  executeCampaign,
  executeBulkCampaign,
  executeAIChatbotCampaign
}; 
const Contact = require('../models/Contact.js');
const Message = require('../models/Message.js');
const Campaign = require('../models/Campaign.js');
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
  getChats // Tambah fungsi baru
}; 
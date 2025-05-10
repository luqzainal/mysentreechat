const Contact = require('../models/Contact.js');
const Message = require('../models/Message.js');
const Campaign = require('../models/Campaign.js');
const { getWhatsAppSocket, sendMessage: sendWhatsappMessageViaService } = require('../services/whatsappService.js');
const { processSpintax } = require('../utils/spintaxUtils.js');

// Fungsi helper untuk format nombor ke JID WhatsApp
const formatToJid = (number) => {
  // Buang simbol bukan digit
  const digits = number.replace(/\D/g, '');
  // Tambah @c.us (sepatutnya @c.us untuk chat biasa, bukan @s.whatsapp.net)
  return `${digits}@c.us`; 
};

// Fungsi helper untuk menambah delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// @desc    Hantar mesej pukal
// @route   POST /whatsapp/bulk
// @access  Private
const sendBulkMessage = async (req, res) => {
  const { message, contactIds, campaignId, deviceId } = req.body;
  const userId = req.user._id;

  if (!message || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Message and at least one contact ID are required.' });
  }
  if (!campaignId) {
    return res.status(400).json({ message: 'campaignId is required for bulk messaging.' });
  }
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId is required.'});
  }

  const client = getWhatsAppSocket(userId);

  if (!client) {
     return res.status(400).json({ message: 'WhatsApp connection is not active for this user. Please connect first.' });
  }

  try {
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
      const targetJid = contact.phoneNumber;
      try {
        const spunMessage = processSpintax(message);
        console.log(`Sending bulk message (spun) to ${contact.name} (${targetJid}) for campaign ${campaignId}`);
        
        await sendWhatsappMessageViaService(userId, targetJid, spunMessage, deviceId);
        
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Success' });
        successCount++;
      } catch (error) {
        console.error(`Failed to send bulk to ${targetJid} for campaign ${campaignId}:`, error);
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Failed', error: error.message });
        failCount++;
      }
      await delay(Math.random() * 2000 + 1000); 
    }

    if (campaignId) {
        try {
            await Campaign.findByIdAndUpdate(campaignId, {
                $inc: { sentCount: successCount, failedCount: failCount }
            });
            console.log(`Campaign ${campaignId} stats updated: ${successCount} sent, ${failCount} failed.`);
        } catch (campaignUpdateError) {
            console.error(`Failed to update campaign stats for ${campaignId}:`, campaignUpdateError);
        }
    }

    res.json({
        message: `Bulk sending process completed. Success: ${successCount}, Failed: ${failCount}`,
        results: results
    });

  } catch (error) {
    console.error("Error in bulk send process:", error);
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
const sendMessage = async (req, res) => {
  const { to, message, deviceId } = req.body;
  const userId = req.user._id;

  if (!to || !message) {
    return res.status(400).json({ message: 'Recipient number (to) and message are required.' });
  }
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId is required to send message.' });
  }

  const targetJid = formatToJid(to);

  try {
    const sentMessage = await sendWhatsappMessageViaService(userId, targetJid, message, deviceId);
    
    try {
        const newMessage = new Message({
            user: userId,
            chatJid: targetJid,
            body: message,
            timestamp: new Date(sentMessage.timestamp * 1000),
            fromMe: true,
            messageId: sentMessage.id._serialized,
            status: 'sent',
            sourceDeviceId: deviceId
        });
        await newMessage.save();
        console.log(`Sent message to ${targetJid} from device ${deviceId} saved to DB.`);
    } catch (dbError) {
        console.error(`Failed to save sent message for ${targetJid} (device ${deviceId}) to DB:`, dbError);
    }

    res.status(200).json({ message: 'Message sent successfully.', messageId: sentMessage.id._serialized });

  } catch (error) {
    console.error(`Error sending message to ${targetJid} from device ${deviceId}:`, error);
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
  sendMessage,
  // getMessages, // Nampaknya tidak digunakan/didefinisikan
  // getChats, // Nampaknya tidak digunakan/didefinisikan
  // getScanQRCode, // Nampaknya tidak digunakan/didefinisikan
  // disconnectWhatsapp, // Nampaknya tidak digunakan/didefinisikan
  sendBulkMessage,
  getChatHistory,
  getChats // Tambah fungsi baru
}; 
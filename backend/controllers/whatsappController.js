const Contact = require('../models/Contact.js');
const Message = require('../models/Message.js');
const { getWhatsAppSocket, sendMessage: sendWhatsappMessage } = require('../services/whatsappService.js');
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
  const { message, contactIds } = req.body;
  const userId = req.user._id; // Dari middleware protect

  if (!message || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Message and at least one contact ID are required.' });
  }

  // Dapatkan client untuk user ini
  const client = getWhatsAppSocket(userId);

  if (!client) {
     // Cuba semak status dari DB juga?
     return res.status(400).json({ message: 'WhatsApp connection is not active for this user. Please connect on the Dashboard.' });
  }
  // Semakan state client (jika perlu, tapi service sepatutnya handle ralat jika tak connected)
  // try {
  //   const state = await client.getState();
  //   if (state !== 'CONNECTED') {
  //        return res.status(400).json({ message: `WhatsApp is not connected (state: ${state}). Please check the Dashboard.` });
  //   }
  // } catch (e) {
  //     return res.status(500).json({ message: 'Could not verify WhatsApp connection state.' });
  // }

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
        console.log(`Sending bulk message (spun) to ${contact.name} (${targetJid}): ${spunMessage}`);
        
        // Guna fungsi dari service, hantar userId juga
        await sendWhatsappMessage(userId, targetJid, spunMessage);
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Success' });
        successCount++;
      } catch (error) {
        console.error(`Failed to send bulk to ${targetJid}:`, error);
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Failed', error: error.message });
        failCount++;
      }
      await delay(Math.random() * 2000 + 1000); 
    }

    res.json({
        message: `Sending process completed. Success: ${successCount}, Failed: ${failCount}`,
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
  const userId = req.user._id;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number parameter is required.' });
  }

  // Pastikan format JID yang betul
  const chatJid = formatToJid(phoneNumber);

  try {
    // Dapatkan mesej dari DB yang melibatkan pengguna ini dan nombor telefon ini
    // Anggap `user` field dalam Message model merujuk kepada pengguna aplikasi kita
    // dan `chatJid` merujuk kepada nombor WhatsApp lawan bicara
    const messages = await Message.find({
      user: userId,
      chatJid: chatJid, 
    })
    .sort({ timestamp: 1 }) // Susun ikut timestamp
    .limit(100); // Hadkan bilangan mesej (optional)

    // Format mesej mengikut keperluan frontend { id, body, timestamp, fromMe }
    const formattedMessages = messages.map(msg => ({
        id: msg._id, // Guna _id dari MongoDB
        body: msg.body,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe // Medan ini perlu wujud dalam model Message
    }));

    res.json(formattedMessages);

  } catch (error) {
    console.error(`Error fetching chat history for ${chatJid}:`, error);
    res.status(500).json({ message: 'Server error fetching chat history.' });
  }
};

// @desc    Hantar mesej individu
// @route   POST /whatsapp/send
// @access  Private
const sendMessage = async (req, res) => {
  const { to, message } = req.body;
  const userId = req.user._id;

  if (!to || !message) {
    return res.status(400).json({ message: 'Recipient number (to) and message are required.' });
  }

  // Pastikan format JID yang betul
  const targetJid = formatToJid(to);

  try {
    // Guna fungsi dari whatsappService, hantar userId
    const sentMessage = await sendWhatsappMessage(userId, targetJid, message);
    
    // Selepas berjaya hantar, simpan ke database
     try {
         const newMessage = new Message({
             user: userId,
             chatJid: targetJid,
             body: message,
             timestamp: new Date(sentMessage.timestamp * 1000), // Guna timestamp dari mesej dihantar
             fromMe: true,
             messageId: sentMessage.id._serialized, // Guna ID dari whatsapp-web.js
             status: 'sent'
         });
         await newMessage.save();
         console.log(`Sent message to ${targetJid} saved to DB.`);
     } catch (dbError) {
         console.error(`Failed to save sent message for ${targetJid} to DB:`, dbError);
         // Jangan gagalkan request utama hanya kerana gagal simpan DB,
         // tapi mungkin log atau hantar notifikasi
     }

    res.status(200).json({ message: 'Message sent successfully.', messageId: sentMessage.id._serialized });

  } catch (error) {
    console.error(`Error sending message to ${targetJid}:`, error);
    // Hantar ralat yang lebih spesifik jika boleh (cth., dari whatsappService)
    res.status(500).json({ message: error.message || 'Failed to send message.' });
  }
};

// @desc    Dapatkan senarai perbualan (chats)
// @route   GET /api/whatsapp/chats
// @access  Private
const getChats = async (req, res) => {
    const userId = req.user._id;
    try {
        // 1. Agregasi mesej untuk dapatkan mesej terakhir bagi setiap chatJid
        const latestMessages = await Message.aggregate([
            { $match: { user: userId } }, // Hanya mesej pengguna ini
            { $sort: { timestamp: -1 } }, // Susun ikut timestamp terbaru dahulu
            {
                $group: {
                    _id: "$chatJid", // Kumpulkan berdasarkan chatJid
                    lastMessageTimestamp: { $first: "$timestamp" },
                    lastMessageBody: { $first: "$body" },
                    lastMessageFromMe: { $first: "$fromMe" },
                    // Boleh tambah field lain jika perlu, cth: unreadCount
                }
            },
            { $sort: { lastMessageTimestamp: -1 } } // Susun chat ikut mesej terbaru
        ]);

        // 2. Dapatkan nama kenalan (jika ada) untuk setiap chatJid
        const chatJids = latestMessages.map(msg => msg._id);
        const contacts = await Contact.find({ user: userId, phoneNumber: { $in: chatJids } }).select('phoneNumber name');
        const contactMap = contacts.reduce((map, contact) => {
            map[contact.phoneNumber] = contact.name;
            return map;
        }, {});

        // 3. Gabungkan data agregat dengan nama kenalan
        const chats = latestMessages.map(chat => ({
            jid: chat._id,
            name: contactMap[chat._id] || chat._id.split('@')[0], // Guna nama jika ada, jika tidak guna nombor
            lastMessageTimestamp: chat.lastMessageTimestamp,
            lastMessageBody: chat.lastMessageBody,
            lastMessageFromMe: chat.lastMessageFromMe
            // Tambah field lain seperti unread count jika logik ditambah
        }));

        res.json(chats);

    } catch (error) {
        console.error(`Error fetching chats for user ${userId}:`, error);
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
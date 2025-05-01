import Contact from '../models/Contact.js';
import Message from '../models/Message.js'; // <-- Import model Message
// import { sock } from '../services/whatsappService.js'; // Buang import sock
import { getWhatsAppSocket } from '../services/whatsappService.js';
import { sendMessage as sendWhatsappMessage } from '../services/whatsappService.js'; // Import & rename secara berasingan
import { processSpintax } from '../utils/spintaxUtils.js'; // Import fungsi spintax

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

  const currentSock = getWhatsAppSocket();

  if (!currentSock || currentSock.user?.id === undefined) { 
     return res.status(400).json({ message: 'WhatsApp connection is not active. Please connect on the Dashboard.' });
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
        console.log(`Sending bulk message (spun) to ${contact.name} (${targetJid}): ${spunMessage}`);
        
        // Guna fungsi dari service
        await sendWhatsappMessage(targetJid, spunMessage);
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
    // Guna fungsi dari whatsappService
    const sentMessageInfo = await sendWhatsappMessage(targetJid, message);
    
    // Selepas berjaya hantar, simpan ke database (jika perlu)
     try {
         const newMessage = new Message({
             user: userId,
             chatJid: targetJid,
             body: message,
             timestamp: new Date(), // Guna timestamp semasa
             fromMe: true,
             messageId: sentMessageInfo?.key?.id, // Simpan ID mesej WhatsApp jika ada
             status: 'sent' // Status mesej
         });
         await newMessage.save();
         console.log(`Sent message to ${targetJid} saved to DB.`);
     } catch (dbError) {
         console.error(`Failed to save sent message for ${targetJid} to DB:`, dbError);
         // Jangan gagalkan request utama hanya kerana gagal simpan DB,
         // tapi mungkin log atau hantar notifikasi
     }

    res.status(200).json({ message: 'Message sent successfully.', messageId: sentMessageInfo?.key?.id });

  } catch (error) {
    console.error(`Error sending message to ${targetJid}:`, error);
    // Hantar ralat yang lebih spesifik jika boleh (cth., dari whatsappService)
    res.status(500).json({ message: error.message || 'Failed to send message.' });
  }
};

export { sendBulkMessage, getChatHistory, sendMessage }; // <-- Pastikan semua dieksport 
import Contact from '../models/Contact.js';
// import { sock } from '../services/whatsappService.js'; // Buang import sock
import { getWhatsAppSocket } from '../services/whatsappService.js'; // Import fungsi getter
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
    return res.status(400).json({ message: 'Mesej dan sekurang-kurangnya satu ID kenalan diperlukan.' });
  }

  // Dapatkan instance sock semasa
  const currentSock = getWhatsAppSocket();

  // Semak jika sock wujud dan bersambung
  if (!currentSock || currentSock.user?.id === undefined) { 
     return res.status(400).json({ message: 'Sambungan WhatsApp tidak aktif. Sila sambung di Dashboard.' });
  }

  try {
    // Dapatkan nombor telefon kenalan yang dipilih milik pengguna
    const contacts = await Contact.find({ 
      _id: { $in: contactIds }, 
      user: userId 
    }).select('phoneNumber name'); // Pilih hanya nombor telefon & nama

    if (contacts.length === 0) {
      return res.status(404).json({ message: 'Tiada kenalan sah ditemui untuk ID yang diberikan.' });
    }

    let successCount = 0;
    let failCount = 0;
    const results = [];

    // Hantar mesej satu per satu dengan delay
    for (const contact of contacts) {
       // Ambil phoneNumber asal yang disimpan (patutnya sudah ada @c.us)
      // const targetJid = formatToJid(contact.phoneNumber);
      const targetJid = contact.phoneNumber; // Anggap phoneNumber dalam DB sudah dalam format JID
      try {
        // Proses spintax pada mesej SEBELUM menghantar
        const spunMessage = processSpintax(message);
        console.log(`Menghantar mesej (spun) ke ${contact.name} (${targetJid}): ${spunMessage}`);
        
        // Hantar mesej yang telah diproses spintax
        await currentSock.sendMessage(targetJid, { text: spunMessage });
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Berjaya' });
        successCount++;
      } catch (error) {
        console.error(`Gagal menghantar ke ${targetJid}:`, error);
        results.push({ name: contact.name, number: contact.phoneNumber, status: 'Gagal', error: error.message });
        failCount++;
      }
      // Tambah delay antara mesej (cth., 1-3 saat) - SANGAT PENTING!
      await delay(Math.random() * 2000 + 1000); 
    }

    res.json({
        message: `Proses penghantaran selesai. Berjaya: ${successCount}, Gagal: ${failCount}`,
        results: results
    });

  } catch (error) {
    console.error("Ralat dalam proses hantar pukal:", error);
    res.status(500).json({ message: 'Ralat pelayan semasa menghantar mesej pukal.' });
  }
};

export { sendBulkMessage }; 
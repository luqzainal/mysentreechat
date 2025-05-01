import Contact from '../models/Contact.js';
import xlsx from 'xlsx'; // Import xlsx

// @desc    Dapatkan semua kenalan pengguna
// @route   GET /contacts
// @access  Private
const getContacts = async (req, res) => {
  const contacts = await Contact.find({ user: req.user._id });
  res.json(contacts);
};

// @desc    Tambah kenalan baru
// @route   POST /contacts
// @access  Private
const addContact = async (req, res) => {
  const { name, phoneNumber } = req.body;

  if (!name || !phoneNumber) {
    res.status(400).json({ message: 'Nama dan nombor telefon diperlukan' });
    return;
  }

  // Semak jika nombor sudah wujud untuk pengguna ini
  const contactExists = await Contact.findOne({ user: req.user._id, phoneNumber });
  if (contactExists) {
      res.status(400).json({ message: 'Nombor telefon sudah wujud dalam senarai anda' });
      return;
  }

  const contact = new Contact({
    name,
    phoneNumber,
    user: req.user._id,
  });

  const createdContact = await contact.save();
  res.status(201).json(createdContact);
};

// @desc    Padam kenalan
// @route   DELETE /contacts/:id
// @access  Private
const deleteContact = async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  // Pastikan kenalan wujud dan dimiliki oleh pengguna
  if (contact && contact.user.toString() === req.user._id.toString()) {
    await contact.deleteOne(); // Guna deleteOne pada instance
    res.json({ message: 'Kenalan dipadam' });
  } else {
    res.status(404).json({ message: 'Kenalan tidak ditemui atau anda tidak dibenarkan' });
  }
};

// @desc    Muat naik kenalan dari fail Excel
// @route   POST /contacts/upload
// @access  Private
const uploadContacts = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tiada fail dimuat naik.' });
    }

    try {
        // Baca fail dari buffer memori
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Tukar sheet kepada JSON - anggap baris pertama adalah header
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (!data || data.length === 0) {
            return res.status(400).json({ message: 'Fail Excel kosong atau format tidak sah.' });
        }

        const contactsToInsert = [];
        const errors = [];
        const existingNumbers = new Set((await Contact.find({ user: req.user._id }, 'phoneNumber')).map(c => c.phoneNumber)); // Dapatkan nombor sedia ada

        data.forEach((row, index) => {
            const name = row['Nama']; // Anggap nama lajur 'Nama'
            let phoneNumber = row['Nombor Telefon']; // Anggap nama lajur 'Nombor Telefon'

            if (!name || !phoneNumber) {
                errors.push(`Baris ${index + 2}: Nama atau Nombor Telefon tiada.`);
                return; // Skip baris ini
            }
            
            // Bersihkan & format nombor telefon
            phoneNumber = String(phoneNumber).replace(/\D/g, ''); // Buang bukan digit
            if (!phoneNumber) { // Jika selepas dibuang, nombor kosong
                 errors.push(`Baris ${index + 2}: Nombor Telefon tidak sah.`);
                 return;
            }
            const formattedPhoneNumber = `${phoneNumber}@c.us`;

            // Semak duplikasi dalam fail ini dan dengan data sedia ada
            if (existingNumbers.has(formattedPhoneNumber) || contactsToInsert.some(c => c.phoneNumber === formattedPhoneNumber)) {
                errors.push(`Baris ${index + 2}: Nombor Telefon ${phoneNumber} sudah wujud.`);
                return; // Skip duplikasi
            }

            contactsToInsert.push({
                name: String(name).trim(),
                phoneNumber: formattedPhoneNumber,
                user: req.user._id,
            });
        });

        let createdCount = 0;
        if (contactsToInsert.length > 0) {
            try {
                // Guna insertMany untuk kecekapan, ordered: false untuk teruskan jika ada ralat individu
                const result = await Contact.insertMany(contactsToInsert, { ordered: false });
                createdCount = result.length;
            } catch (insertError) {
                 // insertMany dengan ordered:false masih boleh throw error jika tiada yang berjaya
                 // atau ralat lain. Tangkap dan log.
                 console.error("Ralat semasa insertMany:", insertError);
                 // Jika ada dokumen yang berjaya sebelum error, ia akan ada dalam error.insertedDocs
                 createdCount = insertError.insertedDocs ? insertError.insertedDocs.length : 0;
                 errors.push("Ralat semasa menyimpan sebahagian data ke pangkalan data.");
            }
        }

        res.status(201).json({
            message: `${createdCount} kenalan berjaya ditambah. ${errors.length > 0 ? 'Beberapa baris diabaikan.' : ''}`,
            successCount: createdCount,
            errors: errors,
        });

    } catch (error) {
        console.error("Ralat memproses fail Excel:", error);
        res.status(500).json({ message: 'Ralat pelayan semasa memproses fail.', error: error.message });
    }
};

export { getContacts, addContact, deleteContact, uploadContacts }; 
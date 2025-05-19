const Contact = require('../models/Contact.js');
const ContactGroup = require('../models/ContactGroup.js');
const xlsx = require('xlsx');

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
  const { name, phoneNumber, groupId } = req.body;

  if (!name || !phoneNumber) {
    res.status(400).json({ message: 'Nama dan nombor telefon diperlukan' });
    return;
  }

  // Semak jika nombor sudah wujud untuk pengguna ini
  const cleanedPhoneNumber = String(phoneNumber).replace(/\D/g, '');
  if (!cleanedPhoneNumber) {
    return res.status(400).json({ message: 'Nombor telefon tidak sah.' });
  }
  const formattedPhoneNumberForCheck = `${cleanedPhoneNumber}@c.us`;

  const contactExists = await Contact.findOne({ user: req.user._id, phoneNumber: formattedPhoneNumberForCheck });
  if (contactExists) {
    res.status(400).json({ message: 'Nombor telefon sudah wujud dalam senarai anda' });
    return;
  }

  const contact = new Contact({
    name,
    phoneNumber: formattedPhoneNumberForCheck,
    user: req.user._id,
  });

  try {
    const createdContact = await contact.save();

    // Jika groupId diberikan, tambah kenalan ke kumpulan tersebut
    if (groupId) {
      const contactGroup = await ContactGroup.findOne({ _id: groupId, user: req.user._id });
      if (contactGroup) {
        if (!contactGroup.contacts.includes(createdContact._id)) {
          contactGroup.contacts.push(createdContact._id);
          contactGroup.contactCount = contactGroup.contacts.length;
          await contactGroup.save();
        }
      } else {
        // Kumpulan tidak ditemui atau bukan milik pengguna, tapi kenalan tetap dicipta.
        // Boleh hantar amaran jika perlu.
        console.warn(`Kumpulan dengan ID ${groupId} tidak ditemui untuk pengguna ${req.user._id} semasa menambah kenalan.`);
      }
    }
    res.status(201).json(createdContact);
  } catch (error) {
    console.error("Ralat menambah kenalan:", error);
    // Jika gagal simpan kenalan, tiada apa yang perlu di-rollback dari group
    res.status(500).json({ message: 'Gagal menyimpan kenalan.', error: error.message });
  }
};

// @desc    Padam kenalan
// @route   DELETE /contacts/:id
// @access  Private
const deleteContact = async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  // Pastikan kenalan wujud dan dimiliki oleh pengguna
  if (contact && contact.user.toString() === req.user._id.toString()) {
    try {
      await contact.deleteOne();
      // Selepas memadam kenalan, alih keluar dari semua kumpulan yang mengandunginya
      await ContactGroup.updateMany(
        { user: req.user._id, contacts: req.params.id },
        { $pull: { contacts: req.params.id }, $inc: { contactCount: -1 } }
      );
      res.json({ message: 'Kenalan dipadam dan dialih keluar dari semua kumpulan.' });
    } catch (error) {
      console.error("Ralat memadam kenalan atau mengalih keluar dari kumpulan:", error);
      res.status(500).json({ message: 'Ralat semasa memadam kenalan.' });
    }
  } else {
    res.status(404).json({ message: 'Kenalan tidak ditemui atau anda tidak dibenarkan' });
  }
};

// @desc    Muat naik kenalan dari fail Excel
// @route   POST /contacts/upload
// @access  Private
const uploadContacts = async (req, res) => {
  const { groupId } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'Tiada fail dimuat naik.' });
  }

  let targetGroup = null;
  if (groupId) {
    try {
      targetGroup = await ContactGroup.findOne({ _id: groupId, user: req.user._id });
      if (!targetGroup) {
        return res.status(404).json({ message: `Kumpulan dengan ID ${groupId} tidak ditemui atau bukan milik anda.` });
      }
    } catch (groupError) {
      if (groupError.kind === 'ObjectId') {
        return res.status(400).json({ message: `ID Kumpulan ${groupId} tidak sah.` });
      }
      console.error("Ralat mencari kumpulan:", groupError);
      return res.status(500).json({ message: 'Ralat semasa mengakses kumpulan kenalan.' });
    }
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'Fail Excel kosong atau format tidak sah.' });
    }

    const contactsToInsert = [];
    const errors = [];
    const existingNumbers = new Set((await Contact.find({ user: req.user._id }, 'phoneNumber')).map(c => c.phoneNumber));

    data.forEach((row, index) => {
      const name = row['Nama'] || row['Name'];
      let phoneNumber = row['Nombor Telefon'] || row['Phone Number'] || row['PhoneNumber'];

      if (!name || !phoneNumber) {
        errors.push(`Baris ${index + 2}: Nama atau Nombor Telefon tiada.`);
        return;
      }
      
      phoneNumber = String(phoneNumber).replace(/\D/g, '');
      if (!phoneNumber) {
        errors.push(`Baris ${index + 2}: Nombor Telefon tidak sah.`);
        return;
      }
      const formattedPhoneNumber = `${phoneNumber}@c.us`;

      if (existingNumbers.has(formattedPhoneNumber) || contactsToInsert.some(c => c.phoneNumber === formattedPhoneNumber)) {
        errors.push(`Baris ${index + 2}: Nombor Telefon ${phoneNumber} (${formattedPhoneNumber}) sudah wujud.`);
        return;
      }

      contactsToInsert.push({
        name: String(name).trim(),
        phoneNumber: formattedPhoneNumber,
        user: req.user._id,
      });
    });

    let createdContacts = [];
    if (contactsToInsert.length > 0) {
      try {
        createdContacts = await Contact.insertMany(contactsToInsert, { ordered: false });
      } catch (insertError) {
        console.error("Ralat semasa insertMany:", insertError);
        createdContacts = insertError.insertedDocs || [];
        if (createdContacts.length < contactsToInsert.length) {
          errors.push(`Sebahagian data gagal disimpan ke pangkalan data. Berjaya: ${createdContacts.length}, Gagal: ${contactsToInsert.length - createdContacts.length}`);
        } else if (createdContacts.length === 0) {
          errors.push("Tiada data berjaya disimpan ke pangkalan data disebabkan ralat.");
        }
      }
    }
    
    let message = `${createdContacts.length} kenalan berjaya ditambah.`;
    
    // Jika ada targetGroup, tambah kenalan yang berjaya dicipta ke group
    if (targetGroup && createdContacts.length > 0) {
      const newContactIds = createdContacts.map(c => c._id);
      let addedToGroupCount = 0;
      newContactIds.forEach(id => {
        if (!targetGroup.contacts.includes(id)) {
          targetGroup.contacts.push(id);
          addedToGroupCount++;
        }
      });
      if (addedToGroupCount > 0) {
        targetGroup.contactCount = targetGroup.contacts.length;
        await targetGroup.save();
        message += ` ${addedToGroupCount} daripadanya ditambah ke kumpulan '${targetGroup.groupName}'.`;
      }
    }

    if (errors.length > 0) {
      message += ` ${errors.length > 0 ? 'Beberapa baris diabaikan atau gagal.' : ''}`;
    }

    res.status(201).json({
      message: message,
      successCount: createdContacts.length,
      errors: errors,
    });

  } catch (error) {
    console.error("Ralat memproses fail Excel:", error);
    res.status(500).json({ message: 'Ralat pelayan semasa memproses fail.', errorDetail: error.message });
  }
};

module.exports = {
  // Export semua fungsi controller di sini
  getContacts,
  addContact,
  deleteContact,
  uploadContacts,
}; 
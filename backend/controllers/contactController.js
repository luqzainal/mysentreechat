const Contact = require('../models/Contact.js');
const ContactGroup = require('../models/ContactGroup.js');
const xlsx = require('xlsx');
const { processExcelFile, validateExcelStructure, generateTemplate } = require('../utils/excelProcessor.js');

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
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  // Validate file structure first
  const structureValidation = validateExcelStructure(req.file.buffer);
  if (!structureValidation.isValid) {
    return res.status(400).json({ 
      message: 'Invalid Excel file structure.', 
      error: structureValidation.error 
    });
  }

  let targetGroup = null;
  if (groupId) {
    try {
      targetGroup = await ContactGroup.findOne({ _id: groupId, user: req.user._id });
      if (!targetGroup) {
        return res.status(404).json({ message: `Contact group with ID ${groupId} not found.` });
      }
    } catch (groupError) {
      if (groupError.kind === 'ObjectId') {
        return res.status(400).json({ message: `Invalid group ID: ${groupId}` });
      }
      console.error("Error finding contact group:", groupError);
      return res.status(500).json({ message: 'Error accessing contact group.' });
    }
  }

  try {
    // Process Excel file using our utility
    const processed = processExcelFile(req.file.buffer, req.file.originalname);
    
    if (!processed.success) {
      return res.status(400).json({ 
        message: 'Failed to process Excel file.', 
        error: processed.error,
        errors: processed.errors 
      });
    }

    const { validContacts, errors, summary } = processed;

    if (validContacts.length === 0) {
      return res.status(400).json({ 
        message: 'No valid contacts found in Excel file.', 
        errors: errors,
        summary: summary 
      });
    }

    // Check for existing contacts in database
    const existingNumbers = new Set(
      (await Contact.find({ user: req.user._id }, 'phoneNumber'))
        .map(c => c.phoneNumber.replace('@c.us', ''))
    );

    const contactsToInsert = [];
    const finalErrors = [...errors];

    validContacts.forEach((contact) => {
      // Add @c.us suffix for WhatsApp format
      const formattedPhoneNumber = `${contact.phone}@c.us`;
      
      // Check if contact already exists
      if (existingNumbers.has(contact.phone)) {
        finalErrors.push(`Row ${contact.rowNumber}: Phone number ${contact.originalPhone} already exists.`);
        return;
      }

      // Check for duplicates in current batch
      const existingInBatch = contactsToInsert.find(c => 
        c.phoneNumber.replace('@c.us', '') === contact.phone
      );
      if (existingInBatch) {
        finalErrors.push(`Row ${contact.rowNumber}: Duplicate phone number ${contact.originalPhone} in file.`);
        return;
      }

      contactsToInsert.push({
        name: contact.name,
        phoneNumber: formattedPhoneNumber,
        user: req.user._id,
      });
    });

    // Insert contacts into database
    let createdContacts = [];
    if (contactsToInsert.length > 0) {
      try {
        createdContacts = await Contact.insertMany(contactsToInsert, { ordered: false });
      } catch (insertError) {
        console.error("Error during insertMany:", insertError);
        createdContacts = insertError.insertedDocs || [];
        if (createdContacts.length < contactsToInsert.length) {
          finalErrors.push(`Some contacts failed to save to database. Success: ${createdContacts.length}, Failed: ${contactsToInsert.length - createdContacts.length}`);
        }
      }
    }
    
    let message = `${createdContacts.length} contacts successfully added.`;
    
    // Add contacts to group if specified
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
        message += ` ${addedToGroupCount} of them added to group '${targetGroup.groupName}'.`;
      }
    }

    if (finalErrors.length > 0) {
      message += ` ${finalErrors.length} rows were skipped due to errors.`;
    }

    res.status(201).json({
      success: true,
      message: message,
      summary: {
        totalRows: summary.total,
        validRows: validContacts.length,
        successfullyCreated: createdContacts.length,
        errorCount: finalErrors.length,
        fileName: summary.fileName
      },
      errors: finalErrors,
    });

  } catch (error) {
    console.error("Error processing Excel file:", error);
    res.status(500).json({ 
      message: 'Server error while processing file.', 
      error: error.message 
    });
  }
};

// @desc    Download Excel template for contacts
// @route   GET /contacts/template
// @access  Private
const downloadTemplate = async (req, res) => {
  try {
    const templateBuffer = generateTemplate();
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `contact_template_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', templateBuffer.length);
    
    res.send(templateBuffer);
    
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ 
      message: 'Error generating Excel template.', 
      error: error.message 
    });
  }
};

module.exports = {
  // Export semua fungsi controller di sini
  getContacts,
  addContact,
  deleteContact,
  uploadContacts,
  downloadTemplate,
}; 
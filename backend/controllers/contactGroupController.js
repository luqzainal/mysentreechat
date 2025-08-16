const ContactGroup = require('../models/ContactGroup.js');
const Contact = require('../models/Contact.js');

// @desc    Cipta kumpulan kenalan baru
// @route   POST /api/contact-groups
// @access  Private
const createContactGroup = async (req, res) => {
  const { groupName } = req.body;
  if (!groupName) {
    return res.status(400).json({ message: 'Nama kumpulan diperlukan.' });
  }
  try {
    const groupExists = await ContactGroup.findOne({ user: req.user._id, groupName });
    if (groupExists) {
      return res.status(400).json({ message: 'Nama kumpulan sudah wujud.' });
    }
    const contactGroup = new ContactGroup({
      groupName,
      user: req.user._id,
    });
    const createdGroup = await contactGroup.save();
    res.status(201).json(createdGroup);
  } catch (error) {
    console.error('Ralat mencipta kumpulan kenalan:', error);
    res.status(500).json({ message: 'Ralat pelayan.', error: error.message });
  }
};

// @desc    Dapatkan semua kumpulan kenalan milik pengguna
// @route   GET /api/contact-groups
// @access  Private
const getContactGroups = async (req, res) => {
  try {
    const contactGroups = await ContactGroup.find({ user: req.user._id })
      .populate('contacts', 'name phoneNumber')
      .sort({ groupName: 1 });
    
    // Format response with contact count for each group
    const formattedGroups = contactGroups.map(group => ({
      _id: group._id,
      groupName: group.groupName,
      contactCount: group.contacts.length,
      contacts: group.contacts,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.json(formattedGroups);
  } catch (error) {
    console.error('Ralat mendapatkan kumpulan kenalan:', error);
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Dapatkan satu kumpulan kenalan melalui ID
// @route   GET /api/contact-groups/:id
// @access  Private
const getContactGroupById = async (req, res) => {
  try {
    const contactGroup = await ContactGroup.findById(req.params.id).populate('contacts');
    if (contactGroup && contactGroup.user.toString() === req.user._id.toString()) {
      res.json(contactGroup);
    } else {
      res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }
  } catch (error) {
    console.error('Ralat mendapatkan kumpulan kenalanById:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'ID Kumpulan tidak sah.' });
        }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Kemaskini nama kumpulan kenalan
// @route   PUT /api/contact-groups/:id
// @access  Private
const updateContactGroup = async (req, res) => {
  const { groupName } = req.body;
  if (!groupName) {
    return res.status(400).json({ message: 'Nama kumpulan diperlukan.' });
  }
  try {
    const contactGroup = await ContactGroup.findById(req.params.id);

    if (contactGroup && contactGroup.user.toString() === req.user._id.toString()) {
      // Semak jika nama baru sudah wujud untuk pengguna ini, kecuali untuk group semasa
      const existingGroupWithNewName = await ContactGroup.findOne({
        user: req.user._id,
        groupName,
        _id: { $ne: req.params.id } // $ne = not equal
      });

      if (existingGroupWithNewName) {
        return res.status(400).json({ message: 'Nama kumpulan baru sudah digunakan oleh kumpulan lain.' });
      }

      contactGroup.groupName = groupName;
      const updatedGroup = await contactGroup.save();
      res.json(updatedGroup);
    } else {
      res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }
  } catch (error) {
    console.error('Ralat mengemaskini kumpulan kenalan:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID Kumpulan tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Padam kumpulan kenalan
// @route   DELETE /api/contact-groups/:id
// @access  Private
// Nota: Memadam kumpulan TIDAK memadamkan kenalan di dalamnya, hanya rujukan.
const deleteContactGroup = async (req, res) => {
  try {
    const contactGroup = await ContactGroup.findById(req.params.id);
    if (contactGroup && contactGroup.user.toString() === req.user._id.toString()) {
      await contactGroup.deleteOne();
      res.json({ message: 'Kumpulan kenalan berjaya dipadam.' });
    } else {
      res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }
  } catch (error) {
    console.error('Ralat memadam kumpulan kenalan:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID Kumpulan tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Tambah satu atau lebih kenalan ke dalam kumpulan
// @route   POST /api/contact-groups/:id/contacts
// @access  Private
const addContactsToGroup = async (req, res) => {
  const { contactIds } = req.body; // Terima array contactIds
  if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ message: 'Sila sediakan ID kenalan untuk ditambah.' });
  }

  try {
    const contactGroup = await ContactGroup.findById(req.params.id);
    if (!contactGroup || contactGroup.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }

    // Semak jika semua contactIds adalah sah dan milik pengguna
    const validContacts = await Contact.find({
      _id: { $in: contactIds },
      user: req.user._id,
    });

    if (validContacts.length !== contactIds.length) {
        // Ini bermaksud sebahagian ID kenalan tidak sah atau bukan milik pengguna
        // Atau mungkin ada ID yang sama dihantar lebih sekali
        const validContactIds = validContacts.map(c => c._id.toString());
        const invalidSubmittedIds = contactIds.filter(id => !validContactIds.includes(id));
        if (invalidSubmittedIds.length > 0) {
             return res.status(400).json({
                message: 'Beberapa ID kenalan tidak sah atau bukan milik anda.',
                invalidIds: invalidSubmittedIds
            });
        }
    }
    
    let addedCount = 0;
    const contactsAlreadyInGroup = [];

    for (const contact of validContacts) {
      if (!contactGroup.contacts.includes(contact._id)) {
        contactGroup.contacts.push(contact._id);
        addedCount++;
      } else {
        contactsAlreadyInGroup.push(contact.name || contact.phoneNumber);
      }
    }

    if (addedCount > 0) {
        contactGroup.contactCount = contactGroup.contacts.length; // Kemaskini kiraan
        await contactGroup.save();
    }
    
    let message = `${addedCount} kenalan berjaya ditambah ke kumpulan '${contactGroup.groupName}'.`;
    if (contactsAlreadyInGroup.length > 0) {
        message += ` ${contactsAlreadyInGroup.length} kenalan sudah sedia ada dalam kumpulan: ${contactsAlreadyInGroup.join(', ')}.`;
    }

    res.json({ 
        message,
        addedCount,
        contactsInGroupNow: contactGroup.contactCount,
        updatedGroup: contactGroup 
    });

  } catch (error) {
    console.error('Ralat menambah kenalan ke kumpulan:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID Kumpulan atau Kenalan tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Padam satu kenalan dari kumpulan
// @route   DELETE /api/contact-groups/:groupId/contacts/:contactId
// @access  Private
const removeContactFromGroup = async (req, res) => {
  const { groupId, contactId } = req.params;
  try {
    const contactGroup = await ContactGroup.findById(groupId);

    if (!contactGroup || contactGroup.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }

    // Semak jika kenalan wujud dalam kumpulan
    const contactIndex = contactGroup.contacts.indexOf(contactId);

    if (contactIndex > -1) {
      contactGroup.contacts.splice(contactIndex, 1);
      contactGroup.contactCount = contactGroup.contacts.length; // Kemaskini kiraan
      await contactGroup.save();
      res.json({
        message: 'Kenalan berjaya dipadam dari kumpulan.',
        updatedGroup: contactGroup,
      });
    } else {
      res.status(404).json({ message: 'Kenalan tidak ditemui dalam kumpulan ini.' });
    }
  } catch (error) {
    console.error('Ralat memadam kenalan dari kumpulan:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID Kumpulan atau Kenalan tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Dapatkan semua kenalan dalam satu kumpulan (hanya senarai kenalan)
// @route   GET /api/contact-groups/:id/contacts
// @access  Private
const getContactsInGroup = async (req, res) => {
  try {
    const contactGroup = await ContactGroup.findById(req.params.id)
                                      .populate({
                                        path: 'contacts',
                                        select: 'name phoneNumber createdAt' // Pilih medan yang mahu dipaparkan
                                      });

    if (contactGroup && contactGroup.user.toString() === req.user._id.toString()) {
      res.json(contactGroup.contacts); // Hantar array kenalan sahaja
    } else {
      res.status(404).json({ message: 'Kumpulan kenalan tidak ditemui.' });
    }
  } catch (error) {
    console.error('Ralat mendapatkan kenalan dalam kumpulan:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'ID Kumpulan tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan.' });
  }
};

// @desc    Auto-create default contact group with all user contacts
// @route   POST /api/contact-groups/auto-create-default
// @access  Private
const autoCreateDefaultGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const defaultGroupName = 'All Contacts';

    // Check if default group already exists
    let defaultGroup = await ContactGroup.findOne({ 
      user: userId, 
      groupName: defaultGroupName 
    });

    if (!defaultGroup) {
      // Create default group
      defaultGroup = new ContactGroup({
        groupName: defaultGroupName,
        user: userId,
      });
      await defaultGroup.save();
      console.log(`[autoCreateDefaultGroup] Created default group for user ${userId}`);
    }

    // Get all user contacts
    const allUserContacts = await Contact.find({ user: userId });
    
    if (allUserContacts.length === 0) {
      return res.status(400).json({ 
        message: 'No contacts found. Please add contacts first.' 
      });
    }

    // Add all contacts to default group (avoid duplicates)
    const existingContactIds = defaultGroup.contacts.map(id => id.toString());
    const newContactIds = allUserContacts
      .filter(contact => !existingContactIds.includes(contact._id.toString()))
      .map(contact => contact._id);

    if (newContactIds.length > 0) {
      defaultGroup.contacts.push(...newContactIds);
      defaultGroup.contactCount = defaultGroup.contacts.length;
      await defaultGroup.save();
    }

    // Return populated group
    const populatedGroup = await ContactGroup.findById(defaultGroup._id).populate('contacts');

    res.json({
      message: `Default group '${defaultGroupName}' ready with ${populatedGroup.contacts.length} contacts`,
      group: populatedGroup,
      contactsAdded: newContactIds.length,
      totalContacts: populatedGroup.contacts.length
    });

  } catch (error) {
    console.error('Error auto-creating default contact group:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createContactGroup,
  getContactGroups,
  getContactGroupById,
  updateContactGroup,
  deleteContactGroup,
  addContactsToGroup,
  removeContactFromGroup,
  getContactsInGroup,
  autoCreateDefaultGroup
}; 
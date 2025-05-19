const express = require('express');
const router = express.Router();
const {
  createContactGroup,
  getContactGroups,
  getContactGroupById,
  updateContactGroup,
  deleteContactGroup,
  addContactsToGroup,
  removeContactFromGroup,
  getContactsInGroup
} = require('../controllers/contactGroupController.js');
const { protect } = require('../middleware/authMiddleware.js');

// Lindungi semua laluan dengan middleware protect
router.use(protect);

// Laluan untuk kumpulan kenalan
router.route('/')
  .post(createContactGroup)
  .get(getContactGroups);

router.route('/:id')
  .get(getContactGroupById)
  .put(updateContactGroup)
  .delete(deleteContactGroup);

// Laluan untuk mengurus kenalan dalam kumpulan
router.route('/:id/contacts')
  .post(addContactsToGroup)
  .get(getContactsInGroup);

router.route('/:groupId/contacts/:contactId')
  .delete(removeContactFromGroup);

module.exports = router; 
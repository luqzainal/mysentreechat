import express from 'express';
import { 
  getContacts, 
  addContact, 
  deleteContact, 
  uploadContacts 
} from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';

const router = express.Router();

// Konfigurasi Multer untuk simpanan memori dan penapis fail Excel
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      file.mimetype === 'application/vnd.ms-excel') { // .xls (jika perlu)
    cb(null, true);
  } else {
    cb(new Error('Hanya fail Excel (.xlsx) dibenarkan!'), false);
  }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Had saiz fail 5MB (boleh diubah)
});

// Lindungi semua laluan dengan middleware protect
router.use(protect);

// Laluan CRUD Kenalan sedia ada
router.route('/')
  .get(getContacts)
  .post(addContact);

router.route('/:id')
  .delete(deleteContact);

// Laluan baru untuk muat naik fail Excel
// Guna upload.single('file') - 'file' mesti padan dengan nama field dalam FormData frontend
router.post('/upload', upload.single('file'), uploadContacts);

export default router; 
const multer = require('multer');
const path = require('path');

// Pastikan direktori uploads wujud
const fs = require('fs');
const uploadDir = path.join(__dirname, '../uploads'); // Sesuaikan path jika perlu
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi storan Multer (untuk media)
const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const mediaDir = path.join(uploadDir, 'media'); // Subdirektori media
    if (!fs.existsSync(mediaDir)){ fs.mkdirSync(mediaDir, { recursive: true }); }
    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Guna ID pengguna jika ada untuk susunan yang lebih baik
    const userId = req.user ? req.user.id : 'guest';
    cb(null, `${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Konfigurasi storan Multer (untuk CSV/Excel - simpan di memori)
const csvStorage = multer.memoryStorage();

// Penapis fail media
const mediaFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video') || file.mimetype.startsWith('audio')) {
       cb(null, true);
   } else {
       cb(new Error('Hanya fail imej, video, atau audio dibenarkan!'), false);
   }
};

// Penapis fail CSV/Excel
const csvFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      file.mimetype === 'application/vnd.ms-excel' || // .xls
      file.mimetype === 'text/csv') { // .csv
    cb(null, true);
  } else {
    cb(new Error('Hanya fail Excel (.xlsx, .xls) atau CSV (.csv) dibenarkan!'), false);
  }
};

// Multer instance untuk media
const uploadMediaInstance = multer({
   storage: mediaStorage,
   fileFilter: mediaFileFilter,
   limits: { fileSize: 1024 * 1024 * 25 } // Had saiz 25MB
});

// Multer instance untuk CSV/Excel (guna memory storage)
const uploadCsvInstance = multer({
   storage: csvStorage,
   fileFilter: csvFileFilter,
   limits: { fileSize: 1024 * 1024 * 5 } // Had saiz 5MB
});

// Eksport middleware spesifik
const uploadMedia = uploadMediaInstance.single('mediaFile');
const uploadCsv = uploadCsvInstance.single('file'); // Nama field 'file'

module.exports = { 
    uploadMedia, 
    uploadCsv // Tambah uploadCsv ke exports
}; 
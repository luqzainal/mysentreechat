const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Media = require('../models/Media.js');
const { fileURLToPath } = require('url');

// __filename dan __dirname sudah tersedia dalam CommonJS
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Tentukan direktori penyimpanan media
// Gunakan __dirname global terus
const uploadDir = path.join(__dirname, '../uploads/media');

// Pastikan direktori wujud, jika tidak, ciptakannya
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Direktori uploads/media dicipta di ${uploadDir}`);
} else {
   console.log(`Direktori uploads/media sedia ada di ${uploadDir}`);
}

// Konfigurasi Multer Storage Engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Tetapkan destinasi ke uploads/media
  },
  filename: function (req, file, cb) {
    // Cipta nama fail unik: userId-timestamp-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Tambah random untuk extra uniqueness
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    // Guna ID pengguna dari middleware protect
    cb(null, `${req.user._id}-${uniqueSuffix}-${baseName}${fileExtension}`);
  }
});

// Filter fail (contoh: hanya benarkan imej & video)
const fileFilter = (req, file, cb) => {
  // Terima imej dan video sahaja (tambah jenis lain jika perlu)
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Jenis fail tidak disokong!'), false);
  }
};

// Inisialisasi Multer
const upload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // Had saiz fail 10MB (contoh)
}).single('mediaFile'); // Nama field dalam form-data mesti 'mediaFile'

// Controller Functions

// @desc    Muat naik fail media
// @route   POST /media/upload
// @access  Private
const uploadMedia = (req, res) => {
    // Guna middleware upload multer
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            // Ralat dari Multer (cth., saiz fail terlalu besar)
            console.error("Multer Error:", err);
            return res.status(400).json({ message: `Ralat muat naik: ${err.message}` });
        } else if (err) {
            // Ralat lain (cth., jenis fail tidak disokong)
             console.error("File Upload Error:", err);
            return res.status(400).json({ message: err.message || 'Ralat muat naik fail.' });
        }

        // Jika tiada fail dipilih
        if (!req.file) {
            return res.status(400).json({ message: 'Sila pilih fail untuk dimuat naik.' });
        }

        // Fail berjaya dimuat naik, simpan metadata ke DB
        try {
            const newMedia = await Media.create({
                user: req.user._id,
                originalName: req.file.originalname,
                fileName: req.file.filename,
                filePath: `/uploads/media/${req.file.filename}`, // Laluan relatif untuk akses statik
                fileType: req.file.mimetype,
                fileSize: req.file.size,
            });
            res.status(201).json(newMedia);
        } catch (dbError) {
            console.error("DB Error after upload:", dbError);
            // Cuba padam fail yang dah termuat naik jika simpan DB gagal?
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Gagal padam fail selepas DB error:", unlinkErr);
            });
            res.status(500).json({ message: 'Gagal menyimpan maklumat fail ke pangkalan data.' });
        }
    });
};

// @desc    Dapatkan senarai media pengguna
// @route   GET /media
// @access  Private
const getMediaList = async (req, res) => {
  try {
    const mediaFiles = await Media.find({ user: req.user._id }).sort({ createdAt: -1 }); // Susun ikut terbaru
    res.json(mediaFiles);
  } catch (error) {
    console.error("Ralat mendapatkan senarai media:", error);
    res.status(500).json({ message: 'Ralat pelayan semasa mendapatkan senarai media.' });
  }
};

// @desc    Padam fail media
// @route   DELETE /media/:id
// @access  Private
const deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ message: 'Fail media tidak ditemui.' });
    }

    // Pastikan pengguna yang memadam adalah pemilik fail
    if (media.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Tidak dibenarkan memadam fail ini.' });
    }

    // Padam fail dari filesystem
    const filePath = path.join(__dirname, '..', media.filePath); // Dapatkan laluan penuh
     fs.unlink(filePath, async (err) => {
      if (err) {
        // Jika fail tiada pun, teruskan padam dari DB
        if (err.code === 'ENOENT') {
             console.log(`Fail tidak wujud di ${filePath}, teruskan padam dari DB.`);
        } else {
            console.error("Ralat memadam fail dari sistem:", err);
            // Mungkin jangan teruskan jika fail sistem gagal dipadam?
            return res.status(500).json({ message: 'Gagal memadam fail dari storan.' });
        }
      }
      
      // Padam rekod dari DB
      await media.deleteOne(); // Guna deleteOne pada instance
      res.json({ message: 'Fail media berjaya dipadam.' });
       console.log(`Fail ${filePath} dan rekod DB dipadam.`);

    });

  } catch (error) {
    console.error("Ralat memadam media:", error);
     if (error.kind === 'ObjectId') { // Handle jika ID tidak valid format
        return res.status(400).json({ message: 'ID fail tidak sah.' });
     }
    res.status(500).json({ message: 'Ralat pelayan semasa memadam media.' });
  }
};

module.exports = {
  // Export semua fungsi controller di sini
  uploadMedia,
  getMediaList,
  deleteMedia,
  upload
}; 
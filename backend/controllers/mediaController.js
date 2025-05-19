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
// @route   POST /media
// @access  Private
const uploadMedia = async (req, res) => {
    console.log("[mediaController] Entered uploadMedia controller function.");
    console.log("[mediaController] req.file (from middleware):", req.file);
    console.log("[mediaController] req.body (from middleware):", req.body);
    // Ralat Multer mungkin telah ditangkap oleh error handler Express global atau perlu disemak jika req ada property error dari multer
    // Untuk cara yang lebih mudah, kita boleh semak req.file terus.
    // Middleware uploadMiddleware.js akan pass ralat ke error handler Express jika ada.
    // Jika mahu handle ralat Multer secara spesifik di sini, kita perlukan cara untuk pass ralat itu.
    // Buat masa ini, kita anggap jika ada ralat Multer, req.file mungkin tiada atau ada ralat di req.

    // Jika ralat berlaku dalam uploadMiddleware (seperti jenis fail/saiz), ia sepatutnya tidak sampai ke sini
    // atau akan ada error handler Express yang handle. Jika ia sampai sini tapi tiada req.file:
    if (!req.file) {
        console.log("[mediaController] req.file is undefined. Kemungkinan ralat dari middleware Multer atau tiada fail dihantar.");
        // Mesej ralat sepatutnya lebih spesifik jika dari fileFilter atau limits.
        // Jika ia hanya tiada fail, mesej ini ok.
        return res.status(400).json({ message: 'Tiada fail diterima oleh pelayan atau ralat semasa pra-pemprosesan fail.' });
    }

    // Fail berjaya diproses oleh middleware, simpan metadata ke DB
    console.log("[mediaController] File processed by middleware:", req.file.filename);
    try {
        const newMedia = await Media.create({
            user: req.user._id,
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: `/uploads/media/${req.file.filename}`, 
            fileType: req.file.mimetype,
            fileSize: req.file.size,
        });
        console.log("[mediaController] Media metadata saved to DB:", newMedia._id);
        res.status(201).json(newMedia);
    } catch (dbError) {
        console.error("[mediaController] DB Error after upload:", dbError);
        // Penting: req.file.path merujuk kepada lokasi fail yang disimpan oleh Multer.
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("[mediaController] Gagal padam fail selepas DB error:", unlinkErr);
            else console.log("[mediaController] Fail sementara dipadam selepas DB error:", req.file.path);
        });
        res.status(500).json({ message: 'Gagal menyimpan maklumat fail ke pangkalan data.' });
    }
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
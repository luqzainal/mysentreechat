const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Media = require('../models/Media.js');
const s3Service = require('../services/s3Service.js');
const mediaCompressionService = require('../services/mediaCompressionService.js');
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

// Always use memory storage for all uploads (required for S3 and compression)
const memoryStorage = multer.memoryStorage();

// Filter fail (contoh: hanya benarkan imej & video)
const fileFilter = (req, file, cb) => {
  // Terima imej dan video sahaja (tambah jenis lain jika perlu)
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Jenis fail tidak disokong!'), false);
  }
};

// Inisialisasi Multer with memory storage only
const upload = multer({ 
    storage: memoryStorage, 
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
    console.log("[mediaController] Storage type:", process.env.MEDIA_STORAGE_TYPE);

    if (!req.file) {
        console.log("[mediaController] req.file is undefined. Kemungkinan ralat dari middleware Multer atau tiada fail dihantar.");
        return res.status(400).json({ message: 'Tiada fail diterima oleh pelayan atau ralat semasa pra-pemprosesan fail.' });
    }

    try {
        let uploadResult;
        
        // Validate that we have buffer (required for memory storage)
        if (!req.file.buffer) {
            console.error("[mediaController] req.file.buffer is undefined");
            console.error("[mediaController] req.file contents:", Object.keys(req.file));
            throw new Error('File buffer is missing. Multer memory storage not working correctly.');
        }
        
        console.log("[mediaController] File buffer received:", req.file.buffer.length, "bytes");
        
        // Compress media before upload if needed
        let finalBuffer = req.file.buffer;
        let finalMimeType = req.file.mimetype;
        let finalFileName = req.file.originalname;
        let compressionInfo = null;
        
        // Check if file needs compression
        if (mediaCompressionService.needsCompression(req.file.buffer.length, req.file.mimetype)) {
            console.log("[mediaController] File needs compression, starting compression process...");
            
            try {
                const compressionResult = await mediaCompressionService.compressMedia(
                    req.file.buffer, 
                    req.file.mimetype, 
                    req.file.originalname
                );
                
                finalBuffer = compressionResult.buffer;
                finalMimeType = compressionResult.mimeType;
                finalFileName = compressionResult.fileName;
                compressionInfo = {
                    originalSize: compressionResult.originalSize,
                    compressedSize: compressionResult.compressedSize,
                    compressionRatio: compressionResult.compressionRatio,
                    compressionApplied: compressionResult.compressionApplied
                };
                
                console.log("[mediaController] Compression completed:", compressionInfo);
            } catch (compressionError) {
                console.warn("[mediaController] Compression failed, using original file:", compressionError.message);
                // Continue with original file if compression fails
            }
        } else {
            console.log("[mediaController] File doesn't need compression or compression skipped");
        }

        // Check if using S3 storage or local storage
        if (process.env.MEDIA_STORAGE_TYPE === 's3') {
            // Use S3 service for file upload
            console.log("[mediaController] Using S3 storage for file upload");
            console.log("[mediaController] Final buffer size:", finalBuffer ? finalBuffer.length : 'No buffer');
            
            if (!finalBuffer) {
                throw new Error('File buffer is missing for S3 upload. Please check multer configuration.');
            }
            
            uploadResult = await s3Service.uploadFile(
                finalBuffer, 
                finalFileName, 
                finalMimeType, 
                req.user._id.toString()
            );
            
            console.log("[mediaController] S3 upload result:", uploadResult);
        } else {
            // For local storage - but we want everything to go to S3 now
            console.log("[mediaController] Local storage detected, but forcing S3 upload");
            console.log("[mediaController] Final buffer size for forced S3:", finalBuffer ? finalBuffer.length : 'No buffer');
            
            if (!finalBuffer) {
                throw new Error('File buffer is missing. Please check multer configuration.');
            }
            
            // Force S3 upload even if MEDIA_STORAGE_TYPE is not 's3'
            uploadResult = await s3Service.uploadFile(
                finalBuffer, 
                finalFileName, 
                finalMimeType, 
                req.user._id.toString()
            );
            
            console.log("[mediaController] Forced S3 upload result:", uploadResult);
        }

        if (!uploadResult.success) {
            throw new Error('File upload failed');
        }

        // Save metadata to database
        const mediaData = {
            user: req.user._id,
            originalName: req.file.originalname,
            fileName: uploadResult.fileName,
            filePath: uploadResult.filePath,
            fileType: finalMimeType, // Use compressed file type
            fileSize: uploadResult.fileSize,
            storageType: uploadResult.storageType,
            fileUrl: uploadResult.fileUrl
        };

        // Add compression info if compression was applied
        if (compressionInfo) {
            mediaData.compressionInfo = compressionInfo;
        }

        // Add S3 metadata if using S3
        if (uploadResult.storageType === 's3' && uploadResult.metadata) {
            mediaData.s3Metadata = {
                bucket: uploadResult.metadata.bucket,
                key: uploadResult.metadata.key,
                eTag: uploadResult.metadata.eTag
            };
        }

        const newMedia = await Media.create(mediaData);
        console.log("[mediaController] Media metadata saved to DB:", newMedia._id);
        
        res.status(201).json({
            _id: newMedia._id,
            originalName: newMedia.originalName,
            fileName: newMedia.fileName,
            fileType: newMedia.fileType,
            fileSize: newMedia.fileSize,
            storageType: newMedia.storageType,
            fileUrl: uploadResult.fileUrl,
            compressionInfo: compressionInfo,
            createdAt: newMedia.createdAt
        });

    } catch (error) {
        console.error("[mediaController] Upload error:", error);
        
        // Clean up local file if it exists and DB save failed
        if (req.file.path && process.env.MEDIA_STORAGE_TYPE !== 's3') {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("[mediaController] Gagal padam fail selepas error:", unlinkErr);
                else console.log("[mediaController] Fail sementara dipadam selepas error:", req.file.path);
            });
        }
        
        res.status(500).json({ 
            message: 'Gagal menyimpan fail.', 
            error: error.message 
        });
    }
};

// @desc    Dapatkan senarai media pengguna
// @route   GET /media
// @access  Private
const getMediaList = async (req, res) => {
  try {
    const mediaFiles = await Media.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    // Process each media file to provide accessible URLs
    const processedMediaFiles = await Promise.all(mediaFiles.map(async (media) => {
      try {
        const fileInfo = await s3Service.getFileInfo(media);
        return fileInfo;
      } catch (error) {
        console.error(`[mediaController] Error processing media ${media._id}:`, error);
        // Return basic info if S3 processing fails
        return {
          ...media.toObject(),
          accessUrl: media.fileUrl || media.filePath,
          isS3: media.storageType === 's3'
        };
      }
    }));
    
    res.json(processedMediaFiles);
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

    try {
      // Use S3 service to delete file (handles both S3 and local)
      const deleteSuccess = await s3Service.deleteFile(media.filePath, media.storageType);
      
      if (!deleteSuccess) {
        console.log(`[mediaController] File deletion failed for ${media.filePath}, continuing with DB deletion`);
      }
      
      // Delete record from database
      await media.deleteOne();
      
      res.json({ message: 'Fail media berjaya dipadam.' });
      console.log(`[mediaController] Media ${media._id} deleted successfully`);
      
    } catch (deleteError) {
      console.error("[mediaController] Error deleting file:", deleteError);
      
      // If file deletion fails but file doesn't exist, still delete from DB
      if (deleteError.code === 'ENOENT' || deleteError.message.includes('NoSuchKey')) {
        console.log(`[mediaController] File not found, deleting DB record only`);
        await media.deleteOne();
        return res.json({ message: 'Rekod media dipadam (fail tidak wujud di storan).' });
      }
      
      return res.status(500).json({ message: 'Gagal memadam fail dari storan.' });
    }

  } catch (error) {
    console.error("Ralat memadam media:", error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID fail tidak sah.' });
    }
    res.status(500).json({ message: 'Ralat pelayan semasa memadam media.' });
  }
};

// @desc    Test S3 connection and configuration
// @route   GET /media/s3-test
// @access  Private
const testS3Connection = async (req, res) => {
  try {
    const isConnected = await s3Service.testConnection();
    const storageType = process.env.MEDIA_STORAGE_TYPE || 'local';
    
    if (storageType === 's3') {
      if (isConnected) {
        res.json({
          success: true,
          message: 'S3 connection successful',
          storageType: 's3',
          bucket: process.env.AWS_S3_BUCKET_NAME || 'Not configured',
          region: process.env.AWS_REGION || 'Not configured'
        });
      } else {
        res.status(503).json({
          success: false,
          message: 'S3 connection failed',
          storageType: 's3',
          error: 'Cannot connect to S3 with current configuration'
        });
      }
    } else {
      res.json({
        success: true,
        message: 'Using local storage (S3 not configured)',
        storageType: 'local',
        uploadPath: path.join(__dirname, '../uploads/media')
      });
    }
  } catch (error) {
    console.error("[mediaController] S3 test error:", error);
    res.status(500).json({
      success: false,
      message: 'Error testing S3 connection',
      error: error.message
    });
  }
};

module.exports = {
  // Export semua fungsi controller di sini
  uploadMedia,
  getMediaList,
  deleteMedia,
  testS3Connection,
  upload
}; 
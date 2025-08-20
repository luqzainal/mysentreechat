const mongoose = require('mongoose');

const mediaSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Rujukan kepada model User
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      // Nama fail yang disimpan di server (mungkin berbeza untuk elak pertembungan)
      type: String,
      required: true,
    },
    filePath: {
      // Laluan relatif fail di server
      type: String,
      required: true,
    },
    fileType: {
      // Contoh: 'image/jpeg', 'video/mp4'
      type: String,
      required: true,
    },
    fileSize: {
      // Saiz dalam bytes
      type: Number,
      required: true,
    },
    // Storage configuration for S3/local
    storageType: {
      type: String,
      enum: ['local', 's3'],
      default: 'local'
    },
    fileUrl: {
      // Full URL for accessing the file (S3 URL or local URL)
      type: String,
      required: false
    },
    s3Metadata: {
      // S3-specific metadata
      bucket: { type: String },
      key: { type: String },
      eTag: { type: String }
    },
    compressionInfo: {
      // Compression metadata
      originalSize: { type: Number }, // Original file size in bytes
      compressedSize: { type: Number }, // Compressed file size in bytes
      compressionRatio: { type: Number }, // Compression ratio percentage
      compressionApplied: { type: Boolean, default: false } // Whether compression was applied
    }
  },
  {
    timestamps: true, // Tambah createdAt dan updatedAt secara automatik
  }
);

module.exports = mongoose.model('Media', mediaSchema); 
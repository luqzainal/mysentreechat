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
    // Tambah medan lain jika perlu (cth., thumbnail path)
  },
  {
    timestamps: true, // Tambah createdAt dan updatedAt secara automatik
  }
);

module.exports = mongoose.model('Media', mediaSchema); 
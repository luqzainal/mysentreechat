const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true // Setiap user hanya ada satu dokumen settings
  },
  openaiApiKey: {
    type: String,
    required: false, // Mungkin user tidak set
    select: false // Jangan pulangkan secara default
  },
  // Boleh tambah tetapan lain di sini pada masa hadapan
  // Contoh: defaultPresenceDelay, notificationPreferences, etc.
}, {
  timestamps: true
});

module.exports = mongoose.model('Setting', settingsSchema); // Nama model singular 
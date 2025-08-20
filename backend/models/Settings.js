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
  // AI Configuration Settings
  aiModel: {
    type: String,
    required: false,
    default: 'gpt-3.5-turbo'
  },
  aiTemperature: {
    type: Number,
    required: false,
    default: 0.7,
    min: 0,
    max: 1
  },
  aiMaxTokens: {
    type: Number,
    required: false,
    default: 1000,
    min: 100,
    max: 4000
  },
  // Boleh tambah tetapan lain di sini pada masa hadapan
  // Contoh: defaultPresenceDelay, notificationPreferences, etc.
}, {
  timestamps: true
});

module.exports = mongoose.model('Setting', settingsSchema); // Nama model singular 
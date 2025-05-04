const mongoose = require('mongoose');

const whatsappDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User' // Rujukan kepada model User
  },
  // ID unik untuk sesi/device ini (mungkin dijana oleh whatsapp-web.js atau custom)
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String, // Nama custom yang diberi pengguna, cth: "Telefon Utama"
    required: false,
  },
  number: {
      type: String, // Nombor WhatsApp yang bersambung
      required: false // Mungkin tidak didapati sehingga connected
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected', 'waiting_qr', 'connecting', 'error'],
    default: 'disconnected'
  },
  // Simpan data sesi dari whatsapp-web.js untuk restore (jika guna)
  sessionData: {
    type: Object, 
    required: false,
    select: false // Jangan pulangkan secara default
  },
  lastConnectedAt: {
      type: Date
  }
}, {
  timestamps: true // Tambah createdAt dan updatedAt
});

// Indexing untuk query yang kerap
whatsappDeviceSchema.index({ userId: 1 });
whatsappDeviceSchema.index({ deviceId: 1 });

module.exports = mongoose.model('WhatsappDevice', whatsappDeviceSchema); 
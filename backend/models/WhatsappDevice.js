const mongoose = require('mongoose');

// Periksa jika model sudah wujud sebelum mencipta yang baru
const WhatsappDevice = mongoose.models.WhatsappDevice || mongoose.model('WhatsappDevice', new mongoose.Schema({
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
  },
  isAiEnabled: { // BARU: Untuk status AI Chatbot pada peranti ini
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Tambah createdAt dan updatedAt
}));

// Elakkan menambah index jika model sudah wujud (schema mungkin sudah ada index)
if (!mongoose.models.WhatsappDevice) {
  // Indexing untuk query yang kerap - hanya jika model baru dicipta
  WhatsappDevice.schema.index({ userId: 1 });
  WhatsappDevice.schema.index({ deviceId: 1 });
}

module.exports = WhatsappDevice; 
import mongoose from 'mongoose';

const whatsappConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Rujukan ke model User
    },
    phoneNumber: {
      // Nombor telefon tanpa @c.us, untuk paparan dan pengenalan unik per user
      type: String,
      required: true,
    },
    jid: {
      // JID penuh dengan @c.us, digunakan oleh Baileys
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['disconnected', 'connecting', 'waiting_qr', 'connected', 'error', 'limit_reached'],
      default: 'disconnected',
    },
    qrCode: {
      // Simpan string QR code jika status waiting_qr
      type: String,
      default: null,
    },
    instanceKey: {
       // Pengenal unik untuk instance Baileys di memori backend (jika perlu di masa depan)
       // Boleh guna JID atau UUID
       type: String,
       // unique: true, // Mungkin tidak perlu unik secara global jika kita scope by userId
    },
    lastConnectedAt: {
        type: Date,
    },
     // Tambah unique compound index untuk userId dan phoneNumber
     // Ini memastikan seorang pengguna tidak boleh ada dua rekod untuk nombor yang sama
     // index: { userId: 1, phoneNumber: 1 }, 
     // unique: true,
  },
  {
    timestamps: true, // Tambah createdAt dan updatedAt secara automatik
  }
);

// Tambah compound index selepas schema definition
whatsappConnectionSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

const WhatsappConnection = mongoose.model('WhatsappConnection', whatsappConnectionSchema);

export default WhatsappConnection; 
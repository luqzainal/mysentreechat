import mongoose from 'mongoose';

const messageSchema = mongoose.Schema(
  {
    user: { // ID pengguna aplikasi kita
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    chatJid: { // JID lawan bicara (cth: 60123456789@c.us)
      type: String,
      required: true,
      index: true, // Index untuk query pantas
    },
    messageId: { // ID mesej dari WhatsApp (WA), unik
      type: String,
      required: true,
      unique: true,
    },
    body: { // Kandungan teks mesej
      type: String,
      required: true,
    },
    timestamp: { // Timestamp mesej (dari WA atau semasa simpan)
      type: Date,
      required: true,
      index: true,
    },
    fromMe: { // Adakah mesej ini dari pengguna aplikasi kita?
      type: Boolean,
      required: true,
    },
    status: { // Status mesej (cth: sent, delivered, read, received, sending, failed)
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'received', 'failed'],
      default: 'sent',
    },
    // Tambah medan lain jika perlu (cth: messageType, mediaUrl, etc.)
  },
  {
    timestamps: true, // Tambah createdAt dan updatedAt secara automatik
  }
);

// Indeks kompaun untuk query sejarah chat
messageSchema.index({ user: 1, chatJid: 1, timestamp: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message; 
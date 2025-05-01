import mongoose from 'mongoose';

const autoresponderSettingSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Rujukan kepada model User
      unique: true, // Setiap pengguna hanya ada satu set tetapan
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: false, // Default tidak aktif
    },
    openaiApiKey: {
      type: String,
      // Tidak wajib, pengguna boleh pilih untuk tidak guna AI
      default: '',
    },
    prompt: {
      type: String,
      default: 'Anda adalah pembantu AI yang mesra. Balas mesej ini secara ringkas.', // Prompt default
    },
    savedResponses: {
      type: [String], // Array of strings
      default: [],
    },
    // Tambah lagi tetapan jika perlu pada masa hadapan
  },
  {
    timestamps: true, // Tambah createdAt dan updatedAt secara automatik
  }
);

const AutoresponderSetting = mongoose.model('AutoresponderSetting', autoresponderSettingSchema);

export default AutoresponderSetting; 
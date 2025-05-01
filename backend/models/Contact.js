import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phoneNumber: { // Simpan nombor dalam format antarabangsa cth., 60123456789
    type: String,
    required: true,
    // Mungkin tambah validasi format nombor telefon di sini
  },
  user: { // Rujukan kepada pengguna yang memiliki kenalan ini
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Merujuk kepada model 'User'
  },
}, {
  timestamps: true,
});

// Pastikan nombor telefon unik untuk setiap pengguna
contactSchema.index({ phoneNumber: 1, user: 1 }, { unique: true });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact; 
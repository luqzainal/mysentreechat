import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Import bcryptjs

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Pastikan email unik
    lowercase: true, // Simpan email dalam huruf kecil
  },
  password: {
    type: String,
    required: true,
  },
  isAdmin: { // Untuk membezakan admin dan pengguna biasa
    type: Boolean,
    required: true,
    default: false,
  },
  openaiApiKey: { // Medan baru untuk simpan OpenAI API Key
    type: String,
    default: null, 
  },
  isAutoresponderEnabled: { // Medan untuk enable/disable autoresponder
    type: Boolean,
    default: false,
  },
  membershipPlan: { // Medan untuk pelan keahlian
    type: String,
    required: true,
    default: 'Free', // Nilai default untuk pengguna baru
    enum: ['Free', 'Basic', 'Pro'] // Hadkan kepada nilai ini sahaja (pilihan)
  },
  // Tambah medan lain yang berkaitan dengan membership, whatsapp accounts, etc. nanti
  role: {
    type: String,
    required: true,
    enum: ['user', 'admin'], // Hanya benarkan nilai ini
    default: 'user',      // Default pengguna biasa
  },
}, {
  timestamps: true, // Tambah createdAt dan updatedAt secara automatik
});

// Middleware pra-save untuk hash kata laluan
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    // Jika password tidak diubah, teruskan ke middleware seterusnya (jika ada)
    return next(); 
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // Jangan panggil next() di sini jika mahu middleware seterusnya berjalan
});

// Middleware pra-save BARU untuk pastikan admin guna pelan Pro
userSchema.pre('save', function (next) {
  // Semak jika role ialah 'admin'
  if (this.role === 'admin') {
    // Jika ya, paksa membershipPlan kepada 'Pro'
    this.membershipPlan = 'Pro';
    console.log(`Memastikan admin (ID: ${this._id}) menggunakan pelan Pro.`);
  }
  // Teruskan ke proses simpanan sebenar
  next(); 
});

// Kaedah untuk bandingkan kata laluan
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User; 
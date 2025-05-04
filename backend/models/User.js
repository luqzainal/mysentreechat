const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Untuk hashing password

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false // Jangan pulangkan password secara default
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
  // Tambah field lain jika perlu, cth: avatar, createdAt
  createdAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
}, {
  timestamps: true, // Tambah createdAt dan updatedAt secara automatik
});

// Encrypt password using bcrypt before saving
userSchema.pre('save', async function(next) {
  // Hanya jalankan jika password diubahsuai (atau baru)
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
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

// Method untuk padankan password yang dimasukkan dengan hash dalam DB
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 
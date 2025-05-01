import User from '../models/User.js';
import { io } from '../server.js'; // Import io
import jwt from 'jsonwebtoken'; // Import jwt

// Fungsi untuk jana token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Token sah selama 30 hari
  });
};

// @desc    Register pengguna baru
// @route   POST /users/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400).json({ message: 'Pengguna sudah wujud' }); // Status 400 Bad Request
    return; // Hentikan pelaksanaan jika pengguna wujud
  }

  const user = await User.create({
    name,
    email,
    password, // Password akan di-hash oleh middleware model
    // isAdmin dan membershipPlan akan guna default
  });

  if (user) {
    // Hantar token semasa pendaftaran juga?
    const token = generateToken(user._id);
    res.status(201).json({ // Status 201 Created
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipPlan: user.membershipPlan, // <-- Sertakan pelan
      token: token,
      // Jangan hantar password balik
    });
  } else {
    res.status(400).json({ message: 'Data pengguna tidak sah' });
  }
};

// @desc    Log masuk pengguna
// @route   POST /users/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // initializeWhatsAppService(io, user._id.toString()); // Panggil dari frontend sahaja

    // Jana token JWT
    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      // Komen atau buang isAdmin:
      // isAdmin: user.isAdmin, 
      role: user.role, // Pastikan role dihantar
      membershipPlan: user.membershipPlan, 
      token: token, 
    });
  } else {
    res.status(401).json({ message: 'Email atau kata laluan tidak sah' });
  }
};

// @desc    Dapatkan profil pengguna
// @route   GET /users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  // req.user didapatkan dari middleware protect
  const user = await User.findById(req.user._id).select('-password'); // Jangan hantar password

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipPlan: user.membershipPlan,
      createdAt: user.createdAt // Hantar tarikh daftar sekali
    });
  } else {
    res.status(404).json({ message: 'Pengguna tidak ditemui' });
  }
};

// @desc    Kemas kini profil pengguna (contoh: nama)
// @route   PUT /users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    // Kemaskini email jika perlu (perlu validasi tambahan)
    // user.email = req.body.email || user.email;
    if (req.body.password) {
      user.password = req.body.password; // Password akan di-hash oleh pre-save hook
    }

    const updatedUser = await user.save();

    // Hantar data pengguna yang dikemas kini (tanpa password)
     res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      membershipPlan: updatedUser.membershipPlan,
      token: generateToken(updatedUser._id), // Hantar token baru jika perlu
    });

  } else {
    res.status(404).json({ message: 'Pengguna tidak ditemui' });
  }
};

// Export fungsi
export { registerUser, loginUser, getUserProfile, updateUserProfile }; 
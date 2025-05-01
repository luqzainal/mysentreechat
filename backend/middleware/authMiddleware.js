import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  // Baca JWT dari header Authorization (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Sahkan token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Dapatkan pengguna dari token (tanpa password) dan lampirkan pada req
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
          throw new Error('Pengguna tidak ditemui');
      }

      next(); // Teruskan ke controller/route seterusnya
    } catch (error) {
      console.error('Ralat pengesahan token:', error);
      res.status(401).json({ message: 'Tidak dibenarkan, token gagal' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Tidak dibenarkan, tiada token' });
  }
};

export { protect }; 
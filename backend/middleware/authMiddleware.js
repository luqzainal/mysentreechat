const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

// Middleware untuk melindungi route
const protect = async (req, res, next) => {
  let token;

  // Semak jika header Authorization wujud dan bermula dengan 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Dapatkan token dari header (buang 'Bearer ')
      token = req.headers.authorization.split(' ')[1];

      // Sahkan token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Pastikan JWT_SECRET ada di .env

      // Dapatkan data user dari token (tanpa password) dan letak dalam req.user
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
          throw new Error('User not found'); // Trigger catch block
      }

      next(); // Teruskan ke controller seterusnya
    } catch (error) {
      console.error('Authentication error:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware untuk akses admin sahaja
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') { // Semak role user
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' }); // 403 Forbidden
  }
};

module.exports = { protect, admin }; 
const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const { verifyRefreshToken } = require('../utils/refreshToken');
const { generateTokens } = require('../utils/generateToken');

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
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
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

// Middleware untuk refresh token
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tokens = generateTokens(user._id);
    
    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error.message);
    res.status(403).json({ message: 'Invalid refresh token' });
  }
};

module.exports = { protect, admin, refreshToken }; 
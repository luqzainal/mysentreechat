const jwt = require('jsonwebtoken');
const { generateRefreshToken } = require('./refreshToken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d', // Default 7 hari
  });
};

const generateTokens = (id) => {
  const accessToken = generateToken(id);
  const refreshToken = generateRefreshToken(id);
  
  return {
    accessToken,
    refreshToken
  };
};

module.exports = {
  generateToken,
  generateTokens
}; 
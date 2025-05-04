const jwt = require('jsonwebtoken');  

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d', // Default 30 hari jika tidak ditetapkan
  });
};

module.exports = generateToken; 
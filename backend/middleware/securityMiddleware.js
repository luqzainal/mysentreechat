const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

const securityMiddleware = [
    // Set security HTTP headers
    helmet(),
    
    // Prevent XSS attacks
    xss(),
    
    // Prevent HTTP Parameter Pollution
    hpp(),
    
    // Enable CORS
    cors({
        origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    })
];

module.exports = securityMiddleware; 
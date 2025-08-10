const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Default 15 minit
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Default 100 requests
    message: 'Too many requests from this IP, please try again later'
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 jam untuk authentication
    max: 5, // Limit setiap IP kepada 5 login attempts per jam
    message: 'Too many login attempts from this IP, please try again after an hour'
});

module.exports = {
    apiLimiter,
    authLimiter
}; 
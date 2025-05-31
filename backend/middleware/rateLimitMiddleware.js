const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minit
    max: 100, // Limit setiap IP kepada 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 jam
    max: 5, // Limit setiap IP kepada 5 requests per windowMs
    message: 'Too many login attempts from this IP, please try again after an hour'
});

module.exports = {
    apiLimiter,
    authLimiter
}; 
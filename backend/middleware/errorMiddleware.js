// Middleware untuk handle laluan 404 Not Found
const notFound = (req, res, next) => {
    const error = new Error(`Tidak Ditemui - ${req.originalUrl}`);
    res.status(404);
    next(error); // Hantar error ke error handler seterusnya
};

// Middleware untuk handle ralat umum
const errorHandler = (err, req, res, next) => {
    // Kadang-kadang ralat mungkin datang dengan status code sedia ada (selain 200)
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;

    // Khusus untuk Mongoose CastError (cth., ID objek tidak sah)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        message = 'Sumber tidak ditemui (ID tidak sah)';
    }
    
    // Khusus untuk Mongoose ValidationError
    if (err.name === 'ValidationError') {
        statusCode = 400; // Bad Request
        // Gabungkan mesej ralat validasi
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // Khusus untuk Mongoose Duplicate Key Error
     if (err.code === 11000) {
        statusCode = 400; // Bad Request
        const field = Object.keys(err.keyValue)[0];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} sudah wujud.`;
    }

    res.status(statusCode).json({
        message: message,
        // Hanya sertakan stack trace jika dalam mod development
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export { notFound, errorHandler }; 
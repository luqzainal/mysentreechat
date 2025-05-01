const isAdmin = (req, res, next) => {
    // Middleware ini dijangka berjalan SELEPAS middleware pengesahan (cth., protect)
    // jadi req.user sepatutnya sudah ada.
    if (req.user && req.user.role === 'admin') {
        // Jika pengguna wujud DAN peranannya adalah admin, teruskan ke middleware/controller seterusnya
        next();
    } else {
        // Jika tidak, hantar ralat Forbidden (403)
        res.status(403);
        throw new Error('Akses ditolak. Perlukan hak akses Admin.');
    }
};

export { isAdmin }; 
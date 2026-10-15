const jwt = require('jsonwebtoken');

// ⛔ JANGAN hardcode
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET belum diset di environment');
}

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // =========================
    // 1. Cek Authorization header
    // =========================
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Authorization header tidak ditemukan'
        });
    }

    // Support: Bearer / bearer
    const [scheme, token] = authHeader.split(' ');

    if (!/^Bearer$/i.test(scheme) || !token) {
        return res.status(401).json({
            success: false,
            message: 'Format Authorization harus: Bearer <token>'
        });
    }

    // =========================
    // 2. Verify JWT
    // =========================
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            clockTolerance: 5 // toleransi 5 detik (hindari error jam server)
        });

        req.user = decoded; // <-- PENTING

        // Normalisasi alias identitas: payload JWT MMT memakai
        // kdUser/nmUser/cab, sedangkan banyak controller memakai
        // kode/nama/username/cabang/user_kode. Tanpa alias ini semuanya
        // jatuh ke fallback "SYSTEM" sehingga user_create/user_modified
        // tidak sesuai user yang login (mis. LIA tercatat SYSTEM).
        // Hanya mengisi yang kosong — tidak menimpa field asli.
        const u = req.user;
        u.kode = u.kode ?? u.kdUser;
        u.nama = u.nama ?? u.nmUser;
        u.username = u.username ?? u.kdUser;
        u.user_kode = u.user_kode ?? u.kdUser ?? u.kode;
        u.cabang = u.cabang ?? u.cab;
        next();

    } catch (err) {
        // =========================
        // 3. Error handling detail
        // =========================
        let message = 'Token tidak valid';

        if (err.name === 'TokenExpiredError') {
            message = 'Token kadaluwarsa, silakan login ulang';
        }

        return res.status(401).json({
            success: false,
            message
        });
    }
};

module.exports = verifyToken;

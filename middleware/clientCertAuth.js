// middleware/clientCertAuth.js
const jwt = require("jsonwebtoken");

const clientCertAuth = (req, res, next) => {
  // 🟢 Jika req.user SUDAH diisi oleh JWT auth (verifyToken), jangan timpa lagi!
  if (req.user && (req.user.kdUser || req.user.kode)) {
    return next();
  }

  // Jika request membawa token JWT Authorization header, verifikasi terlebih dahulu
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 5 });
      req.user = decoded;
      req.user.kode = req.user.kode ?? req.user.kdUser;
      return next();
    } catch (_) {
      // Token expired atau tidak valid, lanjutkan fallback ke sertifikat
    }
  }

  // Jika bukan di mode produksi dan belum ada user dari JWT, baru pakai fallback
  if (process.env.NODE_ENV !== "production") {
    req.user = req.user || { kode: "DEV_USER" };
    return next();
  }

  // Ambil header 'X-SSL-Client-DN' yang di-set oleh Nginx
  const userDN = req.headers["x-ssl-client-dn"];

  if (!userDN) {
    return res.status(403).send({
      message:
        "Akses Ditolak: Sertifikat klien tidak valid atau tidak ditemukan.",
    });
  }

  const cnMatch = userDN.match(/CN=([^,]+)/);
  const username = cnMatch ? cnMatch[1] : null;

  if (!username) {
    return res.status(403).send({
      message: "Akses Ditolak: Username tidak ditemukan di dalam sertifikat.",
    });
  }

  req.user = {
    kode: username,
  };

  console.log(`User terautentikasi via sertifikat: ${username}`);
  next();
};

module.exports = clientCertAuth;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/maklonBarang.controller');
const verifyToken = require('../middleware/auth.middleware');

const requireAdmin = (req, res, next) => {
  const userKode = String(req.user?.kdUser || req.user?.username || '').toUpperCase();
  if (userKode !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Menu ini dinonaktifkan sementara karena proses migrasi.',
    });
  }
  next();
};

// Browse, detail, print, lookup (Admin only during migration)
router.use(verifyToken, requireAdmin);
router.get('/browse', controller.getBrowse);
router.get('/detail/:nomor', controller.getDetail);
router.get('/print/:nomor', controller.getPrintData);
router.get('/sj-keluar/print/:sjkNomor', controller.getSjKeluarPrintData);
router.get('/lookup', controller.getLookup);

module.exports = router;

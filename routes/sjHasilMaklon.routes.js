const express = require('express');
const router = express.Router();
const controller = require('../controllers/sjHasilMaklon.controller');
const verifyToken = require('../middleware/auth.middleware');

const requireAdmin = (req, res, next) => {
  const u = req.user;
  const kode = String(u?.kdUser || u?.kode || u?.username || u?.user_kode || '').trim().toUpperCase();
  const nama = String(u?.nmUser || u?.nama || '').trim().toUpperCase();
  const bagian = String(u?.bagian || u?.user_bagian || '').trim().toUpperCase();
  const role = String(u?.role || '').trim().toUpperCase();
  const userLevel = String(u?.user_level || '').trim().toUpperCase();
  const isAdmin =
    kode === 'ADMIN' ||
    kode === 'ESTI' ||
    nama === 'ESTI' ||
    kode === 'ARDANP4' ||
    kode === 'ARDAN' ||
    kode === 'EDP' ||
    kode === 'IT' ||
    bagian === 'ADMIN' ||
    bagian === 'EDP' ||
    bagian === 'IT' ||
    role === 'ADMIN' ||
    userLevel === 'ADMIN' ||
    u?.level === 1 ||
    u?.divisi === 0;

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Menu ini dinonaktifkan sementara karena proses migrasi.',
    });
  }
  next();
};

router.use(verifyToken, requireAdmin);
router.get('/outstanding', controller.getOutstanding);
router.get('/available-maklon', controller.getAvailableMaklon);
router.get('/history', controller.getHistory);
router.get('/history/:nomor/detail', controller.getHistoryDetail);
router.get('/create-data', controller.getCreateData);
router.get('/print/:nomor', controller.getPrintData);
router.post('/save', controller.create);

module.exports = router;

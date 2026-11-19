const express = require('express');
const router = express.Router();
const controller = require('../controllers/sjHasilMaklon.controller');
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

// Admin only during migration
router.use(verifyToken, requireAdmin);
router.get('/outstanding', controller.getOutstanding);
router.get('/available-maklon', controller.getAvailableMaklon);
router.get('/history', controller.getHistory);
router.get('/history/:nomor/detail', controller.getHistoryDetail);
router.get('/create-data', controller.getCreateData);
router.get('/print/:nomor', controller.getPrintData);
router.post('/save', controller.create);

module.exports = router;

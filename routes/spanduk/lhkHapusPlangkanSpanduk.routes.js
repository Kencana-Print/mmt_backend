const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkHapusPlangkanController = require('../../controllers/spanduk/lhkHapusPlangkanSpanduk.controller');

// GET: /api/spanduk/lhk-hapus-plangkan/browse?startDate=&endDate=
router.get('/browse', lhkHapusPlangkanController.getBrowseList);

// GET: /api/spanduk/lhk-hapus-plangkan/:nomor/detail
router.get('/:nomor/detail', lhkHapusPlangkanController.getDetail);

module.exports = router;

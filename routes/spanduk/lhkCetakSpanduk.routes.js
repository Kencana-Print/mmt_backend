const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkCetakController = require('../../controllers/spanduk/lhkCetakSpanduk.controller');

// GET: /api/spanduk/lhk-cetak/browse?startDate=&endDate=
router.get('/browse', lhkCetakController.getBrowseList);

// GET: /api/spanduk/lhk-cetak/:nomor/detail
router.get('/:nomor/detail', lhkCetakController.getDetail);

module.exports = router;

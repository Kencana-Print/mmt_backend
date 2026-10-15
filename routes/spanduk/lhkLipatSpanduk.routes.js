const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkLipatController = require('../../controllers/spanduk/lhkLipatSpanduk.controller');

// GET: /api/spanduk/lhk-lipat/browse?startDate=&endDate=
router.get('/browse', lhkLipatController.getBrowse);

// GET: /api/spanduk/lhk-lipat/:nomor/detail
router.get('/:nomor/detail', lhkLipatController.getDetail);

module.exports = router;

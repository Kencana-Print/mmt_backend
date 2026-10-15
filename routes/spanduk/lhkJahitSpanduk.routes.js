const express = require('express');
const router = express.Router();

// Path disesuaikan keluar dari /routes/spanduk menuju folder controllers
const lhkJahitController = require('../../controllers/spanduk/lhkJahitSpanduk.controller');

// GET: /api/spanduk/lhk-jahit/browse?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// (tanggal opsional; kosong = tanpa filter)
router.get('/browse', lhkJahitController.getBrowse);

// GET: /api/spanduk/lhk-jahit/:nomor/detail
router.get('/:nomor/detail', lhkJahitController.getDetail);

module.exports = router;

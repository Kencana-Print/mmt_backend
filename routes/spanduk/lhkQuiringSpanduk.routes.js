const express = require('express');
const router = express.Router();

// Path disesuaikan keluar dari /routes/spanduk menuju folder controllers
const quiringController = require('../../controllers/spanduk/lhkQuiringSpanduk.controller');

// GET: /api/spanduk/lhk-quiring/browse?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd
router.get('/browse', quiringController.getBrowse);

// GET: /api/spanduk/lhk-quiring/:nomor/detail
// (didefinisikan setelah /browse agar tidak bentrok)
router.get('/:nomor/detail', quiringController.getDetail);

module.exports = router;

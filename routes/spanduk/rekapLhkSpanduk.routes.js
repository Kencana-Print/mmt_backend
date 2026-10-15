const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const rekapLhkController = require('../../controllers/spanduk/rekapLhkSpanduk.controller');

// GET: /api/spanduk/rekap-lhk/browse?startDate=&endDate=&perusahaan=
router.get('/browse', rekapLhkController.getBrowseList);

module.exports = router;

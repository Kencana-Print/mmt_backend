const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkPlotterController = require('../../controllers/spanduk/lhkPlotterSpanduk.controller');

// GET: /api/spanduk/lhk-plotter/browse?startDate=&endDate=
router.get('/browse', lhkPlotterController.getBrowseList);

// GET: /api/spanduk/lhk-plotter/:nomor/detail
router.get('/:nomor/detail', lhkPlotterController.getDetail);

module.exports = router;

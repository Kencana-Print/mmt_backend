const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkPlotterController = require('../../controllers/spanduk/lhkPlotterSpanduk.controller');

// GET: /api/spanduk/lhk-plotter/browse?startDate=&endDate=
router.get('/browse', lhkPlotterController.getBrowseList);

// GET: /api/spanduk/lhk-plotter/:nomor/detail
router.get('/:nomor/detail', lhkPlotterController.getDetail);

// GET: /api/spanduk/lhk-plotter/form/:nomor (data form edit: header + details)
router.get('/form/:nomor', lhkPlotterController.getFormDetail);

// GET: /api/spanduk/lhk-plotter/spk/:spkNomor (resolve SPK utk autofill grid)
router.get('/spk/:spkNomor', lhkPlotterController.resolveSpk);

// POST: /api/spanduk/lhk-plotter/ (baru, nomor auto) — body: { tanggal, pab_kode, details[] }
router.post('/', lhkPlotterController.create);

// PUT: /api/spanduk/lhk-plotter/:nomor (ubah)
router.put('/:nomor', lhkPlotterController.update);

module.exports = router;

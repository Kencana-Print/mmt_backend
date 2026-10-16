const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkCetakController = require('../../controllers/spanduk/lhkCetakSpanduk.controller');

// GET: /api/spanduk/lhk-cetak/browse?startDate=&endDate=
router.get('/browse', lhkCetakController.getBrowseList);

// GET: /api/spanduk/lhk-cetak/:nomor/detail
router.get('/:nomor/detail', lhkCetakController.getDetail);

// Form input: GET /form/:nomor (edit), POST / (new), PUT /:nomor (edit).
router.get('/form/:nomor', lhkCetakController.getFormDetail);
router.post('/', lhkCetakController.create);
router.put('/:nomor', lhkCetakController.update);

module.exports = router;

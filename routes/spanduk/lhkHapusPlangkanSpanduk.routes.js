const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkHapusPlangkanController = require('../../controllers/spanduk/lhkHapusPlangkanSpanduk.controller');

// GET: /api/spanduk/lhk-hapus-plangkan/browse?startDate=&endDate=
router.get('/browse', lhkHapusPlangkanController.getBrowseList);

// GET: /api/spanduk/lhk-hapus-plangkan/:nomor/detail
router.get('/:nomor/detail', lhkHapusPlangkanController.getDetail);

// Form input: GET /form/:nomor (edit), POST / (new), PUT /:nomor (edit).
router.get('/form/:nomor', lhkHapusPlangkanController.getFormDetail);
router.post('/', lhkHapusPlangkanController.create);
router.put('/:nomor', lhkHapusPlangkanController.update);

module.exports = router;

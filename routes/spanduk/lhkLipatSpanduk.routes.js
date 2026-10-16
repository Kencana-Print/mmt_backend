const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkLipatController = require('../../controllers/spanduk/lhkLipatSpanduk.controller');

// GET: /api/spanduk/lhk-lipat/browse?startDate=&endDate=
router.get('/browse', lhkLipatController.getBrowse);

// GET: /api/spanduk/lhk-lipat/:nomor/detail
router.get('/:nomor/detail', lhkLipatController.getDetail);

// --- Form input/save (baru; endpoint browse/detail di atas tidak diubah) ---
// GET form edit: /api/spanduk/lhk-lipat/form/:nomor
router.get('/form/:nomor', lhkLipatController.getForm);

// POST new: /api/spanduk/lhk-lipat
router.post('/', lhkLipatController.createData);

// PUT edit: /api/spanduk/lhk-lipat/:nomor
router.put('/:nomor', lhkLipatController.updateData);

module.exports = router;

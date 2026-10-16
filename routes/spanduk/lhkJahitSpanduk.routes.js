const express = require('express');
const router = express.Router();

// Path disesuaikan keluar dari /routes/spanduk menuju folder controllers
const lhkJahitController = require('../../controllers/spanduk/lhkJahitSpanduk.controller');

// GET: /api/spanduk/lhk-jahit/browse?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// (tanggal opsional; kosong = tanpa filter)
router.get('/browse', lhkJahitController.getBrowse);

// GET: /api/spanduk/lhk-jahit/:nomor/detail
router.get('/:nomor/detail', lhkJahitController.getDetail);

// --- Form input/save (baru; endpoint browse/detail di atas tidak diubah) ---
// GET form edit: /api/spanduk/lhk-jahit/form/:nomor
router.get('/form/:nomor', lhkJahitController.getForm);

// POST new: /api/spanduk/lhk-jahit
router.post('/', lhkJahitController.createData);

// PUT edit: /api/spanduk/lhk-jahit/:nomor
router.put('/:nomor', lhkJahitController.updateData);

module.exports = router;

const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkProofController = require('../../controllers/spanduk/lhkProofSpanduk.controller');

// GET: /api/spanduk/lhk-proof/browse?startDate=&endDate=
router.get('/browse', lhkProofController.getBrowseList);

// GET: /api/spanduk/lhk-proof/:nomor/detail
router.get('/:nomor/detail', lhkProofController.getDetail);

// --- Form input/save (baru; endpoint browse/detail di atas tidak diubah) ---
// GET form edit: /api/spanduk/lhk-proof/form/:nomor
router.get('/form/:nomor', lhkProofController.getForm);

// POST new: /api/spanduk/lhk-proof
router.post('/', lhkProofController.createData);

// PUT edit: /api/spanduk/lhk-proof/:nomor
router.put('/:nomor', lhkProofController.updateData);

module.exports = router;

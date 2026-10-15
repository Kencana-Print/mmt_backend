const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkProofController = require('../../controllers/spanduk/lhkProofSpanduk.controller');

// GET: /api/spanduk/lhk-proof/browse?startDate=&endDate=
router.get('/browse', lhkProofController.getBrowseList);

// GET: /api/spanduk/lhk-proof/:nomor/detail
router.get('/:nomor/detail', lhkProofController.getDetail);

module.exports = router;

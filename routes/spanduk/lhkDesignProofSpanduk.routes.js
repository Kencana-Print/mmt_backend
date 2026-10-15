const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkDesignProofController = require('../../controllers/spanduk/lhkDesignProofSpanduk.controller');

// GET: /api/spanduk/lhk-design-proof/browse?startDate=&endDate=
router.get('/browse', lhkDesignProofController.getBrowseList);

// GET: /api/spanduk/lhk-design-proof/:nomor/detail
router.get('/:nomor/detail', lhkDesignProofController.getDetail);

module.exports = router;

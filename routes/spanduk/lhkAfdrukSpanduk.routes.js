const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const lhkAfdrukController = require('../../controllers/spanduk/lhkAfdrukSpanduk.controller');

// GET: /api/spanduk/lhk-afdruk/browse?startDate=&endDate=
router.get('/browse', lhkAfdrukController.getBrowseList);

// GET: /api/spanduk/lhk-afdruk/:nomor/detail
router.get('/:nomor/detail', lhkAfdrukController.getDetail);

module.exports = router;

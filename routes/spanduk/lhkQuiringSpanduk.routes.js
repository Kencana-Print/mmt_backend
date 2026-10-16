const express = require('express');
const router = express.Router();

// Path disesuaikan keluar dari /routes/spanduk menuju folder controllers
const quiringController = require('../../controllers/spanduk/lhkQuiringSpanduk.controller');

// GET: /api/spanduk/lhk-quiring/browse?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd
router.get('/browse', quiringController.getBrowse);

// GET: /api/spanduk/lhk-quiring/:nomor/detail
// (didefinisikan setelah /browse agar tidak bentrok)
router.get('/:nomor/detail', quiringController.getDetail);

// GET form edit: /api/spanduk/lhk-quiring/form/:nomor -> { header, details }
router.get('/form/:nomor', quiringController.getForm);

// POST form baru: /api/spanduk/lhk-quiring/ (nomor digenerate LHK-Q.YYMM.NNNN)
router.post('/', quiringController.create);

// PUT form edit: /api/spanduk/lhk-quiring/:nomor
router.put('/:nomor', quiringController.update);

module.exports = router;

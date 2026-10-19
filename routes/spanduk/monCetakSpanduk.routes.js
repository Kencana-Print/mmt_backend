const express = require('express');
const router = express.Router();
const monCetakSpandukController = require('../../controllers/spanduk/monCetakSpanduk.controller');

// Monitoring Cetak Spanduk (read-only) — Delphi ufrmbrowsemonitorcetak.pas
// GET /api/spanduk/mon-cetak/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monCetakSpandukController.getBrowseList);

module.exports = router;

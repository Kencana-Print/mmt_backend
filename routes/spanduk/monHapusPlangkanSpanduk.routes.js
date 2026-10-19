const express = require('express');
const router = express.Router();
const monHapusPlangkanSpanduk = require('../../controllers/spanduk/monHapusPlangkanSpanduk.controller');

// Monitoring Hapus Plangkan Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-hapus-plangkan/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monHapusPlangkanSpanduk.getBrowseList);

module.exports = router;

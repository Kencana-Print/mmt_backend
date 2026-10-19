const express = require('express');
const router = express.Router();
const monCuiringSpanduk = require('../../controllers/spanduk/monCuiringSpanduk.controller');

// Monitoring Cuiring Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-cuiring/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monCuiringSpanduk.getBrowseList);

module.exports = router;

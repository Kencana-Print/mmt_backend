const express = require('express');
const router = express.Router();
const monJahitSpanduk = require('../../controllers/spanduk/monJahitSpanduk.controller');

// Monitoring Jahit Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-jahit/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monJahitSpanduk.getBrowseList);

module.exports = router;

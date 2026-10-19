const express = require('express');
const router = express.Router();
const monLipatSpanduk = require('../../controllers/spanduk/monLipatSpanduk.controller');

// Monitoring Lipat Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-lipat/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monLipatSpanduk.getBrowseList);

module.exports = router;

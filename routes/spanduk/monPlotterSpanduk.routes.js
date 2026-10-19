const express = require('express');
const router = express.Router();
const monPlotterSpanduk = require('../../controllers/spanduk/monPlotterSpanduk.controller');

// Monitoring Plotter Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-plotter/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monPlotterSpanduk.getBrowseList);

module.exports = router;

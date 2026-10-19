const express = require('express');
const router = express.Router();
const monAfdrukSpanduk = require('../../controllers/spanduk/monAfdrukSpanduk.controller');

// Monitoring Afdruk Spanduk (read-only) — Delphi spanduk/ufrmbrowsemonitor
// GET /api/spanduk/mon-afdruk/browse?startDate=&endDate=&perusahaan=
router.get('/browse', monAfdrukSpanduk.getBrowseList);

module.exports = router;

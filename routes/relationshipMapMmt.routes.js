const express = require("express");
const router = express.Router();
const controller = require("../controllers/relationshipMapMmt.controller");

// Cari dokumen (12 tipe MMT: MAP, SPK, SO, LHK_*, STBJ, JADWAL_KIRIM, SJ): GET /api/mmt/relationship-map/search?type=SPK&q=...
router.get("/search", controller.search);

// Kembangkan graf: GET /api/mmt/relationship-map/expand?type=SPK&nomor=...
router.get("/expand", controller.expand);

module.exports = router;

const express = require("express");
const router = express.Router();
const bastMapController = require("../controllers/bastMap.controller");

// Sesuaikan middleware auth Anda jika ada (misal: verifyToken, checkPermission, dll)
// const { verifyToken } = require("../middlewares/auth.middleware");

// Route untuk mengambil list browse (GET /api/bast-map)
router.get("/", bastMapController.getBrowseList);

// Route untuk export detail (GET /api/bast-map/export-detail)
// *Catatan: Letakkan sebelum route yang menggunakan parameter `:nomor` agar tidak tertukar*
router.get("/export-detail", bastMapController.getExportDetail);

// Bahan + nomor proof dari LHK Proof berdasarkan nomor SPK/MAP
// (dipakai form Baru saat pilih SPK lookup, dan info tambahan form Ubah)
router.get("/proof/:spk", bastMapController.getProofBySpk);

// Route untuk menghapus BAST (DELETE /api/bast-map/:nomor)
router.delete("/:nomor", bastMapController.deleteBast);

// Ukuran/size untuk form BAST (GET /api/bast-map/:nomor/sizes)
// *Wajib di atas GET /:nomor agar tidak tertukar*
router.get("/:nomor/sizes", bastMapController.getSizes);

// Detail BAST untuk form Ubah (GET /api/bast-map/:nomor)
router.get("/:nomor", bastMapController.getBastDetail);

module.exports = router;

const assert = require("assert");
const service = require("../services/permintaanBahan.service");

// Self-check: user dengan divisi=0 dan bagian=admin (seperti ARDANP4) harus bisa akses data
(async () => {
  const data = await service.getPermintaanBahanData(
    "2026-10-01",
    "2026-11-20",
    0,
    0,
    "admin"
  );
  assert(Array.isArray(data), "Harus mengembalikan array");
  assert(data.length > 0, "Harus mengembalikan data transaksi MMT");
  console.log("Check passed: admin dengan divisi=0 berhasil membaca data MMT.");
  process.exit(0);
})().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});

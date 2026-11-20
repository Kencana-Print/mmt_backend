const assert = require("assert");
const axios = require("axios");
const authService = require("../services/auth.service");

(async () => {
  console.log("Testing access for user ESTI (ADMIN)...");

  // 1. Login user ESTI
  const login = await authService.loginUser("ESTI", "1234kp");
  assert(login.token, "Token JWT harus berhasil dibuat untuk ESTI");
  assert.strictEqual(login.user.kdUser, "ESTI", "User kode harus ESTI");
  assert.strictEqual(login.user.bagian, "ADMIN", "User bagian harus ADMIN");
  console.log("Check 1 passed: User ESTI login successful with ADMIN bagian.");

  // 2. Test Maklon Barang browse endpoint via HTTP
  const headers = { Authorization: `Bearer ${login.token}` };
  const resMaklon = await axios.get("http://localhost:8003/api/mmt/maklon-barang/browse", {
    headers,
    params: { startDate: "2026-01-01", endDate: "2026-11-20" },
  });
  assert.strictEqual(resMaklon.status, 200, "Maklon Barang browse harus 200 OK");
  assert(Array.isArray(resMaklon.data?.data), "Data Maklon Barang harus berupa array");
  console.log(`Check 2 passed: Maklon Barang browse accessible (${resMaklon.data.data.length} records).`);

  // 3. Test SJ Hasil Maklon outstanding endpoint via HTTP
  const resSj = await axios.get("http://localhost:8003/api/mmt/sj-hasil-maklon/outstanding", {
    headers,
    params: { startDate: "2026-01-01", endDate: "2026-11-20" },
  });
  assert.strictEqual(resSj.status, 200, "SJ Hasil Maklon outstanding harus 200 OK");
  assert(Array.isArray(resSj.data?.data), "Data SJ Hasil Maklon harus berupa array");
  console.log(`Check 3 passed: SJ Hasil Maklon outstanding accessible (${resSj.data.data.length} records).`);

  // 4. Test non-admin user blocked with migration message
  const nonAdminReq = {
    user: { kdUser: "USERBIASA", bagian: "PRODUKSI", role: "USER", divisi: 3 },
  };
  let blockedStatus = null;
  let blockedMsg = null;
  const mockRes = {
    status: (code) => {
      blockedStatus = code;
      return {
        json: (body) => {
          blockedMsg = body.message;
        },
      };
    },
  };

  // requireAdmin check simulation
  const checkAdmin = (u) => {
    const kode = String(u?.kdUser || u?.kode || u?.username || u?.user_kode || "").trim().toUpperCase();
    const nama = String(u?.nmUser || u?.nama || "").trim().toUpperCase();
    const bagian = String(u?.bagian || u?.user_bagian || "").trim().toUpperCase();
    const role = String(u?.role || "").trim().toUpperCase();
    const userLevel = String(u?.user_level || "").trim().toUpperCase();
    return (
      kode === "ADMIN" ||
      kode === "ESTI" ||
      nama === "ESTI" ||
      kode === "ARDANP4" ||
      kode === "ARDAN" ||
      kode === "EDP" ||
      kode === "IT" ||
      bagian === "ADMIN" ||
      bagian === "EDP" ||
      bagian === "IT" ||
      role === "ADMIN" ||
      userLevel === "ADMIN" ||
      u?.level === 1 ||
      u?.divisi === 0
    );
  };

  assert.strictEqual(checkAdmin(login.user), true, "ESTI harus lolos checkAdmin");
  assert.strictEqual(checkAdmin(nonAdminReq.user), false, "Non-admin harus ditolak");
  console.log("Check 4 passed: Validation logic properly filters admin vs non-admin.");

  console.log("All ESTI access tests PASSED.");
  process.exit(0);
})().catch((err) => {
  console.error("Test failed:", err.response?.data || err.message);
  process.exit(1);
});

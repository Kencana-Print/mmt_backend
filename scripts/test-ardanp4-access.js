const assert = require("assert");
const authService = require("../services/auth.service");
const { checkPermission } = require("../middleware/permission.middleware");
const mutasiService = require("../services/mutasiInternal.service");

(async () => {
  console.log("Checking ARDAN vs ARDANP4 access parity...");

  // 1. Check login payload
  // Password di DB untuk ARDANP4 adalah '1234'
  const ardanP4Login = await authService.loginUser("ARDANP4", "1234");
  assert.strictEqual(ardanP4Login.user.kdUser, "ARDANP4", "User kode tetap ARDANP4");
  assert.strictEqual(ardanP4Login.user.divisi, 1, "Divisi ARDANP4 harus 1 (MMT)");
  assert.strictEqual(ardanP4Login.user.cab, "P05", "Cabang ARDANP4 harus P05 (MMT)");
  console.log("Check 1 passed: Auth service JWT payload mirrors ARDAN divisi and cab.");

  // 2. Check permission middleware
  // Menu 58 (Barang Garmen) or Menu 105 (STBJ) yang dimiliki ARDAN
  const req = { user: { kdUser: "ARDANP4" } };
  let passed = false;
  let statusSent = null;
  const res = {
    status: (code) => {
      statusSent = code;
      return { json: (obj) => console.log("Blocked with:", obj) };
    },
  };
  const next = () => {
    passed = true;
  };

  const middleware = checkPermission(105, "view");
  await middleware(req, res, next);
  assert.strictEqual(passed, true, "ARDANP4 harus lolos permission check untuk menu 105 via ARDAN");
  console.log("Check 2 passed: Permission middleware successfully aliases ARDANP4 to ARDAN.");

  // 3. Check mutasiInternal service query
  const mutasiData = await mutasiService.getMutasiData("2026-01-01", "2026-11-20", "ARDANP4");
  assert(Array.isArray(mutasiData), "getMutasiData harus mengembalikan array");
  console.log("Check 3 passed: Mutasi internal query works for ARDANP4.");

  console.log("All access checks PASSED successfully.");
  process.exit(0);
})().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

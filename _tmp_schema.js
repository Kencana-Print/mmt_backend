const p = require("./config/db.config");
(async () => {
  try {
    for (const t of [
      "tmutasi_hdr",
      "tmutasi_dtl",
      "tmutasiproduksi_hdr",
      "tmutasiproduksi_dtl",
      "tlhk_rtr_hdr",
      "tlhk_rtr_dtl",
    ]) {
      const [cols] = await p.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?
         ORDER BY ORDINAL_POSITION`,
        [t],
      );
      const [[cnt]] = await p.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      console.log("\n###", t, "rows=", cnt.n);
      console.table(cols);
    }
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    process.exit(0);
  }
})();

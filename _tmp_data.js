const p = require("./config/db.config");
(async () => {
  try {
    console.log("=== tmutasiproduksi_hdr sample ===");
    const [h] = await p.query(
      `SELECT mph_nomor, mph_tanggal, mph_cab, mph_gdgasal, mph_gdgtujuan,
              mph_keterangan, mph_spk_nomor, mph_jumlah, mph_kelompok,
              mph_kelompok_tujuan, mph_komponen, mph_asal_kerjaan,
              mph_nomor_opr, mph_plan_nomor
       FROM tmutasiproduksi_hdr
       ORDER BY mph_tanggal DESC LIMIT 15`,
    );
    console.table(h);
    console.log("=== distinct asal/tujuan/kelompok/kerjaan ===");
    const [d] = await p.query(
      `SELECT mph_gdgasal, mph_gdgtujuan, mph_kelompok, mph_kelompok_tujuan,
              mph_asal_kerjaan, COUNT(*) n
       FROM tmutasiproduksi_hdr GROUP BY 1,2,3,4,5 ORDER BY n DESC LIMIT 40`,
    );
    console.table(d);
    console.log("=== detail sample for latest headers ===");
    if (h.length) {
      const nomors = h.slice(0, 3).map((x) => x.mph_nomor);
      const [dd] = await p.query(
        `SELECT * FROM tmutasiproduksi_dtl WHERE mpd_mph_nomor IN (?)`,
        [nomors],
      );
      console.table(dd);
    }
    console.log("=== detail rows with size or spk ===");
    const [dd2] = await p.query(
      `SELECT * FROM tmutasiproduksi_dtl
       WHERE mpd_size <> '' OR mpd_spk <> ''
       ORDER BY mpd_mph_nomor DESC LIMIT 20`,
    );
    console.table(dd2);
    console.log("=== tmutasi_hdr sample ===");
    const [mh] = await p.query(`SELECT * FROM tmutasi_hdr ORDER BY mut_tanggal DESC LIMIT 10`);
    console.table(mh);
    const [md] = await p.query(`SELECT * FROM tmutasi_dtl ORDER BY mutd_mut_nomor DESC LIMIT 15`);
    console.table(md);
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    process.exit(0);
  }
})();

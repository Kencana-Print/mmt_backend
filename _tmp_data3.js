const p = require("./config/db.config");
(async () => {
  try {
    const [a] = await p.query(
      `SELECT mph_nomor, mph_tanggal, mph_cab, mph_gdgasal, mph_gdgtujuan,
              mph_keterangan, mph_spk_nomor, mph_jumlah, mph_kelompok,
              mph_komponen, mph_asal_kerjaan, mph_nomor_opr
       FROM tmutasiproduksi_hdr WHERE mph_nomor LIKE 'MMT.MUT%' OR mph_keterangan LIKE '%MUTASI INTERNAL%'
       ORDER BY mph_tanggal DESC LIMIT 30`,
    );
    console.log("MMT MUT in tmutasiproduksi", a.length);
    console.table(a);
    const [b] = await p.query(
      `SELECT * FROM tmutasiproduksi_dtl WHERE mpd_mph_nomor LIKE 'MMT.MUT%' LIMIT 30`,
    );
    console.table(b);
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    process.exit(0);
  }
})();

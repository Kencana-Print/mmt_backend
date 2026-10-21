const p = require("./config/db.config");
(async () => {
  try {
    console.log("=== headers with mph_nomor_opr non-empty ===");
    const [a] = await p.query(
      `SELECT mph_nomor, mph_tanggal, mph_cab, mph_gdgasal, mph_gdgtujuan,
              mph_keterangan, mph_spk_nomor, mph_jumlah, mph_kelompok,
              mph_komponen, mph_asal_kerjaan, mph_nomor_opr, mph_apv
       FROM tmutasiproduksi_hdr WHERE mph_nomor_opr <> '' ORDER BY mph_tanggal DESC LIMIT 20`,
    );
    console.table(a);
    console.log("=== headers with asal_kerjaan SUB/RTR/SUBLIM or keterangan like ===");
    const [b] = await p.query(
      `SELECT mph_nomor, mph_tanggal, mph_cab, mph_gdgasal, mph_gdgtujuan,
              mph_keterangan, mph_spk_nomor, mph_jumlah, mph_kelompok,
              mph_komponen, mph_asal_kerjaan, mph_nomor_opr
       FROM tmutasiproduksi_hdr
       WHERE mph_asal_kerjaan IN ('SUB','RTR','SUBLIM') OR mph_keterangan LIKE '%SUBLIM%'
       ORDER BY mph_tanggal DESC LIMIT 30`,
    );
    console.table(b);
    console.log("=== distinct komponen ===");
    const [c] = await p.query(
      `SELECT mph_komponen, COUNT(*) n FROM tmutasiproduksi_hdr GROUP BY mph_komponen ORDER BY n DESC LIMIT 30`,
    );
    console.table(c);
    console.log("=== LHK RTR headers recent ===");
    const [d] = await p.query(
      `SELECT h.lr_nomor, h.lr_tanggal, h.lr_jenis, h.lr_gdg_kode, h.lr_mutasi,
              COUNT(x.lrd_no_urut) n, SUM(x.lrd_jumlah) qty
       FROM tlhk_rtr_hdr h LEFT JOIN tlhk_rtr_dtl x ON x.lrd_lr_nomor=h.lr_nomor
       GROUP BY h.lr_nomor ORDER BY h.lr_tanggal DESC LIMIT 15`,
    );
    console.table(d);
    console.log("=== LHK RTR detail recent ===");
    const [e] = await p.query(
      `SELECT * FROM tlhk_rtr_dtl ORDER BY lrd_lr_nomor DESC, lrd_no_urut LIMIT 30`,
    );
    console.table(e);
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    process.exit(0);
  }
})();

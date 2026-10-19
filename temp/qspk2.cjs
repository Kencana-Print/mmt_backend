const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
(async () => {
  try {
    // 1) Cari LHK yang memuat JA-MT-00699
    const [a] = await pool.query(
      `SELECT ld_lnomor, ld_urut, ld_spk_nomor, ld_total_qtycetak, ld_tile, ld_padding_atas, ld_padding_samping, ld_ambilbahan, ld_ambilbahan_lebar
       FROM tlhk_mesin_dtl WHERE ld_spk_nomor LIKE '%00699%' ORDER BY ld_lnomor DESC LIMIT 10`);
    console.log('== detail LHK memuat 00699 ==');
    console.log(a);

    // 2) Cari SPK 00699 di berbagai tabel
    const [b] = await pool.query(`SELECT spk_nomor, spk_nama, spk_panjang, spk_lebar, spk_jumlah, spk_divisi FROM tspk WHERE spk_nomor LIKE '%00699%' LIMIT 5`);
    console.log('\n== tspk 00699 ==');
    console.log(b);

    // 3) Detail lengkap LHK 0338
    const [c] = await pool.query(
      `SELECT d.ld_urut, d.ld_spk_nomor, d.ld_total_qtycetak, d.ld_tile, d.ld_padding_atas, d.ld_padding_samping,
              d.ld_ambilbahan, d.ld_ambilbahan_lebar, s.spk_panjang, s.spk_lebar, s.spk_jumlah, h.lbahan, h.ltanggal
       FROM tlhk_mesin_dtl d JOIN tlhk_mesin_hdr h ON h.lnomor=d.ld_lnomor
       LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor
       WHERE d.ld_lnomor='MMT-LHK-M.2607.0338' ORDER BY d.ld_urut`);
    console.log('\n== LHK 0338 detail ==');
    console.log(c);
  } catch (e) { console.error('ERR', e.message); }
  finally { await pool.end(); }
})();

const pool = require('../config/db.config');
(async () => {
  const conn = await pool.getConnection();
  try {
    const bc = '10003-2607-038';
    const [r] = await conn.query(
      'SELECT mst_gdg_kode, mst_noreferensi, mst_brg_kode, mst_stok_in, mst_stok_out, mst_panjang, mst_lebar, mst_spk_nomor, mst_tanggal FROM tmasterstok_mmt WHERE TRIM(mst_barcode) = TRIM(?) ORDER BY mst_tanggal, id',
      [bc],
    );
    console.log('moves:', JSON.stringify(r, null, 1));
    const [g] = await conn.query(
      'SELECT gdg_kode, gdg_nama FROM tgudang WHERE gdg_kode IN (SELECT DISTINCT mst_gdg_kode FROM tmasterstok_mmt WHERE TRIM(mst_barcode) = TRIM(?))',
      [bc],
    );
    console.log('gudang:', JSON.stringify(g));
    const [l] = await conn.query(
      'SELECT lprd_lpr_nomor, lprd_j_meter FROM tlhk_proofmmt_dtl WHERE TRIM(REPLACE(lprd_barcode, CHAR(9), "")) = TRIM(?) LIMIT 5',
      [bc],
    );
    console.log('proof use:', JSON.stringify(l));
    const [m] = await conn.query(
      'SELECT mut_nomor, mut_tanggal, mut_gdg_asal, mut_gdg_tujuan FROM tmutasi_hdr_mmt WHERE mut_nomor IN (SELECT DISTINCT mst_noreferensi FROM tmasterstok_mmt WHERE TRIM(mst_barcode) = TRIM(?))',
      [bc],
    );
    console.log('mutasi docs:', JSON.stringify(m));
  } finally {
    conn.release();
    await pool.end();
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

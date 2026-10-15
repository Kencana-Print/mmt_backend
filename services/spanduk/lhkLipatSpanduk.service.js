const pool = require('../../config/db.config');

const throwDbError = (message, error) => {
  throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK persis pola Delphi ufrmbrowsehasilkerjalipat.pas:
// tspk UNION ALL tmemospk (kolom dinormalkan ke spk_nomor/nama/jumlah/panjang/lebar).
const SPK_UNION = `
  (SELECT spk_nomor, spk_nama, spk_jumlah,
          IFNULL(spk_panjang, 0) spk_panjang,
          IFNULL(spk_lebar, 0) spk_lebar
     FROM tspk
   UNION ALL
   SELECT mspk_nomor, mspk_nama, mspk_jumlah,
          IFNULL(mspk_panjang, 0) mspk_panjang,
          IFNULL(mspk_lebar, 0) mspk_lebar
     FROM tmemospk) x`;

// Agregat per nomor LHK (pola turunan browse hasil kerja cetak Delphi:
// cetak punya Jml_Meter via subquery; lipat Delphi tidak punya agregat,
// jadi agregat dihitung dari tlhk_lipat_dtl: total qty lipat + mata ayam + jml SPK).
const AGREGAT_JOIN = `
  LEFT JOIN (
    SELECT lld_llh_nomor XNomor,
           SUM(lld_qty_lipat) Jml_Qty_Lipat,
           SUM(lld_mata_ayam) Jml_Mata_Ayam,
           COUNT(*) Jml_SPK
      FROM tlhk_lipat_dtl
     GROUP BY 1
  ) xx ON (xx.XNomor = h.llh_nomor)`;

// Guard tanggal kosong = tanpa filter (JANGAN pakai zero-date '0000-00-00').
const hasDateFilter = (startDate, endDate) =>
  Boolean(startDate && String(startDate).trim() !== '' &&
          endDate && String(endDate).trim() !== '');

exports.getBrowseList = async (startDate, endDate) => {
  try {
    let sql = `
      SELECT h.llh_nomor AS Nomor,
             DATE_FORMAT(h.llh_tanggal, '%Y-%m-%d') AS Tanggal,
             h.llh_pab_kode AS Kode_Pabrik,
             p.pab_nama AS Nama_Pabrik,
             h.llh_jkar_borongan AS Kar_Borongan,
             h.llh_jkar_harian AS Kar_Harian,
             IFNULL(xx.Jml_Qty_Lipat, 0) AS Jml_Qty_Lipat,
             IFNULL(xx.Jml_Mata_Ayam, 0) AS Jml_Mata_Ayam,
             IFNULL(xx.Jml_SPK, 0) AS Jml_SPK
        FROM tlhk_lipat_hdr h
        LEFT JOIN tpabrik p ON (p.pab_kode = h.llh_pab_kode)
        ${AGREGAT_JOIN}`;
    const params = [];
    if (hasDateFilter(startDate, endDate)) {
      sql += ` WHERE h.llh_tanggal BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    sql += ` ORDER BY h.llh_tanggal DESC, h.llh_nomor DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    throwDbError('Gagal mengambil browse LHK lipat spanduk di database', error);
  }
};

exports.getDetail = async (nomor) => {
  try {
    const sql = `
      SELECT d.lld_llh_nomor AS Nomor,
             d.lld_spk_nomor AS Nomor_SPK,
             x.spk_nama AS Nama_SPK,
             x.spk_jumlah AS Jumlah_Order,
             x.spk_panjang AS Panjang,
             x.spk_lebar AS Lebar,
             d.lld_qty_lipat AS Qty_Lipat,
             d.lld_tambah_lipat AS Tambah_Lipat,
             d.lld_mata_ayam AS Mata_Ayam
        FROM tlhk_lipat_dtl d
        LEFT JOIN ${SPK_UNION} ON (x.spk_nomor = d.lld_spk_nomor)
       WHERE d.lld_llh_nomor = ?
       ORDER BY d.lld_spk_nomor`;
    const [rows] = await pool.query(sql, [nomor]);
    return rows;
  } catch (error) {
    throwDbError('Gagal mengambil detail LHK lipat spanduk di database', error);
  }
};

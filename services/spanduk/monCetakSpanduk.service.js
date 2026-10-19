const pool = require('../../config/db.config');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Delphi spanduk/ufrmbrowsemonitorcetak.pas — procedure loaddata (SQLMaster).
// Monitoring Cetak Spanduk: agregat per SPK (spk_divisi = 1) pada periode LHK,
// dikelompokkan per pabrik cetak (P01/P02 internal, P99 luar).
// Kolom: hari, TANGGAL, PERUSAHAAN, TANGGAL_SPK, DEADLINE, J_ORDER, NAMA_ORDER,
// SPK_NAMA, PANJANG, LEBAR, NOMER_SPK, Jml_ORDER, J_Meter, Kain, KURANG,
// J_LUAR, j_P01, j_P02, j_jumlah, m_P01, m_P02, m_jumlah.
exports.getBrowseList = async (startDate, endDate, perusahaan = '') => {
    try {
        const sql = `
            SELECT * FROM (
                SELECT get_hari(a.lch_tanggal) hari,
                    DATE_FORMAT(a.lch_tanggal, '%d-%m-%Y') TANGGAL,
                    b.spk_perush_kode PERUSAHAAN,
                    DATE_FORMAT(b.spk_tanggal, '%d-%m-%Y') TANGGAL_SPK,
                    DATE_FORMAT(b.spk_dateline, '%d-%m-%Y') DEADLINE,
                    b.spk_jo_kode J_ORDER,
                    jo_nama NAMA_ORDER,
                    b.SPK_NAMA,
                    b.spk_panjang PANJANG,
                    b.spk_lebar LEBAR,
                    b.spk_nomor NOMER_SPK,
                    b.spk_jumlah Jml_ORDER,
                    (IFNULL(b.spk_panjang, 0) * IFNULL(b.spk_jumlah, 0)) J_Meter,
                    b.spk_kain Kain,
                    (SUM(CASE WHEN lch_pab_kode = 'P99' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END) +
                     SUM(CASE WHEN lch_pab_kode IN ('P01', 'P02') THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END)) - b.spk_jumlah KURANG,
                    ROUND(SUM(CASE WHEN lch_pab_kode = 'P99' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END), 2) J_LUAR,
                    ROUND(SUM(CASE WHEN lch_pab_kode = 'P01' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END), 2) j_P01,
                    ROUND(SUM(CASE WHEN lch_pab_kode = 'P02' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END), 2) j_P02,
                    ROUND(SUM(CASE WHEN lch_pab_kode IN ('P01', 'P02') THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END), 2) j_jumlah,
                    SUM(CASE WHEN lch_pab_kode = 'P01' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END * IFNULL(b.spk_panjang, 0)) m_P01,
                    SUM(CASE WHEN lch_pab_kode = 'P02' THEN IFNULL(lcd_qty_cetak, 0) ELSE 0 END * IFNULL(b.spk_panjang, 0)) m_P02,
                    ROUND(SUM(CASE WHEN lch_pab_kode IN ('P01', 'P02') THEN IFNULL(lcd_qty_cetak, 0) * IFNULL(b.spk_panjang, 0) ELSE 0 END), 0) m_jumlah
                FROM (
                    SELECT a.*, b.*
                    FROM tlhk_cetak_hdr a
                    INNER JOIN tlhk_cetak_dtl b ON (lcd_lch_nomor = lch_nomor)
                    WHERE lch_tanggal BETWEEN ? AND ?
                ) a
                LEFT JOIN tspk b ON (spk_nomor = lcd_spk_nomor)
                LEFT JOIN tjenisorder ON (jo_kode = spk_jo_kode)
                WHERE spk_divisi = 1
                GROUP BY b.spk_nomor
            ) x
            WHERE PERUSAHAAN LIKE ?
            ORDER BY NOMER_SPK
        `;
        const params = [startDate, endDate, `%${perusahaan || ''}%`];
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring cetak spanduk di database', error);
    }
};

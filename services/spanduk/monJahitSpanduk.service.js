const pool = require('../../config/db.config');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Delphi spanduk/ufrmbrowsemonitorjahit.pas — loaddata (SQL verbatim).
exports.getBrowseList = async (startDate, endDate, perusahaan = '') => {
    try {
        const sql = `
            SELECT * FROM (
                SELECT get_hari(a.ljh_tanggal) hari,
                    DATE_FORMAT(a.ljh_tanggal, '%d-%m-%Y') TANGGAL,
                    b.spk_perush_kode PERUSAHAAN,
                    DATE_FORMAT(b.spk_tanggal, '%d-%m-%Y') TANGGAL_SPK,
                    DATE_FORMAT(b.spk_dateline, '%d-%m-%Y') DEADLINE,
                    spk_jo_kode J_ORDER, jo_nama NAMA_ORDER,
                    b.SPK_NAMA, b.spk_panjang PANJANG, b.spk_lebar LEBAR,
                    a.ljd_spk_nomor NOMER_SPK, b.spk_jumlah Jml_ORDER,
                    (IFNULL(b.spk_panjang, 0) * IFNULL(b.spk_jumlah, 0)) J_Meter,
                    b.spk_kain KAIN,
                    (SUM(CASE WHEN ljh_pab_kode IN ('P01', 'P02') THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END) +
                     SUM(CASE WHEN ljh_pab_kode = 'P99' THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END)) - b.spk_jumlah KURANG,
                    ROUND(SUM(CASE WHEN ljh_pab_kode = 'P01' THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END), 2) j_P01,
                    ROUND(SUM(CASE WHEN ljh_pab_kode = 'P02' THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END), 2) j_P02,
                    ROUND(SUM(CASE WHEN ljh_pab_kode IN ('P01', 'P02') THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END), 2) j_jumlah,
                    SUM(CASE WHEN ljh_pab_kode = 'P01' THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END * IFNULL(b.spk_panjang, 0)) m_P01,
                    SUM(CASE WHEN ljh_pab_kode = 'P02' THEN IFNULL(ljd_qty_jahit, 0) ELSE 0 END * IFNULL(b.spk_panjang, 0)) m_P02,
                    SUM(CASE WHEN ljh_pab_kode IN ('P01', 'P02') THEN IFNULL(ljd_qty_jahit, 0) * IFNULL(b.spk_panjang, 0) ELSE 0 END) m_jumlah
                FROM (
                    SELECT a.*, b.*
                    FROM tlhk_jahit_hdr a
                    INNER JOIN tlhk_jahit_dtl b ON (ljd_ljh_nomor = ljh_nomor)
                    WHERE ljh_tanggal BETWEEN ? AND ?
                ) a
                LEFT JOIN tspk b ON (spk_nomor = ljd_spk_nomor)
                LEFT JOIN tjenisorder ON (jo_kode = spk_jo_kode)
                WHERE spk_divisi = 1
                GROUP BY a.ljd_spk_nomor
            ) x
            WHERE PERUSAHAAN LIKE ?
            ORDER BY NOMER_SPK
        `;
        const params = [startDate, endDate, `%${perusahaan || ''}%`];
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring jahit spanduk di database', error);
    }
};

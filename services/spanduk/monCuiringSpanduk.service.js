const pool = require('../../config/db.config');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Delphi spanduk/ufrmbrowsemonitorcuiring.pas — loaddata (SQL verbatim).
exports.getBrowseList = async (startDate, endDate, perusahaan = '') => {
    try {
        const sql = `
            SELECT * FROM (
                SELECT get_hari(lqh_tanggal) hari,
                    DATE_FORMAT(a.lqh_tanggal, '%d-%m-%Y') tanggal,
                    b.spk_perush_kode perusahaan,
                    DATE_FORMAT(b.spk_tanggal, '%d-%m-%Y') TANGGAL_SPK,
                    DATE_FORMAT(b.spk_dateline, '%d-%m-%Y') DEADLINE,
                    b.SPK_NAMA, b.spk_panjang PANJANG, b.spk_lebar LEBAR,
                    a.lqd_spk_nomor NOMER_SPK, b.spk_jumlah J_ORDER,
                    (IFNULL(b.spk_panjang, 0) * IFNULL(b.spk_jumlah, 0)) j_meter,
                    b.spk_kain KAIN,
                    b.spk_jumlah - IFNULL(lqd_j_koli, 0) kurang_koli,
                    b.spk_jumlah - IFNULL(lqd_j_oven, 0) kurang_oven,
                    b.spk_jumlah - IFNULL(lqd_j_jemuran, 0) kurang_jemuran,
                    b.spk_jumlah - IFNULL(lqd_j_potong, 0) kurang_potong,
                    ROUND(IFNULL(lqd_j_koli, 0), 0) KOLI,
                    ROUND(IFNULL(lqd_j_oven, 0), 0) OVEN,
                    ROUND(IFNULL(lqd_j_jemuran, 0), 0) JEMURAN,
                    ROUND(IFNULL(lqd_j_potong, 0), 0) POTONG,
                    IFNULL(lqd_j_koli, 0) * IFNULL(b.spk_panjang, 0) meter_koli,
                    IFNULL(lqd_j_oven, 0) * IFNULL(b.spk_panjang, 0) meter_oven
                FROM (
                    SELECT lqh_tanggal, lqh_pab_kode, lqd_spk_nomor,
                        SUM(IFNULL(lqd_j_koli, 0)) lqd_j_koli,
                        SUM(IFNULL(lqd_j_oven, 0)) lqd_j_oven,
                        SUM(IFNULL(lqd_j_jemuran, 0)) lqd_j_jemuran,
                        SUM(IFNULL(lqd_j_potong, 0)) lqd_j_potong
                    FROM tlhk_quiring_hdr a
                    INNER JOIN tlhk_quiring_dtl b ON (lqd_lqh_nomor = lqh_nomor)
                    WHERE lqh_tanggal BETWEEN ? AND ?
                    GROUP BY lqh_pab_kode, lqd_spk_nomor
                ) a
                LEFT JOIN tspk b ON (spk_nomor = lqd_spk_nomor)
            ) x
            WHERE perusahaan LIKE ?
            ORDER BY NOMER_SPK
        `;
        const params = [startDate, endDate, `%${perusahaan || ''}%`];
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring cuiring spanduk di database', error);
    }
};

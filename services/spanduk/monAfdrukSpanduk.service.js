const pool = require('../../config/db.config');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

const SPK_UNION = `
    (SELECT spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar, spk_jo_kode, spk_kain
     FROM tspk WHERE spk_divisi IN (1, 5)
     UNION ALL
     SELECT mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar, mspk_jo_kode, mspk_kain
     FROM tmemospk WHERE mspk_divisi IN (1, 5)) a
`;

// Delphi spanduk/ufrmbrowsemonitorafdruk.pas — loaddata (SQL verbatim).
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const sql = `
            SELECT get_hari(lah_tanggal) hari,
                DATE_FORMAT(lah_tanggal, '%d-%m-%Y') tanggal,
                spk_nama, spk_panjang, spk_lebar, spk_nomor,
                ROUND(CONCAT(qty_050), 2) qty_050,
                ROUND(CONCAT(qty_100), 2) qty_100,
                ROUND(CONCAT(qty_120), 2) qty_120,
                ROUND(CONCAT(qty_150), 2) qty_150,
                ROUND(CONCAT(qty_180), 2) qty_180,
                ROUND(CONCAT(qty_230), 2) qty_230,
                ROUND(CONCAT(qty_250), 2) qty_250,
                ROUND(CONCAT(qty_280), 2) qty_280,
                ROUND(CONCAT(qty_350), 2) qty_350,
                ROUND(CONCAT(qty_400), 2) qty_400,
                ROUND(CONCAT(qty_450), 2) qty_450,
                ROUND(CONCAT(qty_550), 2) qty_550,
                ROUND(CONCAT(qty_580), 2) qty_580,
                ROUND(CONCAT(qty_650), 2) qty_650,
                ROUND(CONCAT(qty_750), 2) qty_750,
                ROUND(CONCAT(qty_all), 2) qty_all,
                lad_j_plangkan jumlah_plangkan,
                lad_ulano, lad_screen, lad_lem, lad_katalis,
                meter_perhari
            FROM tlhk_afdruk_dtl
            INNER JOIN tlhk_afdruk_hdr ON (lad_lah_nomor = lah_nomor)
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lad_spk_nomor)
            LEFT JOIN (
                SELECT lad2_lah_nomor, lad2_spk_nomor,
                    SUM(IF(lad2_up_kode = 0.50, lad2_qty, 0)) qty_050,
                    SUM(IF(lad2_up_kode = 1, lad2_qty, 0)) qty_100,
                    SUM(IF(lad2_up_kode = 1.20, lad2_qty, 0)) qty_120,
                    SUM(IF(lad2_up_kode = 1.50, lad2_qty, 0)) qty_150,
                    SUM(IF(lad2_up_kode = 1.80, lad2_qty, 0)) qty_180,
                    SUM(IF(lad2_up_kode = 2.30, lad2_qty, 0)) qty_230,
                    SUM(IF(lad2_up_kode = 2.50, lad2_qty, 0)) qty_250,
                    SUM(IF(lad2_up_kode = 2.80, lad2_qty, 0)) qty_280,
                    SUM(IF(lad2_up_kode = 3.50, lad2_qty, 0)) qty_350,
                    SUM(IF(lad2_up_kode = 4, lad2_qty, 0)) qty_400,
                    SUM(IF(lad2_up_kode = 4.50, lad2_qty, 0)) qty_450,
                    SUM(IF(lad2_up_kode = 5.50, lad2_qty, 0)) qty_550,
                    SUM(IF(lad2_up_kode = 5.80, lad2_qty, 0)) qty_580,
                    SUM(IF(lad2_up_kode = 6.50, lad2_qty, 0)) qty_650,
                    SUM(IF(lad2_up_kode = 7.50, lad2_qty, 0)) qty_750,
                    SUM(lad2_qty) qty_all
                FROM tlhk_afdruk_dtl_2
                GROUP BY lad2_lah_nomor, lad2_spk_nomor
            ) b ON (lad2_lah_nomor = lah_nomor AND lad2_spk_nomor = lad_spk_nomor)
            LEFT JOIN (
                SELECT lah_tanggal lah_tanggal2, MAX(lad2_spk_nomor) spk,
                    SUM(lad2_up_kode * lad2_qty) meter_perhari
                FROM tlhk_afdruk_dtl_2
                INNER JOIN tlhk_afdruk_hdr ON (lah_nomor = lad2_lah_nomor)
                WHERE lah_tanggal BETWEEN ? AND ?
                GROUP BY 1
            ) x ON (lah_tanggal2 = lah_tanggal AND spk = spk_nomor)
            WHERE lah_tanggal BETWEEN ? AND ?
                AND lah_pab_kode = 'P02'
            ORDER BY 2, spk_nomor
        `;
        const [rows] = await pool.query(sql, [
            startDate,
            endDate,
            startDate,
            endDate,
        ]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring afdruk spanduk di database', error);
    }
};

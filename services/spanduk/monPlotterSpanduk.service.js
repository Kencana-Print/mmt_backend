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

// Delphi spanduk/ufrmbrowsemonitorplotter.pas — loaddata (SQL verbatim).
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const sql = `
            SELECT get_hari(lph_tanggal) hari, lph_tanggal tanggal,
                lpd_spk_nomor nomor_spk, spk_nama, spk_panjang panjang, spk_lebar lebar,
                lpd_j_meter j_meter, lpd_j_lembar j_lembar, lpd_j_totalmeter total_meter
            FROM tlhk_plotter_dtl
            INNER JOIN tlhk_plotter_hdr ON (lpd_lph_nomor = lph_nomor)
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lpd_spk_nomor)
            WHERE lph_tanggal BETWEEN ? AND ?
            ORDER BY tanggal, nomor_spk
        `;
        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring plotter spanduk di database', error);
    }
};

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

// Delphi spanduk/ufrmbrowsemonitorhapusplangkan.pas — loaddata (SQL verbatim).
// Catatan: hanya pabrik P02 (mengikuti Delphi).
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const sql = `
            SELECT get_hari(lhp_tanggal) hari,
                DATE_FORMAT(lhp_tanggal, '%d-%m-%Y') tanggal,
                spk_nama, spk_panjang, spk_lebar, spk_nomor,
                lhpd_jml_plangkan jplangkan,
                lhpd_ukuran ukuran,
                lhpd_ukuran * lhpd_jml_plangkan jumlahmeter,
                spk_panjang * lhpd_jml_plangkan jmeter,
                lhpd_rinso, lhpd_porstek, lhpd_m46,
                lhpd_kaporit, lhpd_caustik, lhpd_keterangan
            FROM tlhk_hapusplangkan_dtl
            INNER JOIN tlhk_hapusplangkan_hdr ON (lhp_nomor = lhpd_lhp_nomor)
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lhpd_spk_nomor)
            WHERE lhp_tanggal BETWEEN ? AND ?
                AND lhp_pab_kode = 'P02'
            ORDER BY 2
        `;
        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data monitoring hapus plangkan spanduk di database', error);
    }
};

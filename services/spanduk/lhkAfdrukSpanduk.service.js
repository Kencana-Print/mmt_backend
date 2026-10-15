const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK spanduk (tspk + tmemospk) — dipakai detail.
const SPK_UNION = `
    (SELECT spk_nomor, spk_nama, spk_jumlah,
        IFNULL(spk_panjang, 0) spk_panjang,
        IFNULL(spk_lebar, 0) spk_lebar
     FROM tspk
     UNION ALL
     SELECT mspk_nomor, mspk_nama, mspk_jumlah,
        IFNULL(mspk_panjang, 0) mspk_panjang,
        IFNULL(mspk_lebar, 0) mspk_lebar
     FROM tmemospk) x
`;

// Delphi UfrmBrowseHasilKerjaafdruk.btnRefreshClick.SQLMaster:
// Nomor/Tanggal/Kode_Pabrik/Nama_Pabrik/Kar_Borongan/Kar_Harian.
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT lah_nomor AS Nomor, lah_tanggal AS Tanggal,
                lah_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik,
                lah_jkar_borongan AS Kar_Borongan, lah_jkar_harian AS Kar_Harian
            FROM tlhk_afdruk_hdr
            LEFT JOIN tpabrik ON (pab_kode = lah_pab_kode)
            ${hasDateFilter ? 'WHERE lah_tanggal >= ? AND lah_tanggal <= ?' : ''}
            ORDER BY lah_nomor, lah_tanggal
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse hasil kerja afdruk di database', error);
    }
};

// Delphi UfrmBrowseHasilKerjaafdruk.btnRefreshClick.SQLDetail + filter nomor:
// Nomor_SPK/Nama_SPK/Jumlah_Order/Panjang/Lebar/J_Plangkan/Ulano/Screen.
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lad_lah_nomor AS Nomor, lad_spk_nomor AS Nomor_SPK,
                spk_nama AS Nama_SPK, spk_jumlah AS Jumlah_Order,
                spk_panjang AS Panjang, spk_lebar AS Lebar,
                lad_j_plangkan AS J_Plangkan, lad_ulano AS Ulano, lad_screen AS Screen
            FROM tlhk_afdruk_dtl
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lad_spk_nomor)
            WHERE lad_lah_nomor = ?
            ORDER BY 1
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail hasil kerja afdruk di database', error);
    }
};

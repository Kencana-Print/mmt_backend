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

// Delphi ufrmbrowsehasilkerjaplotter.pas btnRefreshClick.SQLMaster:
// Nomor/Tanggal/Kode_Pabrik/Nama_Pabrik.
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT lph_nomor AS Nomor, lph_tanggal AS Tanggal,
                lph_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik
            FROM tlhk_plotter_hdr
            LEFT JOIN tpabrik ON (pab_kode = lph_pab_kode)
            ${hasDateFilter ? 'WHERE lph_tanggal >= ? AND lph_tanggal <= ?' : ''}
            ORDER BY lph_nomor, lph_tanggal
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse hasil kerja plotter di database', error);
    }
};

// Delphi ufrmbrowsehasilkerjaplotter.pas btnRefreshClick.SQLDetail + filter nomor:
// Nomor_SPK/Nama_SPK/Jumlah_Order/Panjang/Lebar/J_Meter/J_Lembar/
// J_TotalMeter/J_PK/J_MK/J_Tinta/Keterangan.
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lpd_lph_nomor AS Nomor, lpd_spk_nomor AS Nomor_SPK,
                spk_nama AS Nama_SPK, spk_jumlah AS Jumlah_Order,
                spk_panjang AS Panjang, spk_lebar AS Lebar,
                lpd_j_meter AS J_Meter, lpd_j_lembar AS J_Lembar,
                lpd_j_totalmeter AS J_TotalMeter,
                lpd_j_pk AS J_PK, lpd_j_mk AS J_MK,
                lpd_j_totaltinta AS J_Tinta,
                lpd_keterangan AS Keterangan
            FROM tlhk_plotter_dtl
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lpd_spk_nomor)
            WHERE lpd_lph_nomor = ?
            ORDER BY lpd_lph_nomor
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail hasil kerja plotter di database', error);
    }
};

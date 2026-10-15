const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK spanduk (tspk + tmemospk) — Delphi
// UfrmBrowseHasilKerjaproof.btnRefreshClick.SQLDetail.
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

// Delphi UfrmBrowseHasilKerjaproof.btnRefreshClick.SQLMaster:
// lpr_nomor/lpr_tanggal/lpr_pab_kode/pab_nama (+ jkar live hdr).
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT lpr_nomor AS Nomor, lpr_tanggal AS Tanggal,
                lpr_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik,
                lpr_jkar_borongan AS Kar_Borongan, lpr_jkar_harian AS Kar_Harian
            FROM tlhk_proof_hdr
            LEFT JOIN tpabrik ON (pab_kode = lpr_pab_kode)
            ${hasDateFilter ? 'WHERE lpr_tanggal >= ? AND lpr_tanggal <= ?' : ''}
            ORDER BY lpr_nomor, lpr_tanggal
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse hasil kerja proof di database', error);
    }
};

// Delphi UfrmBrowseHasilKerjaproof.btnRefreshClick.SQLDetail + filter nomor:
// Nomor_SPK/Nama_SPK/Jumlah_Order/Panjang/Lebar/J_Plangkan/J_Proof/J_Meter.
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lprd_lpr_nomor AS Nomor, lprd_spk_nomor AS Nomor_SPK,
                spk_nama AS Nama_SPK, spk_jumlah AS Jumlah_Order,
                spk_panjang AS Panjang, spk_lebar AS Lebar,
                lprd_j_plangkan AS J_Plangkan,
                lprd_j_proof AS J_Proof, lprd_j_meter AS J_Meter
            FROM tlhk_proof_dtl
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lprd_spk_nomor)
            WHERE lprd_lpr_nomor = ?
            ORDER BY 1
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail hasil kerja proof di database', error);
    }
};

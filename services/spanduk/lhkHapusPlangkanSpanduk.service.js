const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK spanduk (tspk + tmemospk) — dipakai detail (Delphi SQLDetail).
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

// Delphi UfrmBrowseHasilKerjahapusplangkan.btnRefreshClick.SQLMaster:
// Nomor/Tanggal/Kode_Pabrik/Nama_Pabrik (master + tpabrik, tanpa agregat).
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT lhp_nomor AS Nomor, lhp_tanggal AS Tanggal,
                lhp_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik
            FROM tlhk_hapusplangkan_hdr
            LEFT JOIN tpabrik ON (pab_kode = lhp_pab_kode)
            ${hasDateFilter ? 'WHERE lhp_tanggal >= ? AND lhp_tanggal <= ?' : ''}
            ORDER BY lhp_nomor, lhp_tanggal
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse hasil kerja hapus plangkan di database', error);
    }
};

// Delphi UfrmBrowseHasilKerjahapusplangkan.btnRefreshClick.SQLDetail + filter nomor:
// Nomor_SPK/Nama_SPK/Jumlah_Order/Panjang/Lebar/J_Plangkan/J_Meter/Ukuran/
// Jumlah_Meter/Rinso/Porstek/M46/Kaporit/Caustik/Keterangan.
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lhpd_lhp_nomor AS Nomor, lhpd_spk_nomor AS Nomor_SPK,
                spk_nama AS Nama_SPK, spk_jumlah AS Jumlah_Order,
                spk_panjang AS Panjang, spk_lebar AS Lebar,
                lhpd_jml_plangkan AS J_Plangkan,
                lhpd_jumlahmeter AS J_Meter,
                lhpd_ukuran AS Ukuran,
                lhpd_ukuran * lhpd_jml_plangkan AS Jumlah_Meter,
                lhpd_rinso AS Rinso, lhpd_porstek AS Porstek,
                lhpd_m46 AS M46, lhpd_kaporit AS Kaporit,
                lhpd_caustik AS Caustik, lhpd_keterangan AS Keterangan
            FROM tlhk_hapusplangkan_dtl
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lhpd_spk_nomor)
            WHERE lhpd_lhp_nomor = ?
            ORDER BY 1, lhpd_nourut
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail hasil kerja hapus plangkan di database', error);
    }
};

const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK spanduk (tspk + tmemospk) — dipakai master (jmeter) & detail.
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

// Delphi UfrmBrowseHasilKerjaCetak.btnRefreshClick.SQLMaster:
// Nomor/Tanggal/Kode_Pabrik/Nama_Pabrik/Kar_Borongan/Kar_Harian/Jml_Meter.
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT lch_nomor AS Nomor, lch_tanggal AS Tanggal,
                lch_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik,
                lch_jkar_borongan AS Kar_Borongan, lch_jkar_harian AS Kar_Harian,
                xx.jmeter AS Jml_Meter
            FROM tlhk_cetak_hdr
            LEFT JOIN tpabrik ON (pab_kode = lch_pab_kode)
            LEFT JOIN (
                SELECT lcd_lch_nomor AS XNomor,
                    SUM(lcd_qty_cetak * spk_panjang) AS jmeter
                FROM tlhk_cetak_dtl
                LEFT JOIN ${SPK_UNION} ON (spk_nomor = lcd_spk_nomor)
                GROUP BY 1
            ) xx ON (XNomor = lch_nomor)
            ${hasDateFilter ? 'WHERE lch_tanggal >= ? AND lch_tanggal <= ?' : ''}
            ORDER BY lch_nomor, lch_tanggal
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse hasil kerja cetak di database', error);
    }
};

// Delphi UfrmBrowseHasilKerjaCetak.btnRefreshClick.SQLDetail + filter nomor:
// Nomor_SPK/Nama_SPK/Jumlah_Order/Panjang/Lebar/Qty_Cetak/Jml_Plangkan.
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lcd_lch_nomor AS Nomor, lcd_spk_nomor AS Nomor_SPK,
                spk_nama AS Nama_SPK, spk_jumlah AS Jumlah_Order,
                spk_panjang AS Panjang, spk_lebar AS Lebar,
                lcd_qty_cetak AS Qty_Cetak, lcd_qty_plangkan AS Jml_Plangkan
            FROM tlhk_cetak_dtl
            LEFT JOIN ${SPK_UNION} ON (spk_nomor = lcd_spk_nomor)
            WHERE lcd_lch_nomor = ?
            ORDER BY 1
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail hasil kerja cetak di database', error);
    }
};

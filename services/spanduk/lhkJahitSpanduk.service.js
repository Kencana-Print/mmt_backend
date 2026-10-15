const pool = require('../../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

const fmtDate = (v) => {
    try {
        return v ? format(new Date(v), 'yyyy-MM-dd') : v;
    } catch { return v; }
};

// SQL master browse: tlhk_jahit_hdr + tpabrik + agregat detail per nomor.
// (Delphi ufrmBrowseHasilKerjaJahit.btnRefreshClick SQLMaster + agregat pola
//  UfrmBrowseHasilKerjaCetak: SUM qty jahit per nomor sebagai Jml_Jahit.)
const MASTER_SELECT = `
    SELECT h.ljh_nomor AS Nomor, h.ljh_tanggal AS Tanggal,
        h.ljh_pab_kode AS Kode_Pabrik, p.pab_nama AS Nama_Pabrik,
        h.ljh_jkar_borongan AS Kar_Borongan, h.ljh_jkar_harian AS Kar_Harian,
        IFNULL(xx.Jml_Jahit, 0) AS Jml_Jahit,
        IFNULL(xx.Jml_Tambah_Jahit, 0) AS Jml_Tambah_Jahit,
        IFNULL(xx.Jml_Tambah_Tali, 0) AS Jml_Tambah_Tali,
        IFNULL(xx.Jml_SPK, 0) AS Jml_SPK
    FROM tlhk_jahit_hdr h
    LEFT JOIN tpabrik p ON (p.pab_kode = h.ljh_pab_kode)
    LEFT JOIN (
        SELECT ljd_ljh_nomor AS XNomor,
            SUM(ljd_qty_jahit) AS Jml_Jahit,
            SUM(ljd_tambah_jahit) AS Jml_Tambah_Jahit,
            SUM(ljd_tambah_tali) AS Jml_Tambah_Tali,
            COUNT(*) AS Jml_SPK
        FROM tlhk_jahit_dtl
        GROUP BY 1
    ) xx ON (xx.XNomor = h.ljh_nomor)
`;

// SQL detail: tlhk_jahit_dtl + union tspk/tmemospk (Delphi SQLDetail verbatim).
const DETAIL_SELECT = `
    SELECT d.ljd_ljh_nomor AS Nomor, d.ljd_spk_nomor AS Nomor_SPK,
        x.spk_nama AS Nama_SPK, x.spk_jumlah AS Jumlah_Order,
        x.spk_panjang AS Panjang, x.spk_lebar AS Lebar,
        d.ljd_qty_jahit AS Qty_Jahit,
        d.ljd_tambah_jahit AS Tambah_Jahit,
        d.ljd_tambah_tali AS Tambah_Tali
    FROM tlhk_jahit_dtl d
    LEFT JOIN (
        SELECT spk_nomor, spk_nama, spk_jumlah,
            IFNULL(spk_panjang, 0) spk_panjang,
            IFNULL(spk_lebar, 0) spk_lebar
        FROM tspk
        UNION ALL
        SELECT mspk_nomor, mspk_nama, mspk_jumlah,
            IFNULL(mspk_panjang, 0) mspk_panjang,
            IFNULL(mspk_lebar, 0) mspk_lebar
        FROM tmemospk
    ) x ON (x.spk_nomor = d.ljd_spk_nomor)
`;

/**
 * Browse master LHK Jahit Spanduk.
 * Guard: tanggal kosong = tanpa filter tanggal (JANGAN pakai zero-date
 * seperti '0000-00-00' yang meledak di MySQL strict mode).
 */
exports.getBrowseList = async (startDate, endDate) => {
    try {
        let sql = MASTER_SELECT;
        const params = [];
        // Hanya tambah filter tanggal bila keduanya terisi.
        if (startDate && endDate) {
            sql += ` WHERE h.ljh_tanggal >= ? AND h.ljh_tanggal <= ?`;
            params.push(startDate, endDate);
        }
        sql += ` ORDER BY h.ljh_nomor, h.ljh_tanggal`;
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = fmtDate(item.Tanggal);
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil browse LHK jahit spanduk di database', error);
    }
};

/**
 * Detail LHK Jahit Spanduk per nomor.
 */
exports.getDetail = async (nomor) => {
    try {
        const sql = DETAIL_SELECT + ` WHERE d.ljd_ljh_nomor = ? ORDER BY 1`;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail LHK jahit spanduk di database', error);
    }
};

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

// ---------------------------------------------------------------------------
// FORM INPUT/SAVE (cermin Delphi ufrmHasilKerjaJahit.simpandata + getmaxkode)
// ---------------------------------------------------------------------------
const NOMERATOR = 'LHK-J';

const pad4 = (n) => String(10000 + n).slice(-4);

const yymmOf = (tanggal) => {
    try {
        return format(new Date(tanggal), 'yyMM');
    } catch { return format(new Date(), 'yyMM'); }
};

/**
 * Penomoran Delphi getmaxkode:
 *   LHK-J.YYMM.NNNN  (NNNN = max 4 digit kanan + 1 per bulan tanggal dokumen)
 */
exports.generateNomor = async (tanggal) => {
    try {
        const yymm = yymmOf(tanggal || new Date());
        const prefix = `${NOMERATOR}.${yymm}.`;
        const [rows] = await pool.query(
            `SELECT MAX(RIGHT(ljh_nomor, 4)) AS maxNo FROM tlhk_jahit_hdr WHERE ljh_nomor LIKE ?`,
            [`${prefix}%`]
        );
        const maxNo = parseInt(rows[0]?.maxNo, 10);
        const next = Number.isFinite(maxNo) ? maxNo + 1 : 1;
        return `${prefix}${pad4(next)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK jahit spanduk di database', error);
    }
};

/**
 * Data form edit: header + details (detail memakai DETAIL_SELECT verbatim).
 */
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT h.ljh_nomor AS Nomor, h.ljh_tanggal AS Tanggal,
                h.ljh_pab_kode AS Kode_Pabrik, p.pab_nama AS Nama_Pabrik
             FROM tlhk_jahit_hdr h
             LEFT JOIN tpabrik p ON (p.pab_kode = h.ljh_pab_kode)
             WHERE h.ljh_nomor = ?`,
            [nomor]
        );
        if (!hdr.length) return null;
        if (hdr[0].Tanggal) hdr[0].Tanggal = fmtDate(hdr[0].Tanggal);
        const details = await exports.getDetail(nomor);
        return { header: hdr[0], details };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK jahit spanduk di database', error);
    }
};

/**
 * Simpan form: header upsert + hapus-insert details dalam transaksi.
 * Cermin Delphi simpandata (insert/update hdr, delete + insert dtl per SPK).
 *
 * SENGAJA DI-SKIP: tlhk_jahit_dtl_2 (rincian karyawan per SPK) — lihat GAP
 * di laporan. Tabel dtl_2 yang sudah ada TIDAK dihapus/diubah.
 */
exports.saveData = async (payload, userKode) => {
    const tanggal = payload?.tanggal;
    const pabKode = (payload?.pabKode || '').trim();
    const rawDetails = Array.isArray(payload?.details) ? payload.details : [];

    if (!tanggal) throw new Error('Tanggal wajib diisi.');
    if (!pabKode) throw new Error('Kode pabrik wajib diisi.');
    const details = rawDetails.filter((d) => (d?.spkNomor || '').trim() !== '');
    if (!details.length) throw new Error('Detail SPK minimal 1 baris.');
    const seen = new Set();
    for (const d of details) {
        const k = d.spkNomor.trim();
        if (seen.has(k)) throw new Error(`Nomor SPK ${k} duplikat (Delphi menolak uraian yang sama).`);
        seen.add(k);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        let nomor = (payload?.nomor || '').trim();
        const isEdit = !!nomor;

        if (!isEdit) {
            // Penomoran memakai YYMM dari tanggal dokumen (cermin getmaxkode).
            const yymm = yymmOf(tanggal);
            const prefix = `${NOMERATOR}.${yymm}.`;
            const [r] = await conn.query(
                `SELECT MAX(RIGHT(ljh_nomor, 4)) AS maxNo FROM tlhk_jahit_hdr WHERE ljh_nomor LIKE ? FOR UPDATE`,
                [`${prefix}%`]
            );
            const maxNo = parseInt(r[0]?.maxNo, 10);
            nomor = `${prefix}${pad4(Number.isFinite(maxNo) ? maxNo + 1 : 1)}`;
            await conn.query(
                `INSERT INTO tlhk_jahit_hdr
                 (ljh_nomor, ljh_tanggal, ljh_pab_kode, ljh_date_Create, ljh_user_create)
                 VALUES (?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, userKode || 'SYSTEM']
            );
        } else {
            const [exists] = await conn.query(
                `SELECT ljh_nomor FROM tlhk_jahit_hdr WHERE ljh_nomor = ? FOR UPDATE`,
                [nomor]
            );
            if (!exists.length) throw new Error(`Nomor ${nomor} tidak ditemukan.`);
            await conn.query(
                `UPDATE tlhk_jahit_hdr SET ljh_tanggal = ?, ljh_pab_kode = ?,
                 ljh_Date_modified = CURDATE(), ljh_user_modified = ?
                 WHERE ljh_nomor = ?`,
                [tanggal, pabKode, userKode || 'SYSTEM', nomor]
            );
            await conn.query(`DELETE FROM tlhk_jahit_dtl WHERE ljd_ljh_nomor = ?`, [nomor]);
        }

        for (const d of details) {
            await conn.query(
                `INSERT INTO tlhk_jahit_dtl
                 (ljd_ljh_nomor, ljd_spk_nomor, ljd_qty_jahit, ljd_tambah_jahit, ljd_tambah_tali)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    nomor,
                    d.spkNomor.trim(),
                    parseInt(d.qtyJahit, 10) || 0,
                    parseFloat(d.tambahJahit) || 0,
                    parseInt(d.tambahTali, 10) || 0,
                ]
            );
        }

        await conn.commit();
        return { nomor, isEdit };
    } catch (error) {
        try { await conn.rollback(); } catch { /* abaikan */ }
        throw new Error(`Gagal menyimpan LHK jahit spanduk: ${error.message}`);
    } finally {
        conn.release();
    }
};

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

// Delphi UfrmHasilKerjaCetak.getmaxkode — NOMERATOR 'LHK-C', format LHK-C.yymm.NNNN.
exports.generateNomor = async (tanggal) => {
    try {
        const d = tanggal ? new Date(tanggal) : new Date();
        const prefix = `LHK-C.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
        const [rows] = await pool.query(
            'SELECT MAX(RIGHT(lch_nomor, 4)) AS maxseq FROM tlhk_cetak_hdr WHERE lch_nomor LIKE ?',
            [`${prefix}%`]
        );
        const seq = parseInt(rows[0]?.maxseq, 10);
        const next = Number.isNaN(seq) ? 1 : seq + 1;
        return `${prefix}${String(10000 + next).slice(-4)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK cetak di database', error);
    }
};

// Form edit: header + details (cermin Delphi loaddata, tanpa dtl_2 karyawan).
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT lch_nomor, lch_tanggal, lch_pab_kode, pab_nama,
                lch_jkar_borongan, lch_jkar_harian
             FROM tlhk_cetak_hdr
             LEFT JOIN tpabrik ON (pab_kode = lch_pab_kode)
             WHERE lch_nomor = ?`,
            [nomor]
        );
        if (!hdr.length) return null;
        const header = hdr[0];
        if (header.lch_tanggal) header.lch_tanggal = format(new Date(header.lch_tanggal), 'yyyy-MM-dd');
        const [details] = await pool.query(
            `SELECT lcd_spk_nomor AS spk_nomor, spk_nama,
                spk_jumlah AS spk_jumlah, spk_panjang, spk_lebar,
                lcd_qty_cetak AS qty_cetak, lcd_qty_plangkan AS qty_plangkan
             FROM tlhk_cetak_dtl
             LEFT JOIN ${SPK_UNION} ON (spk_nomor = lcd_spk_nomor)
             WHERE lcd_lch_nomor = ?
             ORDER BY 1`,
            [nomor]
        );
        return { header, details };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK cetak di database', error);
    }
};

// Delphi UfrmHasilKerjaCetak.simpandata — header upsert + hapus-insert details.
// dtl_2 (karyawan/absensi) SENGAJA DI-SKIP, lihat GAP di laporan.
exports.saveData = async (payload, userKode = 'SYSTEM') => {
    const conn = await pool.getConnection();
    try {
        const tanggal = payload.tanggal || format(new Date(), 'yyyy-MM-dd');
        const pabKode = payload.pab_kode || '';
        const jBorongan = parseInt(payload.jkar_borongan, 10) || 0;
        const jHarian = parseInt(payload.jkar_harian, 10) || 0;
        const details = Array.isArray(payload.details)
            ? payload.details.filter((d) => d && String(d.spk_nomor || '').trim() !== '')
            : [];
        if (!details.length) throw new Error('Detail SPK minimal 1 baris.');

        await conn.beginTransaction();

        let nomor = String(payload.nomor || '').trim();
        if (nomor) {
            const [exists] = await conn.query('SELECT lch_nomor FROM tlhk_cetak_hdr WHERE lch_nomor = ?', [nomor]);
            if (exists.length) {
                await conn.query(
                    `UPDATE tlhk_cetak_hdr SET lch_tanggal = ?, lch_pab_kode = ?,
                        lch_jkar_borongan = ?, lch_jkar_harian = ?,
                        lch_date_modified = CURDATE(), lch_user_modified = ?
                     WHERE lch_nomor = ?`,
                    [tanggal, pabKode, jBorongan, jHarian, userKode, nomor]
                );
            } else {
                await conn.query(
                    `INSERT INTO tlhk_cetak_hdr
                        (lch_nomor, lch_tanggal, lch_pab_kode, lch_jkar_borongan, lch_jkar_harian,
                         lch_date_Create, lch_user_create)
                     VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`,
                    [nomor, tanggal, pabKode, jBorongan, jHarian, userKode]
                );
            }
        } else {
            const d = new Date(tanggal);
            const prefix = `LHK-C.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
            const [rows] = await conn.query(
                'SELECT MAX(RIGHT(lch_nomor, 4)) AS maxseq FROM tlhk_cetak_hdr WHERE lch_nomor LIKE ? FOR UPDATE',
                [`${prefix}%`]
            );
            const seq = parseInt(rows[0]?.maxseq, 10);
            nomor = `${prefix}${String(10000 + (Number.isNaN(seq) ? 1 : seq + 1)).slice(-4)}`;
            await conn.query(
                `INSERT INTO tlhk_cetak_hdr
                    (lch_nomor, lch_tanggal, lch_pab_kode, lch_jkar_borongan, lch_jkar_harian,
                     lch_date_Create, lch_user_create)
                 VALUES (?, ?, ?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, jBorongan, jHarian, userKode]
            );
        }

        await conn.query('DELETE FROM tlhk_cetak_dtl WHERE lcd_lch_nomor = ?', [nomor]);
        for (const dt of details) {
            await conn.query(
                `INSERT INTO tlhk_cetak_dtl
                    (lcd_lch_nomor, lcd_spk_nomor, lcd_qty_cetak, lcd_qty_plangkan)
                 VALUES (?, ?, ?, ?)`,
                [
                    nomor,
                    String(dt.spk_nomor).trim(),
                    parseInt(dt.qty_cetak, 10) || 0,
                    parseInt(dt.qty_plangkan, 10) || 0
                ]
            );
        }

        await conn.commit();
        return { nomor };
    } catch (error) {
        await conn.rollback();
        throw new Error(`Gagal menyimpan LHK cetak: ${error.message}`);
    } finally {
        conn.release();
    }
};

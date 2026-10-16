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

// Delphi ufrmhasilkerjaafdruk.getmaxkode — NOMERATOR 'LHK-A', format LHK-A.yymm.NNNN.
exports.generateNomor = async (tanggal) => {
    try {
        const d = tanggal ? new Date(tanggal) : new Date();
        const prefix = `LHK-A.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
        const [rows] = await pool.query(
            'SELECT MAX(RIGHT(lah_nomor, 4)) AS maxseq FROM tlhk_afdruk_hdr WHERE lah_nomor LIKE ?',
            [`${prefix}%`]
        );
        const seq = parseInt(rows[0]?.maxseq, 10);
        const next = Number.isNaN(seq) ? 1 : seq + 1;
        return `${prefix}${String(10000 + next).slice(-4)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK afdruk di database', error);
    }
};

// Form input/edit: header + details + rincian plangkan (cermin Delphi loaddata/loaddata2).
// lah_jkar_* / lah_team_id SENGAJA tidak dikelola (di Delphi juga dikomentari), lihat GAP laporan.
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT lah_nomor, lah_tanggal, lah_pab_kode, pab_nama
             FROM tlhk_afdruk_hdr
             LEFT JOIN tpabrik ON (pab_kode = lah_pab_kode)
             WHERE lah_nomor = ?`,
            [nomor]
        );
        if (!hdr.length) return null;
        const header = hdr[0];
        if (header.lah_tanggal) header.lah_tanggal = format(new Date(header.lah_tanggal), 'yyyy-MM-dd');
        const [details] = await pool.query(
            `SELECT lad_spk_nomor AS spk_nomor, spk_nama,
                spk_jumlah AS spk_jumlah, spk_panjang, spk_lebar,
                lad_j_plangkan AS j_plangkan, lad_ulano AS ulano,
                lad_screen AS screen, lad_lem AS lem, lad_katalis AS katalis
             FROM tlhk_afdruk_dtl
             LEFT JOIN ${SPK_UNION} ON (spk_nomor = lad_spk_nomor)
             WHERE lad_lah_nomor = ?
             ORDER BY 1`,
            [nomor]
        );
        const [details2] = await pool.query(
            `SELECT lad2_spk_nomor AS spk_nomor, lad2_up_kode AS up_kode, lad2_qty AS qty
             FROM tlhk_afdruk_dtl_2
             WHERE lad2_lah_nomor = ?
             ORDER BY 1, 2`,
            [nomor]
        );
        const [plangkan] = await pool.query(
            'SELECT up_uraian FROM tms_plangkan_2 ORDER BY up_uraian'
        );
        return { header, details, details2, plangkan: plangkan.map((r) => Number(r.up_uraian)) };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK afdruk di database', error);
    }
};

// Delphi ufrmhasilkerjaafdruk.simpandata — header upsert + hapus-insert dtl & dtl_2 transaksional.
// Delphi menyimpan up_uraian (DOUBLE ukuran plangkan) ke lad2_up_kode — diikuti di sini.
exports.saveData = async (payload = {}, userKode = 'SYSTEM') => {
    const conn = await pool.getConnection();
    try {
        const tanggal = payload.tanggal || format(new Date(), 'yyyy-MM-dd');
        const pabKode = String(payload.pab_kode || '').trim();
        if (!pabKode) throw new Error('Kode pabrik wajib diisi.');
        const details = Array.isArray(payload.details)
            ? payload.details.filter((d) => d && String(d.spk_nomor || '').trim() !== '')
            : [];
        if (!details.length) throw new Error('Detail SPK minimal 1 baris.');

        await conn.beginTransaction();

        let nomor = String(payload.nomor || '').trim();
        if (nomor) {
            const [exists] = await conn.query('SELECT lah_nomor FROM tlhk_afdruk_hdr WHERE lah_nomor = ?', [nomor]);
            if (exists.length) {
                await conn.query(
                    `UPDATE tlhk_afdruk_hdr SET lah_tanggal = ?, lah_pab_kode = ?,
                        lah_date_modified = CURDATE(), lah_user_modified = ?
                     WHERE lah_nomor = ?`,
                    [tanggal, pabKode, String(userKode), nomor]
                );
            } else {
                await conn.query(
                    `INSERT INTO tlhk_afdruk_hdr
                        (lah_nomor, lah_tanggal, lah_pab_kode, lah_date_Create, lah_user_create)
                     VALUES (?, ?, ?, CURDATE(), ?)`,
                    [nomor, tanggal, pabKode, String(userKode)]
                );
            }
        } else {
            const d = new Date(tanggal);
            const prefix = `LHK-A.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
            const [rows] = await conn.query(
                'SELECT MAX(RIGHT(lah_nomor, 4)) AS maxseq FROM tlhk_afdruk_hdr WHERE lah_nomor LIKE ? FOR UPDATE',
                [`${prefix}%`]
            );
            const seq = parseInt(rows[0]?.maxseq, 10);
            nomor = `${prefix}${String(10000 + (Number.isNaN(seq) ? 1 : seq + 1)).slice(-4)}`;
            await conn.query(
                `INSERT INTO tlhk_afdruk_hdr
                    (lah_nomor, lah_tanggal, lah_pab_kode, lah_date_Create, lah_user_create)
                 VALUES (?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, String(userKode)]
            );
        }

        await conn.query('DELETE FROM tlhk_afdruk_dtl WHERE lad_lah_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_afdruk_dtl_2 WHERE lad2_lah_nomor = ?', [nomor]);
        for (const dt of details) {
            const spkNomor = String(dt.spk_nomor).trim();
            await conn.query(
                `INSERT INTO tlhk_afdruk_dtl
                    (lad_lah_nomor, lad_spk_nomor, lad_j_plangkan, lad_ulano, lad_screen, lad_lem, lad_katalis)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    nomor,
                    spkNomor,
                    parseInt(dt.j_plangkan, 10) || 0,
                    Number(dt.ulano) || 0,
                    Number(dt.screen) || 0,
                    Number(dt.lem) || 0,
                    Number(dt.katalis) || 0
                ]
            );
            const rincian = Array.isArray(dt.plangkan) ? dt.plangkan : [];
            for (const r of rincian) {
                const qty = parseInt(r.qty, 10) || 0;
                if (qty > 0) {
                    await conn.query(
                        `INSERT INTO tlhk_afdruk_dtl_2
                            (lad2_lah_nomor, lad2_spk_nomor, lad2_up_kode, lad2_qty)
                         VALUES (?, ?, ?, ?)`,
                        [nomor, spkNomor, Number(r.up_kode) || 0, qty]
                    );
                }
            }
        }

        await conn.commit();
        return { nomor };
    } catch (error) {
        await conn.rollback();
        throw new Error(`Gagal menyimpan LHK afdruk: ${error.message}`);
    } finally {
        conn.release();
    }
};

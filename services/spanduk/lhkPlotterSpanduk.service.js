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

// Cermin Delphi ufrmhasilkerjaplotter.pas:
// NOMERATOR = 'LHK-P', getmaxkode: 'LHK-P.' + yymm(tanggal) + '.' + seq(4 digit,
// running per bulan; max(right(lph_nomor,4)) + 1, default 0001).
exports.generateNomor = async (tanggal, conn) => {
    try {
        const d = new Date(tanggal);
        if (isNaN(d.getTime())) throw new Error('Tanggal tidak valid.');
        const yymm =
            String(d.getFullYear()).slice(-2) +
            String(d.getMonth() + 1).padStart(2, '0');
        const prefix = `LHK-P.${yymm}.`;
        const q = conn || pool;
        const [rows] = await q.query(
            'SELECT MAX(RIGHT(lph_nomor, 4)) AS mx FROM tlhk_plotter_hdr WHERE lph_nomor LIKE ?',
            [`${prefix}%`]
        );
        const mx = rows[0] ? rows[0].mx : null;
        const seq = (mx === null || mx === '' ? 0 : parseInt(mx, 10)) + 1;
        return `${prefix}${String(10000 + seq).slice(-4)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK plotter di database', error);
    }
};

// Resolve 1 SPK spanduk (tspk + tmemospk) — autofill grid form.
// Delphi cxspk_nomorPropertiesButtonClick: jumlah/panjang/lebar dari tspk.
exports.resolveSpk = async (spkNomor) => {
    try {
        const [rows] = await pool.query(
            `SELECT spk_nomor, spk_nama, spk_jumlah,
                IFNULL(spk_panjang, 0) spk_panjang,
                IFNULL(spk_lebar, 0) spk_lebar
             FROM ${SPK_UNION} WHERE spk_nomor = ? LIMIT 1`,
            [spkNomor]
        );
        return rows[0] || null;
    } catch (error) {
        throwDbError('Gagal resolve SPK spanduk di database', error);
    }
};

// Data form (new/edit): header + details. Header null bila nomor tak ada.
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT lph_nomor AS Nomor, lph_tanggal AS Tanggal,
                lph_pab_kode AS Kode_Pabrik, pab_nama AS Nama_Pabrik
             FROM tlhk_plotter_hdr
             LEFT JOIN tpabrik ON (pab_kode = lph_pab_kode)
             WHERE lph_nomor = ?`,
            [nomor]
        );
        const header = hdr[0] || null;
        if (header && header.Tanggal) {
            header.Tanggal = format(new Date(header.Tanggal), 'yyyy-MM-dd');
        }
        const details = await exports.getDetail(nomor);
        return { header, details };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK plotter di database', error);
    }
};

// Cermin Delphi simpandata: header insert (nomor baru via generateNomor) /
// update + delete-insert details transaksional. Karyawan/absensi TIDAK ditulis
// (di Delphi blok absensi sudah di-comment-out).
// payload: { nomor?, tanggal('yyyy-MM-dd'), pab_kode, details:[{spk_nomor,
//   j_meter, j_lembar, j_totalmeter, j_pk, j_mk, j_totaltinta, keterangan}] }
exports.saveData = async (payload, userKode) => {
    const user = (userKode || 'SYSTEM').substring(0, 20);
    const tanggal = payload.tanggal;
    const pabKode = (payload.pab_kode || '').trim();
    const rawDetails = Array.isArray(payload.details) ? payload.details : [];
    const details = rawDetails.filter((d) => d && String(d.spk_nomor || '').trim() !== '');

    if (!tanggal || isNaN(new Date(tanggal).getTime())) {
        throw new Error('Tanggal wajib diisi dengan format valid.');
    }
    if (!pabKode) throw new Error('Kode pabrik wajib diisi.');
    if (details.length === 0) throw new Error('Detail SPK minimal 1 baris.');
    const seen = new Set();
    for (const d of details) {
        const k = String(d.spk_nomor).trim();
        if (seen.has(k)) throw new Error(`SPK ${k} duplikat (maks 1x per LHK).`);
        seen.add(k);
    }

    // Auto-kalkulasi cermin Delphi EditValueChanged:
    // j_totalmeter = j_meter*j_lembar (bila keduanya > 0),
    // j_totaltinta = j_pk*j_mk (bila keduanya > 0).
    const norm = details.map((d) => {
        const jm = Number(d.j_meter) || 0;
        const jl = Number(d.j_lembar) || 0;
        const pk = Number(d.j_pk) || 0;
        const mk = Number(d.j_mk) || 0;
        return {
            spk_nomor: String(d.spk_nomor).trim(),
            j_meter: jm,
            j_lembar: jl,
            j_totalmeter: jm > 0 && jl > 0 ? jm * jl : Number(d.j_totalmeter) || 0,
            j_pk: pk,
            j_mk: mk,
            j_totaltinta: pk > 0 && mk > 0 ? pk * mk : Number(d.j_totaltinta) || 0,
            keterangan: String(d.keterangan || '').substring(0, 200)
        };
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        let nomor = (payload.nomor || '').trim();

        if (nomor) {
            const [ex] = await conn.query(
                'SELECT lph_nomor FROM tlhk_plotter_hdr WHERE lph_nomor = ?',
                [nomor]
            );
            if (ex.length === 0) throw new Error(`LHK ${nomor} tidak ditemukan.`);
            await conn.query(
                `UPDATE tlhk_plotter_hdr SET lph_tanggal = ?, lph_pab_kode = ?,
                 lph_date_modified = CURDATE(), lph_user_modified = ?
                 WHERE lph_nomor = ?`,
                [tanggal, pabKode, user, nomor]
            );
        } else {
            nomor = await exports.generateNomor(tanggal, conn);
            await conn.query(
                `INSERT INTO tlhk_plotter_hdr
                 (lph_nomor, lph_tanggal, lph_pab_kode, lph_date_Create, lph_user_create)
                 VALUES (?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, user]
            );
        }

        await conn.query('DELETE FROM tlhk_plotter_dtl WHERE lpd_lph_nomor = ?', [nomor]);
        if (norm.length > 0) {
            const vals = norm.map((d) => [
                nomor, d.spk_nomor, d.j_meter, d.j_lembar, d.j_totalmeter,
                d.j_pk, d.j_mk, d.j_totaltinta, d.keterangan
            ]);
            await conn.query(
                `INSERT INTO tlhk_plotter_dtl
                 (lpd_lph_nomor, lpd_spk_nomor, lpd_j_meter, lpd_j_lembar,
                  lpd_j_totalmeter, lpd_j_pk, lpd_j_mk, lpd_j_totaltinta, lpd_keterangan)
                 VALUES ?`,
                [vals]
            );
        }

        await conn.commit();
        return { nomor };
    } catch (error) {
        await conn.rollback();
        if (error.message && !error.message.includes(':')) throw error;
        throwDbError('Gagal menyimpan LHK plotter di database', error);
    } finally {
        conn.release();
    }
};

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

// Delphi UfrmHasilKerjaproof.getmaxkode — NOMERATOR 'LHK-PR',
// format LHK-PR.YYMM.NNNN (NNNN = max 4 digit kanan + 1 per YYMM tanggal).
const NOMERATOR = 'LHK-PR';

const pad4 = (n) => String(10000 + n).slice(-4);

const yymmOf = (tanggal) => {
    try {
        const d = new Date(tanggal);
        if (Number.isNaN(d.getTime())) return format(new Date(), 'yyMM');
        return format(d, 'yyMM');
    } catch { return format(new Date(), 'yyMM'); }
};

exports.generateNomor = async (tanggal) => {
    try {
        const prefix = `${NOMERATOR}.${yymmOf(tanggal || new Date())}.`;
        const [rows] = await pool.query(
            'SELECT MAX(RIGHT(lpr_nomor, 4)) AS maxNo FROM tlhk_proof_hdr WHERE lpr_nomor LIKE ?',
            [`${prefix}%`]
        );
        const maxNo = parseInt(rows[0]?.maxNo, 10);
        return `${prefix}${pad4(Number.isFinite(maxNo) ? maxNo + 1 : 1)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK proof di database', error);
    }
};

// Form edit: header + details (cermin Delphi loaddata — join union tspk/
// tmemospk untuk Nama_SPK/Order/Panjang/Lebar + kolom simpan j/u1-u7).
// Endpoint browse/detail di atas TIDAK diubah.
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT lpr_nomor, lpr_tanggal, lpr_pab_kode, pab_nama
             FROM tlhk_proof_hdr
             LEFT JOIN tpabrik ON (pab_kode = lpr_pab_kode)
             WHERE lpr_nomor = ?`,
            [nomor]
        );
        if (!hdr.length) return null;
        const header = hdr[0];
        if (header.lpr_tanggal) header.lpr_tanggal = format(new Date(header.lpr_tanggal), 'yyyy-MM-dd');
        const [details] = await pool.query(
            `SELECT lprd_spk_nomor AS spk_nomor, spk_nama,
                spk_jumlah AS spk_jumlahorder, spk_panjang, spk_lebar,
                lprd_j_plangkan AS j_plangkan, lprd_j_proof AS j_proof,
                lprd_j_meter AS j_meter,
                lprd_u1 AS u1, lprd_u2 AS u2, lprd_u3 AS u3, lprd_u4 AS u4,
                lprd_u5 AS u5, lprd_u6 AS u6, lprd_u7 AS u7
             FROM tlhk_proof_dtl
             LEFT JOIN ${SPK_UNION} ON (spk_nomor = lprd_spk_nomor)
             WHERE lprd_lpr_nomor = ?
             ORDER BY 1`,
            [nomor]
        );
        return { header, details };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK proof di database', error);
    }
};

// Delphi UfrmHasilKerjaproof.simpandata — header upsert + hapus-insert
// details dalam satu transaksi.
// SENGAJA DI-SKIP (lihat GAP laporan):
//  - tlhk_proof_dtl_2 (rincian qty per jenis plangkan, 2093 baris live)
//    TIDAK dihapus/diubah;
//  - lpr_jkar_borongan/harian TIDAK ditulis (Delphi meng-comment-nya,
//    live NULL) — form web tidak menyentuh kolom tsb.
exports.saveData = async (payload, userKode = 'SYSTEM') => {
    const conn = await pool.getConnection();
    try {
        const tanggal = payload?.tanggal || '';
        const pabKode = String(payload?.pab_kode || '').trim();
        const details = Array.isArray(payload?.details)
            ? payload.details.filter((d) => d && String(d.spk_nomor || '').trim() !== '')
            : [];
        if (!tanggal) throw new Error('Tanggal wajib diisi.');
        if (!pabKode) throw new Error('Kode pabrik wajib diisi.');
        if (!details.length) throw new Error('Detail SPK minimal 1 baris.');
        const seen = new Set();
        for (const d of details) {
            const k = String(d.spk_nomor).trim();
            if (seen.has(k)) throw new Error(`Nomor SPK ${k} duplikat (Delphi menolak uraian yang sama).`);
            seen.add(k);
        }

        await conn.beginTransaction();

        let nomor = String(payload?.nomor || '').trim();
        if (nomor) {
            const [exists] = await conn.query(
                'SELECT lpr_nomor FROM tlhk_proof_hdr WHERE lpr_nomor = ? FOR UPDATE',
                [nomor]
            );
            if (!exists.length) throw new Error(`Nomor ${nomor} tidak ditemukan.`);
            await conn.query(
                `UPDATE tlhk_proof_hdr SET lpr_tanggal = ?, lpr_pab_kode = ?,
                    lpr_date_modified = CURDATE(), lpr_user_modified = ?
                 WHERE lpr_nomor = ?`,
                [tanggal, pabKode, userKode, nomor]
            );
            await conn.query('DELETE FROM tlhk_proof_dtl WHERE lprd_lpr_nomor = ?', [nomor]);
        } else {
            const prefix = `${NOMERATOR}.${yymmOf(tanggal)}.`;
            const [rows] = await conn.query(
                'SELECT MAX(RIGHT(lpr_nomor, 4)) AS maxNo FROM tlhk_proof_hdr WHERE lpr_nomor LIKE ? FOR UPDATE',
                [`${prefix}%`]
            );
            const maxNo = parseInt(rows[0]?.maxNo, 10);
            nomor = `${prefix}${pad4(Number.isFinite(maxNo) ? maxNo + 1 : 1)}`;
            await conn.query(
                `INSERT INTO tlhk_proof_hdr
                    (lpr_nomor, lpr_tanggal, lpr_pab_kode, lpr_date_Create, lpr_user_create)
                 VALUES (?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, userKode]
            );
        }

        for (const d of details) {
            await conn.query(
                `INSERT INTO tlhk_proof_dtl
                    (lprd_lpr_nomor, lprd_spk_nomor, lprd_j_plangkan, lprd_j_proof, lprd_j_meter,
                     lprd_u1, lprd_u2, lprd_u3, lprd_u4, lprd_u5, lprd_u6, lprd_u7)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nomor,
                    String(d.spk_nomor).trim(),
                    parseInt(d.j_plangkan, 10) || 0,
                    parseInt(d.j_proof, 10) || 0,
                    parseFloat(d.j_meter) || 0,
                    String(d.u1 ?? ''), String(d.u2 ?? ''), String(d.u3 ?? ''),
                    String(d.u4 ?? ''), String(d.u5 ?? ''), String(d.u6 ?? ''),
                    String(d.u7 ?? '')
                ]
            );
        }

        await conn.commit();
        return { nomor };
    } catch (error) {
        try { await conn.rollback(); } catch { /* abaikan */ }
        throw new Error(`Gagal menyimpan LHK proof: ${error.message}`);
    } finally {
        conn.release();
    }
};

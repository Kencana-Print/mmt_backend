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

// Delphi UfrmHasilKerjahapusplangkan.getmaxkode — NOMERATOR 'LHK-HP',
// format LHK-HP.yymm.NNNN (yymm dari tanggal LHK, bukan tanggal hari ini).
exports.generateNomor = async (tanggal) => {
    try {
        const d = tanggal ? new Date(tanggal) : new Date();
        const prefix = `LHK-HP.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
        const [rows] = await pool.query(
            'SELECT MAX(RIGHT(lhp_nomor, 4)) AS maxseq FROM tlhk_hapusplangkan_hdr WHERE lhp_nomor LIKE ?',
            [`${prefix}%`]
        );
        const seq = parseInt(rows[0]?.maxseq, 10);
        const next = Number.isNaN(seq) ? 1 : seq + 1;
        return `${prefix}${String(10000 + next).slice(-4)}`;
    } catch (error) {
        throwDbError('Gagal membuat nomor LHK hapus plangkan di database', error);
    }
};

// Form edit: header + details (cermin Delphi loaddata; bahan kimia
// rinso/porstek/m46/kaporit/caustik ada di DETAIL per SPK, bukan header).
exports.getFormDetail = async (nomor) => {
    try {
        const [hdr] = await pool.query(
            `SELECT lhp_nomor, lhp_tanggal, lhp_pab_kode, pab_nama
             FROM tlhk_hapusplangkan_hdr
             LEFT JOIN tpabrik ON (pab_kode = lhp_pab_kode)
             WHERE lhp_nomor = ?`,
            [nomor]
        );
        if (!hdr.length) return null;
        const header = hdr[0];
        if (header.lhp_tanggal) header.lhp_tanggal = format(new Date(header.lhp_tanggal), 'yyyy-MM-dd');
        const [details] = await pool.query(
            `SELECT lhpd_spk_nomor AS spk_nomor, spk_nama,
                 spk_jumlah AS spk_jumlahorder, spk_panjang, spk_lebar,
                 lhpd_jml_plangkan AS j_plangkan,
                 lhpd_rinso AS j_rinso, lhpd_porstek AS j_porstek,
                 lhpd_m46 AS j_m46, lhpd_kaporit AS j_kaporit,
                 lhpd_caustik AS j_caustik,
                 lhpd_ukuran AS ukuran, lhpd_jumlahmeter AS jumlahmeter,
                 lhpd_keterangan AS keterangan
             FROM tlhk_hapusplangkan_dtl
             LEFT JOIN ${SPK_UNION} ON (spk_nomor = lhpd_spk_nomor)
             WHERE lhpd_lhp_nomor = ?
             ORDER BY lhpd_nourut`,
            [nomor]
        );
        return { header, details };
    } catch (error) {
        throwDbError('Gagal mengambil data form LHK hapus plangkan di database', error);
    }
};

// Delphi UfrmHasilKerjahapusplangkan.simpandata — header upsert +
// hapus-insert details transaksional (lhpd_nourut = urutan baris 1..n).
// Karyawan/absensi + CDS2 (tlhk_afdruk_dtl_2) SENGAJA DI-SKIP: seluruh
// bloknya sudah di-comment di Delphi, bukan logika aktif.
exports.saveData = async (payload, userKode = 'SYSTEM') => {
    const conn = await pool.getConnection();
    try {
        const tanggal = payload.tanggal || format(new Date(), 'yyyy-MM-dd');
        const pabKode = payload.pab_kode || '';
        const details = Array.isArray(payload.details)
            ? payload.details.filter((d) => d && String(d.spk_nomor || '').trim() !== '')
            : [];
        if (!details.length) throw new Error('Detail SPK minimal 1 baris.');

        await conn.beginTransaction();

        let nomor = String(payload.nomor || '').trim();
        if (nomor) {
            const [exists] = await conn.query(
                'SELECT lhp_nomor FROM tlhk_hapusplangkan_hdr WHERE lhp_nomor = ?',
                [nomor]
            );
            if (exists.length) {
                await conn.query(
                    `UPDATE tlhk_hapusplangkan_hdr SET lhp_tanggal = ?, lhp_pab_kode = ?,
                         lhp_date_modified = CURDATE(), lhp_user_modified = ?
                     WHERE lhp_nomor = ?`,
                    [tanggal, pabKode, userKode, nomor]
                );
            } else {
                await conn.query(
                    `INSERT INTO tlhk_hapusplangkan_hdr
                         (lhp_nomor, lhp_tanggal, lhp_pab_kode, lhp_date_Create, lhp_user_create)
                     VALUES (?, ?, ?, CURDATE(), ?)`,
                    [nomor, tanggal, pabKode, userKode]
                );
            }
        } else {
            const d = new Date(tanggal);
            const prefix = `LHK-HP.${format(isNaN(d.getTime()) ? new Date() : d, 'yyMM')}.`;
            const [rows] = await conn.query(
                'SELECT MAX(RIGHT(lhp_nomor, 4)) AS maxseq FROM tlhk_hapusplangkan_hdr WHERE lhp_nomor LIKE ? FOR UPDATE',
                [`${prefix}%`]
            );
            const seq = parseInt(rows[0]?.maxseq, 10);
            nomor = `${prefix}${String(10000 + (Number.isNaN(seq) ? 1 : seq + 1)).slice(-4)}`;
            await conn.query(
                `INSERT INTO tlhk_hapusplangkan_hdr
                     (lhp_nomor, lhp_tanggal, lhp_pab_kode, lhp_date_Create, lhp_user_create)
                 VALUES (?, ?, ?, CURDATE(), ?)`,
                [nomor, tanggal, pabKode, userKode]
            );
        }

        await conn.query('DELETE FROM tlhk_hapusplangkan_dtl WHERE lhpd_lhp_nomor = ?', [nomor]);
        let nourut = 1;
        for (const dt of details) {
            await conn.query(
                `INSERT INTO tlhk_hapusplangkan_dtl
                     (lhpd_lhp_nomor, lhpd_spk_nomor, lhpd_jml_plangkan,
                      lhpd_rinso, lhpd_porstek, lhpd_m46, lhpd_kaporit, lhpd_caustik,
                      lhpd_keterangan, lhpd_ukuran, lhpd_jumlahmeter, lhpd_nourut)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nomor,
                    String(dt.spk_nomor).trim(),
                    parseInt(dt.j_plangkan, 10) || 0,
                    Number(dt.j_rinso) || 0,
                    Number(dt.j_porstek) || 0,
                    Number(dt.j_m46) || 0,
                    Number(dt.j_kaporit) || 0,
                    Number(dt.j_caustik) || 0,
                    String(dt.keterangan || ''),
                    Number(dt.ukuran) || 0,
                    Number(dt.jumlahmeter) || 0,
                    nourut++
                ]
            );
        }

        await conn.commit();
        return { nomor };
    } catch (error) {
        await conn.rollback();
        throw new Error(`Gagal menyimpan LHK hapus plangkan: ${error.message}`);
    } finally {
        conn.release();
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

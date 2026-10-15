const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil 10 antrean cetak (Reguler & Memo) yang belum selesai (Kurang_Cetak > 0)
 * Diurutkan berdasarkan deadline terdekat (Mepet)
 * Sesuai dengan skema database riil (tspk, tmemospk, tlhk_mesin_dtl)
 */
const getTopDeadlineCetak = async () => {
    const sql = `
        SELECT * FROM (
            /* --- ONLY SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS no_spk, 
                t.spk_nama AS nama_produk, 
                t.spk_jumlah AS qty_order,
                'PCS' AS unit, 
                t.spk_dateline AS tanggal_spk,
                t.spk_tanggal AS deadline_waktu, 
                TIMESTAMPDIFF(MINUTE, NOW(), t.spk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN (
                SELECT lcd_spk_nomor, SUM(lcd_qty_cetak) as total_pernah_cetak
                FROM tlhk_cetakmmt_dtl
                GROUP BY lcd_spk_nomor
            ) prod ON prod.lcd_spk_nomor = t.spk_nomor
            WHERE t.spk_close = 0 
              AND t.spk_aktif = 'Y'
              AND t.spk_tanggal >= '2026-04-01'
              AND t.spk_jo_kode = 'MT'
        ) AS antrean
        WHERE Kurang_Cetak > 0 -- Hanya ambil yang produksinya belum terpenuhi
        ORDER BY deadline_waktu ASC -- Menampilkan dari yang paling mendesak
        LIMIT 10
    `;

    try {
        const [rows] = await pool.query(sql);

        return rows.map(item => {
            let sisaWaktuText = '';
            const menit = item.menit_sisa;

            if (menit < 0) {
                const positifMenit = Math.abs(menit);
                if (positifMenit < 60) sisaWaktuText = `Lewat ${positifMenit} m`;
                else if (positifMenit < 1440) sisaWaktuText = `Lewat ${(positifMenit / 60).toFixed(1)} Jam`;
                else sisaWaktuText = `Lewat ${Math.floor(positifMenit / 1440)} Hari`;
            } else if (menit < 60) {
                sisaWaktuText = `${menit} Menit`;
            } else if (menit < 1440) {
                sisaWaktuText = `${(menit / 60).toFixed(1)} Jam`;
            } else {
                sisaWaktuText = `${Math.floor(menit / 1440)} Hari`;
            }

            return {
                no_spk: item.no_spk,
                nama_produk: item.nama_produk,
                qty: item.Kurang_Cetak,
                qty_order: item.qty_order,
                sudah_cetak: item.Sudah_Cetak,
                unit: item.unit,
                sisa_waktu: sisaWaktuText,
                menit_sisa: menit,
                tipe_spk: item.Tipe_SPK
            };
        });
    } catch (error) {
        throw new Error('Gagal memuat Top Deadline Cetak sesuai tabel SPK: ' + error.message);
    }
};

/**
 * Mengambil daftar bon/permintaan bahan baku produksi yang masih pending di gudang
 * Catatan: Jika Anda mempunya tabel tpermintaan_bahan, sesuaikan nama kolomnya di sini.
 */
const getPermintaanBahanPending = async () => {
    const sql = `
        SELECT * FROM (
            /* --- SECTION 1: PERMINTAAN PEMBELIAN MMT --- */
            SELECT 
                d.mbd_mb_nomor AS nomor_bon,
                TRIM(b.brg_nama) AS nama_bahan,
                'DIVISI MMT' AS divisi,
                d.mbd_qty AS qty_minta,
                d.mbd_brg_satuan AS unit,
                'PENDING' AS status_permintaan, -- Tetap PENDING untuk kebutuhan binding Vue
                h.mb_tanggal AS created_at
            FROM tmintabahan_mmt_dtl d
            INNER JOIN tmintabahan_mmt_hdr h ON d.mbd_mb_nomor = h.mb_nomor
            LEFT JOIN tbarang_mmt b ON d.mbd_brg_kode = b.brg_kode
            WHERE h.mb_acc = 'Y'                  -- Sudah di-ACC Manager (Siap diproses Finance)
              AND IFNULL(d.mbd_qty_po, 0) = 0     -- Tapi realisasi PO dari Finance masih kosong (0)

            UNION ALL

            /* --- SECTION 2: PERMINTAAN PEMBELIAN OBAT (WH-20) --- */
            SELECT 
                d.mbd_nomor AS nomor_bon,
                TRIM(t.brg_nama) AS nama_bahan,
                'GUDANG OBAT' AS divisi,
                d.mbd_jumlah AS qty_minta,
                'PCS' AS unit,
                'PENDING' AS status_permintaan, -- Tetap PENDING
                h.mb_tanggal AS created_at
            FROM tobatmintabeli_dtl d
            INNER JOIN tobatmintabeli_hdr h ON d.mbd_nomor = h.mb_nomor
            LEFT JOIN tgarmen_brg t ON d.mbd_o_kode = t.brg_kode
            WHERE h.mb_status = 'OPEN'            -- Masih antrean open di pembelian/finance
        ) AS combined_pending
        ORDER BY created_at ASC
        LIMIT 15
    `;

    try {
        const [rows] = await pool.query(sql);
        return rows;
    } catch (error) {
        throw new Error('Gagal memuat Dashboard (Permintaan Bahan Belum Terealisasi): ' + error.message);
    }
};

// Di Service / Controller Backend Anda
const getPermintaanBahanTotalFull = async () => {
    const sql = `
        SELECT * FROM (
            /* --- SECTION 1: PERMINTAAN PEMBELIAN MMT --- */
            SELECT 
                d.mbd_mb_nomor AS nomor_bon,
                TRIM(b.brg_nama) AS nama_bahan,
                'DIVISI MMT' AS divisi,
                d.mbd_qty AS qty_minta,
                d.mbd_brg_satuan AS unit,
                'PENDING' AS status_permintaan,
                h.mb_tanggal AS created_at
            FROM tmintabahan_mmt_dtl d
            INNER JOIN tmintabahan_mmt_hdr h ON d.mbd_mb_nomor = h.mb_nomor
            LEFT JOIN tbarang_mmt b ON d.mbd_brg_kode = b.brg_kode
            WHERE h.mb_acc = 'Y' AND IFNULL(d.mbd_qty_po, 0) = 0

            UNION ALL

            /* --- SECTION 2: PERMINTAAN PEMBELIAN OBAT (WH-20) --- */
            SELECT 
                d.mbd_nomor AS nomor_bon,
                TRIM(t.brg_nama) AS nama_bahan,
                'GUDANG OBAT' AS divisi,
                d.mbd_jumlah AS qty_minta,
                'PCS' AS unit,
                'PENDING' AS status_permintaan,
                h.mb_tanggal AS created_at
            FROM tobatmintabeli_dtl d
            INNER JOIN tobatmintabeli_hdr h ON d.mbd_nomor = h.mb_nomor
            LEFT JOIN tgarmen_brg t ON d.mbd_o_kode = t.brg_kode
            WHERE h.mb_status = 'OPEN'
        ) AS combined_pending
        ORDER BY created_at ASC 
        /* LIMIT 15 DIHAPUS SUPAYA MENAMPILKAN SEMUANYA */
    `;
    const [rows] = await pool.query(sql);
    return rows;
};

const getTopDeadlineCetakTotalFull = async () => {
    const sql = `
        SELECT * FROM (
            /* --- ONLY SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS no_spk, 
                t.spk_nama AS nama_produk, 
                t.spk_jumlah AS qty_order,
                'PCS' AS unit, 
                t.spk_dateline AS tanggal_spk,
                t.spk_tanggal AS deadline_waktu, 
                TIMESTAMPDIFF(MINUTE, NOW(), t.spk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN (
                SELECT lcd_spk_nomor, SUM(lcd_qty_cetak) as total_pernah_cetak
                FROM tlhk_cetakmmt_dtl
                GROUP BY lcd_spk_nomor
            ) prod ON prod.lcd_spk_nomor = t.spk_nomor
            WHERE t.spk_close = 0 
              AND t.spk_aktif = 'Y'
              AND t.spk_tanggal >= '2026-04-01'
              AND t.spk_jo_kode = 'MT'
        ) AS antrean
        WHERE Kurang_Cetak > 0 -- Hanya ambil yang produksinya belum terpenuhi
        ORDER BY deadline_waktu ASC -- Menampilkan dari yang paling mendesak
        /* LIMIT 10 DIHAPUS SUPAYA MENAMPILKAN SEMUANYA DI MODAL */
    `;

    try {
        const [rows] = await pool.query(sql);

        return rows.map(item => {
            let sisaWaktuText = '';
            const menit = item.menit_sisa;

            if (menit < 0) {
                const positifMenit = Math.abs(menit);
                if (positifMenit < 60) sisaWaktuText = `Lewat ${positifMenit} m`;
                else if (positifMenit < 1440) sisaWaktuText = `Lewat ${(positifMenit / 60).toFixed(1)} Jam`;
                else sisaWaktuText = `Lewat ${Math.floor(positifMenit / 1440)} Hari`;
            } else if (menit < 60) {
                sisaWaktuText = `${menit} Menit`;
            } else if (menit < 1440) {
                sisaWaktuText = `${(menit / 60).toFixed(1)} Jam`;
            } else {
                sisaWaktuText = `${Math.floor(menit / 1440)} Hari`;
            }

            return {
                no_spk: item.no_spk,
                nama_produk: item.nama_produk,
                qty: item.Kurang_Cetak,
                qty_order: item.qty_order,
                sudah_cetak: item.Sudah_Cetak,
                unit: item.unit,
                sisa_waktu: sisaWaktuText,
                menit_sisa: menit,
                tipe_spk: item.tipe_spk,
                tanggal_spk: item.tanggal_spk
            };
        });
    } catch (error) {
        throw new Error('Gagal memuat Seluruh Data Antrean Cetak: ' + error.message);
    }
};

const getGrafikBsBulanan = async () => {
    const sql = `
        SELECT 
            bulan_label AS bulan,
            sort_key,
            jenis_lhk,
            SUM(total_luas_m2) AS total_luas_m2
        FROM (
            /* 1. BS MMT (Digital) */
            SELECT 
                DATE_FORMAT(ltanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(ltanggal, '%Y-%m') AS sort_key,
                'MMT' AS jenis_lhk,
                SUM(COALESCE(lpanjang_bs, 0) * COALESCE(llebar_bs, 0)) AS total_luas_m2
            FROM tlhk_mesin_hdr
            WHERE ltanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND lpanjang_bs > 0
            GROUP BY DATE_FORMAT(ltanggal, '%b %Y'), DATE_FORMAT(ltanggal, '%Y-%m')

            UNION ALL

            /* 2. BS Mesin Tekstil */
            SELECT 
                DATE_FORMAT(lth_tanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(lth_tanggal, '%Y-%m') AS sort_key,
                'TEKSTIL' AS jenis_lhk,
                SUM(COALESCE(lth_panjang_bs, 0) * COALESCE(lth_lebar_bs, 0)) AS total_luas_m2
            FROM tlhk_mesintekstil_hdr
            WHERE lth_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND lth_panjang_bs > 0
            GROUP BY DATE_FORMAT(lth_tanggal, '%b %Y'), DATE_FORMAT(lth_tanggal, '%Y-%m')

            UNION ALL

            /* 3. BS Finishing MMT */
            SELECT 
                DATE_FORMAT(h.lfh_tanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(h.lfh_tanggal, '%Y-%m') AS sort_key,
                'FINISHING' AS jenis_lhk,
                SUM(COALESCE(d.lfd_j_bs, 0) * 1) AS total_luas_m2
            FROM tlhk_finishingmmt_dtl d
            INNER JOIN tlhk_finishingmmt_hdr h ON d.lfd_lfh_nomor = h.lfh_nomor
            WHERE h.lfh_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND d.lfd_j_bs > 0
            GROUP BY DATE_FORMAT(h.lfh_tanggal, '%b %Y'), DATE_FORMAT(h.lfh_tanggal, '%Y-%m')
        ) AS combined_bs
        GROUP BY bulan_label, sort_key, jenis_lhk
        ORDER BY sort_key ASC
    `;

    try {
        const [rows] = await pool.query(sql);

        // Extract daftar bulan unik
        const monthsMap = new Map();
        rows.forEach(r => {
            if (!monthsMap.has(r.sort_key)) {
                monthsMap.set(r.sort_key, r.bulan);
            }
        });

        const months = Array.from(monthsMap.values());
        const sortKeys = Array.from(monthsMap.keys());

        // Inisialisasi dataset hanya untuk 3 divisi
        const categories = ['MMT', 'FINISHING', 'TEKSTIL'];
        const datasets = {};
        
        categories.forEach(cat => {
            datasets[cat] = new Array(months.length).fill(0);
        });

        // Mapping nilai Luas BS M2 ke masing-masing posisi bulan & divisi
        rows.forEach(r => {
            const monthIndex = sortKeys.indexOf(r.sort_key);
            if (monthIndex !== -1 && datasets[r.jenis_lhk]) {
                datasets[r.jenis_lhk][monthIndex] = Number(Number(r.total_luas_m2 || 0).toFixed(2));
            }
        });

        return {
            labels: months,
            datasets: datasets
        };
    } catch (error) {
        throw new Error('Gagal memuat Grafik BS Bulanan 3 Divisi: ' + error.message);
    }
};


/**
 * Funnel produksi MMT per periode: jumlah dokumen di tiap tahap
 * SPK -> LHK (5 jenis) -> STBJ -> Jadwal -> SJ.
 * Kolom tanggal sudah terbukti di relationshipMapMmt.service.
 */
const getFunnelProduksi = async (startDate, endDate) => {
    const hasRange = startDate && endDate;
    const gte = (col) => (hasRange ? ` AND ${col} >= ? AND ${col} <= ?` : '');
    const paramsFor = (col, arr) => {
        if (hasRange) arr.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        return arr;
    };
    try {
        const out = {};
        const q = async (key, sql, buildParams) => {
            const p = [];
            const [rows] = await pool.query(sql.replace(/\/\*RANGE:([^*]+)\*\//g, (m, col) => {
                paramsFor(col.trim(), p);
                return gte(col.trim());
            }), p);
            out[key] = Number(rows[0]?.n) || 0;
        };
        await q('spk', `SELECT COUNT(*) AS n FROM tspk WHERE 1=1 /*RANGE:spk_tanggal*/`);
        await q('spk_memo', `SELECT COUNT(*) AS n FROM tmemospk WHERE 1=1 /*RANGE:mspk_tanggal*/`);
        await q('lhk_cetak', `SELECT COUNT(*) AS n FROM tlhk_mesin_hdr WHERE 1=1 /*RANGE:ltanggal*/`);
        await q('lhk_tekstil', `SELECT COUNT(*) AS n FROM tlhk_tekstilmmt_hdr WHERE 1=1 /*RANGE:lth_tanggal*/`);
        await q('lhk_proof', `SELECT COUNT(*) AS n FROM tlhk_proofmmt_hdr WHERE 1=1 /*RANGE:lpr_tanggal*/`);
        await q('lhk_sublim', `SELECT COUNT(*) AS n FROM tlhk_sublim_hdr WHERE 1=1 /*RANGE:lsb_tanggal*/`);
        await q('lhk_finishing', `SELECT COUNT(*) AS n FROM tlhk_finishingmmt_hdr WHERE 1=1 /*RANGE:lfh_tanggal*/`);
        await q('stbj', `SELECT COUNT(*) AS n FROM tstbj_hdr WHERE 1=1 /*RANGE:stbj_tanggal*/`);
        await q('jadwal', `SELECT COUNT(*) AS n FROM tjadwalkirim WHERE 1=1 /*RANGE:tanggal*/`);
        await q('sj', `SELECT COUNT(*) AS n FROM (
            SELECT SJ_Nomor FROM tsj_hdr WHERE 1=1 /*RANGE:SJ_Tanggal*/
            UNION ALL
            SELECT SJ_Nomor FROM tsj_hdr_memo WHERE 1=1 /*RANGE:SJ_Tanggal*/
        ) x`);
        return out;
    } catch (error) {
        throw new Error('Gagal memuat funnel produksi: ' + error.message);
    }
};

/**
 * Komitmen kirim periode berjalan (CURDATE di dalam rentang, belum close):
 * total rencana vs realisasi + % + 5 kurang terbesar.
 * Rumus realisasi = CASE di komitmenkirim.service.getDetail
 * (MAP→manual, P02→SJ, lainnya→STBJ, dibatasi rentang periode).
 */
const getKomitmenAktif = async () => {
    const sql = `
        SELECT h.pjw_nomor AS Nomor, h.pjw_cab AS Cabang,
               DATE_FORMAT(h.pjw_tgl1, '%Y-%m-%d') AS TglAwal,
               DATE_FORMAT(h.pjw_tgl2, '%Y-%m-%d') AS TglAkhir,
               IFNULL(SUM(d.pjwd_rencana), 0) AS Rencana,
               IFNULL(SUM(${realisasiExpr()}), 0) AS Realisasi
        FROM tpenjadwalan_ppic_hdr h
        LEFT JOIN tpenjadwalan_ppic_dtl d ON d.pjwd_pjw_nomor = h.pjw_nomor
        LEFT JOIN tsalesorder so_from_map
          ON so_from_map.so_memo = d.pjwd_map_nomor
          AND so_from_map.so_aktif = 'Y'
          AND d.pjwd_so_nomor IS NULL
        WHERE h.pjw_close = 'N' AND CURDATE() BETWEEN h.pjw_tgl1 AND h.pjw_tgl2
        GROUP BY h.pjw_nomor, h.pjw_cab, h.pjw_tgl1, h.pjw_tgl2
        ORDER BY h.pjw_tgl1`;
    const sqlKurang = `
        SELECT NomorTampil AS Nomor, Nama,
               (Rencana - Realisasi) AS Kurang, Periode
        FROM (
            SELECT COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor, d.pjwd_map_nomor,
                            d.pjwd_pro_nomor, d.pjwd_nama_manual) AS NomorTampil,
                   COALESCE(src.Nama, mp.mspk_nama, d.pjwd_nama_manual) AS Nama,
                   IFNULL(d.pjwd_rencana, 0) AS Rencana,
                   ${realisasiExpr()} AS Realisasi,
                   h.pjw_nomor AS Periode
            FROM tpenjadwalan_ppic_dtl d
            INNER JOIN tpenjadwalan_ppic_hdr h ON h.pjw_nomor = d.pjwd_pjw_nomor
            LEFT JOIN tsalesorder so_from_map
              ON so_from_map.so_memo = d.pjwd_map_nomor
              AND so_from_map.so_aktif = 'Y'
              AND d.pjwd_so_nomor IS NULL
            LEFT JOIN tmemospk mp
              ON mp.mspk_nomor = d.pjwd_map_nomor
              AND so_from_map.so_nomor IS NULL
            LEFT JOIN (
              SELECT so_nomor AS Nomor, so_nama AS Nama FROM tsalesorder
              UNION ALL
              SELECT spk_nomor, spk_nama FROM tspk WHERE spk_is_so = 0
            ) src ON src.Nomor = COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor)
            WHERE h.pjw_close = 'N' AND CURDATE() BETWEEN h.pjw_tgl1 AND h.pjw_tgl2
        ) x
        WHERE (Rencana - Realisasi) > 0
        ORDER BY Kurang DESC
        LIMIT 5`;
    try {
        const [periodes] = await pool.query(sql);
        const [kurang] = await pool.query(sqlKurang);
        return {
            periodes: periodes.map((p) => ({
                ...p,
                Rencana: Number(p.Rencana) || 0,
                Realisasi: Number(p.Realisasi) || 0,
                Persen: Number(p.Rencana) > 0
                    ? Number(((Number(p.Realisasi) / Number(p.Rencana)) * 100).toFixed(1))
                    : 0,
            })),
            kurang: (kurang || []).map((k) => ({
                ...k,
                Kurang: Number(k.Kurang) || 0,
            })),
        };
    } catch (error) {
        throw new Error('Gagal memuat komitmen aktif: ' + error.message);
    }
};

// Ekspresi realisasi per baris — disalin dari getDetail komitmenkirim.service
// (MAP→manual, cabang P02→SJ, lainnya→STBJ).
function realisasiExpr() {
    return `CASE
        WHEN d.pjwd_tipe = 'MAP' THEN IFNULL(d.pjwd_realisasi_manual, 0)
        WHEN COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor) IS NULL
          AND d.pjwd_map_nomor IS NULL AND d.pjwd_pro_nomor IS NULL
        THEN IFNULL(d.pjwd_realisasi_manual, 0)
        WHEN h.pjw_cab = 'P02' THEN IFNULL((
          SELECT SUM(sd.sjd_jumlah)
          FROM tsj_dtl sd
          INNER JOIN tsj_hdr sh ON sh.sj_nomor = sd.sjd_sj_nomor
          WHERE sd.sjd_spk_nomor = COALESCE(
            (SELECT so.so_spk_ref FROM tsalesorder so
             WHERE so.so_nomor = COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor)),
            COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor)
          )
            AND sh.sj_approve <> 2
            AND sh.sj_tanggal BETWEEN h.pjw_tgl1 AND h.pjw_tgl2
        ), 0)
        ELSE IFNULL((
          SELECT SUM(td.stbjd_jumlah)
          FROM tstbj_dtl td
          INNER JOIN tstbj_hdr th ON th.stbj_nomor = td.stbjd_stbj_nomor
          WHERE td.stbjd_spk_nomor = COALESCE(
            (SELECT so.so_spk_ref FROM tsalesorder so
             WHERE so.so_nomor = COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor)),
            COALESCE(d.pjwd_so_nomor, so_from_map.so_nomor)
          )
          AND th.stbj_tanggal BETWEEN h.pjw_tgl1 AND h.pjw_tgl2
        ), 0)
    END`;
}

/**
 * Stok menipis dari kartu stok live (tmasterstok_mmt) — kolom brg_stok /
 * brg_MIN_STOK di master terbukti tidak terpelihara (522/703 nol, semua
 * MIN nol), jadi agregat kartu stok yang dipakai: 10 terbawah + jumlah
 * yang habis (net <= 0).
 */
const getStokMenipis = async () => {
    try {
        const [[cnt]] = await pool.query(
            `SELECT COUNT(*) AS n FROM (
               SELECT mst_brg_kode FROM tmasterstok_mmt
               GROUP BY mst_brg_kode
               HAVING SUM(IFNULL(mst_stok_in, 0) - IFNULL(mst_stok_out, 0)) <= 0
             ) x`
        );
        const [rows] = await pool.query(
            `SELECT m.mst_brg_kode AS Kode, b.brg_nama AS Nama,
                    b.brg_satuan AS Satuan,
                    SUM(IFNULL(m.mst_stok_in, 0) - IFNULL(m.mst_stok_out, 0)) AS Stok
             FROM tmasterstok_mmt m
             LEFT JOIN tbarang_mmt b ON b.brg_kode = m.mst_brg_kode
             GROUP BY m.mst_brg_kode, b.brg_nama, b.brg_satuan
             ORDER BY Stok ASC
             LIMIT 10`
        );
        return {
            total: Number(cnt?.n) || 0,
            items: (rows || []).map((r) => ({ ...r, Stok: Number(r.Stok) || 0 })),
        };
    } catch (error) {
        throw new Error('Gagal memuat stok menipis: ' + error.message);
    }
};

/**
 * Jadwal kirim terlewat tanggal tapi realisasi belum penuh.
 * Dibatasi 6 bulan terakhir (backlog tahun lama tak actionable) dan
 * diurut dari yang paling baru terlewat agar langsung bisa ditindak.
 */
const getJadwalTerlambat = async () => {
    const where = `tanggal < CURDATE() AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                   AND IFNULL(realisasi, 0) < jumlah`;
    try {
        const [[cnt]] = await pool.query(
            `SELECT COUNT(*) AS n FROM tjadwalkirim WHERE ${where}`
        );
        const [rows] = await pool.query(
            `SELECT nomor_kirim AS Nomor,
                    DATE_FORMAT(tanggal, '%Y-%m-%d') AS Tanggal,
                    spk_nomor AS Spk, gudang AS Gudang,
                    jumlah AS Jumlah, IFNULL(realisasi, 0) AS Realisasi,
                    (jumlah - IFNULL(realisasi, 0)) AS Kurang,
                    DATEDIFF(CURDATE(), tanggal) AS HariTerlambat
             FROM tjadwalkirim
             WHERE ${where}
             ORDER BY tanggal DESC
             LIMIT 10`
        );
        return { total: Number(cnt?.n) || 0, items: rows };
    } catch (error) {
        throw new Error('Gagal memuat jadwal terlambat: ' + error.message);
    }
};


/**
 * Rasio BS vs total produksi per divisi, 6 bulan terakhir.
 * - MMT: produksi SUM(dtl.ld_luas_m2), BS header lpanjang_bs×llebar_bs (m²/m² → %).
 * - TEKSTIL: produksi SUM(dtl.ltd_qty_cetak) pcs vs BS m² (satuan beda → tanpa %).
 * - FINISHING: produksi SUM(seaming+mataayam+coly) vs BS SUM(j_bs) (pcs/pcs → %).
 */
const getBsRate = async () => {
    const byMonth = async (sql) => {
        const [rows] = await pool.query(sql);
        const map = {};
        for (const r of rows) map[r.k] = r;
        return map;
    };
    const MONTH_WHERE = {
        MMT: 'h.ltanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)',
        TEKSTIL_PROD: 'h.lth_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)',
        TEKSTIL_BS: 'lth_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)',
        FIN: 'h.lfh_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)',
    };
    try {
        const mmtProd = await byMonth(
            `SELECT DATE_FORMAT(h.ltanggal, '%Y-%m') AS k,
                    DATE_FORMAT(h.ltanggal, '%b %Y') AS label,
                    SUM(IFNULL(d.ld_luas_m2, 0)) AS v
             FROM tlhk_mesin_dtl d
             INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor
             WHERE ${MONTH_WHERE.MMT}
             GROUP BY DATE_FORMAT(h.ltanggal, '%Y-%m'), DATE_FORMAT(h.ltanggal, '%b %Y')`
        );
        const mmtBs = await byMonth(
            `SELECT DATE_FORMAT(ltanggal, '%Y-%m') AS k,
                    DATE_FORMAT(ltanggal, '%b %Y') AS label,
                    SUM(IFNULL(lpanjang_bs, 0) * IFNULL(llebar_bs, 0)) AS v
             FROM tlhk_mesin_hdr h
             WHERE ${MONTH_WHERE.MMT} AND lpanjang_bs > 0
             GROUP BY DATE_FORMAT(ltanggal, '%Y-%m'), DATE_FORMAT(ltanggal, '%b %Y')`
        );
        const tekProd = await byMonth(
            `SELECT DATE_FORMAT(h.lth_tanggal, '%Y-%m') AS k,
                    DATE_FORMAT(h.lth_tanggal, '%b %Y') AS label,
                    SUM(IFNULL(d.ltd_qty_cetak, 0)) AS v
             FROM tlhk_tekstilmmt_dtl d
             INNER JOIN tlhk_tekstilmmt_hdr h ON h.lth_nomor = d.ltd_lth_nomor
             WHERE ${MONTH_WHERE.TEKSTIL_PROD}
             GROUP BY DATE_FORMAT(h.lth_tanggal, '%Y-%m'), DATE_FORMAT(h.lth_tanggal, '%b %Y')`
        );
        const tekBs = await byMonth(
            `SELECT DATE_FORMAT(lth_tanggal, '%Y-%m') AS k,
                    DATE_FORMAT(lth_tanggal, '%b %Y') AS label,
                    SUM(IFNULL(lth_panjang_bs, 0) * IFNULL(lth_lebar_bs, 0)) AS v
             FROM tlhk_mesintekstil_hdr
             WHERE ${MONTH_WHERE.TEKSTIL_BS} AND lth_panjang_bs > 0
             GROUP BY DATE_FORMAT(lth_tanggal, '%Y-%m'), DATE_FORMAT(lth_tanggal, '%b %Y')`
        );
        const finProd = await byMonth(
            `SELECT DATE_FORMAT(h.lfh_tanggal, '%Y-%m') AS k,
                    DATE_FORMAT(h.lfh_tanggal, '%b %Y') AS label,
                    SUM(IFNULL(d.lfd_j_seaming, 0) + IFNULL(d.lfd_j_mataayam, 0) + IFNULL(d.lfd_j_coly, 0)) AS v
             FROM tlhk_finishingmmt_dtl d
             INNER JOIN tlhk_finishingmmt_hdr h ON h.lfh_nomor = d.lfd_lfh_nomor
             WHERE ${MONTH_WHERE.FIN}
             GROUP BY DATE_FORMAT(h.lfh_tanggal, '%Y-%m'), DATE_FORMAT(h.lfh_tanggal, '%b %Y')`
        );
        const finBs = await byMonth(
            `SELECT DATE_FORMAT(h.lfh_tanggal, '%Y-%m') AS k,
                    DATE_FORMAT(h.lfh_tanggal, '%b %Y') AS label,
                    SUM(IFNULL(d.lfd_j_bs, 0)) AS v
             FROM tlhk_finishingmmt_dtl d
             INNER JOIN tlhk_finishingmmt_hdr h ON h.lfh_nomor = d.lfd_lfh_nomor
             WHERE ${MONTH_WHERE.FIN} AND d.lfd_j_bs > 0
             GROUP BY DATE_FORMAT(h.lfh_tanggal, '%Y-%m'), DATE_FORMAT(h.lfh_tanggal, '%b %Y')`
        );

        const keys = Array.from(
            new Set([
                ...Object.keys(mmtProd), ...Object.keys(mmtBs),
                ...Object.keys(tekProd), ...Object.keys(tekBs),
                ...Object.keys(finProd), ...Object.keys(finBs),
            ]),
        ).sort();
        const labelOf = (k) =>
            (mmtProd[k] || mmtBs[k] || tekProd[k] || tekBs[k] || finProd[k] || finBs[k] || {}).label || k;
        const num = (m, k) => Number((m[k] || {}).v) || 0;
        const pct = (bs, prod) =>
            prod > 0 ? Number(((bs / prod) * 100).toFixed(2)) : 0;

        const months = keys.map((k) => ({ key: k, label: labelOf(k) }));
        const mmtP = keys.map((k) => num(mmtProd, k));
        const mmtB = keys.map((k) => num(mmtBs, k));
        const tekP = keys.map((k) => num(tekProd, k));
        const tekB = keys.map((k) => num(tekBs, k));
        const finP = keys.map((k) => num(finProd, k));
        const finB = keys.map((k) => num(finBs, k));
        return {
            months,
            divisions: {
                MMT: { unit: 'm²', produksi: mmtP, bs: mmtB, persen: keys.map((_, i) => pct(mmtB[i], mmtP[i])) },
                TEKSTIL: { unit: 'pcs vs m²', produksi: tekP, bs: tekB, persen: keys.map(() => null) },
                FINISHING: { unit: 'pcs', produksi: finP, bs: finB, persen: keys.map((_, i) => pct(finB[i], finP[i])) },
            },
        };
    } catch (error) {
        throw new Error('Gagal memuat rasio BS: ' + error.message);
    }
};


/**
 * Ringkasan SPK aktif: total, lewat dateline, deadline hari ini,
 * segera (H-7), tanpa dateline + per cabang + 10 paling mendesak.
 * Aktif = spk_close = 0 AND spk_aktif = 'Y'.
 */
const getSpkAktif = async () => {
    const base = `FROM tspk WHERE spk_close = 0 AND spk_aktif = 'Y'`;
    try {
        const [[s]] = await pool.query(
            `SELECT COUNT(*) AS total,
                    SUM(spk_dateline IS NOT NULL AND spk_dateline < CURDATE()) AS lewat,
                    SUM(spk_dateline IS NOT NULL AND spk_dateline < CURDATE()
                        AND spk_dateline >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)) AS lewatMendesak,
                    SUM(spk_dateline IS NOT NULL AND spk_dateline < DATE_SUB(CURDATE(), INTERVAL 90 DAY)) AS tunggakanLama,
                    SUM(spk_dateline IS NOT NULL AND DATE(spk_dateline) = CURDATE()) AS hariIni,
                    SUM(spk_dateline IS NOT NULL AND spk_dateline > CURDATE()
                        AND spk_dateline <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS segera,
                    SUM(spk_dateline IS NULL) AS tanpaDateline
             ${base}`
        );
        const [cab] = await pool.query(
            `SELECT spk_cab AS Cabang, COUNT(*) AS Total,
                    SUM(spk_dateline IS NOT NULL AND spk_dateline < CURDATE()
                        AND spk_dateline >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)) AS Mendesak
             ${base}
             GROUP BY spk_cab
             ORDER BY Total DESC`
        );
        const [top] = await pool.query(
            `SELECT spk_nomor AS Nomor, spk_nama AS Nama, spk_cab AS Cabang,
                    DATE_FORMAT(spk_dateline, '%Y-%m-%d') AS Dateline,
                    spk_jumlah AS Jumlah,
                    DATEDIFF(spk_dateline, CURDATE()) AS SisaHari
             ${base} AND spk_dateline IS NOT NULL
              AND spk_dateline >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
             ORDER BY spk_dateline ASC
             LIMIT 10`
        );
        return {
            total: Number(s.total) || 0,
            lewat: Number(s.lewat) || 0,
            lewatMendesak: Number(s.lewatMendesak) || 0,
            tunggakanLama: Number(s.tunggakanLama) || 0,
            hariIni: Number(s.hariIni) || 0,
            segera: Number(s.segera) || 0,
            tanpaDateline: Number(s.tanpaDateline) || 0,
            perCabang: cab,
            top,
        };
    } catch (error) {
        throw new Error('Gagal memuat SPK aktif: ' + error.message);
    }
};


module.exports = {
    getTopDeadlineCetak,
    getPermintaanBahanPending,
    getPermintaanBahanTotalFull,
    getTopDeadlineCetakTotalFull,
    getGrafikBsBulanan,
    getFunnelProduksi,
    getKomitmenAktif,
    getStokMenipis,
    getJadwalTerlambat,
    getBsRate,
    getSpkAktif
};
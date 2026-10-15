const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Delphi utama: ufrmbrowserekaplhk.pas btnRefreshClick.SQLMaster (TfrmBrowserekaplhk).
// Laporan agregat per SPK: order SPK (tspk + tmemospk) LEFT JOIN realisasi
// cetak/jahit/lipat periode berjalan → kolom KURANG = order - realisasi.
// BANDING ufrmbrowserekaplhkunit.pas: itu varian pivot per PABRIK/unit
// (C=CETAK/J=JAHIT/L=LIPAT/Q=QUIRING, kolom PCS_JA/MD/KP/AI/SM + METER_*,
// wajib pilih perusahaan C/J/L/Q) — TIDAK dipakai; dipilih utama per-SPK.
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate, perusahaan = '') => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const dateCond = (alias) => (hasDateFilter ? `WHERE ${alias} BETWEEN ? AND ?` : '');

        const sql = `
            SELECT spk_perush_kode AS Perusahaan, spk_tanggal AS Tanggal_SPK,
                spk_dateline AS Dateline, spk_nama AS Nama_SPK,
                IFNULL(spk_panjang, 0) AS Panjang, IFNULL(spk_lebar, 0) AS Lebar,
                lcd_spk_nomor AS Nomor_SPK, IFNULL(spk_jumlah, 0) AS Jumlah_Order,
                IFNULL(spk_jumlah, 0) - IFNULL(lcd_qty_cetak, 0) AS Kurang_Cetak,
                IFNULL(spk_jumlah, 0) - IFNULL(ljd_qty_jahit, 0) AS Kurang_Jahit,
                IFNULL(spk_jumlah, 0) - IFNULL(lld_qty_lipat, 0) AS Kurang_Lipat
            FROM (
                SELECT lcd_spk_nomor, SUM(IFNULL(lcd_qty_cetak, 0)) lcd_qty_cetak
                FROM tlhk_cetak_hdr a
                INNER JOIN tlhk_cetak_dtl b ON (lcd_lch_nomor = lch_nomor)
                ${dateCond('lch_tanggal')}
                GROUP BY lcd_spk_nomor
            ) a
            LEFT JOIN (
                SELECT spk_perush_kode, spk_nomor, spk_tanggal, spk_dateline, spk_nama,
                    IFNULL(spk_panjang, 0) spk_panjang,
                    IFNULL(spk_lebar, 0) spk_lebar,
                    IFNULL(spk_jumlah, 0) spk_jumlah
                FROM tspk
                UNION ALL
                SELECT mspk_perush_kode, mspk_nomor, mspk_tanggal, mspk_dateline, mspk_nama,
                    IFNULL(mspk_panjang, 0) spk_panjang,
                    IFNULL(mspk_lebar, 0) spk_lebar,
                    IFNULL(mspk_jumlah, 0) spk_jumlah
                FROM tmemospk
            ) b ON (spk_nomor = lcd_spk_nomor)
            LEFT JOIN (
                SELECT ljd_spk_nomor, SUM(IFNULL(ljd_qty_jahit, 0)) ljd_qty_jahit
                FROM tlhk_jahit_hdr a
                INNER JOIN tlhk_jahit_dtl b ON (ljd_ljh_nomor = ljh_nomor)
                ${dateCond('ljh_tanggal')}
                GROUP BY ljd_spk_nomor
            ) c ON (ljd_spk_nomor = lcd_spk_nomor)
            LEFT JOIN (
                SELECT lld_spk_nomor, SUM(IFNULL(lld_qty_lipat, 0)) lld_qty_lipat
                FROM tlhk_lipat_hdr a
                INNER JOIN tlhk_lipat_dtl b ON (lld_llh_nomor = llh_nomor)
                ${dateCond('llh_tanggal')}
                GROUP BY lld_spk_nomor
            ) d ON (lld_spk_nomor = lcd_spk_nomor)
            ${perusahaan ? 'WHERE spk_perush_kode LIKE ?' : ''}
            ORDER BY spk_tanggal, lcd_spk_nomor
        `;
        const params = [];
        if (hasDateFilter) params.push(startDate, endDate); // cetak
        if (hasDateFilter) params.push(startDate, endDate); // jahit
        if (hasDateFilter) params.push(startDate, endDate); // lipat
        if (perusahaan) params.push(`%${perusahaan}%`);
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.Tanggal_SPK) item.Tanggal_SPK = format(new Date(item.Tanggal_SPK), 'yyyy-MM-dd');
            if (item.Dateline) item.Dateline = format(new Date(item.Dateline), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse rekap LHK di database', error);
    }
};

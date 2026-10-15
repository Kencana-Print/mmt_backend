const pool = require('../../config/db.config');

const { format } = require('date-fns');

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Delphi MANKSI/spanduk/ufrmBrowLhkDesign_proof.pas btnRefreshClick.SQLMaster:
// Master = tlhkdesign (ld_tipe='S') + nama/tgl SPK dari tspk/tmemospk +
// LastStatus = status terakhir dari tlhkdesign_status per ld_spk.
// Guard: tanggal kosong = tanpa filter tanggal (JANGAN zero-date '0000-00-00').
exports.getBrowseList = async (startDate, endDate) => {
    try {
        const hasDateFilter = Boolean(startDate) && Boolean(endDate);
        const sql = `
            SELECT x.Nomor, x.Nama, x.TglSPK, x.Dateline, x.TglLHK,
                x.Finishing, x.Jml_Sticth, x.Jml_Jumlah,
                x.LastStatus, x.user_create
            FROM (
                SELECT h.ld_spk AS Nomor,
                    h.ld_tanggal AS TglLHK,
                    IFNULL(s.spk_tanggal, m.Mspk_tanggal) AS TglSPK,
                    IFNULL(s.spk_dateline, m.mspk_dateline) AS Dateline,
                    IFNULL(s.spk_nama, m.Mspk_nama) AS Nama,
                    IFNULL(s.spk_finishing, m.Mspk_finishing) AS Finishing,
                    IFNULL((SELECT SUM(ldk_sticth) FROM tlhkdesign_komponen WHERE ldk_spk = h.ld_spk), 0) AS Jml_Sticth,
                    IFNULL((SELECT SUM(ldk_jumlah) FROM tlhkdesign_komponen WHERE ldk_spk = h.ld_spk), 0) AS Jml_Jumlah,
                    IFNULL((SELECT d.lds_status FROM tlhkdesign_status d
                        WHERE d.lds_spk = h.ld_spk ORDER BY d.lds_tgl DESC LIMIT 1), '') AS LastStatus,
                    h.user_create
                FROM tlhkdesign h
                LEFT JOIN tspk s ON (s.spk_nomor = h.ld_spk)
                LEFT JOIN tmemospk m ON (m.MSPK_Nomor = h.ld_spk)
                ${hasDateFilter ? 'WHERE DATE(h.ld_tanggal) BETWEEN ? AND ? AND h.ld_tipe = \'S\'' : 'WHERE h.ld_tipe = \'S\''}
            ) x
            ORDER BY x.TglLHK, x.Nomor
        `;
        const params = hasDateFilter ? [startDate, endDate] : [];
        const [rows] = await pool.query(sql, params);
        rows.forEach((item) => {
            if (item.TglLHK) item.TglLHK = format(new Date(item.TglLHK), 'yyyy-MM-dd');
            if (item.TglSPK) item.TglSPK = format(new Date(item.TglSPK), 'yyyy-MM-dd');
            if (item.Dateline) item.Dateline = format(new Date(item.Dateline), 'yyyy-MM-dd');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse LHK design proof di database', error);
    }
};

// Delphi btnRefreshClick: riwayat status per SPK (clcab/clusr/clsts/cltanggal/cljam/cldurasi/clnote)
// = tlhkdesign_status (lds_tipe='S') diurut lds_tgl. Dipakai untuk expand "Alur Status".
exports.getDetail = async (nomor) => {
    try {
        const sql = `
            SELECT lds_spk AS Nomor, lds_cabang AS Cabang, lds_user AS Desainer,
                lds_status AS Status, lds_tgl AS Tanggal,
                lds_durasi AS Durasi, lds_note AS Note
            FROM tlhkdesign_status
            WHERE lds_spk = ? AND lds_tipe = 'S'
            ORDER BY lds_tgl
        `;
        const [rows] = await pool.query(sql, [nomor]);
        rows.forEach((item) => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd HH:mm:ss');
        });
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail status LHK design proof di database', error);
    }
};

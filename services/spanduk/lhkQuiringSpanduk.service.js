const pool = require("../../config/db.config");

const throwDbError = (message, error) => {
    throw new Error(message + ": " + error.message);
};

// Guard: hanya tanggal valid yyyy-MM-dd yang dipakai filter (tanpa zero-date).
const isValidDate = (value) => {
    const s = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    if (s === "0000-00-00") return false;
    const d = new Date(s + "T00:00:00");
    return !isNaN(d.getTime());
};

// Subquery union SPK persis Delphi (tspk UNION ALL tmemospk).
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

// Browse master: tlhk_quiring_hdr + tpabrik + agregat detail
// (Delphi browse master tanpa agregat; agregat Tot_* ditambah mengikuti
// pola browse cetak Jml_Meter agar ringkasan tampil di grid).
exports.getBrowseList = async (startDate, endDate) => {
    try {
        let sql = `
            SELECT h.lqh_nomor AS Nomor,
                   h.lqh_tanggal AS Tanggal,
                   h.lqh_pab_kode AS Kode_Pabrik,
                   p.pab_nama AS Nama_Pabrik,
                   COALESCE(h.lqh_jkar_borongan, 0) AS Kar_Borongan,
                   COALESCE(h.lqh_jkar_harian, 0) AS Kar_Harian,
                   COALESCE(ag.Tot_Koli, 0) AS Tot_Koli,
                   COALESCE(ag.Tot_Oven, 0) AS Tot_Oven,
                   COALESCE(ag.Tot_Jemuran, 0) AS Tot_Jemuran,
                   COALESCE(ag.Tot_Potong, 0) AS Tot_Potong
              FROM tlhk_quiring_hdr h
              LEFT JOIN tpabrik p ON p.pab_kode = h.lqh_pab_kode
              LEFT JOIN (
                    SELECT lqd_lqh_nomor AS XNomor,
                           SUM(IFNULL(lqd_j_koli, 0)) AS Tot_Koli,
                           SUM(IFNULL(lqd_j_oven, 0)) AS Tot_Oven,
                           SUM(IFNULL(lqd_j_jemuran, 0)) AS Tot_Jemuran,
                           SUM(IFNULL(lqd_j_potong, 0)) AS Tot_Potong
                      FROM tlhk_quiring_dtl
                     GROUP BY lqd_lqh_nomor
              ) ag ON ag.XNomor = h.lqh_nomor
             WHERE 1 = 1
        `;
        const params = [];
        const hasStart = isValidDate(startDate);
        const hasEnd = isValidDate(endDate);

        // Guard tanggal kosong = tanpa filter tanggal (tanpa zero-date).
        if (hasStart && hasEnd) {
            sql += ` AND h.lqh_tanggal BETWEEN ? AND ? `;
            params.push(String(startDate).trim(), String(endDate).trim());
        } else if (hasStart) {
            sql += ` AND h.lqh_tanggal >= ? `;
            params.push(String(startDate).trim());
        } else if (hasEnd) {
            sql += ` AND h.lqh_tanggal <= ? `;
            params.push(String(endDate).trim());
        }

        sql += ` ORDER BY h.lqh_tanggal DESC, h.lqh_nomor DESC `;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil browse LHK Quiring Spanduk", error);
    }
};

// Detail per nomor: tlhk_quiring_dtl + join union tspk/tmemospk (persis Delphi).
exports.getDetail = async (nomor) => {
    try {
        const code = String(nomor || "").trim();
        if (!code) throw new Error("Nomor LHK wajib diisi.");
        const sql = `
            SELECT d.lqd_lqh_nomor AS Nomor,
                   d.lqd_spk_nomor AS Nomor_SPK,
                   x.spk_nama AS Nama_SPK,
                   x.spk_jumlah AS Jumlah_Order,
                   x.spk_panjang AS Panjang,
                   x.spk_lebar AS Lebar,
                   d.lqd_j_koli AS J_Koli,
                   d.lqd_j_oven AS J_Oven,
                   d.lqd_j_jemuran AS J_Jemuran,
                   d.lqd_j_potong AS J_Potong
              FROM tlhk_quiring_dtl d
              LEFT JOIN ${SPK_UNION} ON x.spk_nomor = d.lqd_spk_nomor
             WHERE d.lqd_lqh_nomor = ?
             ORDER BY d.lqd_spk_nomor
        `;
        const [rows] = await pool.query(sql, [code]);
        return rows;
    } catch (error) {
        throwDbError(`Gagal mengambil detail LHK Quiring ${nomor}`, error);
    }
};

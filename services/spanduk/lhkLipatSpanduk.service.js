const pool = require('../../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => {
  throw new Error(`${message}: ${error.message}`);
};

// Subquery union SPK persis pola Delphi ufrmbrowsehasilkerjalipat.pas:
// tspk UNION ALL tmemospk (kolom dinormalkan ke spk_nomor/nama/jumlah/panjang/lebar).
const SPK_UNION = `
  (SELECT spk_nomor, spk_nama, spk_jumlah,
          IFNULL(spk_panjang, 0) spk_panjang,
          IFNULL(spk_lebar, 0) spk_lebar
     FROM tspk
   UNION ALL
   SELECT mspk_nomor, mspk_nama, mspk_jumlah,
          IFNULL(mspk_panjang, 0) mspk_panjang,
          IFNULL(mspk_lebar, 0) mspk_lebar
     FROM tmemospk) x`;

// Agregat per nomor LHK (pola turunan browse hasil kerja cetak Delphi:
// cetak punya Jml_Meter via subquery; lipat Delphi tidak punya agregat,
// jadi agregat dihitung dari tlhk_lipat_dtl: total qty lipat + mata ayam + jml SPK).
const AGREGAT_JOIN = `
  LEFT JOIN (
    SELECT lld_llh_nomor XNomor,
           SUM(lld_qty_lipat) Jml_Qty_Lipat,
           SUM(lld_mata_ayam) Jml_Mata_Ayam,
           COUNT(*) Jml_SPK
      FROM tlhk_lipat_dtl
     GROUP BY 1
  ) xx ON (xx.XNomor = h.llh_nomor)`;

// Guard tanggal kosong = tanpa filter (JANGAN pakai zero-date '0000-00-00').
const hasDateFilter = (startDate, endDate) =>
  Boolean(startDate && String(startDate).trim() !== '' &&
          endDate && String(endDate).trim() !== '');

exports.getBrowseList = async (startDate, endDate) => {
  try {
    let sql = `
      SELECT h.llh_nomor AS Nomor,
             DATE_FORMAT(h.llh_tanggal, '%Y-%m-%d') AS Tanggal,
             h.llh_pab_kode AS Kode_Pabrik,
             p.pab_nama AS Nama_Pabrik,
             h.llh_jkar_borongan AS Kar_Borongan,
             h.llh_jkar_harian AS Kar_Harian,
             IFNULL(xx.Jml_Qty_Lipat, 0) AS Jml_Qty_Lipat,
             IFNULL(xx.Jml_Mata_Ayam, 0) AS Jml_Mata_Ayam,
             IFNULL(xx.Jml_SPK, 0) AS Jml_SPK
        FROM tlhk_lipat_hdr h
        LEFT JOIN tpabrik p ON (p.pab_kode = h.llh_pab_kode)
        ${AGREGAT_JOIN}`;
    const params = [];
    if (hasDateFilter(startDate, endDate)) {
      sql += ` WHERE h.llh_tanggal BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    sql += ` ORDER BY h.llh_tanggal DESC, h.llh_nomor DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    throwDbError('Gagal mengambil browse LHK lipat spanduk di database', error);
  }
};

exports.getDetail = async (nomor) => {
  try {
    const sql = `
      SELECT d.lld_llh_nomor AS Nomor,
             d.lld_spk_nomor AS Nomor_SPK,
             x.spk_nama AS Nama_SPK,
             x.spk_jumlah AS Jumlah_Order,
             x.spk_panjang AS Panjang,
             x.spk_lebar AS Lebar,
             d.lld_qty_lipat AS Qty_Lipat,
             d.lld_tambah_lipat AS Tambah_Lipat,
             d.lld_mata_ayam AS Mata_Ayam
        FROM tlhk_lipat_dtl d
        LEFT JOIN ${SPK_UNION} ON (x.spk_nomor = d.lld_spk_nomor)
       WHERE d.lld_llh_nomor = ?
       ORDER BY d.lld_spk_nomor`;
    const [rows] = await pool.query(sql, [nomor]);
    return rows;
  } catch (error) {
    throwDbError('Gagal mengambil detail LHK lipat spanduk di database', error);
  }
};

// ---------------------------------------------------------------------------
// FORM INPUT/SAVE (cermin Delphi ufrmhasilkerjalipat.simpandata + getmaxkode)
// ---------------------------------------------------------------------------
const NOMERATOR = 'LHK-L';

const pad4 = (n) => String(10000 + n).slice(-4);

const yymmOf = (tanggal) => {
  try {
    return format(new Date(tanggal), 'yyMM');
  } catch { return format(new Date(), 'yyMM'); }
};

/**
 * Penomoran Delphi getmaxkode:
 *   LHK-L.YYMM.NNNN  (NNNN = max 4 digit kanan + 1 per bulan tanggal dokumen)
 */
exports.generateNomor = async (tanggal) => {
  try {
    const yymm = yymmOf(tanggal || new Date());
    const prefix = `${NOMERATOR}.${yymm}.`;
    const [rows] = await pool.query(
      `SELECT MAX(RIGHT(llh_nomor, 4)) AS maxNo FROM tlhk_lipat_hdr WHERE llh_nomor LIKE ?`,
      [`${prefix}%`]
    );
    const maxNo = parseInt(rows[0]?.maxNo, 10);
    const next = Number.isFinite(maxNo) ? maxNo + 1 : 1;
    return `${prefix}${pad4(next)}`;
  } catch (error) {
    throwDbError('Gagal membuat nomor LHK lipat spanduk di database', error);
  }
};

/**
 * Data form edit: header + details (cermin Delphi loaddata, tanpa dtl_2).
 */
exports.getFormDetail = async (nomor) => {
  try {
    const [hdr] = await pool.query(
      `SELECT h.llh_nomor, h.llh_tanggal,
              h.llh_pab_kode, p.pab_nama
         FROM tlhk_lipat_hdr h
         LEFT JOIN tpabrik p ON (p.pab_kode = h.llh_pab_kode)
        WHERE h.llh_nomor = ?`,
      [nomor]
    );
    if (!hdr.length) return null;
    const header = hdr[0];
    if (header.llh_tanggal) {
      try { header.llh_tanggal = format(new Date(header.llh_tanggal), 'yyyy-MM-dd'); } catch { /* biarkan apa adanya */ }
    }
    const details = await exports.getDetail(nomor);
    return { header, details };
  } catch (error) {
    throwDbError('Gagal mengambil data form LHK lipat spanduk di database', error);
  }
};

/**
 * Simpan form: header upsert + hapus-insert details dalam transaksi.
 * Cermin Delphi simpandata (insert/update hdr tanggal+pabrik+audit,
 * delete dtl per nomor + insert dtl per SPK).
 * Delphi TIDAK menulis llh_jkar_borongan/llh_jkar_harian (barisnya
 * di-comment di simpandata) → service ini juga tidak menyentuhnya.
 *
 * SENGAJA DI-SKIP: tlhk_lipat_dtl_2 (rincian karyawan per SPK +
 * absensi) — lihat GAP di laporan. Tabel dtl_2 yang sudah ada TIDAK
 * dihapus/diubah.
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
        `SELECT MAX(RIGHT(llh_nomor, 4)) AS maxNo FROM tlhk_lipat_hdr WHERE llh_nomor LIKE ? FOR UPDATE`,
        [`${prefix}%`]
      );
      const maxNo = parseInt(r[0]?.maxNo, 10);
      nomor = `${prefix}${pad4(Number.isFinite(maxNo) ? maxNo + 1 : 1)}`;
      await conn.query(
        `INSERT INTO tlhk_lipat_hdr
                (llh_nomor, llh_tanggal, llh_pab_kode, llh_date_Create, llh_user_create)
                VALUES (?, ?, ?, CURDATE(), ?)`,
        [nomor, tanggal, pabKode, userKode || 'SYSTEM']
      );
    } else {
      const [exists] = await conn.query(
        `SELECT llh_nomor FROM tlhk_lipat_hdr WHERE llh_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!exists.length) throw new Error(`Nomor ${nomor} tidak ditemukan.`);
      await conn.query(
        `UPDATE tlhk_lipat_hdr SET llh_tanggal = ?, llh_pab_kode = ?,
                llh_Date_modified = CURDATE(), llh_user_modified = ?
                WHERE llh_nomor = ?`,
        [tanggal, pabKode, userKode || 'SYSTEM', nomor]
      );
      await conn.query(`DELETE FROM tlhk_lipat_dtl WHERE lld_llh_nomor = ?`, [nomor]);
    }

    for (const d of details) {
      await conn.query(
        `INSERT INTO tlhk_lipat_dtl
                (lld_llh_nomor, lld_spk_nomor, lld_qty_lipat, lld_tambah_lipat, lld_mata_ayam)
                VALUES (?, ?, ?, ?, ?)`,
        [
          nomor,
          d.spkNomor.trim(),
          parseInt(d.qtyLipat, 10) || 0,
          parseFloat(d.tambahLipat) || 0,
          parseInt(d.mataAyam, 10) || 0,
        ]
      );
    }

    await conn.commit();
    return { nomor, isEdit };
  } catch (error) {
    try { await conn.rollback(); } catch { /* abaikan */ }
    throw new Error(`Gagal menyimpan LHK lipat spanduk: ${error.message}`);
  } finally {
    conn.release();
  }
};

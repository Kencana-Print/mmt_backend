const db = require("../config/db.config");

const { format } = require("date-fns");

// --- GET BROWSE LIST ---
// Aturan tampil seperti SO SPK:
// - Jika userCabang = P05 (case-insensitive): tampilkan
//   mspk_cab = 'P05' ATAU UPPER(TRIM(mspk_workshop)) = 'MMT' ATAU mspk_sublim = 'Y'
// - Cabang lain (selain ALL/HO-/HO/ADMIN/kosong): tampilkan mspk_cab = cabang tsb
//   (plus baris dengan cab kosong/null agar data lama tetap terlihat)
// - Filter manual cabang/workshop/sublim dari frontend bersifat opsional
//   dan dipasang di atas aturan otomatis tersebut.
const getBrowseList = async (filters, userCabang) => {
  const {
    startDate,
    endDate,
    onProgressOnly,
    search,
    cabang,
    workshop,
    sublim,
  } = filters || {};

  const normCab = String(userCabang || "ALL")
    .trim()
    .toUpperCase();
  const isP05 = normCab === "P05";
  const isAll =
    !normCab ||
    normCab === "ALL" ||
    normCab === "HO-" ||
    normCab === "HO" ||
    normCab === "ADMIN";

  let params = [];
  let whereClause = `WHERE m.mspk_divisi IN (3, 4, 6) AND m.mspk_cmo <> ""`;

  // 1. Aturan otomatis mengikuti cabang login (seperti SO SPK)
  if (isP05) {
    whereClause += ` AND (UPPER(TRIM(m.mspk_cab)) = 'P05' OR UPPER(TRIM(m.mspk_workshop)) = 'MMT' OR UPPER(TRIM(m.mspk_sublim)) = 'Y')`;
  } else if (!isAll) {
    whereClause += ` AND (UPPER(TRIM(m.mspk_cab)) = ? OR m.mspk_cab = "" OR m.mspk_cab IS NULL)`;
    params.push(normCab);
  }

  // 2. Filter khusus "On Progress" (ckLock di Delphi)
  if (onProgressOnly === "true" || onProgressOnly === true) {
    whereClause += ` AND m.mspk_nomor IN (SELECT map FROM tkesesuaianmap_lock WHERE apv = "N"`;
    if (!isAll && !isP05) {
      whereClause += ` AND UPPER(TRIM(cab)) = ?`;
      params.push(normCab);
    }
    whereClause += `)`;
  } else if (startDate && endDate) {
    // Jika tidak On Progress, gunakan filter tanggal mspk_tanggal
    whereClause += ` AND m.mspk_tanggal >= ? AND m.mspk_tanggal <= ?`;
    params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }

  // 3. Filter manual opsional dari dropdown frontend
  if (cabang && cabang !== "ALL" && cabang !== "") {
    whereClause += ` AND UPPER(TRIM(m.mspk_cab)) = ?`;
    params.push(String(cabang).trim().toUpperCase());
  }
  if (workshop && workshop !== "ALL" && workshop !== "") {
    whereClause += ` AND UPPER(TRIM(m.mspk_workshop)) = ?`;
    params.push(String(workshop).trim().toUpperCase());
  }
  if (sublim && sublim !== "ALL" && sublim !== "") {
    const s = String(sublim).trim().toUpperCase();
    if (s === "Y" || s === "YA") {
      whereClause += ` AND UPPER(TRIM(m.mspk_sublim)) = 'Y'`;
    } else if (s === "TIDAK" || s === "N" || s === "T") {
      whereClause += ` AND (UPPER(TRIM(m.mspk_sublim)) <> 'Y' OR m.mspk_sublim IS NULL OR m.mspk_sublim = "")`;
    }
  }

  // 4. Search nomor / nama pekerjaan
  if (search && String(search).trim() !== "") {
    whereClause += ` AND (m.mspk_nomor LIKE ? OR m.mspk_nama LIKE ? OR m.mspk_nama2 LIKE ?)`;
    const kw = `%${String(search).trim()}%`;
    params.push(kw, kw, kw);
  }

  const query = `
    SELECT
      m.mspk_nomor AS Nomor,
      IF(m.mspk_divisi = 3, "KAOSAN", "GARMEN") AS Divisi,
      m.mspk_tipe AS Tipe,
      m.mspk_tanggal AS Tanggal,
      IF((SELECT s.mspk_nomor FROM tkesesuaianmap s WHERE s.mspk_nomor = m.mspk_nomor LIMIT 1) IS NULL, "", "SUDAH") AS CetakBAST,
      m.mspk_nama AS NamaPekerjaan,
      m.mspk_nama2 AS NamaExt,
      m.mspk_ukuran AS Ukuran,
      m.mspk_gramasi AS Gramasi,
      IFNULL((SELECT k.keterangan FROM tkesesuaianmap k WHERE k.kode_sesuai = 2 AND k.mspk_nomor = m.mspk_nomor LIMIT 1), "") AS GramasiSetting_Aktual,
      m.mspk_kain AS Kain,
      m.mspk_finishing AS Finishing,
      m.mspk_keterangan AS Keterangan,
      m.mspk_kendala AS kendalaProduksi,
      m.mspk_jumlah_jadi AS Jumlah,
      m.mspk_cab AS Cabang,
      m.mspk_workshop AS Workshop,
      m.mspk_sublim AS Sublim,
      (SELECT IFNULL(l.apv, "") FROM tkesesuaianmap_lock l WHERE l.map = m.mspk_nomor LIMIT 1) AS OnProgres
    FROM tmemospk m
    ${whereClause}
    ORDER BY m.mspk_tanggal DESC
  `;

  const [rows] = await db.query(query, params);
  return rows;
};

// --- GET DETAIL BAST (untuk form Ubah) ---
// Header diambil dari tmemospk (data MAP/SPK), checklist/komponen/obat/lock
// diambil dari tabel tkesesuaianmap*, bahan + nomor proof diambil dari
// LHK Proof (tlhk_proofmmt_hdr/dtl) berdasarkan lprd_spk_nomor = nomor MAP.
const getBastDetail = async (nomor) => {
  if (!nomor) throw new Error("Nomor BAST wajib diisi.");

  const [mapRows] = await db.query(
    `SELECT
       m.mspk_nomor AS Nomor,
       m.mspk_tanggal AS Tanggal,
       m.mspk_nama AS Nama,
       m.mspk_nama2 AS Nama2,
       m.mspk_ukuran AS Ukuran,
       m.mspk_kain AS Kain,
       m.mspk_finishing AS Finishing,
       m.mspk_gramasi AS Gramasi,
       m.mspk_rencana_size AS RencanaSize,
       m.mspk_keterangan AS Keterangan,
       m.mspk_kendala AS Kendala,
       m.mspk_jumlah AS Jumlah,
       m.mspk_jumlah_jadi AS JumlahJadi,
       m.mspk_tipe AS Tipe,
       m.mspk_cab AS Cabang,
       m.mspk_workshop AS Workshop,
       m.mspk_sublim AS Sublim
     FROM tmemospk m
     WHERE m.mspk_nomor = ?
     LIMIT 1`,
    [nomor],
  );
  if (mapRows.length === 0) return null;
  const map = mapRows[0];

  const [checklist] = await db.query(
    `SELECT kode_sesuai AS no, kode_sesuai AS kode, status, keterangan
     FROM tkesesuaianmap WHERE mspk_nomor = ? ORDER BY kode_sesuai`,
    [nomor],
  );

  const [komponen] = await db.query(
    `SELECT c.nomor, c.kode, c.komponen, c.ketk, c.warna,
            c.babaran, c.babarank, c.mkb, c.no_urut,
            b.bhn_name AS bhn_name, b.bhn_satuan AS bhn_satuan
     FROM tkesesuaianmap_komponen c
     LEFT JOIN tbahan b ON b.bhn_kode = c.kode
     WHERE c.nomor = ? ORDER BY c.no_urut, c.kode`,
    [nomor],
  );

  const [obat] = await db.query(
    `SELECT o.ko_nomor AS nomor, o.ko_kode AS kode, o.ko_qty AS qty,
            o.ko_harga AS harga, o.no_urut,
            b.bhn_name AS nama, b.bhn_satuan AS satuan
     FROM tkesesuaianmap_obat o
     LEFT JOIN tbahan b ON b.bhn_kode = o.ko_kode
     WHERE o.ko_nomor = ? ORDER BY o.no_urut`,
    [nomor],
  );

  const [acc] = await db.query(
    `SELECT k.kode AS kode, b.bhn_name AS nama, b.bhn_satuan AS satuan
     FROM tkesesuaianmap_acc k
     LEFT JOIN tbahan b ON b.bhn_kode = k.kode
     WHERE k.nomor = ? ORDER BY k.kode`,
    [nomor],
  ).catch(() => [[]]);

  const [sizeRows] = await db.query(
    `SELECT ks_komponen AS komponen, ks_size AS size, ks_babaran AS babaran
     FROM tkesesuaianmap_size WHERE ks_nomor = ? ORDER BY ks_urut, ks_size`,
    [nomor],
  ).catch(() => [[]]);

  const [lockRows] = await db.query(
    `SELECT map, tgl, cab, apv, approved, alasan
     FROM tkesesuaianmap_lock WHERE map = ? LIMIT 1`,
    [nomor],
  );
  const lock = lockRows[0] || null;

  // Bahan + nomor proof dari LHK Proof (bisa lebih dari 1, ambil yang terbaru)
  // Kode & nama bahan diresolve via barcode -> tmasterstok_mmt -> tbarang_mmt
  const [proofRows] = await db.query(
    `SELECT h.lpr_nomor AS nomor_proof,
            DATE_FORMAT(h.lpr_tanggal, '%Y-%m-%d') AS tanggal_proof,
            d.lprd_spk_nomor AS spk_nomor,
            d.lprd_bahan AS bahan,
            d.lprd_barcode AS barcode,
            d.lprd_panjang AS panjang,
            d.lprd_lebar AS lebar,
            d.lprd_j_meter AS j_meter,
            s.mst_brg_kode AS kode_bahan,
            b.brg_nama AS nama_bahan,
            b.brg_satuan AS satuan_bahan
     FROM tlhk_proofmmt_dtl d
     INNER JOIN tlhk_proofmmt_hdr h ON h.lpr_nomor = d.lprd_lpr_nomor
     LEFT JOIN (
       SELECT mst_barcode, MAX(mst_brg_kode) AS mst_brg_kode
       FROM tmasterstok_mmt GROUP BY mst_barcode
     ) s ON s.mst_barcode = REPLACE(TRIM(d.lprd_barcode), '\t', '')
     LEFT JOIN tbarang_mmt b ON b.brg_kode = s.mst_brg_kode
     WHERE d.lprd_spk_nomor = ?
     ORDER BY h.lpr_tanggal DESC, h.lpr_nomor DESC`,
    [nomor],
  );

  const header = {
    mmpt_nomor: map.Nomor,
    mmpt_tanggal: map.Tanggal,
    mmpt_nama: map.Nama,
    mmpt_nama2: map.Nama2,
    mmpt_ukuran: map.Ukuran,
    mmpt_kain: map.Kain,
    mmpt_finishing: map.Finishing,
    mmpt_gramasi: map.Gramasi,
    mmpt_rencana_size: map.RencanaSize,
    mmpt_keterangan: map.Keterangan,
    mmpt_kendala: map.Kendala,
    mmpt_jumlah_jadi: map.JumlahJadi ?? map.Jumlah ?? 0,
    mmpt_tipe: map.Tipe || "Standard",
    mmpt_cabang: map.Cabang,
    mmpt_workshop: map.Workshop,
    mmpt_sublim: map.Sublim,
    mmpt_proof_number: proofRows[0]?.nomor_proof || "",
  };

  return {
    header,
    checklist: checklist.map((c) => ({
      no: c.no,
      kesesuaian:
        c.no === 1
          ? "Bahan"
          : c.no === 2
            ? "Desain"
            : c.no === 3
              ? "Model Finishing"
              : c.no === 4
                ? "Ukuran"
                : "Babaran",
      status: c.status,
      keterangan: c.keterangan,
    })),
    komponen: komponen.map((k) => ({
      kode: k.kode || "",
      bhn_name: k.bhn_name || "",
      bhn_satuan: k.bhn_satuan || "",
      komponen: k.komponen || "",
      warna: k.warna || "",
      babaran: Number(k.babaran) || 0,
      babarank: Number(k.babarank) || 0,
    })),
    aksesoris: (obat || []).map((o) => ({
      kode: o.kode || "",
      nama: o.nama || "",
      satuan: o.satuan || "",
      qty: Number(o.qty) || 0,
      note: "",
    })),
    obat,
    acc: acc || [],
    sizeBreakdown: (sizeRows || []).map((s) => ({
      komponen: s.komponen || "",
      size: s.size || "",
      babaran: Number(s.babaran) || 0,
    })),
    lock,
    isLocked: !!lock,
    isApproved: lock?.apv === "Y",
    alasanApproval: lock?.alasan || "",
    proof: proofRows[0] || null,
    proofList: proofRows,
  };
};

// --- GET SIZES (untuk dropdown babaran per size di form) ---
const getSizes = async (nomor) => {
  const [mapSize] = await db.query(
    `SELECT mspks_size AS size FROM tmemospk_size WHERE mspks_nomor = ? ORDER BY mspks_size`,
    [nomor],
  ).catch(() => [[]]);
  if (mapSize && mapSize.length > 0) {
    return mapSize.map((r) => ({ mmpts_size: r.size, size: r.size }));
  }
  const [bastSize] = await db.query(
    `SELECT DISTINCT ks_size AS size FROM tkesesuaianmap_size WHERE ks_nomor = ? ORDER BY ks_size`,
    [nomor],
  ).catch(() => [[]]);
  return (bastSize || []).map((r) => ({ mmpts_size: r.size, size: r.size }));
};

// --- GET PROOF BY SPK (untuk form Baru: setelah pilih SPK lookup) ---
const getProofBySpk = async (spkNomor) => {
  const [rows] = await db.query(
    `SELECT h.lpr_nomor AS nomor_proof,
            DATE_FORMAT(h.lpr_tanggal, '%Y-%m-%d') AS tanggal_proof,
            d.lprd_spk_nomor AS spk_nomor,
            d.lprd_bahan AS bahan,
            d.lprd_barcode AS barcode,
            d.lprd_panjang AS panjang,
            d.lprd_lebar AS lebar,
            s.mst_brg_kode AS kode_bahan,
            b.brg_nama AS nama_bahan,
            b.brg_satuan AS satuan_bahan
     FROM tlhk_proofmmt_dtl d
     INNER JOIN tlhk_proofmmt_hdr h ON h.lpr_nomor = d.lprd_lpr_nomor
     LEFT JOIN (
       SELECT mst_barcode, MAX(mst_brg_kode) AS mst_brg_kode
       FROM tmasterstok_mmt GROUP BY mst_barcode
     ) s ON s.mst_barcode = REPLACE(TRIM(d.lprd_barcode), '\t', '')
     LEFT JOIN tbarang_mmt b ON b.brg_kode = s.mst_brg_kode
     WHERE d.lprd_spk_nomor = ?
     ORDER BY h.lpr_tanggal DESC, h.lpr_nomor DESC
     LIMIT 5`,
    [spkNomor],
  );
  return rows;
};

// --- DELETE BAST ---
const deleteBast = async (nomor, userKode) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Hapus dari tabel utama BAST
    await conn.query(`DELETE FROM tkesesuaianmap WHERE mspk_nomor = ?`, [
      nomor,
    ]);

    // 2. Reset data di tmemospk (Sesuai logic Delphi)
    await conn.query(
      `UPDATE tmemospk SET mspk_jumlah_jadi = 0, mspk_kendala = "", mspk_tipe = NULL WHERE mspk_nomor = ?`,
      [nomor],
    );

    // 3. Hapus tabel-tabel pendukung terkait BAST
    await conn.query(`DELETE FROM tkesesuaianmap_komponen WHERE nomor = ?`, [
      nomor,
    ]);
    await conn.query(`DELETE FROM tkesesuaianmap_obat WHERE ko_nomor = ?`, [
      nomor,
    ]);
    await conn.query(`DELETE FROM tkesesuaianmap_lock WHERE map = ?`, [nomor]);

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// --- GET EXPORT DETAIL ---
const getExportDetail = async (filters, userCabang) => {
  // 1. Ambil data master/header dengan filter yang sama persis
  const headers = await getBrowseList(filters, userCabang);
  if (headers.length === 0) return [];

  const mapNomors = headers.map((h) => h.Nomor);
  const placeholders = mapNomors.map(() => "?").join(",");

  // 2. Ambil data Komponen (Bahan)
  // Sesuai struktur: menggunakan c.nomor, c.kode, dan c.babaran
  const [komponen] = await db.query(
    `
    SELECT
      c.nomor AS Nomor,
      c.kode AS Kode,
      b.bhn_name AS Nama,
      c.babaran AS Qty,
      b.bhn_satuan AS Satuan,
      'KOMPONEN' AS Jenis
    FROM tkesesuaianmap_komponen c
    LEFT JOIN tbahan b ON b.bhn_kode = c.kode
    WHERE c.nomor IN (${placeholders})
  `,
    mapNomors,
  );

  // 3. Ambil data Obat
  // Sesuai struktur: menggunakan o.ko_nomor, o.ko_kode, dan o.ko_qty
  const [obat] = await db.query(
    `
    SELECT
      o.ko_nomor AS Nomor,
      o.ko_kode AS Kode,
      b.bhn_name AS Nama,
      o.ko_qty AS Qty,
      b.bhn_satuan AS Satuan,
      'OBAT' AS Jenis
    FROM tkesesuaianmap_obat o
    LEFT JOIN tbahan b ON b.bhn_kode = o.ko_kode
    WHERE o.ko_nomor IN (${placeholders})
  `,
    mapNomors,
  );

  const allDetails = [...komponen, ...obat];

  // 4. Gabungkan ke dalam objek headers
  return headers.map((h) => ({
    ...h,
    details: allDetails.filter((d) => d.Nomor === h.Nomor),
  }));
};

module.exports = {
  getBrowseList,
  getBastDetail,
  getSizes,
  getProofBySpk,
  deleteBast,
  getExportDetail,
};

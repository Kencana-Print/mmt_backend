// controllers/sjHasilMaklon.controller.js
const service = require('../services/sjHasilMaklon.service');

const getUserCabang = (req) => {
  const u = req.user;
  const kode = String(u?.kode || u?.kdUser || u?.username || "").trim().toUpperCase();
  const bagian = String(u?.bagian || u?.user_bagian || "").trim().toUpperCase();
  const cab = String(u?.cabang || u?.cab || "").trim().toUpperCase();
  const isAdmin =
    kode === "ADMIN" ||
    kode === "ESTI" ||
    bagian === "ADMIN" ||
    cab === "HO" ||
    u?.divisi === 0;
  if (isAdmin) return null;
  return req.user?.cabang ?? req.user?.cab ?? req.user?.Cab ?? null;
};

exports.getOutstanding = async (req, res) => {
  try {
    const { startDate, endDate, cab, semuaCabang, keyword } = req.query;
    const cabangFilter = (semuaCabang === 'true' || semuaCabang === true)
      ? null
      : (cab !== undefined ? cab : getUserCabang(req));

    const data = await service.getOutstanding({
      startDate,
      endDate,
      cab: cabangFilter,
      semuaCabang: semuaCabang === 'true' || semuaCabang === true,
      keyword,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GET /sj-hasil-maklon/outstanding', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableMaklon = async (req, res) => {
  try {
    const { cab, semuaCabang } = req.query;
    const cabangFilter = (semuaCabang === 'true' || semuaCabang === true)
      ? null
      : (cab !== undefined ? cab : getUserCabang(req));

    const data = await service.getAvailableMaklon({
      cab: cabangFilter,
      semuaCabang: semuaCabang === 'true' || semuaCabang === true,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GET /sj-hasil-maklon/available-maklon', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { startDate, endDate, cab, semuaCabang, keyword } = req.query;
    const cabangFilter = (semuaCabang === 'true' || semuaCabang === true)
      ? null
      : (cab !== undefined ? cab : getUserCabang(req));

    const data = await service.getHistory({
      startDate,
      endDate,
      cab: cabangFilter,
      semuaCabang: semuaCabang === 'true' || semuaCabang === true,
      keyword,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GET /sj-hasil-maklon/history', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHistoryDetail = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await service.getHistoryDetail(nomor);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`GET /sj-hasil-maklon/history/${req.params?.nomor}/detail`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCreateData = async (req, res) => {
  try {
    const rawIds = req.query.ids;
    const ids = rawIds ? String(rawIds).split(",").map((s) => s.trim()).filter(Boolean) : [];
    const mklNomor = req.query.mklNomor ? String(req.query.mklNomor).trim() : null;
    const data = await service.getCreateData({ ids, mklNomor });
    res.json({ success: true, data });
  } catch (error) {
    console.error('GET /sj-hasil-maklon/create-data', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const result = await service.createSjHasilMaklon(req.body, req.user);
    res.json({
      success: true,
      message: "SJ Hasil Maklon berhasil disimpan.",
      data: result,
    });
  } catch (error) {
    console.error('POST /sj-hasil-maklon/save', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getPrintData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await service.getPrintData(nomor);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`GET /sj-hasil-maklon/print/${req.params?.nomor}`, error);
    res.status(404).json({ success: false, message: error.message });
  }
};

const bastMapService = require("../services/bastMap.service");

// --- GET BROWSE LIST ---
const getBrowseList = async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      onProgressOnly: req.query.onProgress,
      search: req.query.search,
      cabang: req.query.cabang,
      workshop: req.query.workshop,
      sublim: req.query.sublim,
    };

    const userCabang =
      req.user?.cabang ||
      req.user?.cab ||
      req.user?.Cab ||
      req.user?.cabang_kode ||
      "ALL";

    const data = await bastMapService.getBrowseList(filters, userCabang);

    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil data browse BAST MAP",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

// --- GET DETAIL BAST (untuk form Ubah) ---
const getBastDetail = async (req, res, next) => {
  try {
    const { nomor } = req.params;
    const data = await bastMapService.getBastDetail(nomor);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: `Data BAST ${nomor} tidak ditemukan.`,
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// --- GET SIZES ---
const getSizes = async (req, res, next) => {
  try {
    const { nomor } = req.params;
    const data = await bastMapService.getSizes(nomor);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// --- GET PROOF BY SPK (bahan + nomor proof dari LHK Proof) ---
const getProofBySpk = async (req, res, next) => {
  try {
    const { spk } = req.params;
    const data = await bastMapService.getProofBySpk(spk);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// --- DELETE BAST ---
const deleteBast = async (req, res, next) => {
  try {
    const { nomor } = req.params;
    const userKode = req.user?.kode || "SYSTEM";

    await bastMapService.deleteBast(nomor, userKode);

    return res.status(200).json({
      status: true,
      message: `BAST MAP dengan nomor ${nomor} berhasil dihapus.`,
    });
  } catch (error) {
    next(error);
  }
};

// --- GET EXPORT DETAIL ---
const getExportDetail = async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      onProgressOnly: req.query.onProgress,
      search: req.query.search,
      cabang: req.query.cabang,
      workshop: req.query.workshop,
      sublim: req.query.sublim,
    };

    const userCabang =
      req.user?.cabang ||
      req.user?.cab ||
      req.user?.Cab ||
      req.user?.cabang_kode ||
      "ALL";

    const data = await bastMapService.getExportDetail(filters, userCabang);

    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil data export detail BAST MAP",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBrowseList,
  getBastDetail,
  getSizes,
  getProofBySpk,
  deleteBast,
  getExportDetail,
};

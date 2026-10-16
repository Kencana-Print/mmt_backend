// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const lhkLipatService = require('../../services/spanduk/lhkLipatSpanduk.service');

// GET /browse?startDate=&endDate= (keduanya opsional; kosong = tanpa filter tanggal)
exports.getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await lhkLipatService.getBrowseList(startDate, endDate);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /:nomor/detail
exports.getDetail = async (req, res) => {
  try {
    const { nomor } = req.params;

    if (!nomor) {
      return res.status(400).json({
        success: false,
        message: 'Parameter nomor wajib diisi.',
      });
    }

    const data = await lhkLipatService.getDetail(nomor);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET form edit: header + details (tidak mengubah endpoint browse/detail).
exports.getForm = async (req, res) => {
  try {
    const { nomor } = req.params;
    if (!nomor) {
      return res.status(400).json({
        success: false,
        message: 'Parameter nomor wajib diisi.',
      });
    }
    const data = await lhkLipatService.getFormDetail(nomor);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: `Nomor ${nomor} tidak ditemukan.`,
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const resolveUserKode = (req) =>
  req.user?.kdUser || req.user?.kode || req.user?.username || 'SYSTEM';

// POST new / PUT edit (payload: { nomor?, tanggal, pabKode, details[] }).
const doSave = async (req, res) => {
  try {
    const result = await lhkLipatService.saveData(req.body || {}, resolveUserKode(req));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.createData = doSave;
exports.updateData = doSave;

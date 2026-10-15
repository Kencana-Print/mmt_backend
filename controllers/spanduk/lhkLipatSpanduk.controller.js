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

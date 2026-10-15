// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const lhkAfdrukService = require('../../services/spanduk/lhkAfdrukSpanduk.service');

exports.getBrowseList = async (req, res) => {
    try {
        // Tanggal opsional: kosong = tanpa filter (JANGAN kirim zero-date).
        const { startDate, endDate } = req.query;

        const data = await lhkAfdrukService.getBrowseList(startDate, endDate);

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) {
            return res.status(400).json({
                success: false,
                message: 'Parameter nomor wajib diisi.'
            });
        }

        const data = await lhkAfdrukService.getDetail(nomor);

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

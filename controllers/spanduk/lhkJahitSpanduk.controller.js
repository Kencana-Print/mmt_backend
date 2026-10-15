// Path disesuaikan keluar dari /controllers/spanduk menuju folder services
const lhkJahitService = require('../../services/spanduk/lhkJahitSpanduk.service');

exports.getBrowse = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Tanggal opsional: kosong = tanpa filter (guard ada di service).
        const data = await lhkJahitService.getBrowseList(startDate || '', endDate || '');

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

        const data = await lhkJahitService.getDetail(nomor);

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

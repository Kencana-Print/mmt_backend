// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const rekapLhkService = require('../../services/spanduk/rekapLhkSpanduk.service');

exports.getBrowseList = async (req, res) => {
    try {
        // Tanggal opsional: kosong = tanpa filter (JANGAN kirim zero-date).
        // Perusahaan opsional (Delphi: spk_perush_kode LIKE '%...%').
        const { startDate, endDate, perusahaan } = req.query;

        const data = await rekapLhkService.getBrowseList(startDate, endDate, perusahaan || '');

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

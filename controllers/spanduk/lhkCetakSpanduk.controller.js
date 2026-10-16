// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const lhkCetakService = require('../../services/spanduk/lhkCetakSpanduk.service');

exports.getBrowseList = async (req, res) => {
    try {
        // Tanggal opsional: kosong = tanpa filter (JANGAN kirim zero-date).
        const { startDate, endDate } = req.query;

        const data = await lhkCetakService.getBrowseList(startDate, endDate);

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

        const data = await lhkCetakService.getDetail(nomor);

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

exports.getFormDetail = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) {
            return res.status(400).json({
                success: false,
                message: 'Parameter nomor wajib diisi.'
            });
        }

        const data = await lhkCetakService.getFormDetail(nomor);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: `Data LHK cetak ${nomor} tidak ditemukan.`
            });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getUserKode = (req) =>
    String(req.user?.kdUser || req.user?.KDUSER || req.user?.username || 'SYSTEM');

exports.create = async (req, res) => {
    try {
        const result = await lhkCetakService.saveData(
            { ...req.body, nomor: '' },
            getUserKode(req)
        );
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) {
            return res.status(400).json({
                success: false,
                message: 'Parameter nomor wajib diisi.'
            });
        }

        const result = await lhkCetakService.saveData(
            { ...req.body, nomor },
            getUserKode(req)
        );
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

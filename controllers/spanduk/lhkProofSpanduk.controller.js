// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const lhkProofService = require('../../services/spanduk/lhkProofSpanduk.service');

exports.getBrowseList = async (req, res) => {
    try {
        // Tanggal opsional: kosong = tanpa filter (JANGAN kirim zero-date).
        const { startDate, endDate } = req.query;

        const data = await lhkProofService.getBrowseList(startDate, endDate);

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

        const data = await lhkProofService.getDetail(nomor);

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

// GET form edit: header + details (endpoint browse/detail di atas tidak diubah).
exports.getForm = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!nomor) {
            return res.status(400).json({
                success: false,
                message: 'Parameter nomor wajib diisi.'
            });
        }
        const data = await lhkProofService.getFormDetail(nomor);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: `Nomor ${nomor} tidak ditemukan.`
            });
        }
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const resolveUserKode = (req) =>
    req.user?.kdUser || req.user?.kode || req.user?.username || 'SYSTEM';

// POST new / PUT edit (payload: { nomor?, tanggal, pab_kode, details[] }).
const doSave = async (req, res) => {
    try {
        const result = await lhkProofService.saveData(req.body || {}, resolveUserKode(req));
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.createData = doSave;
exports.updateData = doSave;

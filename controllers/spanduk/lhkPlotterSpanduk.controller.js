// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const lhkPlotterService = require('../../services/spanduk/lhkPlotterSpanduk.service');

exports.getBrowseList = async (req, res) => {
    try {
        // Tanggal opsional: kosong = tanpa filter (JANGAN kirim zero-date).
        const { startDate, endDate } = req.query;

        const data = await lhkPlotterService.getBrowseList(startDate, endDate);

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

        const data = await lhkPlotterService.getDetail(nomor);

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

const userKodeOf = (req) =>
    req.user?.kdUser || req.user?.kode || req.user?.username || 'SYSTEM';

// GET /form/:nomor — data form edit (header + details).
exports.getFormDetail = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!nomor) {
            return res.status(400).json({
                success: false,
                message: 'Parameter nomor wajib diisi.'
            });
        }
        const data = await lhkPlotterService.getFormDetail(nomor);
        if (!data.header) {
            return res.status(404).json({
                success: false,
                message: `LHK ${nomor} tidak ditemukan.`
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

// GET /spk/:spkNomor — resolve 1 SPK (autofill grid form).
exports.resolveSpk = async (req, res) => {
    try {
        const { spkNomor } = req.params;
        const data = await lhkPlotterService.resolveSpk(spkNomor);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: `SPK ${spkNomor} tidak ditemukan.`
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

// POST / — simpan baru (nomor auto). PUT /:nomor — ubah.
const saveHandler = async (req, res) => {
    try {
        const payload = { ...(req.body || {}) };
        if (req.params.nomor) payload.nomor = req.params.nomor;
        const result = await lhkPlotterService.saveData(payload, userKodeOf(req));
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        const clientError =
            /wajib|minimal|duplikat|tidak ditemukan|tidak valid/i.test(error.message);
        return res.status(clientError ? 400 : 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.create = saveHandler;
exports.update = saveHandler;

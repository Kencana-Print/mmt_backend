const quiringService = require("../../services/spanduk/lhkQuiringSpanduk.service");

exports.getBrowse = async (req, res) => {
    try {
        const { startDate = "", endDate = "" } = req.query;
        const data = await quiringService.getBrowseList(startDate, endDate);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat browse LHK Quiring.", error: error.message });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!String(nomor || "").trim()) {
            return res.status(400).json({ message: "Nomor LHK wajib diisi." });
        }
        const data = await quiringService.getDetail(nomor);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat detail LHK Quiring.", error: error.message });
    }
};

// GET form edit: header + detail (cermin Delphi loaddata).
exports.getForm = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!String(nomor || "").trim()) {
            return res.status(400).json({ message: "Nomor LHK wajib diisi." });
        }
        const data = await quiringService.getFormDetail(nomor);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(404).json({ message: "Data LHK Quiring tidak ditemukan.", error: error.message });
    }
};

const resolveUserKode = (req) =>
    String(
        req.user?.kdUser || req.user?.KDUSER || req.user?.username ||
        req.body?.userKode || req.body?.user_kode || "SYSTEM"
    ).substring(0, 20);

// POST form baru (cermin Delphi simpandata mode insert; nomor digenerate).
exports.create = async (req, res) => {
    try {
        const result = await quiringService.saveData({ ...req.body, nomor: "" }, resolveUserKode(req));
        return res.status(201).json({ message: "LHK Quiring berhasil disimpan.", nomor: result.nomor });
    } catch (error) {
        return res.status(500).json({ message: "Gagal menyimpan LHK Quiring.", error: error.message });
    }
};

// PUT form edit (cermin Delphi simpandata mode FLAGEDIT).
exports.update = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!String(nomor || "").trim()) {
            return res.status(400).json({ message: "Nomor LHK wajib diisi." });
        }
        const result = await quiringService.saveData({ ...req.body, nomor }, resolveUserKode(req));
        return res.status(200).json({ message: "LHK Quiring berhasil disimpan.", nomor: result.nomor });
    } catch (error) {
        return res.status(500).json({ message: "Gagal menyimpan LHK Quiring.", error: error.message });
    }
};

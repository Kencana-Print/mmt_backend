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

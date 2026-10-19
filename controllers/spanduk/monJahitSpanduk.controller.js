const monJahitSpanduk = require('../../services/spanduk/monJahitSpanduk.service');

// GET /api/spanduk/mon-jahit/browse?startDate=&endDate=&perusahaan=
exports.getBrowseList = async (req, res) => {
    try {
        const { startDate, endDate, perusahaan } = req.query;

        const data = await monJahitSpanduk.getBrowseList(startDate, endDate, perusahaan);

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

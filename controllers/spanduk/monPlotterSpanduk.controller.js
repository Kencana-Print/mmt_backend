const monPlotterSpanduk = require('../../services/spanduk/monPlotterSpanduk.service');

// GET /api/spanduk/mon-plotter/browse?startDate=&endDate=&perusahaan=
exports.getBrowseList = async (req, res) => {
    try {
        const { startDate, endDate, perusahaan } = req.query;

        const data = await monPlotterSpanduk.getBrowseList(startDate, endDate, perusahaan);

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

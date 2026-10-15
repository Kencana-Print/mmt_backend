const dashboardService = require('../services/dashboard.service'); // Sesuaikan path file service Anda

/**
 * Mengambil data top 10 antrean cetak yang mepet deadline
 */
const getTopDeadlineCetak = async (req, res) => {
    try {
        const data = await dashboardService.getTopDeadlineCetak();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mengambil daftar permintaan bahan yang belum terealisasi (pending)
 */
const getPermintaanBahanPending = async (req, res) => {
    try {
        const data = await dashboardService.getPermintaanBahanPending();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPermintaanBahanPendingTotal = async (req, res) => {
    try {
        // Memanggil fungsi service baru yang sudah kita buat sebelumnya (tanpa LIMIT 15)
        const data = await dashboardService.getPermintaanBahanTotalFull();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getTopDeadlineCetakTotal = async (req, res) => {
    try {
        // Memanggil fungsi service baru tanpa LIMIT yang kita buat sebelumnya
        const data = await dashboardService.getTopDeadlineCetakTotalFull();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getGrafikBsBulanan = async (req, res) => {
    try {
        const result = await dashboardService.getGrafikBsBulanan();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getFunnelProduksi = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await dashboardService.getFunnelProduksi(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getKomitmenAktif = async (req, res) => {
    try {
        const data = await dashboardService.getKomitmenAktif();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getStokMenipis = async (req, res) => {
    try {
        const data = await dashboardService.getStokMenipis();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getJadwalTerlambat = async (req, res) => {
    try {
        const data = await dashboardService.getJadwalTerlambat();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBsRate = async (req, res) => {
    try {
        const data = await dashboardService.getBsRate();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSpkAktif = async (req, res) => {
    try {
        const data = await dashboardService.getSpkAktif();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getTopDeadlineCetak,
    getPermintaanBahanPending,
    getPermintaanBahanPendingTotal,
    getTopDeadlineCetakTotal,
    getGrafikBsBulanan,
    getFunnelProduksi,
    getKomitmenAktif,
    getStokMenipis,
    getJadwalTerlambat,
    getBsRate,
    getSpkAktif
};
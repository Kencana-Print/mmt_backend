const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const SPKS = ['JA-MT-00699', 'KP-MT-005732', 'KP-MT-005730', 'KP-MT-005722', 'KP-MT-005721'];
(async () => {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM tspk`);
    console.log('== kolom tspk ==');
    console.log(cols.map((c) => c.Field).join(', '));

    const [rows] = await pool.query(
      `SELECT * FROM tspk WHERE spk_nomor IN (${SPKS.map(() => '?').join(',')})`, SPKS);
    console.log('\n== tspk ==');
    for (const r of rows) {
      const pick = {};
      for (const k of Object.keys(r)) if (k.includes('panjang') || k.includes('lebar') || k.includes('jumlah') || k.includes('orientasi') || k.includes('nama') || k.includes('nomor') || k.includes('tile')) pick[k] = r[k];
      console.log(JSON.stringify(pick));
    }

    const [lhks] = await pool.query(
      `SELECT ld_lnomor, COUNT(*) n FROM tlhk_mesin_dtl WHERE ld_spk_nomor IN (${SPKS.map(() => '?').join(',')}) GROUP BY ld_lnomor ORDER BY ld_lnomor DESC LIMIT 10`, SPKS);
    console.log('\n== LHK yang memuat SPK tsb ==');
    console.log(lhks);
  } catch (e) { console.error('ERR', e.message); }
  finally { await pool.end(); }
})();

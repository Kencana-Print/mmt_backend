const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const EPS = 1e-6;

// ---- build units (per piece) ----
function buildUnits(ds) {
  const W = Number(ds[0]?.ld_ambilbahan_lebar || 0);
  const units = [];
  ds.forEach((d, i) => {
    const n = Math.floor(Number(d.ld_total_qtycetak || 0));
    const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100;
    const ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
    const w = Number(d.spk_panjang || 0) + ps;
    const h = Number(d.spk_lebar || 0) + pa;
    if (n <= 0 || w <= 0 || h <= 0) return;
    for (let k = 0; k < n; k++) units.push({ spk: i, w, h });
  });
  return { W, units };
}

// ---- skyline packer ----
function skyline(W, units, scoreFn) {
  const sky = [{ x0: 0, x1: 0, y: 0 }]; // starts empty
  let maxX = 0;
  const placed = [];
  const segs = () => sky;
  for (const u of units) {
    const xs = new Set([0]);
    for (const s of sky) xs.add(s.x0);
    let best = null;
    for (const x of xs) {
      // y = max skyline over [x, x+u.w]
      let y = 0, sum = 0, ok = true;
      const x2 = x + u.w;
      for (const s of sky) {
        if (s.x1 <= x + EPS || s.x0 >= x2 - EPS) continue;
        const a = Math.max(s.x0, x), b = Math.min(s.x1, x2);
        if (s.y > y) y = s.y;
        sum += (b - a);
      }
      // also account for gaps where no segment exists => y=0 there
      sum += (u.w - sum); // uncovered area treated as y=0
      if (y + u.h > W + EPS) { ok = false; }
      if (!ok) continue;
      const score = scoreFn({ x, y, w: u.w, h: u.h, waste: sum * 0 /*placeholder*/ });
      if (!best || score < best.score - 1e-9) best = { x, y, score };
    }
    if (!best) { // force at far right top
      best = { x: maxX, y: 0, score: 0 };
    }
    placed.push({ ...u, x: best.x, y: best.y });
    // update skyline: set [x, x+w] to y+h
    const nx0 = best.x, nx1 = best.x + u.w, ny = best.y + u.h;
    const next = [];
    for (const s of sky) {
      if (s.x1 <= nx0 + EPS || s.x0 >= nx1 - EPS) { next.push(s); continue; }
      if (s.x0 < nx0 - EPS) next.push({ x0: s.x0, x1: nx0, y: s.y });
      if (s.x1 > nx1 + EPS) next.push({ x0: nx1, x1: s.x1, y: s.y });
    }
    next.push({ x0: nx0, x1: nx1, y: ny });
    next.sort((a, b) => a.x0 - b.x0);
    // merge
    sky.length = 0;
    for (const s of next) {
      const last = sky[sky.length - 1];
      if (last && Math.abs(last.y - s.y) < EPS && Math.abs(last.x1 - s.x0) < EPS) last.x1 = s.x1;
      else sky.push({ ...s });
    }
    if (nx1 > maxX) maxX = nx1;
  }
  return { len: maxX, placed };
}

const scoreBL = (p) => p.y * 1000 + p.x;
const scoreBLT = (p) => (p.y + p.h) * 1000 + p.x;

(async () => {
  const [hdrs] = await pool.query(`
    SELECT d.ld_lnomor, COUNT(*) n FROM tlhk_mesin_dtl d GROUP BY d.ld_lnomor HAVING n BETWEEN 3 AND 9 ORDER BY d.ld_lnomor DESC LIMIT 200`);
  let s1 = 0, s2 = 0, cnt = 0;
  for (const r of hdrs) {
    const [ds] = await pool.query(`
      SELECT s.spk_panjang, s.spk_lebar, d.ld_total_qtycetak, d.ld_padding_atas, d.ld_padding_samping, d.ld_ambilbahan_lebar
      FROM tlhk_mesin_dtl d LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor WHERE d.ld_lnomor=? ORDER BY d.ld_urut`, [r.ld_lnomor]);
    const { W, units } = buildUnits(ds);
    if (W <= 0.01 || units.length < 2) continue;
    // sort units: height desc, width desc, keep spk order
    const sorted = [...units].sort((a, b) => b.h - a.h || b.w - a.w || a.spk - b.spk);
    const a = skyline(W, sorted, scoreBL);
    const b = skyline(W, sorted, scoreBLT);
    s1 += a.len; s2 += b.len; cnt++;
    if (r.ld_lnomor === 'MMT-LHK-M.2607.0338') {
      console.log('0338 BL len=', a.len.toFixed(2), 'BLT len=', b.len.toFixed(2));
      console.log('  BL placed:', a.placed.map((p) => `S${p.spk + 1}(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(' '));
    }
  }
  console.log(`\nLHKs=${cnt} avgLen BL=${(s1 / cnt).toFixed(2)} BLT=${(s2 / cnt).toFixed(2)}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

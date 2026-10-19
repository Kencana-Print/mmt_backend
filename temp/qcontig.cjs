const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const EPS = 1e-6;

function skylinePacker(W) {
  let sky = [{ x0: 0, x1: 0, y: 0 }]; let maxX = 0;
  const place = (w, h) => {
    const xs = new Set([0]); for (const s of sky) xs.add(s.x0);
    let best = null;
    for (const x of xs) {
      let y = 0; const x2 = x + w;
      for (const s of sky) { if (s.x1 <= x + EPS || s.x0 >= x2 - EPS) continue; if (s.y > y) y = s.y; }
      if (y + h > W + EPS) continue;
      const score = y * 1000 + x;
      if (!best || score < best.score - 1e-9) best = { x, y, score };
    }
    if (!best) best = { x: maxX, y: 0 };
    const nx0 = best.x, nx1 = best.x + w, ny = best.y + h;
    const next = [];
    for (const s of sky) { if (s.x1 <= nx0 + EPS || s.x0 >= nx1 - EPS) { next.push(s); continue; }
      if (s.x0 < nx0 - EPS) next.push({ x0: s.x0, x1: nx0, y: s.y });
      if (s.x1 > nx1 + EPS) next.push({ x0: nx1, x1: s.x1, y: s.y }); }
    next.push({ x0: nx0, x1: nx1, y: ny }); next.sort((a, b) => a.x0 - b.x0);
    sky = []; for (const s of next) { const l = sky[sky.length - 1]; if (l && Math.abs(l.y - s.y) < EPS && Math.abs(l.x1 - s.x0) < EPS) l.x1 = s.x1; else sky.push({ ...s }); }
    if (nx1 > maxX) maxX = nx1;
    return { x: best.x, y: best.y, w, h };
  };
  return { place, len: () => maxX };
}

function components(rects) {
  const n = rects.length; const seen = new Array(n).fill(false); let comps = 0;
  const touch = (a, b) => {
    const ovx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const ovy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const adj = (Math.abs(ovx) < 1e-4 && ovy > 1e-4) || (Math.abs(ovy) < 1e-4 && ovx > 1e-4);
    return adj || (ovx > 1e-4 && ovy > 1e-4);
  };
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue; comps++; const st = [i]; seen[i] = true;
    while (st.length) { const u = st.pop(); for (let v = 0; v < n; v++) if (!seen[v] && touch(rects[u], rects[v])) { seen[v] = true; st.push(v); } }
  }
  return comps;
}

(async () => {
  const [hdrs] = await pool.query(`SELECT d.ld_lnomor FROM tlhk_mesin_dtl d GROUP BY d.ld_lnomor HAVING COUNT(*) BETWEEN 3 AND 12 ORDER BY d.ld_lnomor DESC LIMIT 250`);
  let split = 0, multi = 0, tested = 0;
  for (const r of hdrs) {
    const [ds] = await pool.query(`SELECT s.spk_panjang, s.spk_lebar, d.ld_total_qtycetak, d.ld_padding_atas, d.ld_padding_samping, d.ld_ambilbahan_lebar FROM tlhk_mesin_dtl d LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor WHERE d.ld_lnomor=? ORDER BY d.ld_urut`, [r.ld_lnomor]);
    const W = Number(ds[0]?.ld_ambilbahan_lebar || 0); if (W <= 0.01) continue;
    const groups = [];
    ds.forEach((d) => {
      const n = Math.floor(Number(d.ld_total_qtycetak || 0));
      const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100, ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
      const w = Number(d.spk_panjang || 0) + ps, h = Number(d.spk_lebar || 0) + pa;
      if (n <= 0 || w <= 0 || h <= 0) return;
      const arr = []; for (let k = 0; k < n; k++) arr.push({ w, h });
      groups.push(arr);
    });
    if (groups.length < 2) continue;
    tested++;
    const pk = skylinePacker(W);
    for (const g of groups) {
      const rects = g.map((it) => pk.place(it.w, it.h));
      if (rects.length > 1) { multi++; if (components(rects) > 1) { split++; if (split <= 8) console.log('SPLIT', r.ld_lnomor, 'n=', rects.length, rects.map((q) => `(${q.x.toFixed(1)},${q.y.toFixed(1)})`).join(' ')); } }
    }
  }
  console.log(`\ntested LHK=${tested} multi-unit SPK=${multi} yang terpecah=${split}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

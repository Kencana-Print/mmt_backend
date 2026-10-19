const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const EPS = 1e-6;

function mkSky() { return { sky: [{ x0: 0, x1: 0, y: 0 }], maxX: 0 }; }
function skylineMax(sky, x, w) {
  let y = 0; const x2 = x + w;
  for (const s of sky) { if (s.x1 <= x + EPS || s.x0 >= x2 - EPS) continue; if (s.y > y) y = s.y; }
  return y;
}
function skylineSet(st, x0, x1, ny) {
  const next = [];
  for (const s of st.sky) { if (s.x1 <= x0 + EPS || s.x0 >= x1 - EPS) { next.push(s); continue; }
    if (s.x0 < x0 - EPS) next.push({ x0: s.x0, x1: x0, y: s.y });
    if (s.x1 > x1 + EPS) next.push({ x0: x1, x1: s.x1, y: s.y }); }
  next.push({ x0, x1, y: ny }); next.sort((a, b) => a.x0 - b.x0);
  const out = []; for (const s of next) { const l = out[out.length - 1]; if (l && Math.abs(l.y - s.y) < EPS && Math.abs(l.x1 - s.x0) < EPS) l.x1 = s.x1; else out.push({ ...s }); }
  st.sky = out; if (x1 > st.maxX) st.maxX = x1;
}

// place a rigid block (cols wide) at bottom-left; occupy only actual cells (notch stays free)
function placeBlockPartial(st, W, w, h, n, rows) {
  if (!(rows > 0)) return { x: st.maxX, y: 0 };
  const cols = Math.ceil(n / rows);
  const bw = cols * w;
  const xs = new Set([0]); for (const s of st.sky) xs.add(s.x0);
  let best = null;
  for (const x of xs) {
    const y = skylineMax(st.sky, x, bw);
    // height check: every column's top must be <= W
    let ok = true;
    for (let c = 0; c < cols; c++) {
      const cnt = Math.min(rows, n - c * rows);
      const ch = cnt * h;
      if (y + ch > W + EPS) { ok = false; break; }
    }
    if (!ok) continue;
    const score = y * 1000 + x;
    if (!best || score < best.score - 1e-9) best = { x, y, score };
  }
  if (!best) best = { x: st.maxX, y: 0 };
  const { x, y } = best;
  for (let c = 0; c < cols; c++) {
    const cnt = Math.min(rows, n - c * rows);
    if (cnt <= 0) continue;
    skylineSet(st, x + c * w, x + (c + 1) * w, y + cnt * h);
  }
  return { x, y };
}

(async () => {
  const [hdrs] = await pool.query(`SELECT d.ld_lnomor FROM tlhk_mesin_dtl d GROUP BY d.ld_lnomor HAVING COUNT(*) BETWEEN 3 AND 12 ORDER BY d.ld_lnomor DESC LIMIT 250`);
  let partial = 0, full = 0, cnt = 0;
  for (const r of hdrs) {
    const [ds] = await pool.query(`SELECT s.spk_panjang, s.spk_lebar, d.ld_total_qtycetak, d.ld_tile, d.ld_padding_atas, d.ld_padding_samping, d.ld_ambilbahan_lebar FROM tlhk_mesin_dtl d LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor WHERE d.ld_lnomor=? ORDER BY d.ld_urut`, [r.ld_lnomor]);
    const W = Number(ds[0]?.ld_ambilbahan_lebar || 0); if (W <= 0.01) continue;
    const spec = [];
    ds.forEach((d) => {
      const n = Math.floor(Number(d.ld_total_qtycetak || 0)); const tile = Number(d.ld_tile || 1);
      const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100, ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
      const w = Number(d.spk_panjang || 0) + ps, h = Number(d.spk_lebar || 0) + pa;
      if (n <= 0 || w <= 0 || h <= 0) return;
      const maxRows = Math.max(1, Math.floor((W + EPS) / h));
      const rows = Math.max(1, Math.min(tile, n, maxRows));
      spec.push({ w, h, n, rows });
    });
    if (spec.length < 2) continue;
    cnt++;
    // order: by block height desc (rows*h) then width desc
    const ord = spec.map((s, i) => i).sort((a, b) => spec[b].rows * spec[b].h - spec[a].rows * spec[a].h);
    const A = mkSky();
    for (const i of ord) placeBlockPartial(A, W, spec[i].w, spec[i].h, spec[i].n, spec[i].rows);
    partial += A.maxX;
    // full bbox variant
    const B = mkSky();
    for (const i of ord) {
      const s = spec[i]; const cols = Math.ceil(s.n / s.rows); const bw = cols * s.w, bh = s.rows * s.h;
      const xs = new Set([0]); for (const q of B.sky) xs.add(q.x0);
      let best = null;
      for (const x of xs) { const y = skylineMax(B.sky, x, bw); if (y + bh > W + EPS) continue; const sc = y * 1000 + x; if (!best || sc < best.score - 1e-9) best = { x, y, score: sc }; }
      if (!best) best = { x: B.maxX, y: 0 };
      skylineSet(B, best.x, best.x + bw, best.y + bh);
    }
    full += B.maxX;
  }
  console.log(`LHKs=${cnt} avg partial(notch-fill)=${(partial / cnt).toFixed(2)} avg fullBlock=${(full / cnt).toFixed(2)}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

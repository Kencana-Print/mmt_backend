const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const EPS = 1e-6;
function mkSky() { return { sky: [{ x0: 0, x1: 0, y: 0 }], maxX: 0 }; }
function skyMax(sky, x, w) { let y = 0; const x2 = x + w; for (const s of sky) { if (s.x1 <= x + EPS || s.x0 >= x2 - EPS) continue; if (s.y > y) y = s.y; } return y; }
function skySet(st, x0, x1, ny) {
  const next = [];
  for (const s of st.sky) { if (s.x1 <= x0 + EPS || s.x0 >= x1 - EPS) { next.push(s); continue; }
    if (s.x0 < x0 - EPS) next.push({ x0: s.x0, x1: x0, y: s.y }); if (s.x1 > x1 + EPS) next.push({ x0: x1, x1: s.x1, y: s.y }); }
  next.push({ x0, x1, y: ny }); next.sort((a, b) => a.x0 - b.x0);
  const out = []; for (const s of next) { const l = out[out.length - 1]; if (l && Math.abs(l.y - s.y) < EPS && Math.abs(l.x1 - s.x0) < EPS) l.x1 = s.x1; else out.push({ ...s }); }
  st.sky = out; if (x1 > st.maxX) st.maxX = x1;
}
function placeBlock(st, W, w, h, n, rows) {
  const cols = Math.ceil(n / rows); const bw = cols * w;
  const xs = new Set([0]); for (const s of st.sky) xs.add(s.x0);
  let best = null;
  for (const x of xs) {
    const y = skyMax(st.sky, x, bw); let ok = true;
    for (let c = 0; c < cols; c++) { const cnt = Math.min(rows, n - c * rows); if (y + cnt * h > W + EPS) { ok = false; break; } }
    if (!ok) continue;
    const score = y * 1000 + x; if (!best || score < best.score - 1e-9) best = { x, y, score };
  }
  if (!best) best = { x: st.maxX, y: 0 };
  for (let c = 0; c < cols; c++) { const cnt = Math.min(rows, n - c * rows); if (cnt <= 0) continue; skySet(st, best.x + c * w, best.x + (c + 1) * w, best.y + cnt * h); }
}
function run(spec, W, ord) {
  const st = mkSky();
  for (const i of ord) { const s = spec[i]; placeBlock(st, W, s.w, s.h, s.n, s.rows); }
  return st.maxX;
}
// block-shelf exact
function blockShelf(blocks, W) {
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[b].bh - blocks[a].bh);
  const packAt = (L) => { const sh = []; for (const bi of order) { const b = blocks[bi]; let t = null; for (const s of sh) if (s.width + b.bw <= L + EPS) { t = s; break; } if (t) { t.width += b.bw; if (b.bh > t.height) t.height = b.bh; } else sh.push({ height: b.bh, width: b.bw }); } return sh.reduce((s, x) => s + x.height, 0); };
  const tot = blocks.reduce((s, b) => s + b.bw, 0); let lo = Math.max(...blocks.map((b) => b.bw)), hi = tot;
  if (packAt(hi) > W + EPS) return Math.max(...blocks.map((b) => b.bw));
  for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (packAt(mid) <= W + EPS) hi = mid; else lo = mid; }
  return hi;
}

(async () => {
  const [hdrs] = await pool.query(`SELECT d.ld_lnomor FROM tlhk_mesin_dtl d GROUP BY d.ld_lnomor HAVING COUNT(*) BETWEEN 3 AND 12 ORDER BY d.ld_lnomor DESC LIMIT 250`);
  let cur = 0, bestAll = 0, cnt = 0, improves = 0;
  for (const r of hdrs) {
    const [ds] = await pool.query(`SELECT s.spk_panjang, s.spk_lebar, d.ld_total_qtycetak, d.ld_tile, d.ld_padding_atas, d.ld_padding_samping, d.ld_ambilbahan_lebar FROM tlhk_mesin_dtl d LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor WHERE d.ld_lnomor=? ORDER BY d.ld_urut`, [r.ld_lnomor]);
    const W = Number(ds[0]?.ld_ambilbahan_lebar || 0); if (W <= 0.01) continue;
    const spec = []; const blocks = [];
    ds.forEach((d) => {
      const n = Math.floor(Number(d.ld_total_qtycetak || 0)); const tile = Number(d.ld_tile || 1);
      const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100, ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
      const w = Number(d.spk_panjang || 0) + ps, h = Number(d.spk_lebar || 0) + pa;
      if (n <= 0 || w <= 0 || h <= 0) return;
      const maxRows = Math.max(1, Math.floor((W + EPS) / h));
      const rows = Math.max(1, Math.min(tile, n, maxRows)); const cols = Math.ceil(n / rows);
      spec.push({ w, h, n, rows }); blocks.push({ bw: cols * w, bh: rows * h });
    });
    if (spec.length < 2) continue; cnt++;
    const curLen = blockShelf(blocks, W); cur += curLen;
    const idx = spec.map((_, i) => i);
    const ords = [
      [...idx].sort((a, b) => spec[b].rows * spec[b].h - spec[a].rows * spec[a].h),
      [...idx].sort((a, b) => spec[b].w * Math.ceil(spec[b].n / spec[b].rows) - spec[a].w * Math.ceil(spec[a].n / spec[a].rows)),
      [...idx].sort((a, b) => spec[b].w * spec[b].h * spec[b].n - spec[a].w * spec[a].h * spec[a].n),
      [...idx],
      [...idx].reverse(),
    ];
    let best = Infinity;
    for (const o of ords) best = Math.min(best, run(spec, W, o));
    const pick = Math.min(curLen, best);
    bestAll += pick;
    if (pick < curLen - 0.01) improves++;
  }
  console.log(`LHKs=${cnt} avgCurrent=${(cur / cnt).toFixed(2)} avgBestOfBoth(contiguous)=${(bestAll / cnt).toFixed(2)} casesImproved=${improves}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

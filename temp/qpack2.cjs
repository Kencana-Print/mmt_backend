const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db.config.js'));
const EPS = 1e-6;

function buildUnits(ds) {
  const W = Number(ds[0]?.ld_ambilbahan_lebar || 0);
  const units = [];
  ds.forEach((d, i) => {
    const n = Math.floor(Number(d.ld_total_qtycetak || 0));
    const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100;
    const ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
    const w = Number(d.spk_panjang || 0) + ps, h = Number(d.spk_lebar || 0) + pa;
    if (n <= 0 || w <= 0 || h <= 0) return;
    const u = [];
    for (let k = 0; k < n; k++) u.push({ w, h });
    units.push(u);
  });
  return { W, units };
}

function skylinePacker(W) {
  let sky = [{ x0: 0, x1: 0, y: 0 }];
  let maxX = 0;
  const place = (w, h) => {
    const xs = new Set([0]);
    for (const s of sky) xs.add(s.x0);
    let best = null;
    for (const x of xs) {
      let y = 0; const x2 = x + w;
      for (const s of sky) { if (s.x1 <= x + EPS || s.x0 >= x2 - EPS) continue; if (s.y > y) y = s.y; }
      if (y + h > W + EPS) continue;
      const cover = sky.reduce((a, s) => a + Math.max(0, Math.min(s.x1, x2) - Math.max(s.x0, x)), 0);
      const waste = (w - cover) * 0 + cover; // prefer positions over taller existing skyline? keep simple BL
      const score = y * 1000 + x;
      if (!best || score < best.score - 1e-9) best = { x, y, score };
    }
    if (!best) best = { x: maxX, y: 0 };
    const nx0 = best.x, nx1 = best.x + w, ny = best.y + h;
    const next = [];
    for (const s of sky) {
      if (s.x1 <= nx0 + EPS || s.x0 >= nx1 - EPS) { next.push(s); continue; }
      if (s.x0 < nx0 - EPS) next.push({ x0: s.x0, x1: nx0, y: s.y });
      if (s.x1 > nx1 + EPS) next.push({ x0: nx1, x1: s.x1, y: s.y });
    }
    next.push({ x0: nx0, x1: nx1, y: ny });
    next.sort((a, b) => a.x0 - b.x0);
    sky = [];
    for (const s of next) {
      const l = sky[sky.length - 1];
      if (l && Math.abs(l.y - s.y) < EPS && Math.abs(l.x1 - s.x0) < EPS) l.x1 = s.x1;
      else sky.push({ ...s });
    }
    if (nx1 > maxX) maxX = nx1;
    return { x: best.x, y: best.y };
  };
  return { place, len: () => maxX };
}

// current block-shelf (exact-seeded)
function blockShelf(blocks, W) {
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[b].bh - blocks[a].bh);
  const packAt = (L) => {
    const sh = [];
    for (const bi of order) { const b = blocks[bi]; let t = null;
      for (const s of sh) if (s.width + b.bw <= L + EPS) { t = s; break; }
      if (t) { t.width += b.bw; if (b.bh > t.height) t.height = b.bh; } else sh.push({ height: b.bh, width: b.bw }); }
    return { h: sh.reduce((s, x) => s + x.height, 0), sh };
  };
  const totalW = blocks.reduce((s, b) => s + b.bw, 0);
  let lo = Math.max(...blocks.map((b) => b.bw)), hi = totalW;
  if (packAt(hi).h > W + EPS) return Math.max(...blocks.map((b) => b.bw));
  for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (packAt(mid).h <= W + EPS) hi = mid; else lo = mid; }
  return hi;
}
function toBlocks(units, W) {
  return units.map((u) => {
    const n = u.length; if (!n) return null;
    const w = u[0].w, h = u[0].h;
    const maxRows = Math.max(1, Math.floor((W + EPS) / h));
    const rows = Math.max(1, Math.min(3, n, maxRows)); // tile approx 3 (unknown) -> use 3 like form default? we only have tile from db not passed
    const cols = Math.ceil(n / rows);
    return { bw: cols * w, bh: rows * h };
  }).filter(Boolean);
}

(async () => {
  const [hdrs] = await pool.query(`
    SELECT d.ld_lnomor, COUNT(*) n FROM tlhk_mesin_dtl d GROUP BY d.ld_lnomor HAVING n BETWEEN 3 AND 10 ORDER BY d.ld_lnomor DESC LIMIT 250`);
  let cur = 0, sky = 0, cnt = 0, scatter = 0;
  for (const r of hdrs) {
    const [ds] = await pool.query(`
      SELECT s.spk_panjang, s.spk_lebar, d.ld_total_qtycetak, d.ld_tile, d.ld_padding_atas, d.ld_padding_samping, d.ld_ambilbahan_lebar
      FROM tlhk_mesin_dtl d LEFT JOIN tspk s ON s.spk_nomor=d.ld_spk_nomor WHERE d.ld_lnomor=? ORDER BY d.ld_urut`, [r.ld_lnomor]);
    const { W, units } = buildUnits(ds);
    if (W <= 0.01 || units.length < 2) continue;
    // blocks with real tile
    const blocks = [];
    ds.forEach((d) => {
      const n = Math.floor(Number(d.ld_total_qtycetak || 0)); const tile = Number(d.ld_tile || 1);
      const pa = ((parseFloat(d.ld_padding_atas) || 0) * 2) / 100, ps = ((parseFloat(d.ld_padding_samping) || 0) * 2) / 100;
      const w = Number(d.spk_panjang || 0) + ps, h = Number(d.spk_lebar || 0) + pa;
      if (n <= 0 || w <= 0 || h <= 0) return;
      const maxRows = Math.max(1, Math.floor((W + EPS) / h));
      const rows = Math.max(1, Math.min(tile, n, maxRows)), cols = Math.ceil(n / rows);
      blocks.push({ bw: cols * w, bh: rows * h });
    });
    if (!blocks.length) continue;
    cnt++;
    cur += blockShelf(blocks, W);

    // skyline per-SPK (order preserved)
    const pk = skylinePacker(W);
    const boxes = [];
    for (const u of units) {
      const bb = [];
      for (const it of u) bb.push(pk.place(it.w, it.h));
      boxes.push(bb);
    }
    sky += pk.len();
    // scatter metric: for n>1, bbox fill
    for (const bb of boxes) {
      if (bb.length < 2) continue;
      const x0 = Math.min(...bb.map((p) => p.x)), x1 = Math.max(...bb.map((p) => p.x));
      const y0 = Math.min(...bb.map((p) => p.y)), y1 = Math.max(...bb.map((p) => p.y));
      // approximate: bbox area vs sum unit area
    }
  }
  console.log(`LHKs=${cnt} avg blockShelf=${(cur / cnt).toFixed(2)} avg skyline=${(sky / cnt).toFixed(2)}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });

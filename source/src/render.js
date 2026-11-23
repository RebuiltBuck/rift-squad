// ===== Rift Squad: sprites + battle renderer =====
const SPR = SPRITES_DATA, SPR_COMMON = SPR._common;
const _sprCache = new Map(), _urlCache = new Map();

const HERO_SPR = (typeof SPRITES32 !== 'undefined') ? SPRITES32 : {};
const EYE_COL = '#283040';
// heroes whose eyes aren't the standard eye colour: pixels that close when they blink
const BLINK_EXTRA = { rocco: [[4, 5], [5, 5], [6, 5], [9, 5], [10, 5], [11, 5]], mumbo: [[6, 7], [9, 7]], vex: [[6, 7], [9, 7]], luna: [[6, 7], [9, 7]], zorp: [[4, 7], [11, 7]], volt: [[5, 6], [6, 6], [7, 6], [8, 6]] };
// One animation frame of a hero: br = breathing (torso down 1px), lift = 0 none / 1 left foot / 2 right foot raised
function heroFrame(hid, br, lift, blink, white) {
  const key = 'F|' + hid + '|' + br + lift + (blink ? 1 : 0) + (white ? 1 : 0);
  let c = _sprCache.get(key); if (c) return c;
  const base = sprCanvas(hid, null, white ? 'white' : blink ? 'blink' : '');
  const w = base.width, h = base.height, L = 4, hw = w >> 1;
  c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.drawImage(base, 0, h - L, hw, L, 0, h - L - (lift === 1 ? 1 : 0), hw, L);
  g.drawImage(base, hw, h - L, w - hw, L, hw, h - L - (lift === 2 ? 1 : 0), w - hw, L);
  g.drawImage(base, 0, 0, w, h - L, 0, br, w, h - L);
  _sprCache.set(key, c); return c;
}
const ALPHA32 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function sprSize(name) { return HERO_SPR[name] ? HERO_SPR[name].w : 16; }
function sprCanvas(name, palOver, mode) {
  const key = name + '|' + (palOver ? JSON.stringify(palOver) : '') + '|' + (mode || '');
  let c = _sprCache.get(key); if (c) return c;
  const H = HERO_SPR[name];
  if (H) {
    c = document.createElement('canvas'); c.width = H.w; c.height = H.h; const g = c.getContext('2d');
    const colAt = (x, y) => (y < 0 || y >= H.h || H.rows[y][x] === '.') ? null : H.pal[ALPHA32.indexOf(H.rows[y][x])];
    const extra = mode === 'blink' ? new Set((BLINK_EXTRA[name] || []).map(p => p[0] + ',' + p[1])) : null;
    H.rows.forEach((row, y) => {
      for (let x = 0; x < H.w; x++) {
        const ch = row[x]; if (ch === '.') continue; let col = H.pal[ALPHA32.indexOf(ch)];
        if (extra) { // eyelids: the top pixel of each 2-tall eye takes the colour above it
          const eye = (xx, yy) => colAt(xx, yy) === EYE_COL;
          if ((eye(x, y) && eye(x, y + 1) && !eye(x, y - 1)) || extra.has(x + ',' + y)) col = colAt(x, y - 1) || col;
        }
        g.fillStyle = mode === 'sil' ? (col === '#1b1325' ? '#0b0918' : '#3a3366') : mode === 'white' ? '#ffffff' : col;
        g.fillRect(x, y, 1, 1);
      }
    });
    _sprCache.set(key, c); return c;
  }
  const d = SPR[name]; c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d'); const pal = Object.assign({}, SPR_COMMON, d.pal, palOver || {});
  d.rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x]; if (ch === '.') continue;
      g.fillStyle = mode === 'sil' ? (ch === 'k' ? '#0b0918' : '#3a3366') : mode === 'white' ? '#ffffff' : pal[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
  _sprCache.set(key, c); return c;
}
// Scale2x (EPX) upscale so 16px props sit nicely next to 32px heroes
function spr2x(name, palOver) {
  const key = 'x2|' + name + '|' + (palOver ? JSON.stringify(palOver) : '');
  let c = _sprCache.get(key); if (c) return c;
  const src = sprCanvas(name, palOver); const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); const out = g.createImageData(w * 2, h * 2);
  const P = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return (sd[i] << 24 | sd[i + 1] << 16 | sd[i + 2] << 8 | sd[i + 3]) >>> 0; };
  const put = (x, y, v) => { const i = (y * w * 2 + x) * 4; out.data[i] = v >>> 24; out.data[i + 1] = v >>> 16 & 255; out.data[i + 2] = v >>> 8 & 255; out.data[i + 3] = v & 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = P(x, y), A = P(x, y - 1), B = P(x + 1, y), C = P(x - 1, y), D = P(x, y + 1);
    put(2 * x, 2 * y, (C === A && C !== D && A !== B) ? A : p);
    put(2 * x + 1, 2 * y, (A === B && A !== C && B !== D) ? B : p);
    put(2 * x, 2 * y + 1, (D === C && D !== B && C !== A) ? C : p);
    put(2 * x + 1, 2 * y + 1, (B === D && B !== A && D !== C) ? D : p);
  }
  g.putImageData(out, 0, 0); _sprCache.set(key, c); return c;
}
function sprURL(name, palOver, mode, px) {
  px = px || 64;
  const key = name + '|' + (palOver ? JSON.stringify(palOver) : '') + '|' + (mode || '') + '|' + px;
  let u = _urlCache.get(key); if (u) return u;
  const src = sprCanvas(name, palOver, mode); const c = document.createElement('canvas'); c.width = px; c.height = px;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const k = Math.max(1, Math.floor(px / Math.max(src.width, src.height))), w = src.width * k, h = src.height * k;
  g.drawImage(src, Math.floor((px - w) / 2), Math.floor((px - h) / 2), w, h);
  u = c.toDataURL(); _urlCache.set(key, u); return u;
}
function chestURL(type) { return sprURL('chest', CHESTS[type].pal); }
function heroImg(hid, cls, locked) { return `<img class="${cls || 'spr'}" src="${sprURL(hid, null, locked ? 'sil' : '')}" alt="">`; }
function icon(name, cls) { return `<img class="${cls || ''}" src="${sprURL(name)}" alt="">`; }

// ---------- floor ----------
const TILE = 18, PADT = 12; // PADT: headroom above the top row for tall sprites, health bars and numbers
const BG_PAD = 28; // the arena backdrop runs this far past every screen edge, so shakes and zooms never show what's behind it
function drawFloorTile(g, ax, ay, x, y, arena, seed) {
  const A = ARENAS[arena], [c1, c2, c3] = A.floor;
  g.fillStyle = (x + y) % 2 ? c1 : c2; g.fillRect(ax, ay, TILE, TILE);
  const r = mulberry32(seed + x * 131 + y * 977);
  g.fillStyle = c3;
  for (let i = 0; i < 4; i++) { g.fillRect(ax + 1 + Math.floor(r() * 16), ay + 1 + Math.floor(r() * 16), r() < 0.3 ? 2 : 1, 1); }
  g.fillStyle = '#00000018'; g.fillRect(ax, ay + TILE - 1, TILE, 1); g.fillRect(ax + TILE - 1, ay, 1, TILE);
}
function drawEventTile(g, ax, ay, type, x, y) {
  const r = mulberry32(x * 31 + y * 17 + 5);
  if (type === 'lava') {
    g.fillStyle = '#7a1f12'; g.fillRect(ax + 1, ay + 1, TILE - 2, TILE - 2);
    g.fillStyle = '#d8401c'; g.fillRect(ax + 2, ay + 2, TILE - 4, TILE - 4);
    g.fillStyle = '#ff8a2a'; for (let i = 0; i < 5; i++) g.fillRect(ax + 3 + Math.floor(r() * 11), ay + 3 + Math.floor(r() * 11), 2 + Math.floor(r() * 2), 1);
  } else if (type === 'spring') {
    g.fillStyle = '#1e4f8a'; g.fillRect(ax + 1, ay + 1, TILE - 2, TILE - 2);
    g.fillStyle = '#2f7fd6'; g.fillRect(ax + 2, ay + 2, TILE - 4, TILE - 4);
    g.fillStyle = '#8fd3ff'; g.fillRect(ax + 4, ay + 5, 5, 1); g.fillRect(ax + 9, ay + 10, 5, 1); g.fillRect(ax + 5, ay + 13, 3, 1);
  } else if (type === 'crystal') {
    g.fillStyle = '#3f1f78'; g.fillRect(ax + 1, ay + 1, TILE - 2, TILE - 2);
    g.fillStyle = '#7b3fd1'; g.fillRect(ax + 2, ay + 2, TILE - 4, TILE - 4);
    g.fillStyle = '#e6d0ff'; g.fillRect(ax + 3, ay + 3, 1, 3); g.fillRect(ax + 14, ay + 12, 1, 3);
    g.fillStyle = '#c08cff'; g.fillRect(ax + 2, ay + 4, 3, 2); g.fillRect(ax + 13, ay + 13, 3, 2);
  } else if (type === 'mud') {
    g.fillStyle = '#5a3a1e'; g.fillRect(ax, ay, TILE, TILE);
    g.fillStyle = '#7a5230'; for (let i = 0; i < 6; i++) g.fillRect(ax + Math.floor(r() * 14), ay + Math.floor(r() * 15), 3 + Math.floor(r() * 3), 2);
  } else if (type === 'bush') {
    g.fillStyle = '#2c6b2a'; g.fillRect(ax + 1, ay + 1, TILE - 2, TILE - 2);
  }
}
// leafy front layer drawn over heroes standing in a bush
function drawBushTop(g, ax, ay) {
  const c = ['#3f8f3a', '#5fd068', '#2c6b2a'];
  const blobs = [[1, 10, 6], [6, 11, 7], [11, 10, 6], [3, 13, 5], [9, 13, 6]];
  for (const [bx, by, w] of blobs) { g.fillStyle = c[2]; g.fillRect(ax + bx, ay + by + 1, w, 5); g.fillStyle = c[0]; g.fillRect(ax + bx, ay + by, w, 4); g.fillStyle = c[1]; g.fillRect(ax + bx + 1, ay + by, w - 3, 1); }
}
function buildFloor(rs, arena, seed) {
  const c = document.createElement('canvas'); c.width = BW * TILE * 2; c.height = BH * TILE * 2; const g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) drawFloorTile(g, x * TILE, y * TILE, x, y, arena, seed);
  g.fillStyle = '#ff4f6b12'; g.fillRect(0, 0, BW * TILE, HALF * TILE);
  g.fillStyle = '#4fa3ff12'; g.fillRect(0, P0 * TILE, BW * TILE, HALF * TILE);
  if (GAP) { g.fillStyle = '#0000001c'; g.fillRect(0, HALF * TILE, BW * TILE, GAP * TILE); } // no-man's land
  g.fillStyle = '#ffffff30'; for (let x = 0; x < BW * TILE; x += 4) { g.fillRect(x, HALF * TILE - 1, 2, 1); if (GAP) g.fillRect(x, P0 * TILE, 2, 1); }
  const A = ARENAS[arena];
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const tt = rs.tiles[y * BW + x];
    if (tt && tt !== 'rock') drawEventTile(g, x * TILE, y * TILE, tt, x, y);
    if (rs.obs[y * BW + x]) { g.fillStyle = '#0000002a'; g.fillRect(x * TILE + 3, y * TILE + 14, 12, 3); g.drawImage(sprCanvas(A.obs, A.obsPal), x * TILE + 1, y * TILE + 1, 16, 16); }
  }
  return c;
}
// a 3-tile strip showing what a hazard looks like in this arena
function hazardStrip(eventId, arena) {
  const E = EVENTS[eventId], c = document.createElement('canvas'); c.width = 3 * TILE * 2; c.height = TILE * 2; c.className = 'px';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0); const A = ARENAS[arena];
  for (let x = 0; x < 3; x++) { drawFloorTile(g, x * TILE, 0, x, 0, arena, 7);
    if (!E.tile || x !== 1) continue;
    if (E.tile === 'rock') g.drawImage(sprCanvas(A.obs, A.obsPal), x * TILE + 1, 1, 16, 16); else drawEventTile(g, x * TILE, 0, E.tile, x, 0); }
  return c;
}
function arenaBanner(arena, squad, w, h) {
  const cols = w || 10, rows = h || 4;
  const c = document.createElement('canvas'); c.width = cols * TILE * 2; c.height = rows * TILE * 2; c.className = 'px'; const g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) drawFloorTile(g, x * TILE, y * TILE, x, y, arena, 99);
  const A = ARENAS[arena];
  [[0, 1], [9, 2], [6, 3]].forEach(([x, y]) => { if (x < cols && y < rows) g.drawImage(sprCanvas(A.obs, A.obsPal), x * TILE + 1, y * TILE + 1, 16, 16); });
  const rx = cols - 2;
  g.fillStyle = '#7ef9ff40'; g.fillRect(rx * TILE, 2 * TILE, TILE, TILE);
  g.drawImage(sprCanvas('relic'), rx * TILE + 1, 2 * TILE + 1, 16, 16);
  (squad || []).forEach((hid, i) => {
    const px = (0.3 + i * 1.2) * TILE + 4, py = 2 * TILE + 2 + (i % 2 ? -6 : 0) + (i === 0 ? -2 : 0);
    g.fillStyle = '#4fa3ff88'; g.fillRect(px + 3, py + 15, 10, 2);
    const sc = sprCanvas(hid); g.drawImage(sc, Math.round(px), py + 16 - sc.height, sc.width, sc.height);
  });
  return c;
}

// ---------- battle view ----------
const BV = { low: null, lg: null, cv: null, g: null, scale: 1, dpr: 1, floor: null, fx: [], floats: [], raf: 0, speed: 1 };

// re-fit the board whenever its area changes size (top bar / bottom row changing), not just on window resize
let BV_RO = null;
function bvInit(canvas) {
  try { if (!BV_RO && typeof ResizeObserver !== 'undefined') { BV_RO = new ResizeObserver(() => { if (typeof M !== 'undefined' && M && BV.cv) bvLayout(); }); BV_RO.observe(canvas.parentElement); BV_RO.observe(document.getElementById('battle')); } } catch (e) { }
  BV.cv = canvas; BV.g = canvas.getContext('2d');
  BV.low = document.createElement('canvas'); BV.low.width = BW * TILE * 2; BV.low.height = (BH * TILE + PADT) * 2; BV.lg = BV.low.getContext('2d');
  BV.lg.imageSmoothingEnabled = false; BV.lg.setTransform(2, 0, 0, 2, 0, 0);
  BV.fx = []; BV.floats = [];
}
function bvLayout() {
  const box = BV.cv.parentElement.getBoundingClientRect();
  // smaller than the space allows, with clear room above and below, so the arena shows all around it
  const s = Math.max(1, Math.min(box.width * 0.76 / (BW * TILE), (box.height - 30) / (BH * TILE + PADT)));
  BV.dpr = window.devicePixelRatio || 1; BV.scale = s;
  const W = Math.floor(BW * TILE * s), H = Math.floor((BH * TILE + PADT) * s);
  BV.cv.style.width = W + 'px'; BV.cv.style.height = H + 'px';
  BV.cv.width = Math.floor(W * BV.dpr); BV.cv.height = Math.floor(H * BV.dpr);
  bvBackdrop();
}
// the arena floor carries on past the board to fill the whole screen (darker, with props, nothing to stand on)
function bvBackdrop() {
  const bg = document.getElementById('bbg'); if (!bg || !BV.cv || typeof M === 'undefined' || !M || !M.setup) return;
  // layout positions (not getBoundingClientRect: the slow-mo zoom scales the canvas)
  const hostEl = bg.parentElement, bb = BV.cv.parentElement, host = { width: hostEl.clientWidth + BG_PAD * 2, height: hostEl.clientHeight + BG_PAD * 2, top: 0, left: 0 }, cr = { left: bb.offsetLeft + BV.cv.offsetLeft + BG_PAD, top: bb.offsetTop + BV.cv.offsetTop + BG_PAD, width: BV.cv.offsetWidth };
  const s = BV.scale, dpr = BV.dpr, arena = M.setup.arena, A = ARENAS[arena];
  if (!host.width || !cr.width) return;
  bg.width = Math.ceil(host.width * dpr); bg.height = Math.ceil(host.height * dpr);
  const ox = cr.left, oy = cr.top + PADT * s, ts = TILE * s; // board tile (0,0) in css px
  const x0 = Math.floor(-ox / ts) - 1, x1 = Math.ceil((host.width - ox) / ts) + 1, y0 = Math.floor(-oy / ts) - 1, y1 = Math.ceil((host.height - oy) / ts) + 1;
  const nx = x1 - x0, ny = y1 - y0, off = document.createElement('canvas'); off.width = nx * TILE; off.height = ny * TILE;
  const o = off.getContext('2d'); o.imageSmoothingEnabled = false;
  const seed = (M.setup.seed || 1) ^ 0x51ed, prop = sprCanvas(A.obs, A.obsPal);
  // no props behind the top bar or the bottom buttons
  const hb = $('.bhud'), pb = $('.bpanel'), uiTop = hb ? hb.offsetTop + hb.offsetHeight + BG_PAD : 0, uiBot = pb ? pb.offsetTop + BG_PAD : host.height;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ax = (x - x0) * TILE, ay = (y - y0) * TILE, onBoard = x >= 0 && x < BW && y >= 0 && y < BH; if (onBoard) continue; // the board itself is drawn after the dimming
    drawFloorTile(o, ax, ay, x, y, arena, seed);
    const near = x >= -1 && x <= BW && y >= -1 && y <= BH; // keep the tiles right around the board clear
    const ty = oy + y * ts; if (!near && ty > uiTop && ty + ts < uiBot && mulberry32(seed + (x + 50) * 73 + (y + 50) * 191)() < 0.16) { o.fillStyle = '#0000002a'; o.fillRect(ax + 3, ay + 14, 12, 3); o.drawImage(prop, ax + 1, ay + 1, 16, 16); }
  }
  o.fillStyle = '#0b071655'; o.fillRect(0, 0, off.width, off.height); // dim everything off the board
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) drawFloorTile(o, (x - x0) * TILE, (y - y0) * TILE, x, y, arena, seed); // plain floor under the board (only seen mid-zoom)
  // an even frame on all four sides so the board reads as the place to play
  const bx = -x0 * TILE, by = -y0 * TILE, W = BW * TILE, H = BH * TILE, ring = (d, c) => { o.fillStyle = c; o.fillRect(bx - d, by - d, W + d * 2, d); o.fillRect(bx - d, by + H, W + d * 2, d); o.fillRect(bx - d, by, d, H); o.fillRect(bx + W, by, d, H); };
  ring(4, '#0b071640'); ring(3, '#0b07168c'); ring(2, '#0b0716d0'); ring(1, A.floor[2] || '#ffffff55');
  const g = bg.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bg.width, bg.height);
  g.drawImage(off, Math.round((ox + x0 * ts) * dpr), Math.round((oy + y0 * ts) * dpr), Math.round(nx * ts * dpr), Math.round(ny * ts * dpr));
}

function pxRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function corners(g, x, y, c, inset) {
  const a = x * TILE + inset, b = y * TILE + inset, e = TILE - inset * 2;
  g.fillStyle = c;
  g.fillRect(a, b, 4, 1); g.fillRect(a, b, 1, 4); g.fillRect(a + e - 4, b, 4, 1); g.fillRect(a + e - 1, b, 1, 4);
  g.fillRect(a, b + e - 1, 4, 1); g.fillRect(a, b + e - 4, 1, 4); g.fillRect(a + e - 4, b + e - 1, 4, 1); g.fillRect(a + e - 1, b + e - 4, 1, 4);
}

function unitPos(u, rt) {
  if (u.mt1 > u.mt0 && rt < u.mt1) { const k = Math.max(0, Math.min(1, (rt - u.mt0) / (u.mt1 - u.mt0))); return [u.fx + (u.x - u.fx) * k, u.fy + (u.y - u.fy) * k, k]; }
  return [u.x, u.y, 1];
}
function drawCrown(g, x, y) { g.fillStyle = '#1b1325'; g.fillRect(x - 1, y - 1, 9, 5); g.fillStyle = '#ffd23f'; g.fillRect(x, y + 1, 7, 2); g.fillRect(x, y, 1, 1); g.fillRect(x + 3, y - 0, 1, 1); g.fillRect(x + 6, y, 1, 1); g.fillStyle = '#ff4f6b'; g.fillRect(x + 3, y + 1, 1, 1); }

// V = { rs: round state, rt: render time (s), mode: 'setup'|'fight', vis, sel, drag:{uid,px,py}, hover }
function bvDraw(V, now) {
  const g = BV.lg, rs = V.rs, t = now / 1000;
  g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, BW * TILE, BH * TILE + PADT); g.setTransform(2, 0, 0, 2, 0, PADT * 2);
  g.drawImage(V.floor, 0, 0, BW * TILE, BH * TILE);
  // animated tile glints
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const tt = rs.tiles[y * BW + x]; if (!tt) continue;
    if (tt === 'lava' && Math.sin(t * 3 + x + y * 2) > 0.6) { g.fillStyle = '#ffd23f'; g.fillRect(x * TILE + 4 + ((x * 7 + Math.floor(t * 2)) % 9), y * TILE + 5 + ((y * 5 + Math.floor(t * 2)) % 8), 2, 1); }
    if (tt === 'spring' && Math.sin(t * 2 + x * 3 + y) > 0.7) { g.fillStyle = '#ffffff'; g.fillRect(x * TILE + 6 + (Math.floor(t * 3) % 6), y * TILE + 7, 1, 1); }
    if (tt === 'crystal') { g.fillStyle = `rgba(192,140,255,${0.15 + 0.12 * Math.sin(t * 3 + x)})`; g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2); }
  }
  // setup: show open spots in your half
  if (V.mode === 'setup') {
    for (let y = P0; y < BH; y++) for (let x = 0; x < BW; x++) {
      if (rs.obs[y * BW + x] || unitAt(rs, x, y)) continue;
      g.fillStyle = V.drag ? 'rgba(79,163,255,0.30)' : 'rgba(79,163,255,0.12)'; g.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    }
    if (V.drag && V.hover) { corners(g, V.hover.x, V.hover.y, '#ffd23f', 0); }
  }
  // selected hero: the tiles it can hit from where it stands (no diagonals)
  // while dragging, the same tiles around the spot it would land on
  let rgU = null, rgX = 0, rgY = 0;
  if (V.drag) { const u = V.drag.bench ? { rng: heroStats(V.drag.hid).rng, side: 0 } : byUid(rs, V.drag.uid), h = V.hover || { x: Math.floor(V.drag.px / TILE), y: Math.floor(V.drag.py / TILE) }; if (u && inB(h.x, h.y) && !V.drag.toBench) { rgU = u; rgX = h.x; rgY = h.y; } }
  else if (V.sel) { const u = byUid(rs, V.sel); if (u && u.alive) { const [ux, uy] = unitPos(u, V.rt); rgU = u; rgX = Math.round(ux); rgY = Math.round(uy); } }
  if (rgU && rgU.rng) { const u = rgU, cx = rgX, cy = rgY, col = u.side === 0 ? '255,210,63' : '255,79,107'; {
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const d = Math.abs(x - cx) + Math.abs(y - cy); if (d < 1 || d > u.rng) continue; g.fillStyle = `rgba(${col},0.2)`; g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2); g.fillStyle = `rgba(${col},0.5)`; g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, 1); } } }
  // prediction: where the enemy stood last round (faded), and where your round-start abilities will land
  if (V.mode === 'setup') {
    if (V.ghosts) for (const gh of V.ghosts) {
      const im = heroFrame(gh.hid, Math.sin(t * 2.2 + gh.x) > 0.4 ? 1 : 0, 0, false, false);
      const gx = gh.x * TILE + 1, gy = gh.y * TILE + 17 - im.height;
      g.globalAlpha = 0.16; g.fillStyle = '#ff4f6b'; g.fillRect(gh.x * TILE + 2, gh.y * TILE + 2, TILE - 4, TILE - 4);
      g.globalAlpha = 0.38 + 0.08 * Math.sin(t * 3 + gh.y); g.save(); g.translate(gx + im.width, gy); g.scale(-1, 1); g.drawImage(im, 0, 0); g.restore();
      if (gh.cap) { g.globalAlpha = 0.5; drawCrown(g, gx + 4, gy - 4); }
      g.globalAlpha = 1;
    }
    for (const u of rs.units) {
      if (u.side !== 0 || !u.alive || !u.ab || ABILITIES[u.ab].kind !== 'start') continue; const ab = u.ab;
      const at = V.drag && V.drag.uid === u.uid ? V.hover : u; if (!at) continue;
      const pulse = 0.22 + 0.1 * Math.sin(t * 5), col = HERO[u.hid].color;
      const box = (x, y, c) => { if (!inB(x, y)) return; g.globalAlpha = pulse; g.fillStyle = c; g.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4); g.globalAlpha = 1; corners(g, x, y, c, 0); };
      if (['laser', 'cannon', 'hook', 'avalanche'].includes(ab)) { g.globalAlpha = pulse; g.fillStyle = ab === 'avalanche' ? '#e8f6ff' : ab === 'laser' ? col : '#ffd23f'; for (let y = at.y - 1; y >= 0; y--) g.fillRect(at.x * TILE + 7, y * TILE + ((Math.floor(t * 20) + y * 3) % 4), 4, TILE - 3); }
      if (ab === 'bomb') { const ty = Math.max(0, at.y - 3); for (let y = ty - 1; y <= ty + 1; y++) for (let x = at.x - 1; x <= at.x + 1; x++) box(x, y, '#ff8a2a'); }
      if (ab === 'cauldron') { const ty = at.y - 2; for (let y = ty - 1; y <= ty + 1; y++) for (let x = at.x - 1; x <= at.x + 1; x++) box(x, y, '#7dff6b'); }
      if (ab === 'firewall') { const ty = at.y - 2; for (let x = at.x - 1; x <= at.x + 1; x++) box(x, ty, '#ff6a2a'); }
      if (ab === 'mine') box(at.x, at.y - 2, '#4ff0ff');
      if (ab === 'rally' || ab === 'warcry') for (const [dx, dy] of DIR8) { const x = at.x + dx, y = at.y + dy; if (inB(x, y) && y >= P0) { g.globalAlpha = pulse * 0.8; g.fillStyle = ab === 'rally' ? '#4ff0ff' : '#ff6b6b'; g.fillRect(x * TILE + 6, y * TILE + 6, TILE - 12, TILE - 12); g.globalAlpha = 1; } }
      g.globalAlpha = 1;
    }
  }
  // mines and healing drones (fight)
  if (V.mode === 'fight') {
    for (const mn of rs.mines || []) { const ic = sprCanvas('i_mine'); g.globalAlpha = 0.9; g.drawImage(ic, mn.x * TILE + 1, mn.y * TILE + 1); if (Math.floor(t * 3) % 2) pxRect(g, mn.x * TILE + 8, mn.y * TILE + 8, 2, 2, '#ff4f6b'); g.globalAlpha = 1; }
    for (const dr of rs.drones || []) { const o = byUid(rs, dr.owner); if (!o || !o.alive) continue; const p = unitPos(o, V.rt); g.drawImage(sprCanvas('i_drone'), Math.round(p[0] * TILE + 6 + Math.cos(t * 2) * 6), Math.round(p[1] * TILE - 10 + Math.sin(t * 4) * 2), 12, 12); }
  }
  // units (back to front)
  BV.hpLabels = [];
  const dtF = Math.min(0.1, (now - (BV.lastNow || now)) / 1000); BV.lastNow = now;
  const half = v => Math.round(v * 2) / 2;
  const list = rs.units.map(u => { const v = V.vis[u.uid] || (V.vis[u.uid] = { flash: 0, deadAt: 0, lunge: null, leapT: 0 }); const p = unitPos(u, V.rt); return { u, v, p }; })
    .filter(o => o.u.alive || (o.v.deadAt && now - o.v.deadAt < 500))
    .filter(o => !(V.mode === 'setup' && V.hideFoe && o.u.side === 1))
    .sort((a, b) => a.p[1] - b.p[1]);
  for (const { u, v, p } of list) {
    if (V.drag && V.drag.uid === u.uid) continue;
    const [ux, uy, k] = p; let ox = 0, oy = 0, z = 0;
    const seed = (u.uid.charCodeAt(1) || 0) * 1.7 + (u.side ? 3.1 : 0);
    const frozen = u.alive && u.st.stunT > rs.t, gone = u.st.goneT > 0 && u.st.goneT > V.rt;
    if (gone && u.alive) continue; // abducted
    const moving = V.mode === 'fight' && u.alive && u.mt1 > u.mt0 && V.rt < u.mt1;
    if (v.stepT !== u.mt0 && moving) { v.stepT = u.mt0; v.steps = (v.steps || 0) + 1; if (v.leapT !== u.mt0) bvFx({ type: 'dust', x: u.fx * TILE + 9, y: u.fy * TILE + 16, dur: 320 }); }
    // facing: toward the target, else the way we're walking, else toward the enemy side
    const tg = u.tgt && u.tgt.alive ? u.tgt : null;
    let face = v.face || (u.side === 0 ? 1 : -1);
    if (moving && u.x !== u.fx) face = Math.sign(u.x - u.fx); else if (tg && tg.x !== u.x) face = Math.sign(tg.x - u.x);
    v.face = face;
    // walk: little hop each tile with alternating feet; leaps arc high
    let lift = 0;
    if (moving && v.leapT === u.mt0) z = Math.sin(k * Math.PI) * 14;
    else if (moving) { z = Math.abs(Math.sin(k * Math.PI)) * (rs.grid ? 4 : 2); if (k > 0.15 && k < 0.85) lift = (v.steps % 2) ? 1 : 2; }
    // attack body motion, timed so the strike lands exactly when the hit does
    if (v.anim) { const A = v.anim, d = now - A.t0, D = Math.max(40, A.d); let q = null;
      if (A.body === 'heavy') { // big overhead: rise and lean back, then slam
        if (d < D) { const r = d / D; z += Math.sin(r * Math.PI / 2) * 7; q = -2 * r; lift = r > 0.3 ? 1 : 0; }
        else if (d < D + 260) { const r = (d - D) / 260; q = 5 * (1 - r) * (1 - r); }
      } else if (A.body === 'quick') { // two fast jabs
        const P = D; if (d < P) q = -1 + 6 * Math.max(0, d / P - 0.3) / 0.7; else if (d < P + 90) q = 5 - 4 * (d - P) / 90; else if (d < P + 170) q = 1 + 4 * Math.sin((d - P - 90) / 80 * Math.PI); else if (d < P + 260) q = 1 - (d - P - 170) / 90;
        if (q != null) lift = (Math.floor(d / 70) % 2) + 1;
      } else if (A.body === 'recoil') { if (d < 170) q = -2 * (1 - d / 170); }
      else if (A.body === 'throw') { if (d < 260) { z += Math.sin(d / 260 * Math.PI) * 3; q = d < 100 ? -1 : 1; } }
      else { // lunge: wind up, thrust on impact, settle back
        if (d < D) q = d < D * 0.55 ? -2 * d / (D * 0.55) : -2 + 8 * (d - D * 0.55) / (D * 0.45); else if (d < D + 180) q = 6 * (1 - Math.pow((d - D) / 180, 0.6));
        if (q != null && d > D * 0.4) lift = (Math.floor(d / 60) % 2) + 1;
      }
      if (q == null) v.anim = null; else { ox += A.dx * q; oy += A.dy * q; } }
    if (v.knock) { const d = now - v.knock.t0; if (d < 160) { const q = 2 * Math.sin(Math.min(1, d / 50) * Math.PI / 2) * (1 - d / 160); ox += v.knock.dx * q; oy += v.knock.dy * q; } else v.knock = null; }
    if (v.castT && now - v.castT < 260) z += Math.sin((now - v.castT) / 260 * Math.PI) * 3;
    if (u.st.floatT > 0 && u.st.floatT > V.rt) z += 5 + Math.sin(t * 5) * 1.5;
    if (v.spinT && now - v.spinT < 320) face = Math.floor((now - v.spinT) / 60) % 2 ? 1 : -1;
    // winners celebrate: staggered hops, turning to face the other way each jump
    if (V.cheer && u.alive && u.side === V.cheer.side && V.mode === 'fight') {
      const ph = (now - V.cheer.t0) / 1000 * (V.cheer.big ? 7 : 6) - (u.x * 0.7 + u.y * 0.4);
      if (ph > 0) { const hop = Math.max(0, Math.sin(ph)); z += hop * (V.cheer.big ? 6 : 4); if (hop > 0.15) lift = 2; face = Math.floor(ph / Math.PI) % 2 ? 1 : -1; }
    }
    // round start: enemies drop in where they really are
    let alpha = u.alive ? 1 : Math.max(0, 1 - (now - v.deadAt) / 500);
    if (u.st.vanishT > 0 && u.st.vanishT > V.rt) alpha *= 0.3; if (u.clone) alpha *= 0.75;
    if (V.revealAt && u.side === 1 && V.mode === 'fight') { const a = Math.min(1, (now - V.revealAt) / 380); alpha *= a; z += (1 - a) * (1 - a) * 14; }
    if (!u.alive) z += (now - v.deadAt) / 500 * 4;
    // idle: slow breathing and the odd blink
    const br = !moving && u.alive && !frozen && Math.sin(t * 2.3 + seed) > 0.35 ? 1 : 0;
    if (!v.blinkAt) v.blinkAt = now + 600 + ((seed * 997) % 2600);
    if (now > v.blinkAt + 140) v.blinkAt = now + 1800 + Math.random() * 3200;
    const blink = u.alive && !frozen && now >= v.blinkAt && now < v.blinkAt + 140;
    const frog = u.st.frogT > 0 && u.st.frogT > V.rt, shrink = u.st.shrinkT > 0 && u.st.shrinkT > V.rt;
    const img = frog ? sprCanvas('i_frog') : heroFrame(u.hid, br, lift, blink, false);
    const sw = shrink ? Math.round(img.width * 0.6) : img.width, shh = shrink ? Math.round(img.height * 0.6) : img.height;
    const bx0 = half((ux + ox / TILE) * TILE), by0 = half((uy + oy / TILE) * TILE);
    const px = bx0 + 1 + (16 - sw) / 2, py = by0 + 17 - shh - half(z);
    g.globalAlpha = alpha;
    // ground shadow + team marker (stay on the floor while hopping)
    const sh = Math.max(6, 12 - Math.round(z / 2));
    g.fillStyle = 'rgba(10,6,20,0.35)'; g.fillRect(bx0 + 9 - sh / 2, by0 + 15, sh, 2);
    g.fillStyle = u.side === 0 ? '#4fa3ff' : '#ff4f6b'; g.fillRect(bx0 + 9 - sh / 2 + 1, by0 + 16, sh - 2, 1);
    const drawSpr = (im) => { if (face < 0) { g.save(); g.translate(px + sw, py); g.scale(-1, 1); g.drawImage(im, 0, 0, sw, shh); g.restore(); } else g.drawImage(im, px, py, sw, shh); };
    drawSpr(img);
    if (!frog && (now < v.flash || (!u.alive && now - v.deadAt < 90))) { g.globalAlpha = 0.5 * alpha; drawSpr(heroFrame(u.hid, br, lift, false, true)); g.globalAlpha = alpha; }
    if (u.alive && u.st.stunT > V.rt && (u.st.stunKind === 'freeze' || u.st.stunKind === 'wrap')) { g.globalAlpha = 0.45 * alpha; drawSpr(heroFrame(u.hid, 0, 0, false, true)); g.globalAlpha = alpha; if (u.st.stunKind === 'wrap') for (let i = 0; i < 3; i++) pxRect(g, px + 1, py + 5 + i * 5, sw - 2, 1, '#b8a88a'); }
    if (u.alive && rs.tiles[u.y * BW + u.x] === 'bush' && k >= 1) drawBushTop(g, u.x * TILE, u.y * TILE);
    if (u.cap && V.mode !== 'fight') drawCrown(g, px + 4, py - 4 + br);
    if (u.alive && V.mode === 'fight') {
      if (u.st.shield > 0 && u.st.shieldT > rs.t) { g.globalAlpha = 0.45 + 0.2 * Math.sin(t * 8); g.fillStyle = '#4ff0ff'; g.fillRect(px - 1, py + 2, 1, shh - 4); g.fillRect(px + sw, py + 2, 1, shh - 4); g.fillRect(px + 2, py - 1, sw - 4, 1); g.globalAlpha = alpha; }
      const sk = u.st.stunKind;
      if (frozen && !frog && sk !== 'freeze' && sk !== 'wrap' && sk !== 'float') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; pxRect(g, px + 7 + Math.cos(a) * 5, py - 1 + Math.sin(a) * 1.5, 2, 2, sk === 'shock' ? '#4ff0ff' : '#ffd23f'); }
      if (u.st.dotT > rs.t) { const c = u.st.dotKind === 'poison' ? '#7dff6b' : '#ff8a2a'; pxRect(g, px + 3 + (Math.floor(t * 3) % 3) * 4, py + 4 + (Math.floor(t * 6) % 6), 1, 2, c); pxRect(g, px + 11 - (Math.floor(t * 3) % 3) * 3, py + 8 + (Math.floor(t * 6 + 3) % 6), 1, 2, c); }
      if (u.st.hasteT > rs.t) { pxRect(g, px - 2 - (Math.floor(t * 10) % 3), py + 8, 2, 1, '#ffe94f'); pxRect(g, px - 3 - (Math.floor(t * 10 + 1) % 3), py + 12, 2, 1, '#ffe94f'); }
      if (u.st.slowT > rs.t) { pxRect(g, px + 2, py + shh - 2, 2, 1, '#8cc6ff'); pxRect(g, px + 12, py + shh - 3, 2, 1, '#8cc6ff'); }
      if (u.st.charmT > rs.t) { const yy = py - 4 - (Math.floor(t * 4) % 3); pxRect(g, px + 6, yy, 1, 1, '#ff8ac8'); pxRect(g, px + 8, yy, 1, 1, '#ff8ac8'); pxRect(g, px + 6, yy + 1, 3, 1, '#ff8ac8'); pxRect(g, px + 7, yy + 2, 1, 1, '#ff8ac8'); }
      if (u.st.tauntT > rs.t) { pxRect(g, px + 7, py - 6, 2, 3, '#ff4f6b'); pxRect(g, px + 7, py - 2, 2, 1, '#ff4f6b'); }
      if (u.st.vulnT > rs.t) { pxRect(g, px + sw - 2, py + 1, 2, 2, '#c07bff'); pxRect(g, px + sw - 1, py, 1, 1, '#ffffff'); }
      // hp bar drains smoothly, leaving a white trail; purple = ability charge (none for round-start abilities)
      const bx = bx0 + 7, bty = by0 + 17 - shh - 5;
      if (v.hpShow == null) v.hpShow = u.hp;
      v.hpShow = v.hpShow > u.hp ? Math.max(u.hp, v.hpShow - (v.hpShow - u.hp) * Math.min(1, dtF * 5) - u.maxHp * 0.2 * dtF) : u.hp;
      const f = Math.max(0, u.hp / u.maxHp), fs = Math.max(0, v.hpShow / u.maxHp);
      const startAb = !u.ab || ABILITIES[u.ab].kind !== 'charge';
      const BWD = 10;
      pxRect(g, bx - 1, bty - 0.5, BWD + 2, startAb ? 3.5 : 4.5, '#1b1325');
      if (fs > f) pxRect(g, bx, bty + 0.5, Math.max(1, Math.round(BWD * fs)), 1.5, '#ffffff');
      pxRect(g, bx, bty + 0.5, Math.max(0.5, Math.round(BWD * f * 2) / 2), 1.5, f > 0.5 ? (u.side === 0 ? '#5fd068' : '#ff6b6b') : f > 0.25 ? '#ffd23f' : '#ff4f6b');
      if (u.st.shield > 0 && u.st.shieldT > rs.t) pxRect(g, bx, bty + 0.5, Math.min(BWD, Math.max(1, Math.round(BWD * u.st.shield / u.maxHp))), 1.5, '#4ff0ff');
      if (!startAb) pxRect(g, bx, bty + 2.5, Math.max(0, Math.round(BWD * Math.min(1, u.charge / u.cd))), 1, u.charge >= u.cd ? '#ffffff' : '#b36bff');
      if (u.cap) { pxRect(g, bx + BWD + 1, bty - 0.5, 3, 3, '#1b1325'); pxRect(g, bx + BWD + 1.5, bty, 2, 2, '#ffd23f'); }
      BV.hpLabels.push({ x: bx - 1.5, y: bty + 1.6, hp: u.hp + (u.st.shield > 0 && u.st.shieldT > rs.t ? 0 : 0), col: u.st.shield > 0 && u.st.shieldT > rs.t ? '#9ff8ff' : '#ffffff', a: alpha });
    }
    g.globalAlpha = 1;
  }
  if (V.sel) { const u = byUid(rs, V.sel); if (u && u.alive) { const [ux, uy] = unitPos(u, V.rt); corners(g, ux, uy, Math.sin(t * 6) > 0 ? '#ffd23f' : '#fff3a8', 0);
    // who it's going after: marching dots to its target
    const tg = V.mode === 'fight' && u.tgt && u.tgt.alive ? u.tgt : null;
    if (tg) { const [tx, ty] = unitPos(tg, V.rt), n = Math.max(3, Math.round(Math.hypot(tx - ux, ty - uy) * 4)), col = u.side === 0 ? '#8cc6ff' : '#ff9aa8', off = (t * 3) % 1;
      for (let i = 0; i < n; i++) { const q = (i + off) / n; if (q < 0.12 || q > 0.88) continue; pxRect(g, (ux + (tx - ux) * q) * TILE + 8.5, (uy + (ty - uy) * q) * TILE + 8.5, 1.5, 1.5, col); }
      corners(g, tx, ty, col, 1); } } }
  // tutorial pointer: a bouncing arrow over a hero or a tile
  if (V.mark) { let mx = null, my = null; if (V.mark.uid) { const mu = byUid(rs, V.mark.uid); if (mu && mu.alive) [mx, my] = unitPos(mu, V.rt); } else if (V.mark.x != null) { mx = V.mark.x; my = V.mark.y; }
    if (mx != null) { const bob = Math.round(Math.abs(Math.sin(t * 5)) * 3), ax = mx * TILE + 9, ay = my * TILE - 9 - bob;
      g.fillStyle = '#1b1325'; g.fillRect(ax - 4, ay - 1, 9, 4); g.fillRect(ax - 2, ay + 3, 5, 2); g.fillRect(ax - 1, ay + 5, 3, 1);
      g.fillStyle = '#ffd23f'; g.fillRect(ax - 3, ay, 7, 2); g.fillRect(ax - 2, ay + 2, 5, 1); g.fillRect(ax - 1, ay + 3, 3, 1); g.fillRect(ax, ay + 4, 1, 1);
      corners(g, mx, my, Math.sin(t * 8) > 0 ? '#ffd23f' : '#ffffff', 0); } }
  if (V.drag) { const u = V.drag.bench ? { hid: V.drag.hid } : byUid(rs, V.drag.uid); if (u) { const im = heroFrame(u.hid, 0, Math.floor(t * 8) % 2 + 1, false, false); g.globalAlpha = V.drag.toBench ? 0.45 : 0.9; g.drawImage(im, Math.round(V.drag.px - 8), Math.round(V.drag.py - 14), im.width, im.height); g.globalAlpha = 1; } }
  // low-res fx
  BV.fx = BV.fx.filter(f => now < f.t0 + (f.delay || 0) + f.dur);
  for (const f of BV.fx) {
    if (now < f.t0 + (f.delay || 0)) continue;
    const k = Math.max(0, Math.min(1, (now - f.t0 - (f.delay || 0)) / f.dur));
    if (f.type === 'shot' || f.type === 'swing') { drawAttackFx(g, f, k, now); continue; }
    if (f.type === 'proj') {
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - (f.arc ? Math.sin(k * Math.PI) * f.arc / TILE : 0);
      if (f.bomb) { const ic = sprCanvas('i_bomb'); g.save(); g.translate(x * TILE + 9, y * TILE + 9); g.rotate(k * 7); g.drawImage(ic, -6, -6, 12, 12); g.restore(); }
      else { const sz = f.big ? 3 : 2; pxRect(g, x * TILE + 9 - sz / 2, y * TILE + 9 - sz / 2, sz, sz, f.color); if (f.big) { g.globalAlpha = 0.5; pxRect(g, x * TILE + 9 - (f.x1 - f.x0) * 3 - 1, y * TILE + 9 - (f.y1 - f.y0) * 3 - 1, 2, 2, f.color); g.globalAlpha = 1; } }
    } else if (f.type === 'line') { // heal beams, ropes
      const n = Math.max(4, Math.round(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) * 6)), reach = Math.min(1, k * 4);
      g.globalAlpha = Math.min(1, (1 - k) * 2);
      for (let i = 0; i <= n * reach; i++) { const q = i / n; const wob = f.rope ? Math.sin(q * 12 + now / 40) * (1 - k) * 1.5 : 0; pxRect(g, (f.x0 + (f.x1 - f.x0) * q) * TILE + 9 - f.w / 2, (f.y0 + (f.y1 - f.y0) * q) * TILE + 8 + wob - f.w / 2, f.w, f.w, i % 3 ? f.color : '#ffffff'); }
      g.globalAlpha = 1;
    } else if (f.type === 'zapline') {
      g.globalAlpha = 1 - k; let lx = f.x0 * TILE + 9, ly = f.y0 * TILE + 8; const n = 6;
      for (let i = 1; i <= n; i++) { const q = i / n, nx = (f.x0 + (f.x1 - f.x0) * q) * TILE + 9 + (i < n ? (Math.random() - 0.5) * 5 : 0), ny = (f.y0 + (f.y1 - f.y0) * q) * TILE + 8 + (i < n ? (Math.random() - 0.5) * 5 : 0);
        for (let j = 0; j < 4; j++) pxRect(g, lx + (nx - lx) * j / 4 - 0.5, ly + (ny - ly) * j / 4 - 0.5, 1.5, 1.5, j % 2 ? f.color : '#ffffff'); lx = nx; ly = ny; }
      g.globalAlpha = 1;
    } else if (f.type === 'lane') { // avalanche rolling down a lane
      const dir = f.y1 < f.y0 ? -1 : 1, y = (f.y0 + dir * k * Math.abs(f.y1 - f.y0)) * TILE + 9, x = f.x * TILE + 9;
      g.globalAlpha = 1 - k * 0.5; for (let i = 0; i < 7; i++) pxRect(g, x - 7 + i * 2, y - 3 + Math.sin(i + k * 9) * 3, 3, 3, i % 2 ? f.color : '#bfe8ff');
      for (let i = 1; i < 5; i++) pxRect(g, x - 5 + (i * 7) % 10, y - dir * i * 4, 2, 2, '#ffffff'); g.globalAlpha = 1;
    } else if (f.type === 'ringfx') {
      const r = (0.4 + k * f.r) * TILE; g.globalAlpha = 1 - k;
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; pxRect(g, f.x * TILE + 9 + Math.cos(a) * r - 1, f.y * TILE + 9 + Math.sin(a) * r * 0.8 - 1, 2, 2, i % 2 ? f.color : '#ffffff'); }
      g.globalAlpha = 1;
    } else if (f.type === 'hole') {
      const cx = f.x * TILE + 9, cy = f.y * TILE + 9; g.globalAlpha = Math.min(1, (1 - k) * 2);
      for (let i = 0; i < 18; i++) { const a = i * 0.7 + k * 10, r = (1 - ((i / 18 + k * 2) % 1)) * 16; pxRect(g, cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r * 0.7 - 1, 2, 2, i % 3 ? '#7b3fd1' : '#e6d0ff'); }
      pxRect(g, cx - 3, cy - 2, 6, 4, '#140c22'); g.globalAlpha = 1;
    } else if (f.type === 'ufo') { // abduction beam
      const cx = f.x * TILE + 9, top = f.y * TILE - 14, q = f.up ? k : 1 - k;
      g.globalAlpha = 0.35 * (1 - Math.abs(k - 0.5) * 2) + 0.15; g.fillStyle = '#fff3a8'; g.fillRect(cx - 7, top + 4, 14, f.y * TILE + 18 - top - 4); g.globalAlpha = 1;
      g.drawImage(sprCanvas('i_ufo'), cx - 8, top - 4);
      const im = heroFrame(f.hid, 0, 0, false, false); g.globalAlpha = 1 - q * 0.8; g.drawImage(im, cx - 8, f.y * TILE + 17 - im.height - q * 18); g.globalAlpha = 1;
    } else if (f.type === 'meteor') {
      const tx = f.x * TILE + 9, ty = f.y * TILE + 9, x = tx + (1 - k) * 40, y = ty - (1 - k) * 70;
      for (let i = 1; i < 6; i++) pxRect(g, x + i * 3, y - i * 5, 3, 3, i < 3 ? '#ffd23f' : '#ff8a2a');
      g.drawImage(sprCanvas('i_rock'), Math.round(x - 8), Math.round(y - 8));
    } else if (f.type === 'tint') {
      g.globalAlpha = 0.25 * (1 - k); g.fillStyle = f.color; g.fillRect(0, -PADT, BW * TILE, BH * TILE + PADT); g.globalAlpha = 1;
    } else if (f.type === 'zone') { // fire wall / cauldron
      const fade = Math.min(1, (1 - k) * 6);
      for (const i of f.tiles) { const x = (i % BW) * TILE, y = Math.floor(i / BW) * TILE;
        if (f.kind === 'fire') { g.globalAlpha = 0.35 * fade; g.fillStyle = '#ff6a2a'; g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); g.globalAlpha = fade;
          for (let j = 0; j < 3; j++) { const fx = x + 3 + j * 5, h = 4 + ((Math.floor(now / 90) + j * 2 + i) % 4); pxRect(g, fx, y + TILE - 3 - h, 3, h, j % 2 ? '#ff8a2a' : '#ffd23f'); } }
        else { g.globalAlpha = 0.25 * fade; g.fillStyle = '#7dff6b'; g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); g.globalAlpha = fade; pxRect(g, x + 4 + ((Math.floor(now / 150) + i) % 3) * 4, y + 12 - ((Math.floor(now / 60) + i * 3) % 9), 2, 2, '#7dff6b'); } }
      if (f.kind === 'brew') { g.globalAlpha = fade; g.drawImage(sprCanvas('i_cauldron'), f.cx * TILE + 1, f.cy * TILE + 1); }
      g.globalAlpha = 1;
    } else if (f.type === 'hazpulse') { // hazard tiles blinking (match intro / tiles moved)
      const on = 0.5 + 0.5 * Math.sin(k * Math.PI * 6), fade = Math.min(1, (1 - k) * 4);
      for (const i of f.tiles) { const x = (i % BW) * TILE, y = Math.floor(i / BW) * TILE;
        g.globalAlpha = 0.45 * on * fade; g.fillStyle = f.color; g.fillRect(x, y, TILE, TILE);
        g.globalAlpha = fade; g.fillStyle = on > 0.5 ? '#ffffff' : f.color; g.fillRect(x, y, TILE, 1); g.fillRect(x, y + TILE - 1, TILE, 1); g.fillRect(x, y, 1, TILE); g.fillRect(x + TILE - 1, y, 1, TILE); }
      g.globalAlpha = 1;
    } else if (f.type === 'blast') {
      g.globalAlpha = (1 - k) * 0.75;
      for (const p of f.tiles) { g.fillStyle = f.color; g.fillRect(p.x * TILE + k * 4, p.y * TILE + k * 4, TILE - k * 8, TILE - k * 8); }
      g.globalAlpha = 1;
    } else if (f.type === 'parts') {
      for (const p of f.list) { const sz = p.big ? 3 + k * 3 : 2; if (p.big) g.globalAlpha = 1 - k; pxRect(g, p.x + p.vx * k * 14 - sz / 2, p.y + p.vy * k * 14 + (p.big ? 0 : k * k * 10), sz, sz, p.color); g.globalAlpha = 1; }
    } else if (f.type === 'dust') {
      g.globalAlpha = 0.55 * (1 - k); g.fillStyle = '#e8e0d0';
      g.fillRect(f.x - 3 - k * 4, f.y - k * 2, 2, 2); g.fillRect(f.x + 2 + k * 4, f.y - k * 2, 2, 2); g.fillRect(f.x - 1, f.y - 1 - k * 3, 2, 1); g.globalAlpha = 1;
    } else if (f.type === 'charge') { // energy gathering before a laser (follows the hero)
      const cu = f.uid && byUid(rs, f.uid); if (cu) { const cp = unitPos(cu, V.rt); f.x = cp[0]; f.y = cp[1]; }
      const r = 9 * (1 - k); g.globalAlpha = 0.4 + 0.6 * k; g.fillStyle = f.color;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + k * 4; g.fillRect(f.x * TILE + 9 + Math.cos(a) * r - 1, f.y * TILE + 6 + Math.sin(a) * r - 1, 2, 2); }
      g.fillStyle = '#ffffff'; g.fillRect(f.x * TILE + 9 - k * 2, f.y * TILE + 6 - k * 2, 1 + k * 4, 1 + k * 4); g.globalAlpha = 1;
    } else if (f.type === 'laser') {
      const top = Math.min(f.y0, f.y1) * TILE + (f.y1 < f.y0 ? 0 : 9), bot = Math.max(f.y0, f.y1) * TILE + (f.y1 < f.y0 ? 9 : 0);
      const reach = Math.min(1, k * 5), len = (bot - top) * reach, cx = f.x * TILE + 9;
      const y0 = f.y1 < f.y0 ? bot - len : top, w = (k < 0.2 ? 8 : 8 * (1 - (k - 0.2) / 0.8)) + (Math.floor(now / 40) % 2);
      g.globalAlpha = 0.5 * (1 - k); g.fillStyle = f.color; g.fillRect(cx - w - 2, y0, w * 2 + 4, len);
      g.globalAlpha = 1 - k * 0.6; g.fillStyle = f.color; g.fillRect(cx - w / 2 - 1, y0, w + 2, len);
      g.fillStyle = '#ffffff'; g.fillRect(cx - Math.max(1, w / 4), y0, Math.max(2, w / 2), len); g.globalAlpha = 1;
    } else if (f.type === 'ring') {
      g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 1; g.strokeRect(f.x * TILE + 0.5 - k * 6, f.y * TILE + 0.5 - k * 6, TILE - 1 + k * 12, TILE - 1 + k * 12); g.globalAlpha = 1;
    }
  }
  const G = BV.g, S = BV.scale * BV.dpr;
  G.imageSmoothingEnabled = false; G.clearRect(0, 0, BV.cv.width, BV.cv.height);
  const shx = 0, shy = 0; let kx = 0, ky = 0; if (BV.shake && now < BV.shake.t0 + BV.shake.dur) { const m = BV.shake.mag * (1 - (now - BV.shake.t0) / BV.shake.dur) * BV.scale; kx = Math.round((Math.random() - 0.5) * 2 * m); ky = Math.round((Math.random() - 0.5) * 2 * m); }
  if (kx !== (BV.shk || [0, 0])[0] || ky !== (BV.shk || [0, 0])[1]) { BV.shk = [kx, ky]; bvXform(); }
  G.drawImage(BV.low, 0, 0, BV.low.width, BV.low.height, shx, shy, BW * TILE * S, (BH * TILE + PADT) * S);
  // health numbers next to each bar
  G.font = `${Math.round(6.2 * S)}px Jersey, monospace`; G.textAlign = 'right'; G.textBaseline = 'middle'; G.lineJoin = 'round'; G.lineWidth = Math.max(2, S * 1.2); G.strokeStyle = '#140c22';
  for (const l of BV.hpLabels || []) { G.globalAlpha = l.a; const x = Math.round(l.x * S) + shx, y = Math.round((l.y + PADT) * S) + shy; G.strokeText(String(l.hp), x, y); G.fillStyle = l.col; G.fillText(String(l.hp), x, y); }
  G.globalAlpha = 1;
  BV.floats = BV.floats.filter(f => now < f.t0 + f.dur);
  for (const f of BV.floats) {
    const k = (now - f.t0) / f.dur; const size = Math.round((f.size || 7) * S);
    G.font = `${Math.round(size * 1.3)}px Jersey, monospace`; G.textBaseline = 'middle';
    let x = (f.x + 0.5) * TILE * S; const y = ((f.y + 0.3) * TILE + PADT) * S - (1 - Math.pow(1 - k, 2)) * 11 * S;
    G.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    { // optional pixel icon in front of the text (whole-number scale); keep the label inside the board
      const ic = f.icon ? sprCanvas(f.icon) : null, z = Math.max(1, Math.round(size * 1.15 / 16)), iw = ic ? 16 * z : 0, gap = ic ? 2 * z : 0, tw = G.measureText(f.text).width;
      const full = iw + gap + tw, maxX = BW * TILE * S - 4;
      const x0 = Math.round(Math.max(4, Math.min(maxX - full, x - full / 2)));
      if (ic) G.drawImage(ic, x0, Math.round(y - iw / 2), iw, iw);
      x = x0 + iw + gap; G.textAlign = 'left';
    }
    G.lineJoin = 'round'; G.lineWidth = Math.max(3, S * 1.8); G.strokeStyle = '#140c22'; G.strokeText(f.text, x, y); G.fillStyle = f.color; G.fillText(f.text, x, y);
    G.globalAlpha = 1;
  }
}

function bvFloat(x, y, text, color, size, dur, icon) {
  // keep labels from piling on top of each other: nudge up until there's room
  const now = bvNow(), wid = f => (f.text.length * 0.34 + (f.icon ? 0.6 : 0)) * (f.size || 7) / 6.5;
  const me = { x, y, text, color, size, icon };
  for (let i = 0; i < 4; i++) {
    const hit = BV.floats.some(f => now - f.t0 < 450 && Math.abs(f.y - me.y) < 0.42 && Math.abs(f.x - me.x) < (wid(f) + wid(me)) / 2);
    if (!hit) break; me.y -= 0.45;
  }
  me.t0 = now; me.dur = (dur || 900) * BV.speed; BV.floats.push(me);
}
// battle clock: runs slower during the final-kill slow motion (set by the battle loop)
function bvNow() { return BV.vt != null ? BV.vt : performance.now(); }
function bvShake(mag, dur) { BV.shake = { t0: bvNow(), mag, dur: dur || 220 }; }
function bvFx(f) { f.t0 = bvNow(); f.dur = (f.dur || 250) * (f.raw ? 1 : BV.speed); BV.fx.push(f); }
// camera punch toward a tile (p = [x, y] in tiles), or back to normal
function bvZoom(p) { BV.zoomP = p || null; bvXform(); }
// slow-mo zoom and screen shake move the board and the arena around it together, so nothing behind them shows
function bvXform() {
  const cv = BV.cv, bg = document.getElementById('bbg'); if (!cv) return;
  const z = BV.zoomP, [sx, sy] = BV.shk || [0, 0], s = BV.scale;
  if (!z && !sx && !sy) { cv.style.transition = BV.shkWas ? 'none' : ''; cv.style.transform = ''; if (bg) { bg.style.transition = cv.style.transition; bg.style.transform = ''; } BV.shkWas = false; return; }
  BV.shkWas = !!(sx || sy);
  const ox = z ? (z[0] + 0.5) * TILE * s : cv.offsetWidth / 2, oy = z ? ((z[1] + 0.5) * TILE + PADT) * s : cv.offsetHeight / 2, t = `translate(${sx}px,${sy}px) scale(${z ? 1.22 : 1})`;
  const tr = sx || sy ? 'none' : ''; cv.style.transition = tr; if (bg) bg.style.transition = tr; // shakes snap; the zoom eases (same curve on both)
  cv.style.transformOrigin = `${ox}px ${oy}px`; cv.style.transform = t;
  if (bg) { const bb = cv.parentElement; bg.style.transformOrigin = `${bb.offsetLeft + cv.offsetLeft + ox + BG_PAD}px ${bb.offsetTop + cv.offsetTop + oy + BG_PAD}px`; bg.style.transform = t; }
}

// ----- per-hero attack effects -----
// 'swing' = melee hit at the target (appears when the blow lands); 'shot' = projectile in flight (k: 0 -> 1 = launch -> impact)
function drawAttackFx(g, f, k, now) {
  const c = f.color || '#ffffff', P = (x, y, w, h, col) => pxRect(g, x, y, w, h, col);
  if (f.type === 'swing') {
    const cx = f.x * TILE + 9, cy = f.y * TILE + 8, a = 1 - k;
    g.globalAlpha = Math.min(1, a * 1.6);
    switch (f.look) {
      case 'slash': case 'slash2': { // crescent arcs; slash2 adds a second, crossing arc
        const arcs = f.look === 'slash2' ? [[-2.4, -0.6, 0], [2.4, 0.6, 0.35]] : [[-2.5, 0.2, 0]];
        for (const [a0, a1, off] of arcs) { const kk = Math.min(1, (k - off) * 2.2); if (kk <= 0) continue;
          for (let i = 0; i <= 10 * kk; i++) { const an = a0 + (a1 - a0) * i / 10 - Math.PI / 2 * (f.dy || 0); const r = 7;
            P(cx + Math.cos(an) * r - 1, cy + Math.sin(an) * r - 1, 2, 2, i > 10 * kk - 3 ? '#ffffff' : c); } }
        break; }
      case 'stab': { const L = 3 + 6 * Math.min(1, k * 3); P(cx - f.dx * L - 0.5, cy - f.dy * L - 0.5, 1 + Math.abs(f.dx) * L, 1 + Math.abs(f.dy) * L, '#ffffff'); P(cx - 1, cy - 1, 3, 3, c); break; }
      case 'claw': for (let i = -1; i <= 1; i++) { const L = 8 * Math.min(1, k * 3); for (let j = 0; j < L; j++) P(cx - 4 + j + i * 3, cy - 4 + j - i, 1.5, 1.5, j > L - 2 ? '#ffffff' : c); } break;
      case 'punch': { const r = 2 + k * 6; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; P(cx + Math.cos(an) * r - 1, cy + Math.sin(an) * r - 1, 2, 2, i % 2 ? c : '#ffffff'); }
        if (c === '#bfe8ff') for (let i = 0; i < 5; i++) P(cx - 6 + i * 3, cy - 5 + k * 9 + (i % 2) * 3, 1, 1, '#ffffff'); // snow
        else for (let i = 0; i < 3; i++) { const sx = cx - 6 + i * 6, sy = cy - 6 + ((i * 5 + Math.floor(now / 40)) % 4); P(sx, sy, 1, 2, c); P(sx + 1, sy + 2, 1, 2, c); } // sparks
        break; }
      case 'whip': { const n = 12; for (let i = 0; i <= n * Math.min(1, k * 3); i++) { const q = i / n; const x = f.x0 * TILE + 9 + (cx - f.x0 * TILE - 9) * q, y = f.y0 * TILE + 8 + (cy - f.y0 * TILE - 8) * q + Math.sin(q * 9 + now / 50) * 2 * (1 - q); P(x - 0.5, y - 0.5, 1.5, 1.5, c); } P(cx - 2, cy - 2, 4, 4, '#ffffff'); break; }
      case 'chomp': { const gap = 7 * Math.max(0, 1 - k * 2.5); for (let i = 0; i < 4; i++) { P(cx - 6 + i * 3, cy - 3 - gap, 2, 2 + (i % 2), '#ffffff'); P(cx - 6 + i * 3, cy + 2 + gap - (i % 2), 2, 2 + (i % 2), '#ffffff'); } if (k > 0.4) for (let i = 0; i < 4; i++) P(cx - 5 + i * 3, cy - 1, 1, 1, '#ff6b6b'); break; }
      case 'smash': case 'chop': {
        if (f.look === 'chop') { const L = 14 * Math.min(1, k * 4); P(cx - 1, cy - 8, 2.5, L, '#ffffff'); P(cx - 2.5, cy - 8, 1, L, c); }
        const r = 3 + k * 10; for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6; P(cx + Math.cos(an) * r - 1, cy + 6 + Math.sin(an) * r * 0.35 - 1, 2, 1.5, i % 3 ? '#d8cdb8' : '#ffffff'); }
        for (let i = 0; i < 5; i++) P(cx - 6 + i * 3, cy + 4 - Math.sin(k * Math.PI) * (4 + i % 3 * 2), 1.5, 1.5, '#8a7a68');
        P(cx - 3, cy - 3, 6, 6, k < 0.25 ? '#ffffff' : c);
        break; }
    }
    g.globalAlpha = 1; return;
  }
  // projectiles
  const x0 = f.x0 * TILE + 9, y0 = f.y0 * TILE + 8, x1 = f.x1 * TILE + 9, y1 = f.y1 * TILE + 8;
  let x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  switch (f.look) {
    case 'bolt': for (let i = 0; i < 6; i++) P(x - ux * i - 1, y - uy * i - 1, 2, 2, i < 2 ? '#ffffff' : c); break;
    case 'bullet': P(x - 1, y - 1, 2, 2, '#ffffff'); for (let i = 1; i < 5; i++) { g.globalAlpha = 1 - i / 5; P(x - ux * i * 2 - 0.5, y - uy * i * 2 - 0.5, 1, 1, c); } g.globalAlpha = 1; if (k < 0.3) P(x0 + ux * 7 - 2, y0 + uy * 7 - 2, 4, 4, '#fff3a8'); break;
    case 'zap': { const n = Math.max(3, Math.round(len / 4)); let px = x0, py = y0; for (let i = 1; i <= n; i++) { const q = i / n, jx = i < n ? (Math.random() - 0.5) * 4 : 0, jy = i < n ? (Math.random() - 0.5) * 4 : 0; const nx = x0 + (x1 - x0) * q + jx, ny = y0 + (y1 - y0) * q + jy;
        for (let j = 0; j < 4; j++) P(px + (nx - px) * j / 4 - 0.5, py + (ny - py) * j / 4 - 0.5, 1.5, 1.5, j % 2 ? c : '#ffffff'); px = nx; py = ny; } break; }
    case 'orb': for (let i = 3; i >= 0; i--) { g.globalAlpha = 1 - i * 0.25; const s = i ? 2 : 4; P(x - ux * i * 3 - s / 2, y - uy * i * 3 - s / 2, s, s, i ? c : '#ffffff'); } g.globalAlpha = 1; P(x - 1.5, y - 1.5, 3, 3, c); P(x - 0.5, y - 0.5, 1, 1, '#ffffff'); break;
    case 'star': { const r = Math.floor(now / 70) % 2; if (r) { P(x - 2.5, y - 0.5, 5, 1, c); P(x - 0.5, y - 2.5, 1, 5, c); } else for (let i = -2; i <= 2; i++) { P(x + i - 0.5, y + i - 0.5, 1, 1, c); P(x + i - 0.5, y - i - 0.5, 1, 1, c); } P(x - 0.5, y - 0.5, 1, 1, '#ffffff');
      for (let i = 1; i < 4; i++) if ((Math.floor(now / 60) + i) % 2) P(x - ux * i * 4 + (i % 2 ? 1 : -1), y - uy * i * 4, 1, 1, '#ffffff'); break; }
    case 'hex': { const w = Math.sin(k * Math.PI * 3) * 3; x += -uy * w; y += ux * w; for (let i = 1; i < 5; i++) { g.globalAlpha = 0.8 - i * 0.15; const wk = Math.sin((k - i * 0.06) * Math.PI * 3) * 3; P(x0 + (x1 - x0) * (k - i * 0.06) - uy * wk - 1, y0 + (y1 - y0) * (k - i * 0.06) + ux * wk - 1, 2, 2, c); } g.globalAlpha = 1; P(x - 2, y - 2, 4, 4, c); P(x - 1, y - 1, 2, 2, '#ffffff'); break; }
    case 'fireball': for (let i = 4; i >= 0; i--) { const s = Math.max(1, 5 - i); g.globalAlpha = 1 - i * 0.17; P(x - ux * i * 2.5 - s / 2 + (i ? (Math.random() - 0.5) * 2 : 0), y - uy * i * 2.5 - s / 2, s, s, i === 0 ? '#fff3a8' : i < 2 ? '#ffd23f' : c); } g.globalAlpha = 1; break;
    case 'lob': { y -= Math.sin(k * Math.PI) * 12; const r = Math.floor(k * 6) % 2; P(x - 2, y - 1.5, 4, 3, c); P(x - 1.5 + r, y - 2.5, 3, 1, '#ffffff'); P(x - 1, y + 1.5, 2, 1, '#c9a46a'); break; }
    case 'cannon': case 'boulder': case 'scrap': { if (f.look !== 'cannon') y -= Math.sin(k * Math.PI) * 10; const ic = sprCanvas(f.look === 'cannon' ? 'i_bomb' : f.look === 'boulder' ? 'i_rock' : 'i_bomb'); g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(k * 6); g.drawImage(ic, -5, -5, 10, 10); g.restore();
      if (f.look === 'cannon') for (let i = 1; i < 4; i++) { g.globalAlpha = 0.5 - i * 0.12; P(x - ux * i * 4 - 1.5, y - uy * i * 4 - 1.5, 3, 3, '#c9c3ee'); } g.globalAlpha = 1; break; }
    case 'missile': for (let i = 4; i >= 0; i--) P(x - ux * i * 2 - 1, y - uy * i * 2 - 1, 2, 2, i === 0 ? '#dfe6f0' : i < 2 ? '#ffd23f' : '#ff8a2a'); P(x + ux * 2 - 1, y + uy * 2 - 1, 2, 2, '#ff4d6d'); break;
    case 'ice': for (let i = 0; i < 5; i++) P(x - ux * i * 2 - 1, y - uy * i * 2 - 1, 2, 2, i ? c : '#ffffff'); P(x - 2, y - 0.5, 4, 1, '#ffffff'); P(x - 0.5, y - 2, 1, 4, '#ffffff'); break;
    case 'whip': { const n = Math.max(4, Math.round(len / 2)); for (let i = 0; i <= n * k; i++) { const q = i / n, wv = Math.sin(q * 10 + now / 40) * 2 * (1 - q); P(x0 + (x1 - x0) * q - uy * wv - 0.5, y0 + (y1 - y0) * q + ux * wv - 0.5, 1.5, 1.5, c); } break; }
    default: P(x - 1, y - 1, 2, 2, c);
  }
  if (k > 0.92) { g.globalAlpha = 0.9; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4; P(x1 + Math.cos(an) * 3 - 1, y1 + Math.sin(an) * 3 - 1, 2, 2, c); } g.globalAlpha = 1; }
}

// ===== live hero portraits: idle breathing + blinking, hop when tapped (hero card, chest reveals) =====
// usage: liveHero(hid, k) -> HTML for a <canvas class="live"> drawn at k CSS px per sprite pixel
const LIVE = new WeakMap();
function liveHero(hid, k, cls) { return `<canvas class="live px ${cls || ''}" data-hid="${hid}" data-k="${k}" style="width:${16 * k}px;height:${25 * k}px"></canvas>`; }
function liveHop(cv) { const s = LIVE.get(cv); if (s) { s.hopT = performance.now(); s.blinkAt = 0; } }
(function liveLoop() {
  const now = performance.now(), t = now / 1000, dpr = Math.min(3, window.devicePixelRatio || 1);
  for (const cv of document.querySelectorAll('canvas.live')) {
    let s = LIVE.get(cv);
    if (!s) {
      s = { seed: Math.random() * 6, blinkAt: now + 500 + Math.random() * 1500, hopT: 0 }; LIVE.set(cv, s);
      cv.addEventListener('click', () => liveHop(cv));
    }
    const k = +cv.dataset.k, hid = cv.dataset.hid, W = Math.round(16 * k * dpr), Hh = Math.round(25 * k * dpr);
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, Hh);
    const u = W / 16; // device px per sprite pixel
    // hop when tapped
    let z = 0, lift = 0; const hd = now - s.hopT;
    if (s.hopT && hd < 420) { const q = hd / 420; z = Math.sin(q * Math.PI) * 4; lift = q < 0.5 ? 1 : 2; }
    const br = !z && Math.sin(t * 2.3 + s.seed) > 0.35 ? 1 : 0;
    if (now > s.blinkAt + 140) s.blinkAt = now + 1800 + Math.random() * 3000;
    const blink = now >= s.blinkAt && now < s.blinkAt + 140;
    // ground shadow
    const sw = Math.max(6, 12 - Math.round(z));
    g.fillStyle = 'rgba(10,6,20,0.35)'; g.fillRect(Math.round((8 - sw / 2) * u), Math.round(23 * u), Math.round(sw * u), Math.round(1.5 * u));
    const im = heroFrame(hid, br, lift, blink, false);
    g.drawImage(im, 0, Math.round((24 - im.height - z) * u), Math.round(16 * u), Math.round(im.height * u));
  }
  requestAnimationFrame(liveLoop);
})();

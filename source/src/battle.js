// ===== Rift Squad: auto-battle simulator + AI formations (pure logic, no DOM) =====
// Tile movement: heroes step tile to tile in 4 directions and can't pass through anyone. 4 rows per side, all placeable.
// (the old free-movement code paths are kept behind this flag)
const GRID_MODE = true;
const GAP = 0; // empty middle rows (none: the middle rows belong to each side)
const BW = 5, HALF = GRID_MODE ? 4 : 3, BH = HALF * 2 + GAP, P0 = HALF + GAP, DT = 0.05; // 5 wide, 4 rows per side; your side starts at row P0

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const inB = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH;
const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// grid movement (experimental): heroes step tile to tile in 4 directions, much slower, and everyone hits the closest enemy
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GRID_SLOW = 2.5, GRID_HOP = 0.3;
const dirsOf = s => s.grid ? DIR4 : DIR8;
const manh = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
// distance used for "can I hit it" and "who is closest"
// attack reach on the tile board: a round shape, so every hero can hit diagonally (movement stays up/down/left/right).
// a tile is within range r when dx^2 + dy^2 <= r(r+1): r1 = the 8 tiles around, r2 adds the knight-move tiles, and so on
const rdist = (ax, ay, bx, by) => { const d2 = (ax - bx) ** 2 + (ay - by) ** 2; return d2 === 0 ? 0 : Math.ceil((Math.sqrt(1 + 4 * d2) - 1) / 2 - 1e-9); };
const reach = (s, ax, ay, bx, by) => s.grid ? rdist(ax, ay, bx, by) : Math.max(Math.abs(ax - bx), Math.abs(ay - by));
function deployRows(side) { const r = []; for (let d = 0; d < HALF; d++) r.push(rowAt(side, d)); return r; }
function inHalf(side, y) { return side === 0 ? y >= P0 : y < HALF; }
// depth 0 = row touching the middle, HALF-1 = back row
function rowAt(side, depth) { return side === 0 ? P0 + depth : HALF - 1 - depth; }
function frontRow(side) { return rowAt(side, 0); }
function backRow(side) { return rowAt(side, HALF - 1); }
const ROLE_DEPTH = GRID_MODE ? { tank: 1, fighter: 1, ranged: 3, healer: 3 } : { tank: 0, fighter: 0, ranged: 2, healer: 2 }; // AI leaves the front row open by default
const FRONT_ROLES = { tank: 1, fighter: 1 };

// Fixed whole-number stats (heroes don't level up; abilities are the upgrades)
function heroStats(hid) {
  const h = HERO[hid], r = ROLES[h.role];
  const c = heroCost(hid);
  return { hp: Math.round((h.hp || r.hp) * (COST_HP[c] || 1)), atk: (h.dmg || r.dmg) + (COST_DMG[c] || 0), as: +((h.as || r.as) * 1.25).toFixed(3), rng: h.rng || r.rng, spd: SPEEDS[heroSpeed(hid)].t, cost: c };
}

// ----- events / tiles -----
// variant 0/1 = the hand-made layouts; any bigger number is a seed for a fresh layout (hazards move every round)
const HAZARD_COUNT = { lava: 3, spring: 2, rock: 3 };
function genLayout(E, seed) {
  for (let tries = 0; tries < 30; tries++) {
    const rnd = mulberry32((seed + tries * 7919) >>> 0), L = Array.from({ length: HALF }, () => [...'.....']);
    let n = HAZARD_COUNT[E.tile] || 3, guard = 0;
    while (n > 0 && guard++ < 50) { const d = Math.floor(rnd() * HALF), x = Math.floor(rnd() * BW); if (L[d][x] === '.' && L[d].filter(c => c === 'x').length < 2) { L[d][x] = 'x'; n--; } }
    const rows = L.map(r => r.join(''));
    if (E.tile !== 'rock' || boardOpen(rows)) return rows;
  }
  return E.layouts[0];
}
// rocks must never cut the board in two
function boardOpen(rows) {
  const blocked = new Set();
  for (let d = 0; d < HALF; d++) for (let x = 0; x < BW; x++) if ((rows[d] || '')[x] === 'x') { blocked.add((P0 + d) * BW + x); blocked.add((HALF - 1 - d) * BW + x); }
  const free = []; for (let i = 0; i < BW * BH; i++) if (!blocked.has(i)) free.push(i);
  const seen = new Set([free[0]]), q = [free[0]];
  while (q.length) { const i = q.pop(), x = i % BW, y = (i / BW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * BW + nx; if (nx < 0 || ny < 0 || nx >= BW || ny >= BH || blocked.has(j) || seen.has(j)) continue; seen.add(j); q.push(j); } }
  return seen.size === free.length;
}
function eventBoard(eventId, variant) {
  const E = EVENTS[eventId]; const tiles = new Array(BW * BH).fill(null), obs = new Array(BW * BH).fill(0);
  if (E && E.tile && E.layouts.length) {
    const L = (variant || 0) >= 2 ? genLayout(E, variant) : E.layouts[(variant || 0) % E.layouts.length];
    for (let d = 0; d < HALF; d++) for (let x = 0; x < BW; x++) if ((L[d] || '')[x] === 'x') {
      for (const y of [P0 + d, HALF - 1 - d]) { tiles[y * BW + x] = E.tile; if (E.tile === 'rock') obs[y * BW + x] = 1; }
    }
  }
  return { tiles, obs };
}
function pickEvent(arena, rnd) {
  const fav = ARENA_EVENT[arena];
  if (fav && rnd() < 0.5) return fav;
  return EVENT_IDS[Math.floor(rnd() * EVENT_IDS.length)];
}

// ----- synergies -----
function worldCounts(hids) { const c = {}; for (const h of hids) { const w = HERO[h].world; c[w] = (c[w] || 0) + 1; } return c; }
function worldBonus(counts, world) { if (!WORLDS_ON) return 0; const n = counts[world] || 0; return n >= 3 ? WORLD_BONUS[1] : n === 2 ? WORLD_BONUS[0] : 0; }
function activeSynergies(hids) {
  if (!WORLDS_ON) return [];
  const c = worldCounts(hids); const out = [];
  for (const w in WORLDS) { const n = c[w] || 0; if (n >= 1) out.push({ world: w, n, tier: n >= 3 ? 2 : n === 2 ? 1 : 0, v: worldBonus(c, w) }); }
  return out.sort((a, b) => b.tier - a.tier || b.n - a.n);
}

// ----- round setup -----
function capFxOf(hid) { return hid && HERO[hid] && HERO[hid].cap ? HERO[hid].cap.fx : {}; }
function mkSt() {
  return { shield: 0, shieldT: 0, stunT: 0, frogT: 0, floatT: 0, slowT: 0, hasteT: 0, fastT: 0, dotT: 0, dotNext: 0, dotKind: null, dotSrc: null,
    tauntUid: null, tauntT: 0, charmT: 0, vanishT: 0, goneT: 0, shrinkT: 0, vulnT: 0 };
}
function makeUnit(s, uid, hid, side, ab, x, y, opts) {
  opts = opts || {};
  const st = heroStats(hid), H = HERO[hid], A = ab ? ABILITIES[ab] : null;
  const cd = A && A.kind === 'charge' ? A.cd : 1e9;
  const maxHp = opts.hp || Math.max(1, Math.round((st.hp + (opts.hpAdd || 0)) * (opts.hpMul || 1)));
  return { uid, hid, side, ab: ab || null, role: H.role, cap: !!opts.cap, clone: !!opts.clone, tg: heroTarget(hid), tgFail: 0, dealt: 0, kills: 0,
    x, y, fx: x, fy: y, mt0: 0, mt1: 0, holdT: 0, hp: maxHp, maxHp, atk: opts.atk || st.atk, as: st.as, rng: st.rng, spd: st.spd, cd,
    charge: cd * (opts.charge0 || 0.3), nextAtk: 0.35 + (opts.i || 0) * 0.05, tgt: null, retgt: 0, alive: true, bonus: 0,
    m: { abilHaste: opts.abilHaste || 1, abil: opts.abil || 0, block: opts.block || 0 },
    pas: { stone: ab === 'stoneskin' ? 3 : 0, fort: ab === 'snowfort' ? 1 : 0, low: false },
    st: Object.assign(mkSt(), { shield: opts.shield || 0, shieldT: opts.shield ? 999 : 0 }) };
}
// opts: { sides: [{ units:[{hid,ab,x,y}], captain: hid }, {...}], event, variant, seed, timeLimit }
function newRound(opts) {
  const { tiles, obs } = eventBoard(opts.event, opts.variant);
  const s = { t: 0, tiles, obs, event: opts.event, units: [], pending: [], winner: null, grid: opts.grid != null ? !!opts.grid : GRID_MODE, gridReach: opts.gridReach || 'manh', timeLimit: opts.timeLimit || ((opts.grid != null ? opts.grid : GRID_MODE) ? GRID_ROUND_TIME : ROUND_TIME),
    stats: [mkStats(), mkStats()], rnd: mulberry32(opts.seed || 1), revive: [0, 0], started: false, open: 0, zones: [], mines: [], drones: [], feats: [{}, {}] };
  for (let side = 0; side < 2; side++) {
    const S = opts.sides[side];
    const capFx = capFxOf(S.captain);
    const counts = worldCounts(S.units.map(u => u.hid));
    s.revive[side] = capFx.revive || 0;
    S.units.forEach((d, i) => {
      const H = HERO[d.hid];
      const H2 = HERO[d.hid]; if (H2.boss) { const b = makeUnit(s, (side ? 'e' : 'p') + i, d.hid, side, null, d.x, d.y, { i, cap: d.hid === S.captain, hp: H2.hp }); b.big = !!H2.big; b.boss = true; if (d.hpNow != null) b.hp = Math.max(1, Math.min(b.maxHp, d.hpNow)); s.units.push(b); return; }
      s.units.push(makeUnit(s, (side ? 'e' : 'p') + i, d.hid, side, d.ab, d.x, d.y, {
        i, cap: d.hid === S.captain, hpAdd: (capFx.hp || 0) + worldBonus(counts, H.world), hpMul: S.hpMul || 1,
        abilHaste: Math.max(0.3, 1 + (capFx.abilHaste || 0)), abil: capFx.abilDmg || 0, block: capFx.abilBlock || 0, shield: capFx.shieldStart || 0, charge0: S.charge0 }));
    });
  }
  if (s.grid) for (const u of s.units) u.moveCd = moveTime(s, u, false) * GRID_SLOW; // everyone waits one step before moving
  return s;
}
function mkStats() { return { dmg: 0, kills: 0, abil: 0, heal: 0, lost: 0 }; }

// ----- helpers -----
function unitAt(s, x, y) { for (const u of s.units) if (u.alive && !(u.st.goneT > s.t) && (u.x === x || (u.big && u.x + 1 === x)) && (u.y === y || (u.big && u.y + 1 === y))) return u; return null; }
// the tile of t closest to (x, y): big bosses cover 2x2
function near(t, x, y) { return t.big ? [Math.max(t.x, Math.min(t.x + 1, x)), Math.max(t.y, Math.min(t.y + 1, y))] : [t.x, t.y]; }
const rdTo = (x, y, t) => { const p = near(t, x, y); return rdist(x, y, p[0], p[1]); };
const mhTo = (x, y, t) => { const p = near(t, x, y); return manh(x, y, p[0], p[1]); };
function byUid(s, uid) { for (const u of s.units) if (u.uid === uid) return u; return null; }
function isObs(s, x, y) { return s.obs[y * BW + x] === 1; }
function tileAt(s, x, y) { return s.tiles[y * BW + x]; }
function free(s, x, y) { return inB(x, y) && !isObs(s, x, y) && !unitAt(s, x, y); }
const present = (s, e) => e.alive && !(e.st.goneT > s.t);
function foesOf(s, u) { return s.units.filter(e => e.side !== u.side && present(s, e)); }
function friendsOf(s, u) { return s.units.filter(a => a.side === u.side && present(s, a)); }
const targetable = (s, e) => present(s, e) && !(e.st.vanishT > s.t);
function pushEv(ev, e) { if (ev) ev.push(e); }
function stunned(s, u) { return u.st.stunT > s.t || u.st.frogT > s.t || u.st.floatT > s.t || u.st.goneT > s.t; }
const lowHp = u => u.hp * 2 < u.maxHp;
function dmgOf(u) { return u.atk + u.bonus + (u.ab === 'berserk' && lowHp(u) ? 1 : 0); }
function interval(s, u) {
  let k = 1; if (u.st.slowT > s.t) k *= 2; if (u.st.hasteT > s.t) k /= 2; if (u.ab === 'overdrive' && lowHp(u)) k /= 2;
  return u.as * k;
}
function moveTime(s, u, diag) { let k = diag ? 1.3 : 1; if (u.st.slowT > s.t) k *= 2; if (u.st.fastT > s.t) k /= 2; return u.spd * k; }
const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'enemy' ? 'enemies' : w + 's');
function cap(ev, u, msg) { pushEv(ev, { t: 'cap', uid: u.uid, ab: u.ab, msg }); }
function nearestFree(s, x, y, side) {
  let best = null, bd = 99;
  for (let yy = 0; yy < BH; yy++) for (let xx = 0; xx < BW; xx++) if (free(s, xx, yy)) {
    const d = cheb(x, y, xx, yy) + (side != null && !inHalf(side, yy) ? 0.5 : 0); if (d < bd) { bd = d; best = [xx, yy]; }
  }
  return best;
}

function heal(s, u, amt, ev) {
  amt = Math.round(amt); if (!u.alive || amt <= 0) return 0;
  const b = u.hp; u.hp = Math.min(u.maxHp, u.hp + amt); const h = u.hp - b;
  s.stats[u.side].heal += h;
  if (h >= 1) pushEv(ev, { t: 'heal', uid: u.uid, amt: Math.round(h) });
  if (!lowHp(u)) u.pas.low = false;
  return h;
}

function dealDamage(s, src, tgt, amt, ev, kind) {
  if (!tgt.alive) return 0;
  kind = kind || 'hit';
  if (tgt.pas.stone > 0 && (kind === 'hit' || kind === 'abil')) { // Stone Skin
    tgt.pas.stone--; pushEv(ev, { t: 'dmg', uid: tgt.uid, src: src ? src.uid : null, amt: 0, absorbed: 1, kind });
    cap(ev, tgt, tgt.pas.stone ? `blocked a hit (${tgt.pas.stone} left)` : 'blocked a hit (last one)'); return 0;
  }
  amt = Math.round(amt);
  if (tgt.st.vulnT > s.t && (kind === 'hit' || kind === 'abil')) amt += 1;
  if (tgt.st.shrinkT > s.t) amt *= 2;
  if (kind === 'abil' && tgt.m.block) amt -= tgt.m.block;
  amt = Math.max(1, amt);
  let absorbed = 0;
  if (tgt.st.shield > 0 && tgt.st.shieldT > s.t) { absorbed = Math.min(tgt.st.shield, amt); tgt.st.shield -= absorbed; }
  const dmg = amt - absorbed; const before = tgt.hp; tgt.hp = Math.max(0, tgt.hp - dmg); const dealt = before - tgt.hp;
  if (src) { s.stats[src.side].dmg += dealt + absorbed; src.dealt += dealt + absorbed; }
  pushEv(ev, { t: 'dmg', uid: tgt.uid, src: src ? src.uid : null, amt: dealt, absorbed, kind });
  if (tgt.hp > 0 && lowHp(tgt) && !tgt.pas.low) { // dropping below half health
    tgt.pas.low = true;
    if (tgt.pas.fort) { tgt.pas.fort = 0; tgt.st.shield = Math.max(tgt.st.shield, 4); tgt.st.shieldT = 999; pushEv(ev, { t: 'status', uid: tgt.uid, kind: 'shield' }); cap(ev, tgt, 'built a snow fort: 4 shield'); }
    if (tgt.ab === 'overdrive') { pushEv(ev, { t: 'status', uid: tgt.uid, kind: 'haste' }); cap(ev, tgt, 'now attacks twice as fast'); }
    if (tgt.ab === 'berserk') { pushEv(ev, { t: 'status', uid: tgt.uid, kind: 'rage' }); cap(ev, tgt, 'goes berserk: +1 damage'); }
  }
  if (tgt.hp <= 0) {
    if (s.revive[tgt.side] > 0 && !tgt.clone) {
      tgt.hp = Math.ceil(tgt.maxHp * s.revive[tgt.side]); s.revive[tgt.side] = 0; tgt.pas.low = lowHp(tgt);
      pushEv(ev, { t: 'status', uid: tgt.uid, kind: 'revive' });
    } else {
      tgt.alive = false; if (!tgt.clone) { s.stats[tgt.side].lost++; if (src && src.side !== tgt.side) { s.stats[src.side].kills++; src.kills++; } }
      pushEv(ev, { t: 'die', uid: tgt.uid });
      if (src && src.alive && src.ab === 'plunder' && src.side !== tgt.side) { src.bonus++; pushEv(ev, { t: 'status', uid: src.uid, kind: 'rage' }); cap(ev, src, `plundered: now ${dmgOf(src)} damage`); }
    }
  }
  return dealt + absorbed;
}

// a normal hit ('atk') does the hero's damage; abilities add their bonus
function hit(s, src, tgt, bonus, ev, kind) {
  if (!src || !tgt || !tgt.alive) return 0;
  const d = dmgOf(src) + (kind === 'atk' ? 0 : bonus + src.m.abil);
  const r = dealDamage(s, src, tgt, d, ev, kind === 'atk' ? 'hit' : 'abil');
  if (kind === 'atk') {
    if (src.ab === 'poison' && tgt.alive) applyDot(s, tgt, 'poison', 3, src);
    if (src.ab === 'lifedrain' && src.alive) heal(s, src, 1, ev);
  }
  return r;
}
// fixed-damage ability hit (e.g. "3 damage")
function zap(s, src, tgt, amt, ev) { return dealDamage(s, src, tgt, amt + (src ? src.m.abil : 0), ev, 'abil'); }
function applyDot(s, t, kind, dur, src) { t.st.dotT = s.t + dur + 0.01; t.st.dotNext = s.t + 1; t.st.dotKind = kind; t.st.dotSrc = src ? src.uid : null; }
function stun(s, t, dur, ev, kind) { t.st.stunT = Math.max(t.st.stunT, s.t + dur); t.st.stunKind = kind || 'stun'; if (kind === 'frog') t.st.frogT = s.t + dur; if (kind === 'float') t.st.floatT = s.t + dur; pushEv(ev, { t: 'status', uid: t.uid, kind: kind || 'stun' }); }
function later(s, delay, fn) { s.pending.push({ t: s.t + delay, fn }); }

// ----- movement -----
function bfsFrom(s, tx, ty, selfUid) {
  const D = new Array(BW * BH).fill(-1); const q = [tx + ty * BW]; D[q[0]] = 0;
  while (q.length) {
    const c = q.shift(); const cx = c % BW, cy = (c - cx) / BW;
    for (const [dx, dy] of dirsOf(s)) {
      const nx = cx + dx, ny = cy + dy; if (!inB(nx, ny) || isObs(s, nx, ny)) continue;
      const k = nx + ny * BW; if (D[k] >= 0) continue;
      const o = unitAt(s, nx, ny); if (o && o.uid !== selfUid) { D[k] = D[c] + 1; continue; } // can't pass through, but mark distance
      D[k] = D[c] + 1; q.push(k);
    }
  }
  return D;
}
function stepToward(s, u, tgt) {
  const D = bfsFrom(s, tgt.x, tgt.y, u.uid);
  const here = D[u.x + u.y * BW];
  let best = null, bv = here >= 0 ? here : 99, bd = reach(s, u.x, u.y, tgt.x, tgt.y);
  for (const [dx, dy] of dirsOf(s)) {
    const nx = u.x + dx, ny = u.y + dy; if (!free(s, nx, ny)) continue;
    const v = D[nx + ny * BW]; if (v < 0) continue;
    const cd = s.grid ? manh(nx, ny, tgt.x, tgt.y) : cheb(nx, ny, tgt.x, tgt.y);
    if (v < bv || (v === bv && cd < bd && here < 0)) { bv = v; bd = cd; best = [nx, ny, dx !== 0 && dy !== 0]; }
  }
  if (!best) return false;
  u.fx = u.x; u.fy = u.y; u.x = best[0]; u.y = best[1]; u.mt0 = s.t;
  if (s.grid) { const st = moveTime(s, u, false) * GRID_SLOW; u.mt1 = s.t + Math.min(GRID_HOP, st); u.moveCd = s.t + st; } // quick hop, then a pause on the tile
  else u.mt1 = s.t + moveTime(s, u, best[2]);
  return true;
}
// ----- tile movement (grid mode) -----
// walking distance from a unit to every tile; other units block the way
function walkMap(s, u) {
  const D = new Array(BW * BH).fill(-1), q = [u.x + u.y * BW]; D[q[0]] = 0;
  for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % BW, cy = (c - cx) / BW;
    for (const [dx, dy] of DIR4) { const nx = cx + dx, ny = cy + dy, k = nx + ny * BW; if (!inB(nx, ny) || D[k] >= 0 || !free(s, nx, ny)) continue; D[k] = D[c] + 1; q.push(k); } }
  return D;
}
// steps needed before u can hit e (stand on any open tile within range of it); 1e9 = no way there right now
function walkCost(s, u, e, D) {
  let c = 1e9; for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const d = D[x + y * BW]; if (d >= 0 && d < c) { const m = rdTo(x, y, e); if (m >= 1 && m <= u.rng) c = d; } }
  return c;
}
// closest enemy: anyone already in range first (keeps its current one), else the fewest steps away. Sticks to its target unless another is clearly closer.
function gridTarget(s, u) {
  const foes = s.units.filter(e => e.side !== u.side && targetable(s, e)); if (!foes.length) return null;
  const cur = u.tgt && foes.includes(u.tgt) ? u.tgt : null, by = (a, b, ka, kb) => ka - kb || a.hp - b.hp || (a.uid < b.uid ? -1 : 1);
  const dist = e => rdTo(u.x, u.y, e) * 10 + mhTo(u.x, u.y, e); // nearest by reach, then by steps
  const inR = foes.filter(e => rdTo(u.x, u.y, e) <= u.rng);
  if (inR.length) { const near = inR.sort((a, b) => by(a, b, dist(a), dist(b)))[0]; return cur && inR.includes(cur) && dist(cur) <= dist(near) ? cur : near; }
  const D = walkMap(s, u), cost = new Map(foes.map(e => [e, walkCost(s, u, e, D)]));
  const best = foes.slice().sort((a, b) => by(a, b, cost.get(a), cost.get(b)))[0];
  if (cur && cost.get(cur) < 1e9 && cost.get(cur) <= cost.get(best) + 1) return cur;
  if (cost.get(best) < 1e9) return best;
  return cur || foes.sort((a, b) => by(a, b, dist(a), dist(b)))[0]; // boxed in: wait facing the closest
}
// one step along the shortest open path to a tile within range of t. Never steps sideways without getting closer, so no back-and-forth.
function gridStep(s, u, t) {
  const D = new Array(BW * BH).fill(-1), q = [], open = (x, y) => (x === u.x && y === u.y) || free(s, x, y);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const m = rdTo(x, y, t); if (m >= 1 && m <= u.rng && open(x, y) && !isObs(s, x, y)) { D[x + y * BW] = 0; q.push(x + y * BW); } }
  for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % BW, cy = (c - cx) / BW;
    for (const [dx, dy] of DIR4) { const nx = cx + dx, ny = cy + dy, k = nx + ny * BW; if (!inB(nx, ny) || D[k] >= 0 || !open(nx, ny)) continue; D[k] = D[c] + 1; q.push(k); } }
  const here = D[u.x + u.y * BW]; if (here <= 0) return false;
  const fwd = u.side === 0 ? -1 : 1; let best = null, bk = null;
  for (const [dx, dy] of DIR4) {
    const nx = u.x + dx, ny = u.y + dy; if (!inB(nx, ny) || !free(s, nx, ny) || D[nx + ny * BW] !== here - 1) continue;
    const back = u.lastDir && u.lastDir[0] === -dx && u.lastDir[1] === -dy ? 1 : 0;
    const key = [mhTo(nx, ny, t), back, dy === fwd ? 0 : 1, dx];
    if (!bk || (key[0] - bk[0] || key[1] - bk[1] || key[2] - bk[2] || key[3] - bk[3]) < 0) { bk = key; best = [nx, ny, dx, dy]; }
  }
  if (!best) return false;
  u.fx = u.x; u.fy = u.y; u.x = best[0]; u.y = best[1]; u.mt0 = s.t; u.lastDir = [best[2], best[3]];
  const st = moveTime(s, u, false) * GRID_SLOW; u.mt1 = s.t + Math.min(GRID_HOP, st); u.moveCd = s.t + st;
  return true;
}
function placeAt(u, x, y, s, dur) { if (u.big) return; u.fx = u.x; u.fy = u.y; u.x = x; u.y = y; u.mt0 = s.t; u.mt1 = s.t + (dur || 0); }
// slide a unit to a tile (knockback / pulls); returns true if it moved
function shove(s, u, x, y, ev, dur) { if (!free(s, x, y)) return false; placeAt(u, x, y, s, dur || 0.25); pushEv(ev, { t: 'shove', uid: u.uid }); return true; }

function chooseTarget(s, u) {
  if (u.st.charmT > s.t) { // charmed: goes after its own friends
    let best = null, bd = 99;
    for (const e of s.units) if (e !== u && e.side === u.side && targetable(s, e)) { const d = cheb(u.x, u.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (best) return best;
  }
  if (u.st.tauntT > s.t) { const t = byUid(s, u.st.tauntUid); if (t && targetable(s, t)) return t; }
  if (s.grid) return gridTarget(s, u);
  // targeting style: back line / weakest / toughest (falls back to closest for a moment if the way is blocked)
  if (!s.grid && u.tg !== 'near' && !(u.tgFail > s.t)) {
    const fwd = u.side === 0 ? -1 : 1; let best = null, bv = -1e9;
    for (const e of s.units) {
      if (e.side === u.side || !targetable(s, e)) continue;
      const v = (u.tg === 'back' ? e.y * fwd * 100 : u.tg === 'weak' ? -e.hp * 100 : e.hp * 100) - cheb(u.x, u.y, e.x, e.y);
      if (v > bv || (v === bv && (e.hp < best.hp || (e.hp === best.hp && e.uid < best.uid)))) { bv = v; best = e; }
    }
    if (best) return best;
  }
  let best = null, bd = 99;
  for (const e of s.units) {
    if (e.side === u.side || !targetable(s, e)) continue;
    const d = s.grid ? rdist(u.x, u.y, e.x, e.y) * 10 + manh(u.x, u.y, e.x, e.y) : cheb(u.x, u.y, e.x, e.y);
    if (d < bd || (d === bd && (e.hp < best.hp || (e.hp === best.hp && e.uid < best.uid)))) { bd = d; best = e; }
  }
  return best;
}
const closestFoes = (s, u, n, from) => { from = from || u; return foesOf(s, u).filter(e => !(e.st.vanishT > s.t)).sort((a, b) => cheb(from.x, from.y, a.x, a.y) - cheb(from.x, from.y, b.x, b.y) || a.hp - b.hp || (a.uid < b.uid ? -1 : 1)).slice(0, n); };
const laneFoes = (s, u) => { const fwd = u.side === 0 ? -1 : 1; return foesOf(s, u).filter(e => e.x === u.x && (e.y - u.y) * fwd > 0).sort((a, b) => Math.abs(a.y - u.y) - Math.abs(b.y - u.y)); };
const mostHurt = (s, u, n) => friendsOf(s, u).filter(a => a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.hp - b.hp).slice(0, n || 1);
const around = (s, u, cx, cy, r) => foesOf(s, u).filter(e => { const p = near(e, cx, cy); return cheb(cx, cy, p[0], p[1]) <= r; });

// ----- round-start abilities (fire once, so placement matters) -----
function startAbility(s, u, ev) {
  const ab = u.ab, col = HERO[u.hid].color, fwd = u.side === 0 ? -1 : 1, me = HERO[u.hid];
  const cast = () => { pushEv(ev, { t: 'cast', uid: u.uid, ab, color: col }); s.stats[u.side].abil++; };
  const t0 = s.t + (s.open || 0); // durations count from the end of the opening
  switch (ab) {
    case 'laser': cast();
      pushEv(ev, { t: 'charge', uid: u.uid, color: col, dur: 0.6 }); u.holdT = 0.6;
      later(s, 0.6, ev2 => {
        if (!u.alive || stunned(s, u)) return;
        pushEv(ev2, { t: 'laser', uid: u.uid, x: u.x, y0: u.y, y1: fwd < 0 ? -1 : BH, color: col });
        const hitList = laneFoes(s, u); hitList.forEach(e => hit(s, u, e, 2, ev2, 'abil')); if (hitList.length >= 3) s.feats[u.side].laser3 = 1;
        cap(ev2, u, hitList.length ? `hit ${plural(hitList.length, 'enemy')} in the lane` : 'the lane was empty');
      }); return;
    case 'bomb': { cast(); const tx = u.x, ty = Math.max(0, Math.min(BH - 1, u.y + fwd * 3));
      pushEv(ev, { t: 'lob', uid: u.uid, x: tx, y: ty, color: '#2a2438', bomb: true, dur: 550 });
      later(s, 0.55, ev2 => {
        const tiles = []; for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (inB(x, y)) tiles.push({ x, y });
        pushEv(ev2, { t: 'blast', tiles, color: '#ff8a2a', boom: true });
        const hl = around(s, u, tx, ty, 1); hl.forEach(e => hit(s, u, e, 1, ev2, 'abil'));
        cap(ev2, u, hl.length ? `the bomb hit ${plural(hl.length, 'enemy')}` : 'the bomb missed');
      }); return; }
    case 'dash': case 'batform': {
      const pool = ab === 'dash' ? foesOf(s, u).sort((a, b) => cheb(u.x, u.y, b.x, b.y) - cheb(u.x, u.y, a.x, a.y) || (a.uid < b.uid ? -1 : 1))
        : foesOf(s, u).sort((a, b) => a.hp - b.hp || cheb(u.x, u.y, a.x, a.y) - cheb(u.x, u.y, b.x, b.y));
      const back = u.side === 0 ? -1 : 1;
      for (const f of pool) {
        let spot = null;
        for (const [dx, dy] of [[0, back], [1, back], [-1, back], [1, 0], [-1, 0], [0, -back], [1, -back], [-1, -back]]) if (free(s, f.x + dx, f.y + dy)) { spot = [f.x + dx, f.y + dy]; break; }
        if (!spot) continue;
        cast(); pushEv(ev, { t: 'leap', uid: u.uid, at: s.t, bat: ab === 'batform' }); placeAt(u, spot[0], spot[1], s, 0.45); u.tgt = f; u.retgt = t0 + 1; u.nextAtk = t0 + 0.2;
        if (ab === 'dash') later(s, 0.45, ev2 => { if (u.alive && f.alive) { pushEv(ev2, { t: 'lunge', uid: u.uid, tuid: f.uid }); hit(s, u, f, 1, ev2, 'abil'); cap(ev2, u, `struck ${HERO[f.hid].name} from behind`); } });
        else cap(ev, u, `flew to ${HERO[f.hid].name} (weakest enemy)`);
        return;
      }
      return; }
    case 'rally': { cast(); const fr = friendsOf(s, u).filter(a => a !== u && cheb(u.x, u.y, a.x, a.y) <= 1);
      fr.forEach(a => { a.st.shield = Math.max(a.st.shield, 2); a.st.shieldT = 999; pushEv(ev, { t: 'status', uid: a.uid, kind: 'shield' }); });
      cap(ev, u, fr.length ? `shielded ${plural(fr.length, 'friend')}` : 'nobody was next to him'); return; }
    case 'cannon': { cast(); const e = laneFoes(s, u)[0];
      pushEv(ev, { t: 'atk', uid: u.uid, tuid: e ? e.uid : null, x1: u.x, y1: fwd < 0 ? 0 : BH - 1, ranged: true, look: 'cannon', color: '#2a2438', d: 0.3 });
      later(s, 0.3, ev2 => { if (e && e.alive) { zap(s, u, e, 3, ev2); cap(ev2, u, `blasted ${HERO[e.hid].name} for 3`); } else cap(ev2, u, 'the lane was empty'); }); return; }
    case 'hook': { const e = laneFoes(s, u).slice(-1)[0]; cast();
      if (!e) { cap(ev, u, 'nobody in her lane'); return; }
      const dest = free(s, u.x, u.y + fwd) ? [u.x, u.y + fwd] : nearestFree(s, u.x, u.y + fwd);
      pushEv(ev, { t: 'hook', uid: u.uid, tuid: e.uid, color: '#c9a46a' });
      if (dest && cheb(dest[0], dest[1], e.x, e.y) > 0) { placeAt(e, dest[0], dest[1], s, 0.35); stun(s, e, 0.35, null); }
      cap(ev, u, `hooked ${HERO[e.hid].name} over`); return; }
    case 'curse': { const e = closestFoes(s, u, 1)[0]; if (!e) return; cast(); e.st.vulnT = t0 + 5; pushEv(ev, { t: 'status', uid: e.uid, kind: 'curse' }); cap(ev, u, `cursed ${HERO[e.hid].name}: +1 from every hit`); return; }
    case 'missiles': { const list = closestFoes(s, u, 3); if (!list.length) return; cast();
      list.forEach((e, i) => { pushEv(ev, { t: 'atk', uid: u.uid, tuid: e.uid, ranged: true, look: 'missile', color: '#ff8a2a', d: 0.45 + i * 0.12 }); later(s, 0.45 + i * 0.12, ev2 => { if (e.alive) zap(s, u, e, 2, ev2); }); });
      cap(ev, u, `fired at ${plural(list.length, 'enemy')}`); return; }
    case 'slowtime': { cast(); const fs = foesOf(s, u); fs.forEach(e => { e.st.slowT = t0 + 4; pushEv(ev, { t: 'status', uid: e.uid, kind: 'slow' }); }); pushEv(ev, { t: 'screen', kind: 'slowtime' }); cap(ev, u, `slowed all ${plural(fs.length, 'enemy')}`); return; }
    case 'mine': { const my = u.y + fwd * 2; if (!inB(u.x, my) || isObs(s, u.x, my)) return; cast(); s.mines.push({ x: u.x, y: my, side: u.side, owner: u.uid }); pushEv(ev, { t: 'mine', x: u.x, y: my, side: u.side }); cap(ev, u, 'planted a mine'); return; }
    case 'drone': cast(); s.drones.push({ side: u.side, owner: u.uid, next: t0 + 2 }); pushEv(ev, { t: 'drone', uid: u.uid }); cap(ev, u, 'launched a healing drone'); return;
    case 'quickdraw': { const e = closestFoes(s, u, 1)[0]; if (!e) return; cast();
      pushEv(ev, { t: 'atk', uid: u.uid, tuid: e.uid, ranged: true, look: 'bullet', color: '#ffd23f', d: 0.08 }); later(s, 0.08, ev2 => { if (e.alive) { zap(s, u, e, 3, ev2); cap(ev2, u, `shot ${HERO[e.hid].name} for 3`); } }); return; }
    case 'feast': { cast(); const fr = friendsOf(s, u); fr.forEach(a => { a.maxHp += 2; a.hp += 2; pushEv(ev, { t: 'heal', uid: a.uid, amt: 2 }); }); cap(ev, u, `gave ${plural(fr.length, 'friend')} +2 health`); return; }
    case 'avalanche': { cast(); pushEv(ev, { t: 'lanefx', uid: u.uid, x: u.x, y0: u.y, y1: fwd < 0 ? -1 : BH, color: '#e8f6ff', kind: 'snow' });
      later(s, 0.35, ev2 => { const hl = laneFoes(s, u); hl.forEach(e => { zap(s, u, e, 1, ev2); e.st.slowT = t0 + 4; pushEv(ev2, { t: 'status', uid: e.uid, kind: 'slow' }); }); cap(ev2, u, hl.length ? `slowed ${plural(hl.length, 'enemy')}` : 'the lane was empty'); }); return; }
    case 'nitro': cast(); u.st.hasteT = t0 + 4; u.st.fastT = t0 + 4; pushEv(ev, { t: 'status', uid: u.uid, kind: 'haste' }); cap(ev, u, 'is twice as fast for 4s'); return;
    case 'cauldron': case 'firewall': {
      const cy = u.y + fwd * 2; if (!inB(u.x, cy)) return; cast();
      const tiles = []; if (ab === 'cauldron') { for (let y = cy - 1; y <= cy + 1; y++) for (let x = u.x - 1; x <= u.x + 1; x++) if (inB(x, y)) tiles.push(y * BW + x); }
      else for (let x = u.x - 1; x <= u.x + 1; x++) if (inB(x, cy)) tiles.push(cy * BW + x);
      s.zones.push({ kind: ab === 'cauldron' ? 'brew' : 'fire', side: u.side, owner: u.uid, tiles, cx: u.x, cy, until: t0 + (ab === 'cauldron' ? 4 : 6), next: s.t + 0.5 });
      pushEv(ev, { t: 'zone', kind: ab === 'cauldron' ? 'brew' : 'fire', tiles, cx: u.x, cy, dur: ab === 'cauldron' ? 4 : 6 });
      cap(ev, u, ab === 'cauldron' ? 'dropped a bubbling cauldron' : 'set 3 tiles on fire'); return; }
    case 'meteor': { const e = foesOf(s, u).sort((a, b) => b.hp - a.hp || (a.uid < b.uid ? -1 : 1))[0]; if (!e) return; cast();
      pushEv(ev, { t: 'meteor', tuid: e.uid, dur: 0.7 }); later(s, 0.7, ev2 => { if (e.alive) { pushEv(ev2, { t: 'blast', tiles: [{ x: e.x, y: e.y }], color: '#ff8a2a', boom: true }); zap(s, u, e, 3, ev2); cap(ev2, u, `crushed ${HERO[e.hid].name} for 3`); } }); return; }
    case 'warcry': { cast(); const fr = friendsOf(s, u).filter(a => a !== u && cheb(u.x, u.y, a.x, a.y) <= 1); fr.forEach(a => { a.bonus++; pushEv(ev, { t: 'status', uid: a.uid, kind: 'rage' }); }); cap(ev, u, fr.length ? `${plural(fr.length, 'friend')} got +1 damage` : 'nobody heard it'); return; }
    case 'clone': { const sp = [[1, 0], [-1, 0], [0, -fwd], [0, fwd], [1, -fwd], [-1, -fwd]].map(([dx, dy]) => [u.x + dx, u.y + dy]).find(([x, y]) => free(s, x, y)); if (!sp) return; cast();
      const c = makeUnit(s, u.uid + 'c', u.hid, u.side, null, sp[0], sp[1], { hp: 2, atk: 1, clone: true, i: 3 }); c.fx = u.x; c.fy = u.y; c.mt0 = 0; c.mt1 = 0.3; s.units.push(c);
      pushEv(ev, { t: 'spawn', uid: c.uid }); cap(ev, u, 'made a copy of himself'); return; }
    case 'abduct': { const e = closestFoes(s, u, 3).find(x => !x.big); if (!e) return; cast(); pushEv(ev, { t: 'abduct', uid: e.uid }); e.st.goneT = t0 + 4; s.units.forEach(o => { if (o.tgt === e) o.retgt = 0; }); cap(ev, u, `abducted ${HERO[e.hid].name} for 4s`); return; }
  }
}

// ----- charge abilities: return true if cast -----
function castAbility(s, u, ev) {
  const ab = u.ab; const t = u.tgt && targetable(s, u.tgt) && u.tgt.side !== u.side ? u.tgt : null;
  const d = t ? (s.grid ? rdTo(u.x, u.y, t) : reach(s, u.x, u.y, t.x, t.y)) : 99;
  const cast = () => { pushEv(ev, { t: 'cast', uid: u.uid, ab, color: HERO[u.hid].color }); s.stats[u.side].abil++; };
  const shot = (tg, look, color, dl) => pushEv(ev, { t: 'atk', uid: u.uid, tuid: tg.uid, ranged: true, look, color, d: dl || 0.15 });
  const nm = e => HERO[e.hid].name;
  switch (ab) {
    case 'bash': { if (d > 1) return false; cast(); pushEv(ev, { t: 'lunge', uid: u.uid, tuid: t.uid }); hit(s, u, t, 1, ev, 'abil');
      const moved = t.alive && shove(s, t, t.x + Math.sign(t.x - u.x), t.y + Math.sign(t.y - u.y), ev); cap(ev, u, moved ? `bashed ${nm(t)} back` : `bashed ${nm(t)}`); return true; }
    case 'taunt': { const list = foesOf(s, u).filter(e => !(e.st.charmT > s.t)); if (!list.length || !foesOf(s, u).some(e => cheb(u.x, u.y, e.x, e.y) <= 3)) return false; cast();
      pushEv(ev, { t: 'taunt', uid: u.uid, tuids: list.map(e => e.uid) });
      list.forEach(e => { e.st.tauntUid = u.uid; e.st.tauntT = s.t + 3; e.tgt = u; e.retgt = s.t + 3; pushEv(ev, { t: 'status', uid: e.uid, kind: 'taunt' }); });
      if (list.length >= 4) s.feats[u.side].tauntAll = 1;
      cap(ev, u, list.length > 1 ? `all ${list.length} enemies have to attack him` : 'the last enemy has to attack him'); return true; }
    case 'boulder': { const e = t && d <= 2 ? t : closestFoes(s, u, 1).find(x => cheb(u.x, u.y, x.x, x.y) <= 2); if (!e) return false; cast();
      pushEv(ev, { t: 'atk', uid: u.uid, tuid: e.uid, ranged: true, look: 'boulder', color: '#9a8f86', d: 0.3 }); later(s, 0.3, ev2 => { if (e.alive) { hit(s, u, e, 2, ev2, 'abil'); cap(ev2, u, `hit ${nm(e)} with a boulder`); } }); return true; }
    case 'quake': { const list = around(s, u, u.x, u.y, 1); if (!list.length) return false; cast(); pushEv(ev, { t: 'quake', uid: u.uid });
      list.forEach(e => stun(s, e, 2, ev)); cap(ev, u, `stunned ${plural(list.length, 'enemy')}`); return true; }
    case 'wrap': case 'freeze': { if (d > Math.max(2, u.rng)) return false; cast(); shot(t, ab === 'wrap' ? 'whip' : 'ice', ab === 'wrap' ? '#ece0c4' : '#bfe8ff', 0.1);
      stun(s, t, 2, ev, ab === 'wrap' ? 'wrap' : 'freeze'); cap(ev, u, `${ab === 'wrap' ? 'wrapped' : 'froze'} ${nm(t)} for 2s`); return true; }
    case 'sandstorm': { const list = around(s, u, u.x, u.y, 2); if (!list.length) return false; cast(); pushEv(ev, { t: 'ringfx', uid: u.uid, r: 2, color: '#e0c98a' });
      list.forEach(e => { zap(s, u, e, 1, ev); e.st.slowT = s.t + 3; pushEv(ev, { t: 'status', uid: e.uid, kind: 'slow' }); }); cap(ev, u, `slowed ${plural(list.length, 'enemy')}`); return true; }
    case 'chomp3': { if (d > 1) return false; cast(); for (let i = 0; i < 3; i++) later(s, i * 0.18, ev2 => { if (u.alive && t.alive) { pushEv(ev2, { t: 'atk', uid: u.uid, tuid: t.uid, look: 'chomp', color: '#ffffff', d: 0.05 }); hit(s, u, t, 0, ev2, 'abil'); } });
      cap(ev, u, `chomped ${nm(t)} 3 times`); return true; }
    case 'mend': { const fr = friendsOf(s, u); if (!fr.some(a => a.hp < a.maxHp)) return false; cast(); pushEv(ev, { t: 'ringfx', uid: u.uid, r: 9, color: '#5fd068' }); fr.forEach(a => heal(s, a, 1, ev)); cap(ev, u, 'healed every friend for 1'); return true; }
    case 'haste': { if (!foesOf(s, u).some(e => cheb(u.x, u.y, e.x, e.y) <= 3)) return false; cast(); const fr = friendsOf(s, u).filter(a => cheb(u.x, u.y, a.x, a.y) <= 2);
      fr.forEach(a => { a.st.hasteT = s.t + 3; pushEv(ev, { t: 'status', uid: a.uid, kind: 'haste' }); }); cap(ev, u, `sped up ${plural(fr.length, 'friend')}`); return true; }
    case 'overclock': { if (!t || d > u.rng) return false; cast(); u.st.hasteT = s.t + 3; pushEv(ev, { t: 'status', uid: u.uid, kind: 'haste' }); cap(ev, u, 'fires twice as fast for 3s'); return true; }
    case 'heal': { const h = mostHurt(s, u, 1).find(a => a.maxHp - a.hp >= 2); if (!h) return false; cast(); pushEv(ev, { t: 'beam', uid: u.uid, tuid: h.uid, color: '#5fd068' }); heal(s, h, 3 + u.m.abil, ev); cap(ev, u, `healed ${nm(h)}`); return true; }
    case 'bubble': { const h = mostHurt(s, u, 1).find(a => !(a.st.shield > 0 && a.st.shieldT > s.t)); if (!h || !foesOf(s, u).length) return false; cast(); pushEv(ev, { t: 'beam', uid: u.uid, tuid: h.uid, color: '#4ff0ff' });
      h.st.shield = 3 + u.m.abil; h.st.shieldT = s.t + 6; pushEv(ev, { t: 'status', uid: h.uid, kind: 'shield' }); cap(ev, u, `bubbled ${nm(h)} (3 shield)`); return true; }
    case 'scrap': case 'fireball': case 'pepper': { if (!t || d > Math.max(3, u.rng)) return false; cast();
      const look = ab === 'fireball' ? 'fireball' : ab === 'pepper' ? 'lob' : 'scrap', col = ab === 'pepper' ? '#ff4f2a' : ab === 'fireball' ? '#ff8a2a' : '#8a8a9a';
      shot(t, look, col, 0.25); const tx = t.x, ty = t.y;
      later(s, 0.25, ev2 => { const tiles = []; for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (inB(x, y)) tiles.push({ x, y });
        pushEv(ev2, { t: 'blast', tiles, color: col }); const hl = around(s, u, tx, ty, 1);
        if (ab === 'pepper') { hl.forEach(e => { applyDot(s, e, 'burn', 3, u); pushEv(ev2, { t: 'status', uid: e.uid, kind: 'burn' }); }); cap(ev2, u, `set ${plural(hl.length, 'enemy')} burning`); }
        else { hl.forEach(e => hit(s, u, e, 1, ev2, 'abil')); cap(ev2, u, `hit ${plural(hl.length, 'enemy')}`); } });
      return true; }
    case 'backstab': { if (!t || d > 3) return false; const bx = t.x + Math.sign(t.x - u.x), by = t.y + Math.sign(t.y - u.y);
      let spot = free(s, bx, by) ? [bx, by] : null; if (!spot) for (const [dx, dy] of DIR8) if (free(s, t.x + dx, t.y + dy)) { spot = [t.x + dx, t.y + dy]; break; }
      if (!spot) return false; cast(); pushEv(ev, { t: 'leap', uid: u.uid, at: s.t }); placeAt(u, spot[0], spot[1], s, 0.3);
      later(s, 0.3, ev2 => { if (u.alive && t.alive) { pushEv(ev2, { t: 'lunge', uid: u.uid, tuid: t.uid }); hit(s, u, t, 2, ev2, 'abil'); cap(ev2, u, `backstabbed ${nm(t)}`); } }); return true; }
    case 'lasso': { if (!t || d > 3) return false; cast(); pushEv(ev, { t: 'hook', uid: u.uid, tuid: t.uid, color: '#c9a46a' });
      const px = t.x - Math.sign(t.x - u.x), py = t.y - Math.sign(t.y - u.y); if (d >= 2) shove(s, t, px, py, ev, 0.25); stun(s, t, 1, ev); cap(ev, u, `lassoed ${nm(t)}`); return true; }
    case 'snack': { const list = mostHurt(s, u, 2); if (!list.length) return false; cast(); list.forEach(h => { pushEv(ev, { t: 'atk', uid: u.uid, tuid: h.uid, ranged: true, look: 'lob', color: '#fff3d6', d: 0.2 }); later(s, 0.2, ev2 => heal(s, h, 2 + u.m.abil, ev2)); });
      cap(ev, u, `fed ${list.map(nm).join(' and ')}`); return true; }
    case 'shuriken': { const list = closestFoes(s, u, 3); if (!list.length) return false; cast(); list.forEach(e => { shot(e, 'star', '#e8eef5', 0.15); later(s, 0.15, ev2 => { if (e.alive) zap(s, u, e, 1, ev2); }); }); cap(ev, u, `threw stars at ${plural(list.length, 'enemy')}`); return true; }
    case 'smoke': { if (!foesOf(s, u).some(e => e.tgt === u)) return false; cast(); u.st.vanishT = s.t + 2; pushEv(ev, { t: 'smoke', uid: u.uid });
      s.units.forEach(o => { if (o.tgt === u) o.retgt = 0; }); cap(ev, u, 'vanished in smoke'); return true; }
    case 'turbo': { if (d > 1) return false; cast(); pushEv(ev, { t: 'lunge', uid: u.uid, tuid: t.uid }); hit(s, u, t, 2, ev, 'abil'); cap(ev, u, `turbo-punched ${nm(t)}`); return true; }
    case 'chain': { if (!t || d > Math.max(2, u.rng)) return false; cast(); const extra = foesOf(s, u).filter(e => e !== t && cheb(t.x, t.y, e.x, e.y) <= 2).sort((a, b) => cheb(t.x, t.y, a.x, a.y) - cheb(t.x, t.y, b.x, b.y)).slice(0, 2);
      pushEv(ev, { t: 'chain', uids: [u.uid, t.uid].concat(extra.map(e => e.uid)) }); hit(s, u, t, 1, ev, 'abil'); extra.forEach(e => zap(s, u, e, 1, ev)); cap(ev, u, `zapped ${plural(1 + extra.length, 'enemy')}`); return true; }
    case 'frog': { if (!t || d > Math.max(2, u.rng)) return false; cast(); shot(t, 'hex', '#7dff6b', 0.15); stun(s, t, 2, ev, 'frog'); cap(ev, u, `turned ${nm(t)} into a frog`); return true; }
    case 'drain': { if (!t || d > u.rng) return false; cast(); shot(t, 'hex', '#ff3b5c', 0.15); hit(s, u, t, 1, ev, 'abil'); const h = mostHurt(s, u, 1)[0]; if (h) { pushEv(ev, { t: 'beam', uid: t.uid, tuid: h.uid, color: '#ff3b5c' }); heal(s, h, 2 + u.m.abil, ev); }
      cap(ev, u, h ? `drained ${nm(t)} to heal ${nm(h)}` : `drained ${nm(t)}`); return true; }
    case 'zerog': { if (!t || d > Math.max(2, u.rng)) return false; cast(); const list = around(s, u, t.x, t.y, 1); list.forEach(e => stun(s, e, 2, ev, 'float')); cap(ev, u, `floated ${plural(list.length, 'enemy')}`); return true; }
    case 'blackhole': { if (!t || d > Math.max(2, u.rng)) return false; cast(); const list = around(s, u, t.x, t.y, 2); pushEv(ev, { t: 'hole', x: t.x, y: t.y });
      list.filter(e => e !== t).sort((a, b) => cheb(t.x, t.y, a.x, a.y) - cheb(t.x, t.y, b.x, b.y)).forEach(e => { if (cheb(t.x, t.y, e.x, e.y) > 1) shove(s, e, e.x - Math.sign(e.x - t.x), e.y - Math.sign(e.y - t.y), ev, 0.3); });
      list.forEach(e => zap(s, u, e, 1, ev)); cap(ev, u, `pulled in ${plural(list.length, 'enemy')}`); return true; }
    case 'whirl': { const list = around(s, u, u.x, u.y, 1); if (!list.length) return false; cast(); pushEv(ev, { t: 'spin', uid: u.uid }); list.forEach(e => hit(s, u, e, 1, ev, 'abil')); cap(ev, u, `spun into ${plural(list.length, 'enemy')}`); return true; }
    case 'charm': { if (!t || d > 2 || t.big) return false; if (!friendsOf(s, t).some(f => f !== t)) return false; cast(); shot(t, 'orb', '#ff8ac8', 0.15); t.st.charmT = s.t + 3; t.tgt = null; t.retgt = 0; pushEv(ev, { t: 'status', uid: t.uid, kind: 'charm' }); cap(ev, u, `charmed ${nm(t)}`); return true; }
    case 'shrink': { if (!t || d > u.rng) return false; cast(); shot(t, 'zap', '#c07bff', 0.1); t.st.shrinkT = s.t + 3; pushEv(ev, { t: 'status', uid: t.uid, kind: 'shrink' }); cap(ev, u, `shrank ${nm(t)}: double damage`); return true; }
    case 'flamering': { const list = around(s, u, u.x, u.y, 2); if (!list.length) return false; cast(); pushEv(ev, { t: 'ringfx', uid: u.uid, r: 2, color: '#ff8a2a' }); list.forEach(e => zap(s, u, e, 1, ev)); cap(ev, u, `burned ${plural(list.length, 'enemy')}`); return true; }
  }
  return false;
}

// ----- simulation step -----
const OPENING = 1.0; // seconds of stand-still at round start when anyone has a round-start ability
function step(s, ev) {
  if (s.winner != null) return;
  if (!s.started) {
    s.started = true;
    // opening: round-start abilities go off while every hero stands still, so a good guess about enemy spots pays off
    const openers = s.units.filter(u => u.alive && u.ab && ABILITIES[u.ab].kind === 'start' && !stunned(s, u));
    s.open = openers.length ? OPENING : 0; s.timeLimit += s.open;
    for (const u of openers) startAbility(s, u, ev);
    if (s.open) pushEv(ev, { t: 'opening', dur: s.open });
  }
  s.t = +(s.t + DT).toFixed(3);
  if (s.pending.length) { const due = s.pending.filter(p => p.t <= s.t + 1e-9); s.pending = s.pending.filter(p => p.t > s.t + 1e-9); for (const p of due) p.fn(ev); }
  const tick = Math.floor(s.t / 1.5 + 1e-9) !== Math.floor((s.t - DT) / 1.5 + 1e-9);
  // zones (fire / cauldron), mines, drones
  for (const z of s.zones) if (s.t < z.until && s.t >= z.next - 1e-9) {
    z.next += 1; const owner = byUid(s, z.owner);
    for (const e of s.units) if (e.side !== z.side && present(s, e) && z.tiles.includes(e.y * BW + e.x)) dealDamage(s, owner, e, 1, ev, 'burn');
  }
  s.zones = s.zones.filter(z => s.t < z.until);
  for (const mn of s.mines.slice()) {
    const e = s.units.find(o => o.side !== mn.side && present(s, o) && o.x === mn.x && o.y === mn.y); if (!e) continue;
    s.mines.splice(s.mines.indexOf(mn), 1); const owner = byUid(s, mn.owner);
    pushEv(ev, { t: 'blast', tiles: [{ x: mn.x, y: mn.y }], color: '#4ff0ff', boom: true, mine: true }); zap(s, owner, e, 2, ev); if (e.alive) stun(s, e, 2, ev, 'shock');
    if (owner) cap(ev, owner, `mine shocked ${HERO[e.hid].name}`);
  }
  for (const dr of s.drones) if (s.t >= dr.next - 1e-9) {
    dr.next += 2; const o = byUid(s, dr.owner); if (!o || !o.alive) continue;
    const h = mostHurt(s, o, 1)[0]; if (h) { pushEv(ev, { t: 'beam', uid: o.uid, tuid: h.uid, color: '#5fd068', drone: true }); heal(s, h, 1, ev); }
  }
  for (const u of s.units) {
    if (!u.alive || s.winner != null) continue;
    if (u.st.goneT && u.st.goneT <= s.t + 1e-9) { // back from the abduction
      u.st.goneT = 0; if (!free(s, u.x, u.y)) { const p = nearestFree(s, u.x, u.y, u.side); if (p) { u.x = p[0]; u.y = p[1]; } }
      u.fx = u.x; u.fy = u.y; pushEv(ev, { t: 'return', uid: u.uid });
    }
    if (u.st.goneT > s.t || s.t < s.open) continue;
    if (tick) {
      const tile = tileAt(s, u.x, u.y);
      if (tile === 'lava') dealDamage(s, null, u, 1, ev, 'burn');
      if (!u.alive) continue;
      if (tile === 'spring') heal(s, u, 1, ev);
    }
    if (u.st.dotT > s.t && s.t >= u.st.dotNext - 1e-9) { u.st.dotNext += 1; dealDamage(s, byUid(s, u.st.dotSrc), u, 1, ev, u.st.dotKind); if (!u.alive) continue; }
    if (stunned(s, u) || u.mt1 > s.t || u.holdT > s.t) continue;
    const bad = !u.tgt || !targetable(s, u.tgt) || (u.tgt.side === u.side && !(u.st.charmT > s.t)) || (u.tgt.side !== u.side && u.st.charmT > s.t);
    if (bad || s.t >= u.retgt || (u.st.tauntT > s.t && u.tgt && u.tgt.uid !== u.st.tauntUid)) { u.tgt = chooseTarget(s, u); u.retgt = s.t + 1; }
    if (u.ab && ABILITIES[u.ab].kind === 'charge' && !(u.st.charmT > s.t)) {
      u.charge += DT * u.m.abilHaste;
      if (u.charge >= u.cd) { if (castAbility(s, u, ev)) { u.charge = 0; if (u.mt1 > s.t || !u.alive) continue; } else u.charge = u.cd; }
    }
    if (u.boss) { bossTick(s, u, ev); if (!u.alive || s.winner != null) continue; }
    const t = u.tgt; if (!t || !targetable(s, t)) continue;
    if ((s.grid ? Math.min(...(u.big ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]).map(([a, b]) => rdTo(u.x + a, u.y + b, t))) : reach(s, u.x, u.y, t.x, t.y)) <= u.rng) {
      if (s.t >= u.nextAtk) {
        u.nextAtk = s.t + interval(s, u);
        const L = LOOKS[HERO[u.hid].look] || LOOKS.slash;
        pushEv(ev, { t: 'atk', uid: u.uid, tuid: t.uid, ranged: u.rng > 1, look: HERO[u.hid].look, color: HERO[u.hid].lc, d: L.d });
        if (u.rng > 1) later(s, L.d, ev2 => hit(s, u, t, 0, ev2, 'atk'));
        else later(s, L.d, ev2 => { if (u.alive && !stunned(s, u)) hit(s, u, t, 0, ev2, 'atk'); });
      }
    } else if (u.big) {
      // bosses never move
    } else if (s.grid) {
      // tile movement: rest on the tile between steps; if boxed in, wait and look again shortly
      if (u.moveCd <= s.t && !gridStep(s, u, t)) u.retgt = Math.min(u.retgt, s.t + 0.3);
    } else if (!stepToward(s, u, t)) {
      u.retgt = Math.min(u.retgt, s.t + 0.3);
      if (u.tg !== 'near' && !(u.st.tauntT > s.t)) u.tgFail = s.t + 1.5;
      // grid mode: the way is blocked, so walk toward the next-closest enemy you can actually reach
      if (s.grid && !(u.st.tauntT > s.t)) for (const e of s.units.filter(o => o.side !== u.side && o !== t && targetable(s, o)).sort((a, b) => manh(u.x, u.y, a.x, a.y) - manh(u.x, u.y, b.x, b.y))) if (stepToward(s, u, e)) { u.tgt = e; u.retgt = s.t + 1; break; }
    }
  }
  // end conditions (clones don't keep a side alive on their own)
  const bossDown = side => s.units.some(u => u.boss && u.side === side && !u.alive);
  const a0 = s.units.some(u => u.alive && u.side === 0 && !u.clone) && !bossDown(0), a1 = s.units.some(u => u.alive && u.side === 1 && !u.clone) && !bossDown(1);
  if (!a0 || !a1) { s.winner = a0 ? 0 : a1 ? 1 : 'draw'; s.winBy = 'wipe'; return; }
  if (s.t >= s.timeLimit) {
    const f = side => s.units.filter(u => u.alive && u.side === side && !u.clone).reduce((a, u) => a + u.hp / u.maxHp, 0);
    const f0 = f(0), f1 = f(1); s.winBy = 'time';
    s.winner = Math.abs(f0 - f1) < 0.05 ? 'draw' : f0 > f1 ? 0 : 1;
  }
}

// ----- bosses -----
// slam: mark the 3x3 area that catches the most enemies, then hit everyone still in it
function bossTick(s, u, ev) {
  const B = HERO[u.hid].slam; if (!B) return;
  if (u.slamAt) {
    if (s.t < u.slamAt.t - 1e-9) return;
    const c = u.slamAt, tiles = []; u.slamAt = null; u.slamNext = s.t + B.every;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(c.x + dx, c.y + dy)) tiles.push({ x: c.x + dx, y: c.y + dy });
    pushEv(ev, { t: 'blast', tiles, color: '#ff4f6b', boom: true, slam: true });
    let n = 0; for (const e of s.units.slice()) if (e.side !== u.side && present(s, e) && tiles.some(p => p.x === e.x && p.y === e.y)) { dealDamage(s, u, e, B.dmg, ev, 'slam'); n++; }
    cap(ev, u, n ? `slammed ${plural(n, 'enemy')}` : 'slammed the ground');
    return;
  }
  if (s.t < (u.slamNext != null ? u.slamNext : 2.5)) return;
  let best = null, bn = 0;
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const n = s.units.filter(e => e.side !== u.side && present(s, e) && Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1).length;
    if (n > bn) { bn = n; best = { x, y }; }
  }
  if (!best) { u.slamNext = s.t + 1; return; }
  u.slamAt = { x: best.x, y: best.y, t: s.t + B.wind };
  const idx = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(best.x + dx, best.y + dy)) idx.push((best.y + dy) * BW + best.x + dx);
  pushEv(ev, { t: 'tele', uid: u.uid, tiles: idx, dur: B.wind });
}

function simulateRound(opts) {
  const s = newRound(opts); let guard = 0;
  while (s.winner == null && guard++ < 5000) step(s, null);
  return s;
}

// ----- formations -----
// lineup = { units: [{hid,ab,x,y}], captain }
function roleFormation(squad, side, rnd, shuffle, obs) {
  const used = new Set(); const out = [];
  const cols = [2, 1, 3, 0, 4];
  const okSpot = (x, y) => !used.has(x + ',' + y) && !(obs && obs[y * BW + x]);
  const list = shuffle ? squad.slice().sort(() => rnd() - 0.5) : squad.slice().sort((a, b) => ROLE_DEPTH[HERO[a.hid].role] - ROLE_DEPTH[HERO[b.hid].role]);
  for (const h of list) {
    let depth = ROLE_DEPTH[HERO[h.hid].role]; if (shuffle && rnd() < 0.35) depth = Math.max(0, Math.min(HALF - 1, depth + (rnd() < 0.5 ? -1 : 1)));
    // prefer columns nobody is using yet, so the squad spreads out
    const colUse = c => out.filter(o => o.x === c).length;
    const cl = (shuffle ? cols.slice().sort(() => rnd() - 0.5) : cols.slice()).sort((a, b) => colUse(a) - colUse(b)); let placed = false;
    for (let dd = 0; dd < HALF && !placed; dd++) for (const dep of [depth + dd, depth - dd]) {
      if (placed || dep < 0 || dep > HALF - 1) continue; const y = rowAt(side, dep);
      for (const x of cl) if (okSpot(x, y)) { used.add(x + ',' + y); out.push({ hid: h.hid, ab: h.ab, x, y }); placed = true; break; }
    }
  }
  return out;
}
function randomFormation(squad, side, rnd, obs) {
  const spots = []; for (const y of deployRows(side)) for (let x = 0; x < BW; x++) if (!(obs && obs[y * BW + x])) spots.push([x, y]);
  spots.sort(() => rnd() - 0.5);
  return squad.map((h, i) => ({ hid: h.hid, ab: h.ab, x: spots[i][0], y: spots[i][1] }));
}
// everyone in one or two rows at a random depth
function lineFormation(squad, side, rnd, obs) {
  const d = Math.floor(rnd() * (HALF - 1)); const spots = [];
  for (const dep of [d, d + 1]) { const y = rowAt(side, dep); for (let x = 0; x < BW; x++) if (!(obs && obs[y * BW + x])) spots.push([x, y]); }
  const list = squad.slice().sort((a, b) => ROLE_DEPTH[HERO[a.hid].role] - ROLE_DEPTH[HERO[b.hid].role] || rnd() - 0.5);
  const firstRow = spots.filter(p => p[1] === rowAt(side, d)).sort(() => rnd() - 0.5), second = spots.filter(p => p[1] !== rowAt(side, d)).sort(() => rnd() - 0.5);
  const order = firstRow.concat(second);
  return list.map((h, i) => ({ hid: h.hid, ab: h.ab, x: order[i][0], y: order[i][1] }));
}
// Guess the opponent's next lineup: heroes keep their last spots, new arrivals go to role spots
function estimateLineup(board, prev, side, captain, obs) {
  const units = []; const used = new Set();
  for (const h of board) { const p = prev && prev.units.find(u => u.hid === h.hid); if (p && !used.has(p.x + ',' + p.y)) { used.add(p.x + ',' + p.y); units.push({ hid: h.hid, ab: h.ab, x: p.x, y: p.y }); } }
  const rest = board.filter(h => !units.some(u => u.hid === h.hid));
  if (rest.length) { const rf = roleFormation(rest, side, mulberry32(5), false, obs.map((o, i) => o || used.has((i % BW) + ',' + Math.floor(i / BW)) ? 1 : 0)); units.push(...rf); }
  return { units, captain };
}
function mirrorLineup(lineup) { return { captain: lineup.captain, units: lineup.units.map(u => ({ hid: u.hid, ab: u.ab, x: u.x, y: BH - 1 - u.y })) }; }
function bestCaptain(squad) {
  const caps = squad.filter(h => HERO[h.hid].captain); const pool = caps.length ? caps : squad;
  return pool.slice().sort((a, b) => (b.ab ? 1 : 0) - (a.ab ? 1 : 0) || RARITIES[HERO[b.hid].rarity].order - RARITIES[HERO[a.hid].rarity].order)[0].hid;
}

const AI_CFG = {
  easy:   { mode: 'sloppy', tries: 0 },
  normal: { mode: 'search', tries: 3, captains: false },
  hard:   { mode: 'search', tries: 8, captains: false },
  expert: { mode: 'search', tries: 18, captains: true },
};
function sloppyFormation(squad, side, rnd, obs) {
  // Easy AI: random spots, or ranged heroes up front and bruisers in the back
  if (rnd() < 0.5) return randomFormation(squad, side, rnd, obs);
  const inv = squad.map(h => ({ ...h })); const f = roleFormation(inv, side, rnd, true, obs);
  return f.map(u => { const d = side === 0 ? u.y - P0 : HALF - 1 - u.y; const nd = HALF - 1 - d; const y = rowAt(side, nd); return (obs && obs[y * BW + u.x]) || f.some(o => o !== u && o.x === u.x && o.y === y) ? u : { ...u, y }; });
}

// AI picks a lineup for `side`. opp = its best guess of the opponent's lineup (may be null).
function aiLineup(squad, side, diffId, opp, ctx, seed) {
  const cfg = AI_CFG[diffId] || AI_CFG.normal; const rnd = mulberry32(seed || 3);
  const obs = eventBoard(ctx.event, ctx.variant).obs;
  const cap0 = ctx.captain || bestCaptain(squad);
  if (cfg.mode === 'sloppy') return { units: sloppyFormation(squad, side, rnd, obs), captain: cap0 };
  const base = { units: roleFormation(squad, side, rnd, false, obs), captain: cap0 };
  if (!opp) return base;
  const opps = [opp]; if (ctx.oppBoard && diffId === 'expert') opps.push({ units: roleFormation(ctx.oppBoard, 1 - side, rnd, true, obs), captain: opp.captain });
  const cands = [base];
  for (let i = 0; i < cfg.tries; i++) { const k = rnd(); cands.push({ units: k < 0.5 ? roleFormation(squad, side, rnd, true, obs) : k < 0.8 ? lineFormation(squad, side, rnd, obs) : randomFormation(squad, side, rnd, obs), captain: cap0 }); }
  let best = cands[0], bs = -Infinity;
  for (const c of cands) {
    let sc = 0;
    for (const o of opps) for (const sd of [11, 29]) {
      const sides = side === 0 ? [c, o] : [o, c];
      const r = simulateRound({ sides, event: ctx.event, variant: ctx.variant, seed: (seed ^ sd) >>> 0 });
      const f = sd2 => r.units.filter(u => u.alive && u.side === sd2).reduce((a, u) => a + u.hp / u.maxHp, 0);
      sc += (r.winner === side ? 10 : r.winner === 'draw' ? 0 : -10) + f(side) - f(1 - side);
    }
    if (sc > bs) { bs = sc; best = c; }
  }
  return best;
}

// ----- matches: first to 3. Each round you field heroes up to your slot limit (5, 6, 7 ... 9; +1 after losing a round) -----
// deck: [{hid,ab}], deck[0] is the Captain (always on the board)
function newMatchSide(deck) { return { captain: deck[0].hid, board: [deck[0]], bench: deck.slice(1) }; }
function sideCap(round, lostLast) { return slotCap(round) + (lostLast ? COMEBACK_SLOTS : 0); }
// keep the board inside the limit (drops the last-added heroes, never the captain)
function trimBoard(side, cap) {
  while (slotsUsed(side.board) > cap && side.board.length > 1) { const h = side.board.pop(); side.bench.push(h); }
}
// fill free slots from the bench in deck order (the player's default; they can change it)
function autoFill(side, cap) {
  trimBoard(side, cap);
  for (const h of side.bench.slice()) if (slotsUsed(side.board) + heroCost(h.hid) <= cap) { side.board.push(h); side.bench = side.bench.filter(x => x !== h); }
}
// AI picks its whole board each round: captain + the best set of bench heroes that fits.
// style: 'wide' likes lots of cheap heroes, 'big' likes a few strong ones, 'mix' just fills the slots
const AI_STYLES = ['wide', 'big', 'mix'];
function aiStyleFor(seed) { return AI_STYLES[(seed >>> 0) % AI_STYLES.length]; }
const AREA_ABS = new Set(['fireball', 'flamering', 'firewall', 'avalanche', 'chain', 'blackhole', 'pepper', 'cauldron', 'zerog', 'whirl', 'quake', 'cannon', 'missiles', 'bomb', 'laser', 'scrap', 'shuriken', 'sandstorm']);
function aiPickBoard(side, cap, style, diffId, rnd, oppPrev) {
  const deck = [...side.board, ...side.bench], cap0 = deck.find(h => h.hid === side.captain) || deck[0], rest = deck.filter(h => h !== cap0);
  const budget = cap - heroCost(cap0.hid); let best = null, bs = -1e9;
  const oppN = oppPrev ? oppPrev.units.length : 0, smart = diffId !== 'easy';
  for (let m = 0; m < 1 << rest.length; m++) {
    const pick = rest.filter((h, i) => m & (1 << i)), used = slotsUsed(pick); if (used > budget) continue;
    let sc = used * 3 + rnd() * (smart ? 0.8 : 2.5);
    if (style === 'wide') sc += pick.length * 1.2; else if (style === 'big') sc += pick.filter(h => heroCost(h.hid) >= 3).length * 1.6 - pick.length * 0.3;
    if (smart && oppPrev) { // answer what they did last round
      if (oppN >= 4) sc += pick.filter(h => AREA_ABS.has(h.ab)).length * 1.5;
      if (oppN <= 2) sc += pick.length * 0.8;
    }
    if (sc > bs) { bs = sc; best = pick; }
  }
  side.board = [cap0, ...(best || [])]; side.bench = rest.filter(h => !side.board.includes(h));
  return side.board;
}

// Full AI-vs-AI match (tests / sims)
function simulateMatch(deck0, deck1, d0, d1, ctx, seed) {
  const rnd = mulberry32(seed); const S = [newMatchSide(deck0), newMatchSide(deck1)]; const D = [d0, d1];
  const style = (ctx.styles || [aiStyleFor(seed), aiStyleFor(seed >>> 3)]);
  const score = [0, 0]; let prev = [null, null]; let rounds = 0, last = null;
  while (score[0] < ROUNDS_TO_WIN && score[1] < ROUNDS_TO_WIN && rounds < 9) {
    rounds++;
    for (let i = 0; i < 2; i++) aiPickBoard(S[i], sideCap(rounds, last === 1 - i), style[i], D[i], rnd, prev[1 - i]);
    const obs = eventBoard(ctx.event, ctx.variant).obs;
    const L = [0, 1].map(i => { const j = 1 - i; const guess = prev[j] ? estimateLineup(S[j].board, prev[j], j, S[j].captain, obs) : null;
      return aiLineup(S[i].board, i, D[i], guess, { event: ctx.event, variant: ctx.variant, captain: S[i].captain, oppBoard: S[j].board }, seed + rounds * (101 + i * 2)); });
    const r = simulateRound({ sides: L, event: ctx.event, variant: ctx.variant, seed: seed + rounds });
    if (r.winner === 0) score[0]++; else if (r.winner === 1) score[1]++;
    prev = L; last = r.winner === 0 || r.winner === 1 ? r.winner : null;
  }
  return { score, rounds, winner: score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : 'draw' };
}

if (typeof module !== 'undefined') module.exports = { newRound, step, simulateRound, simulateMatch, aiLineup, roleFormation, estimateLineup, activeSynergies, heroStats, eventBoard, startAbility, castAbility };

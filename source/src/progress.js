// ===== Rift Squad: progression, economy, save (pure logic, no DOM) =====
const HOUR = 3600e3, DAY = 24 * HOUR;
const SAVE_VERSION = 2;

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function weekKey(t) { const d = new Date(t); const wd = (d.getDay() + 6) % 7; const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd); return dayKey(m.getTime()); }
function seasonKey(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function nextMidnight(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); }
function nextWeek(t) { const d = new Date(t); const wd = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd + 7).getTime(); }
function seasonEndsAt(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); }
function seasonNumber(key) { const [y, m] = key.split('-').map(Number); return Math.max(1, (y - 2026) * 12 + (m - 11) + 1); }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function seasonLabel(key) { const [y, m] = key.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; }

function arenaIndex(tr) { let i = 0; for (let k = 0; k < ARENAS.length; k++) if (tr >= ARENAS[k].t) i = k; return i; }
function arenaMult(a) { return 1 + 0.12 * a; }

function newSave(now) {
  const seed = (Math.random() * 2 ** 31) >>> 0;
  const s = {
    v: SAVE_VERSION, seed, created: now, lastSeen: now, name: 'Rift Rookie',
    coins: 300, gems: 20, trophies: 0, best: 0,
    heroes: {}, squad: START_HEROES.slice(),
    shelf: [{ type: 'hero', arena: 0, n: 1, starter: true }, { type: 'hero', arena: 0, n: 2 }, { type: 'resource', arena: 0, n: 3 }], chestSerial: 3, cycle: 0,
    keys: 3, keyNext: now + KEY_HOURS * HOUR,
    road: [], season: { id: seasonKey(now), xp: 0, claimed: [], peak: 0, bonusClaimed: 0 },
    quests: null, shop: null, winCoins: { day: dayKey(now), n: 0 },
    stats: newStats(),
    formation: {}, ach: {}, heroStats: {}, adv: { st: {}, tries: {} },
    settings: { sound: true, music: true, fast: false }, lastDiff: 'normal', tutorialDone: false, pendingEvents: [],
  };
  START_HEROES.forEach(h => s.heroes[h] = newHeroRec(1));
  return s;
}
function newHeroRec(tr) { return { tr, un: [tr >= 1 ? 1 : 0, 0, 0], eq: tr >= 1 ? 0 : -1, rc: [] }; }
function newStats() { return { battles: 0, wins: 0, losses: 0, draws: 0, kills: 0, dmg: 0, abil: 0, chests: 0, upgrades: 0, sweeps: 0, flawless: 0, expertWins: 0, bestStreak: 0, streak: 0, rounds: 0, roundWins: 0, comebacks: 0, clutch: 0, tauntAll: 0, laser3: 0 }; }

function migrate(s) {
  // ---- v1 (levels + shards + timed chest slots) -> v2 (hero trophies + abilities + keys) ----
  if (!s.shelf) {
    for (const h in s.heroes) {
      const o = s.heroes[h]; if (o.tr != null) continue;
      const lvl = o.lvl || 1, tr = lvl >= 8 ? 10 : lvl >= 5 ? 5 : lvl >= 2 ? 2 : 1;
      s.heroes[h] = { tr, un: [tr >= 2 ? 1 : 0, tr >= 5 ? 1 : 0, tr >= 10 ? 1 : 0], eq: tr >= 2 ? 0 : -1 };
    }
    s.shelf = []; s.chestSerial = s.chestSerial || 0;
    for (const c of (s.chests || [])) if (c) s.shelf.push({ type: c.type === 'mega' || c.type === 'crystal' ? 'mega' : c.type === 'bronze' ? 'resource' : 'hero', arena: c.arena || 0, n: ++s.chestSerial });
    s.keys = KEY_MAX; s.keyNext = (s.lastSeen || Date.now()) + KEY_HOURS * HOUR;
    delete s.chests; delete s.chestCursor; delete s.freeDrops; delete s.freeNext; s.cycle = 0; s.shop = null;
    if (s.quests) s.quests = null;
    s.v = 2;
  }
  START_HEROES.forEach(h => { if (!s.heroes[h]) s.heroes[h] = newHeroRec(1); });
  // squad = [Captain, 5 regular heroes]
  const byTr = Object.keys(s.heroes).sort((a, b) => s.heroes[b].tr - s.heroes[a].tr);
  const old = (s.squad || []).filter((h, i, a) => s.heroes[h] && a.indexOf(h) === i);
  const cap = old.find(h => HERO[h].captain) || byTr.find(h => HERO[h].captain) || 'bruno';
  if (!s.heroes[cap]) s.heroes[cap] = newHeroRec(1);
  const regs = old.filter(h => !HERO[h].captain);
  for (const h of byTr) { if (regs.length >= SQUAD_SIZE - 1) break; if (!HERO[h].captain && !regs.includes(h)) regs.push(h); }
  s.squad = [cap].concat(regs.slice(0, SQUAD_SIZE - 1));
  if (!s.formation) s.formation = {};
  s.stats = Object.assign(newStats(), s.stats || {});
  if (!s.ach) s.ach = {}; if (!s.heroStats) s.heroStats = {};
  // hero roads (v3): the first ability comes free with the hero; rc = road levels already claimed
  if (s.wild == null) s.wild = 0;
  if (!s.adv) s.adv = { st: {}, tries: {} }; // adventure: best stars per level, attempts
  for (const h in s.heroes) { const o = s.heroes[h]; if (!o.rc) o.rc = []; if (o.tr >= 1 && !o.un[0]) o.un[0] = 1; if (o.tr >= 1 && o.eq < 0) o.eq = 0; }
  if (s.tutorialDone == null || (!s.tutorialDone && s.stats.battles > 0)) s.tutorialDone = true; // players who already battled skip the tutorial
  if (s.lastDiff == null) s.lastDiff = 'normal';
  if (!s.settings) s.settings = { sound: true, fast: false };
  if (s.settings.music == null) s.settings.music = true;
  if (!s.pendingEvents) s.pendingEvents = [];
  if (s.quests) for (const q of [].concat(s.quests.daily || [], s.quests.weekly || [])) if (q.id === 'dmg' && q.target >= 1000) { q.target = Math.max(100, Math.round(q.target / 50 / 10) * 10); q.prog = q.done ? q.target : Math.min(Math.floor((q.prog || 0) / 50), q.target - 1); q.text = 'Deal ' + q.target.toLocaleString() + ' damage'; }
  if (typeof BH !== 'undefined') for (const h in s.formation) if (s.formation[h] && (s.formation[h].y >= BH || (typeof P0 !== 'undefined' && s.formation[h].y < P0))) delete s.formation[h];
  return s;
}

// ---------- time ----------
function safeNow(s, now) { return Math.max(now, s.lastSeen - 5 * 60e3); }

function tick(s, nowRaw) {
  const now = safeNow(s, nowRaw);
  const events = [];
  // keys refill one at a time
  while (s.keys < KEY_MAX && now >= s.keyNext) { s.keys++; s.keyNext += KEY_HOURS * HOUR; }
  if (s.keys >= KEY_MAX) s.keyNext = Math.max(s.keyNext, now);
  // season rollover
  const sk = seasonKey(now);
  if (s.season.id !== sk) events.push(rolloverSeason(s, sk));
  ensureQuests(s, now);
  ensureShop(s, now);
  if (s.winCoins.day !== dayKey(now)) s.winCoins = { day: dayKey(now), n: 0 };
  s.lastSeen = Math.max(s.lastSeen, now);
  return events;
}
function useKey(s, now) {
  if (s.keys <= 0) return false;
  if (s.keys >= KEY_MAX) s.keyNext = now + KEY_HOURS * HOUR; // the refill timer starts once you're below the cap
  s.keys--; return true;
}

// ---------- heroes, trophies & abilities ----------
function ownedIds(s) { return Object.keys(s.heroes).filter(h => s.heroes[h].tr >= 1); }
function heroTr(s, hid) { return s.heroes[hid] ? s.heroes[hid].tr : 0; }
function equippedAb(s, hid) { const o = s.heroes[hid]; return o && o.eq >= 0 && o.un[o.eq] ? HERO_ABILITIES[hid][o.eq] : null; }
function abilityState(s, hid, k) {
  const o = s.heroes[hid], need = ABILITY_TROPHIES[k], cost = ABILITY_COINS[k];
  if (!o) return { state: 'locked', need, cost };
  if (o.un[k]) return { state: o.eq === k ? 'equipped' : 'unlocked', need, cost };
  if (o.tr >= need) return { state: 'ready', need, cost, can: s.coins >= cost };
  return { state: 'locked', need, cost };
}
function unlockAbility(s, hid, k) {
  const st = abilityState(s, hid, k); if (st.state !== 'ready' || !st.can) return false;
  const o = s.heroes[hid]; s.coins -= st.cost; o.un[k] = 1; if (o.eq < 0) o.eq = k;
  s.stats.upgrades++; questAdd(s, 'upgrades', 1);
  return true;
}
function equipAbility(s, hid, k) { const o = s.heroes[hid]; if (!o || !o.un[k]) return false; o.eq = k; return true; }
function canUnlockAny(s, hid) { return [0, 1, 2].some(k => { const st = abilityState(s, hid, k); return st.state === 'ready' && st.can; }); }
function trophiesNeeded(s, hid) { return Math.max(0, HERO_MAX - heroTr(s, hid)); }
// ----- hero road -----
function roadStep(s, hid, L) { // 'locked' | 'claim' | 'done' (+ for abilities: cost and whether you can afford it)
  const R = HERO_ROAD[L], o = s.heroes[hid], lv = o ? o.tr : 0;
  if (R.kind === 'ab') { const a = abilityState(s, hid, R.k); return { R, state: a.state === 'locked' ? 'locked' : a.state === 'ready' ? 'claim' : 'done', cost: a.cost, can: a.state !== 'ready' || a.can }; }
  if (lv < L) return { R, state: 'locked' };
  return { R, state: (o.rc || []).includes(L) ? 'done' : 'claim', can: true };
}
function heroClaimable(s, hid) { if (!s.heroes[hid] || s.heroes[hid].tr < 1) return 0; let n = 0; for (let L = 1; L <= HERO_MAX; L++) { const st = roadStep(s, hid, L); if (st.state === 'claim' && st.can) n++; } return n; }
function claimHeroRoad(s, hid, L, now) {
  const st = roadStep(s, hid, L); if (st.state !== 'claim' || !st.can) return null;
  const R = st.R;
  if (R.kind === 'ab') return unlockAbility(s, hid, R.k) ? { ability: HERO_ABILITIES[hid][R.k] } : null;
  (s.heroes[hid].rc = s.heroes[hid].rc || []).push(L);
  if (R.kind === 'chest') return openInstant(s, R.chest, arenaIndex(s.trophies), 'road' + hid + L);
  const r = emptyReward(); r[R.kind] = R.n; grant(s, r); return r;
}
// a wild trophy: +1 level on the hero of your choice (unlocks it if you don't have it yet)
function useWild(s, hid) {
  if (s.wild <= 0 || heroTr(s, hid) >= HERO_MAX) return null;
  s.wild--; const r = emptyReward(); r.trophies[hid] = 1; grant(s, r); return r;
}

function pickWeighted(rnd, items, wfn) { let tot = 0; for (const it of items) tot += wfn(it); let r = rnd() * tot; for (const it of items) { r -= wfn(it); if (r <= 0) return it; } return items[items.length - 1]; }
// heroes a trophy can go to: anything your arena allows that still needs trophies (new heroes are a bit rarer)
function trophyPool(s, arena) { return HEROES.filter(h => RARITIES[h.rarity].arena <= arena && trophiesNeeded(s, h.id) > 0).map(h => h.id); }
function trophyWeight(s, hid) { return RARITIES[HERO[hid].rarity].weight * (s.heroes[hid] ? 1 : 0.45) * (s.squad.includes(hid) ? 1.3 : 1); }
function giveTrophies(s, out, n, arena, rnd, only) {
  const extra = {};
  for (let i = 0; i < n; i++) {
    const pool = (only || trophyPool(s, arena)).filter(h => trophiesNeeded(s, h) - (out.trophies[h] || 0) > 0);
    if (!pool.length) { out.coins = (out.coins || 0) + TROPHY_COIN; continue; }
    const h = pickWeighted(rnd, pool, id => trophyWeight(s, id));
    out.trophies[h] = (out.trophies[h] || 0) + 1;
  }
  return extra;
}
function emptyReward() { return { coins: 0, gems: 0, keys: 0, trophies: {}, newHeroes: [] }; }

function rollChest(s, type, arena, rnd, opts) {
  const C = CHESTS[type], m = arenaMult(arena), out = emptyReward();
  if (C.coins) out.coins = Math.round(C.coins * m * (0.85 + rnd() * 0.3));
  if (type === 'resource') { if (rnd() < 0.35) out.gems = 1 + Math.floor(rnd() * 3); if (rnd() < 0.2) out.keys = 1; }
  if (type === 'mega') { out.gems = 5 + Math.floor(rnd() * 6); out.keys = 2; }
  if (rnd() < (WILD_CHANCE[type] || 0)) out.wild = 1;
  if (opts && opts.starter) { // first chest: one brand-new hero
    const fresh = trophyPool(s, arena).filter(h => !s.heroes[h] || s.heroes[h].tr < 1);
    giveTrophies(s, out, 1, arena, rnd, fresh.length ? fresh : null);
  }
  else if (type === 'hero') { // a Hero Chest is always exactly one hero (if your arena's heroes are all maxed, any hero that still needs one)
    const pool = trophyPool(s, arena); giveTrophies(s, out, 1, arena, rnd, pool.length ? null : HEROES.filter(h => trophiesNeeded(s, h.id) > 0).map(h => h.id));
  }
  else if (C.trophies[1] > 0) { const [lo, hi] = C.trophies; const n = lo + (rnd() < 0.3 + 0.03 * arena ? hi - lo : 0); giveTrophies(s, out, n, arena, rnd); }
  return out;
}

function grant(s, r) {
  s.coins += r.coins || 0; s.gems += r.gems || 0; s.keys += r.keys || 0; s.wild = (s.wild || 0) + (r.wild || 0);
  for (const h in (r.trophies || {})) {
    if (!s.heroes[h]) { s.heroes[h] = newHeroRec(0); if (!(r.newHeroes || []).includes(h)) (r.newHeroes = r.newHeroes || []).push(h); }
    s.heroes[h].tr = Math.min(HERO_MAX, s.heroes[h].tr + r.trophies[h]);
  }
  for (const h of (r.newHeroes || [])) if (!s.heroes[h]) s.heroes[h] = newHeroRec(1); else if (s.heroes[h].tr < 1) s.heroes[h].tr = 1;
  for (const h in (r.trophies || {})) { const o = s.heroes[h]; if (o.tr >= 1 && !o.un[0]) { o.un[0] = 1; if (o.eq < 0) o.eq = 0; } } // first ability comes with the hero
  if (r.xp) s.season.xp += r.xp;
}

function addToShelf(s, type, arena) { if (s.shelf.length >= SHELF_MAX) return false; s.shelf.push({ type, arena, n: ++s.chestSerial }); return true; }
function openShelfChest(s, i, now) {
  const c = s.shelf[i]; if (!c || !useKey(s, now)) return null;
  const rnd = mulberry32(s.seed ^ hashStr('chest' + c.n + ':' + c.type));
  const r = rollChest(s, c.type, c.arena, rnd, { starter: c.starter }); r.type = c.type;
  grant(s, r); s.shelf.splice(i, 1); s.stats.chests++; questAdd(s, 'chests', 1);
  return r;
}
function openInstant(s, type, arena, salt) {
  const rnd = mulberry32(s.seed ^ hashStr('inst' + salt + ':' + s.stats.chests));
  const r = rollChest(s, type, arena, rnd); r.type = type; grant(s, r); s.stats.chests++; questAdd(s, 'chests', 1);
  return r;
}

// ---------- trophy road ----------
// heroes only come from chests now; these old milestone steps stay (so saved road progress lines up) and give a chest instead
const ROAD_HEROES = {};
const ROAD_MILESTONES = { 100: 'marla', 300: 'kit', 500: 'rocco', 700: 'yuki', 1200: 'volt', 1800: 'hex', 2500: 'mumbo', 3300: 'luna', 4200: 'ragnar', 5200: 'vex', 6300: 'zorp', 7500: 'ember', 8800: 'rex', 13300: 'chrono' };
function buildRoad() {
  const steps = []; let t = 0;
  while (t < 20000) {
    t += t < 700 ? 50 : t < 3300 ? 100 : t < 8800 ? 150 : t < 15000 ? 200 : 500;
    steps.push(t);
  }
  const extra = Object.keys(ROAD_MILESTONES).map(Number).concat(ARENAS.map(a => a.t).filter(x => x > 0));
  extra.forEach(x => { if (!steps.includes(x)) steps.push(x); });
  steps.sort((a, b) => a - b);
  const cycle = ['coins', 'trophy', 'keys', 'chest', 'gems', 'trophy'];
  let ci = 0;
  return steps.map((t, i) => {
    const a = arenaIndex(t), arenaStart = ARENAS.findIndex(x => x.t === t);
    if (ROAD_MILESTONES[t]) return { t, kind: 'chest', chest: t >= 4200 ? 'mega' : 'hero', arena: a, arenaStart, big: true };
    if (arenaStart > 0) return { t, kind: 'chest', chest: a >= 4 ? 'mega' : 'hero', arena: a, arenaStart };
    const k = cycle[ci++ % cycle.length], m = arenaMult(a);
    if (k === 'coins') return { t, kind: 'coins', n: Math.round(120 * m / 10) * 10 };
    if (k === 'trophy') return { t, kind: 'trophy', n: 1 + Math.floor(a / 5) };
    if (k === 'keys') return { t, kind: 'keys', n: 2 };
    if (k === 'gems') return { t, kind: 'gems', n: 5 + Math.floor(a / 3) };
    return { t, kind: 'chest', chest: t >= 15000 ? 'mega' : 'hero', arena: a };
  });
}
const ROAD = buildRoad();

function claimRoad(s, i, now) {
  const st = ROAD[i]; if (!st || s.best < st.t || s.road.includes(i)) return null;
  s.road.push(i);
  return grantRewardSpec(s, st, 'road' + i);
}
// generic reward spec: {kind:'coins'|'gems'|'keys'|'trophy'|'chest'|'hero', n, chest, arena, hid}
function grantRewardSpec(s, st, salt) {
  const a = arenaIndex(s.trophies);
  if (st.kind === 'coins') { const r = { coins: st.n }; grant(s, r); return r; }
  if (st.kind === 'gems') { const r = { gems: st.n }; grant(s, r); return r; }
  if (st.kind === 'keys') { const r = { keys: st.n }; grant(s, r); return r; }
  if (st.kind === 'trophy') { const r = emptyReward(); giveTrophies(s, r, st.n, a, mulberry32(s.seed ^ hashStr('tr' + salt))); grant(s, r); return r; }
  if (st.kind === 'chest') return openInstant(s, st.chest, st.arena != null ? Math.max(st.arena, 0) : a, salt);
  if (st.kind === 'hero') {
    const r = emptyReward();
    if (!s.heroes[st.hid] || s.heroes[st.hid].tr < 1) r.trophies[st.hid] = 1;
    else if (trophiesNeeded(s, st.hid) > 0) r.trophies[st.hid] = Math.min(2, trophiesNeeded(s, st.hid));
    else r.coins = 300;
    grant(s, r); return r;
  }
  return {};
}
function roadClaimableCount(s) { let n = 0; ROAD.forEach((st, i) => { if (s.best >= st.t && !s.road.includes(i)) n++; }); return n; }

// ---------- season ----------
function seasonTierReward(tier) {
  if (tier === 30) return { kind: 'chest', chest: 'mega' };
  if (tier % 5 === 0) return { kind: 'chest', chest: tier >= 20 ? 'mega' : 'hero' };
  const k = ['coins', 'trophy', 'keys', 'gems'][(tier - 1) % 5 % 4];
  if (k === 'gems') return { kind: 'gems', n: tier >= 25 ? 10 : 5 };
  if (k === 'trophy') return { kind: 'trophy', n: 1 };
  if (k === 'keys') return { kind: 'keys', n: 1 };
  return { kind: 'coins', n: 60 };
}
function scaledSeasonReward(s, tier) {
  const r = Object.assign({}, seasonTierReward(tier)); const m = arenaMult(arenaIndex(s.trophies));
  if (r.kind === 'coins') r.n = Math.round(r.n * m);
  r.arena = arenaIndex(s.trophies);
  return r;
}
function seasonTier(s) { return Math.min(SEASON_TIERS, Math.floor(s.season.xp / SEASON_TIER_XP)); }
function seasonBonus(s) { return Math.max(0, Math.floor((s.season.xp - SEASON_TIERS * SEASON_TIER_XP) / SEASON_TIER_XP)) - s.season.bonusClaimed; }
function claimSeason(s, tier) {
  if (tier > seasonTier(s) || s.season.claimed.includes(tier)) return null;
  s.season.claimed.push(tier);
  return grantRewardSpec(s, scaledSeasonReward(s, tier), 'season' + s.season.id + ':' + tier);
}
function claimSeasonBonus(s) {
  const n = seasonBonus(s); if (n <= 0) return null;
  s.season.bonusClaimed += n; const r = { coins: Math.round(150 * n * arenaMult(arenaIndex(s.trophies))) }; grant(s, r); return r;
}
function rolloverSeason(s, newId) {
  const old = s.season; const ev = { type: 'season', old: old.id, rewards: [] };
  const reached = Math.min(SEASON_TIERS, Math.floor(old.xp / SEASON_TIER_XP));
  for (let t = 1; t <= reached; t++) if (!old.claimed.includes(t)) { old.claimed.push(t); ev.rewards.push(grantRewardSpec(s, scaledSeasonReward(s, t), 'season' + old.id + ':' + t)); }
  const bonus = claimSeasonBonus(s); if (bonus) ev.rewards.push(bonus);
  const pa = arenaIndex(old.peak || s.trophies);
  const end = { coins: 240 * (1 + pa), gems: 3 + pa, keys: 3 }; grant(s, end); ev.endReward = end;
  ev.tierReached = reached; ev.peak = old.peak;
  if (s.trophies > SEASON_RESET_FLOOR) { const before = s.trophies; s.trophies = SEASON_RESET_FLOOR + Math.floor((s.trophies - SEASON_RESET_FLOOR) * 0.9); ev.reset = [before, s.trophies]; }
  s.season = { id: newId, xp: 0, claimed: [], peak: s.trophies, bonusClaimed: 0 };
  s.pendingEvents.push(ev);
  return ev;
}

// ---------- quests ----------
function genQuests(s, key, pool, n, weekly) {
  const rnd = mulberry32(s.seed ^ hashStr((weekly ? 'w' : 'd') + key));
  const a = arenaIndex(s.trophies); const owned = ownedIds(s);
  const avail = pool.filter(q => WORLDS_ON || q.stat !== 'synWins'); const out = [];
  while (out.length < n && avail.length) {
    const q = avail.splice(Math.floor(rnd() * avail.length), 1)[0];
    const inst = { id: q.id, stat: q.stat, target: q.target, prog: 0, done: false, claimed: false, xp: q.xp, coins: Math.round(q.coins * 3 * arenaMult(a)), gems: q.gems || 0, text: q.text };
    if (q.id === 'dmg') { inst.target = Math.round((100 + 15 * a) / 10) * 10; inst.text = q.text.replace('{n}', inst.target.toLocaleString()); }
    if (q.id === 'hero') { inst.hid = owned[Math.floor(rnd() * owned.length)]; inst.text = q.text.replace('{hero}', HERO[inst.hid].name); }
    out.push(inst);
  }
  return out;
}
function ensureQuests(s, now) {
  const dk = dayKey(now), wk = weekKey(now);
  if (!s.quests) s.quests = {};
  if (s.quests.day !== dk) { s.quests.day = dk; s.quests.daily = genQuests(s, dk, QUEST_POOL_DAILY, 3, false); }
  if (s.quests.week !== wk) { s.quests.week = wk; s.quests.weekly = genQuests(s, wk, QUEST_POOL_WEEKLY, 3, true); }
  // world team-up quests can't be finished while worlds are off: swap them for another weekly quest
  if (!WORLDS_ON && s.quests.weekly.some(q => q.stat === 'synWins')) { const fresh = genQuests(s, wk + 'x', QUEST_POOL_WEEKLY, 6, true).filter(q => !s.quests.weekly.some(o => o.id === q.id)); s.quests.weekly = s.quests.weekly.map(q => q.stat === 'synWins' ? fresh.shift() || q : q); }
}
function questAdd(s, stat, n, extra) {
  if (!s.quests) return;
  for (const q of (s.quests.daily || []).concat(s.quests.weekly || [])) {
    if (q.done || q.stat !== stat) continue;
    if (q.hid && (!extra || extra.captain !== q.hid)) continue;
    q.prog = Math.min(q.target, q.prog + n); if (q.prog >= q.target) q.done = true;
  }
}
function claimQuest(s, weekly, i) {
  const q = (weekly ? s.quests.weekly : s.quests.daily)[i]; if (!q || !q.done || q.claimed) return null;
  q.claimed = true; const r = { coins: q.coins, gems: q.gems, xp: q.xp }; grant(s, r); return r;
}
function questsClaimable(s) { if (!s.quests) return 0; return (s.quests.daily || []).concat(s.quests.weekly || []).filter(q => q.done && !q.claimed).length; }

// ---------- shop ----------
const TROPHY_PRICE = { common: 150, rare: 250, epic: 400, mythic: 600, legendary: 900 };
const RECRUIT_GEMS = { common: 60, rare: 150, epic: 350, mythic: 700, legendary: 1200 };
const KEY_PRICE = 150, KEYS_PER_DAY = 3;
function ensureShop(s, now) {
  const dk = dayKey(now), wk = weekKey(now);
  if (s.shop && s.shop.day === dk && s.shop.week === wk) return;
  const a = arenaIndex(s.trophies), m = arenaMult(a);
  const rnd = mulberry32(s.seed ^ hashStr('shop' + dk));
  const offers = [{ kind: 'free', coins: Math.round(100 * m), bought: false }, { kind: 'key', price: KEY_PRICE, left: KEYS_PER_DAY }, { kind: 'chest', chest: 'hero', price: 300, bought: false }];
  const cands = ownedIds(s).filter(h => trophiesNeeded(s, h) > 0); const used = [];
  for (let i = 0; i < 3 && cands.length; i++) {
    const left = cands.filter(h => !used.includes(h)); if (!left.length) break;
    const h = left[Math.floor(rnd() * left.length)]; used.push(h);
    offers.push({ kind: 'trophy', hid: h, price: TROPHY_PRICE[HERO[h].rarity], bought: false });
  }
  offers.push({ kind: 'gemchest', chest: 'mega', price: 120, bought: false });
  offers.push({ kind: 'gemkeys', keys: 5, price: 50, bought: false });
  offers.push({ kind: 'coinbag', coins: Math.round(1000 * m), price: 80, bought: false });
  let recruit = s.shop && s.shop.week === wk ? s.shop.recruit : null;
  if (!s.shop || s.shop.week !== wk) {
    const rr = mulberry32(s.seed ^ hashStr('recruit' + wk));
    // recruits: non-common heroes that aren't about to unlock for free on the Trophy Road
    const roadAt = h => { const e = Object.entries(ROAD_HEROES).find(([, x]) => x === h); return e ? +e[0] : Infinity; };
    const pool = HEROES.filter(h => RARITIES[h.rarity].arena <= a && heroTr(s, h.id) < 1 && h.rarity !== 'common' && roadAt(h.id) > s.best + 1500).map(h => h.id);
    recruit = pool.length ? { hid: pool[Math.floor(rr() * pool.length)], bought: false } : null;
    if (recruit) recruit.price = RECRUIT_GEMS[HERO[recruit.hid].rarity];
  }
  s.shop = { day: dk, week: wk, offers, recruit };
}
function buyOffer(s, i, now) {
  const o = s.shop.offers[i]; if (!o || o.bought) return null;
  const a = arenaIndex(s.trophies);
  if (o.kind === 'free') { o.bought = true; const r = { coins: o.coins }; grant(s, r); return r; }
  if (o.kind === 'key') { if (o.left <= 0 || s.coins < o.price) return null; s.coins -= o.price; o.left--; if (!o.left) o.bought = true; const r = { keys: 1 }; grant(s, r); return r; }
  if (o.kind === 'chest') { if (s.coins < o.price) return null; s.coins -= o.price; o.bought = true; return openInstant(s, o.chest, a, 'shop' + s.shop.day + i); }
  if (o.kind === 'trophy') {
    if (s.coins < o.price || trophiesNeeded(s, o.hid) <= 0) return null;
    s.coins -= o.price; o.bought = true; const r = emptyReward(); r.trophies[o.hid] = 1; grant(s, r); return r;
  }
  if (o.kind === 'gemchest') { if (s.gems < o.price) return null; s.gems -= o.price; o.bought = true; return openInstant(s, o.chest, a, 'shop' + s.shop.day + i); }
  if (o.kind === 'gemkeys') { if (s.gems < o.price) return null; s.gems -= o.price; o.bought = true; const r = { keys: o.keys }; grant(s, r); return r; }
  if (o.kind === 'coinbag') { if (s.gems < o.price) return null; s.gems -= o.price; o.bought = true; const r = { coins: o.coins }; grant(s, r); return r; }
  return null;
}
function buyRecruit(s) {
  const r = s.shop && s.shop.recruit; if (!r || r.bought || heroTr(s, r.hid) >= 1 || s.gems < r.price) return null;
  s.gems -= r.price; r.bought = true; const g = emptyReward(); g.trophies[r.hid] = 1; grant(s, g); return g;
}

// ---------- battles ----------
// how many of their 3 abilities enemy heroes can use (0 = just attacks)
function foeTier(arena, diffId) { const D = DIFF[diffId]; return Math.max(0, Math.min(3, Math.floor((arena + 1) / 2) + (D.idx >= 2 ? 1 : 0) - (D.idx === 0 ? 1 : 0))); }
// arena: any arena up to your current one. Older arenas don't win or lose trophies.
function setupBattle(s, diffId, seed, arena) {
  const top = arenaIndex(s.trophies), a = arena == null ? top : Math.max(0, Math.min(top, arena)); const rnd = mulberry32(seed); const D = DIFF[diffId];
  const allowed = HEROES.filter(h => RARITIES[h.rarity].arena <= a);
  const caps = allowed.filter(h => h.captain).map(h => h.id), pool = allowed.filter(h => !h.captain).map(h => h.id);
  // Captain: Easy picks at random, others take the rarest available
  const capPick = D.idx === 0 ? caps[Math.floor(rnd() * caps.length)] : caps.slice().sort((x, y) => RARITIES[HERO[y].rarity].order - RARITIES[HERO[x].rarity].order || rnd() - 0.5)[0];
  const foe = [];
  if (D.idx >= 2) {
    // Hard/Expert rivals build around their Captain's world
    pool.filter(h => HERO[h].world === HERO[capPick].world).sort(() => rnd() - 0.5).slice(0, 2).forEach(h => foe.push(h));
  }
  while (foe.length < SQUAD_SIZE - 1 && foe.length < pool.length) { const h = pool[Math.floor(rnd() * pool.length)]; if (!foe.includes(h)) foe.push(h); }
  foe.unshift(capPick);
  const tier = foeTier(a, diffId);
  const event = s.stats.battles === 0 ? 'clear' : pickEvent(a, rnd);
  return {
    arena: a, older: a < top, diff: diffId, foeName: RIVAL_NAMES[Math.floor(rnd() * RIVAL_NAMES.length)], foeTier: tier, seed,
    event, variant: Math.floor(rnd() * 2),
    myDeck: s.squad.map(h => ({ hid: h, ab: equippedAb(s, h) })),
    foeDeck: foe.map(h => ({ hid: h, ab: tier ? HERO_ABILITIES[h][Math.floor(rnd() * tier)] : null })),
  };
}

// res: { winner: 0|1|'draw', score:[a,b], stats:{dmg,kills,abil}, flawless, rounds, syn3, captain, flee }
function finishBattle(s, setup, res, now) {
  const D = DIFF[setup.diff]; const a = arenaIndex(s.trophies), pa = setup.arena != null ? Math.min(setup.arena, a) : a, older = pa < a;
  const out = { diff: setup.diff, winner: res.winner, score: res.score, before: s.trophies, older };
  s.stats.battles++; questAdd(s, 'battles', 1);
  s.stats.kills += res.stats.kills; s.stats.dmg += res.stats.dmg; s.stats.abil += res.stats.abil;
  s.stats.rounds += res.rounds || 0; s.stats.roundWins += res.score ? res.score[0] : 0;
  questAdd(s, 'kills', res.stats.kills); questAdd(s, 'dmg', res.stats.dmg); questAdd(s, 'abil', res.stats.abil);
  if (res.flawless) { s.stats.flawless += res.flawless; questAdd(s, 'flawless', res.flawless); }
  if (res.clutch) s.stats.clutch += res.clutch;
  for (const f in (res.feats || {})) if (res.feats[f]) s.stats[f] = (s.stats[f] || 0) + 1;
  for (const h in (res.heroes || {})) {
    const hs = s.heroStats[h] || (s.heroStats[h] = { m: 0, w: 0, k: 0, d: 0 }), x = res.heroes[h];
    hs.m++; if (res.winner === 0) hs.w++; hs.k += x.k || 0; hs.d += x.d || 0;
  }
  if (res.winner === 0) {
    s.stats.wins++; s.stats.streak++; s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.streak);
    questAdd(s, 'wins', 1); questAdd(s, 'heroWins', 1, { captain: res.captain });
    if (res.score && res.score[1] === 0) { s.stats.sweeps++; questAdd(s, 'sweeps', 1); }
    if (res.comeback) s.stats.comebacks++;
    if (res.syn3) questAdd(s, 'synWins', 1);
    if (D.idx >= 2) questAdd(s, 'hardWins', 1);
    if (D.idx === 3) { s.stats.expertWins++; questAdd(s, 'expertWins', 1); }
    out.trophies = older ? 0 : D.win; s.trophies += out.trophies;
    if (s.winCoins.day !== dayKey(now)) s.winCoins = { day: dayKey(now), n: 0 };
    out.coins = s.winCoins.n < DAILY_WIN_COIN_CAP ? Math.round(12 * arenaMult(pa) * D.coin) : 0;
    if (out.coins) s.winCoins.n++;
    s.coins += out.coins; out.xp = D.xpWin;
    const type = CHEST_CODE[CHEST_CYCLE[s.cycle % CHEST_CYCLE.length]];
    if (addToShelf(s, type, pa)) { s.cycle++; out.chest = type; } else out.chestFull = true;
  } else {
    s.stats.streak = 0;
    if (res.winner === 1) { s.stats.losses++; const floor = ARENAS[a].t; const loss = older ? 0 : Math.min(D.loss, Math.max(0, s.trophies - floor)); s.trophies -= loss; out.trophies = -loss; }
    else { s.stats.draws++; out.trophies = 0; }
    out.coins = 0; out.xp = D.xpLoss;
  }
  s.season.xp += out.xp;
  s.best = Math.max(s.best, s.trophies); s.season.peak = Math.max(s.season.peak || 0, s.trophies);
  out.after = s.trophies; out.arenaBefore = a; out.arenaAfter = arenaIndex(s.trophies);
  return out;
}

// ---------- achievements ----------
// s.ach[id]: 1 = done, reward waiting; 2 = claimed
function abilitiesUnlocked(s) { let n = 0; for (const h in s.heroes) n += s.heroes[h].un.reduce((a, b) => a + b, 0); return n; }
function achValue(s, v) {
  if (v === 'arena') return arenaIndex(s.best) + 1;
  if (v === 'owned') return ownedIds(s).length;
  if (v === 'captains') return ownedIds(s).filter(h => HERO[h].captain).length;
  if (v === 'abilities') return abilitiesUnlocked(s);
  if (v === 'maxed') return ownedIds(s).filter(h => s.heroes[h].tr >= HERO_MAX).length;
  if (v === 'ab2') return ownedIds(s).filter(h => s.heroes[h].un[1]).length;
  return s.stats[v] || 0;
}
function checkAchievements(s) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && achValue(s, a.v) >= a.n) { s.ach[a.id] = 1; fresh.push(a); }
  return fresh;
}
function achClaimable(s) { return ACHIEVEMENTS.filter(a => s.ach[a.id] === 1).length; }
function claimAchievement(s, id) {
  const a = ACH[id]; if (!a || s.ach[id] !== 1) return null;
  s.ach[id] = 2; const r = Object.assign({}, a.r); grant(s, r); return r;
}
// most-played hero and the hero with the most damage
function favHeroes(s) {
  const e = Object.entries(s.heroStats || {}).filter(([h]) => HERO[h]);
  const top = k => e.length ? e.slice().sort((a, b) => b[1][k] - a[1][k])[0] : null;
  return { most: top('m'), dmg: top('d'), kills: top('k') };
}

// ---------- tutorial ----------
const TUTORIAL = {
  foeName: 'Training Bot', seed: 424242, event: 'clear', foeHp: 0.6, toWin: 2,
  myDeck: [{ hid: 'bruno', ab: 'taunt' }, { hid: 'zip', ab: 'laser' }, { hid: 'gus', ab: null }, { hid: 'nova', ab: 'heal' }, { hid: 'dusty', ab: null }],
  foeDeck: [{ hid: 'marla', ab: null }, { hid: 'yuki', ab: null }, { hid: 'bao', ab: null }, { hid: 'volt', ab: null }, { hid: 'kit', ab: null }],
};
function tutorialSetup() {
  const T = TUTORIAL;
  return { arena: 0, diff: 'easy', foeName: T.foeName, foeTier: 0, seed: T.seed, event: T.event, variant: 0, tut: true, toWin: T.toWin, foeHp: T.foeHp,
    myDeck: T.myDeck.map(x => Object.assign({}, x)), foeDeck: T.foeDeck.map(x => Object.assign({}, x)) };
}
// first time through: a Hero Chest for finishing
function finishTutorial(s) {
  const first = !s.tutorialDone; s.tutorialDone = true;
  if (first) addToShelf(s, 'hero', 0);
  return first;
}

// ---------- adventure ----------
function advLevel(ch, i) { const C = ADVENTURE.find(c => c.id === ch); return C && C.levels[i]; }
function advStars(s, ch, i) { return (s.adv.st[advKey(ch, i)] || 0); }
function advOpen(s, ch, i) { return i === 0 || advStars(s, ch, i - 1) > 0; }
function advChapterStars(s, ch) { const C = ADVENTURE.find(c => c.id === ch); return C.levels.reduce((n, L, i) => n + advStars(s, ch, i), 0); }
function advNext(s, ch) { const C = ADVENTURE.find(c => c.id === ch); const i = C.levels.findIndex((L, k) => advStars(s, ch, k) === 0); return i < 0 ? C.levels.length - 1 : i; }
// a match for one level, using your squad
function advSetup(s, ch, i) {
  const C = ADVENTURE.find(c => c.id === ch), L = C.levels[i], key = advKey(ch, i), tries = (s.adv.tries[key] || 0) + 1; s.adv.tries[key] = tries;
  const seed = (hashStr('adv' + key) ^ (L.fixed ? 0 : tries * 2654435761)) >>> 0, rnd = mulberry32(seed);
  const abOf = (h, k) => HERO_ABILITIES[h] ? HERO_ABILITIES[h][i < 2 ? 0 : (k + i) % 3] : null;
  const foeHids = L.fixed ? L.fixed.map(f => f[0]) : [L.cap, ...L.team];
  return { adv: { ch, i, key }, arena: C.arena, diff: L.diff, foeName: L.name, foeTier: 1, seed, event: L.event, variant: Math.floor(rnd() * 2),
    foeHp: L.hp !== 1 ? L.hp : null, foeOrbs: L.orbs || 0, boss: L.type === 'boss' ? L.cap : null,
    fixedFoe: L.fixed ? L.fixed.map((f, k) => ({ hid: f[0], ab: abOf(f[0], k), x: f[1], y: f[2] })) : null,
    myDeck: s.squad.map(h => ({ hid: h, ab: equippedAb(s, h) })),
    foeDeck: (L.fixed ? [L.cap, ...foeHids.filter(h => h !== L.cap)] : foeHids).map((h, k) => ({ hid: h, ab: abOf(h, k) })) };
}
// stars: 1 = win, 2 = lost at most 1 round, 3 = lost none. First win pays the level's reward; every new star pays 1 gem.
function advFinish(s, setup, res) {
  const { ch, i, key } = setup.adv, L = advLevel(ch, i), prev = s.adv.st[key] || 0;
  const stars = res.winner === 0 ? (res.score[1] === 0 ? 3 : res.score[1] === 1 ? 2 : 1) : 0;
  const out = { stars, prev, first: stars > 0 && prev === 0, gems: Math.max(0, stars - prev) * ADV_STAR_GEMS, r: null, chest: null };
  s.stats.battles++; questAdd(s, 'battles', 1);
  s.stats.kills += res.stats.kills; s.stats.dmg += res.stats.dmg; s.stats.abil += res.stats.abil;
  questAdd(s, 'kills', res.stats.kills); questAdd(s, 'dmg', res.stats.dmg); questAdd(s, 'abil', res.stats.abil);
  if (res.winner === 0) { s.stats.wins++; questAdd(s, 'wins', 1); }
  if (stars > prev) s.adv.st[key] = stars;
  if (out.gems) s.gems += out.gems;
  if (out.first) {
    const R = L.r; out.r = { coins: R.coins || 0, gems: R.gems || 0, keys: R.keys || 0, wild: R.wild || 0 }; grant(s, out.r);
    if (R.chest) { out.chest = openInstant(s, R.chest, ADVENTURE.find(c => c.id === ch).arena, 'adv' + key); out.chestType = R.chest; }
  }
  return out;
}

// ---------- backup ----------
function exportSave(s) { return 'RIFT1:' + btoaSafe(JSON.stringify(s)); }
function importSave(str) {
  str = (str || '').trim(); if (!str.startsWith('RIFT1:')) throw new Error('Not a Rift Squad backup code');
  const s = JSON.parse(atobSafe(str.slice(6))); if (!s || !s.heroes || s.v == null) throw new Error('Backup looks damaged');
  return migrate(s);
}
function btoaSafe(str) { if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(str))); return Buffer.from(str, 'utf8').toString('base64'); }
function atobSafe(str) { if (typeof atob !== 'undefined') return decodeURIComponent(escape(atob(str))); return Buffer.from(str, 'base64').toString('utf8'); }

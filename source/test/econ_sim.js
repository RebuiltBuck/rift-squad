// Simulates a player over ~3 years using the real progression code.
const load = require('./harness');
const G = load(['data.js', 'battle.js', 'progress.js']);
const g = n => G(n);
const [newSave, tick, finishBattle, setupBattle, openChest, claimFreeDrop, upgradeHero, upgradeInfo, claimRoad, ROAD, claimSeason, seasonTier, claimQuest, buyOffer, buyRecruit, arenaIndex, ARENAS, DIFFS, HEROES, MAX_LEVEL, foeLevel, mulberry32, claimSeasonBonus] =
  ['newSave', 'tick', 'finishBattle', 'setupBattle', 'openChest', 'claimFreeDrop', 'upgradeHero', 'upgradeInfo', 'claimRoad', 'ROAD', 'claimSeason', 'seasonTier', 'claimQuest', 'buyOffer', 'buyRecruit', 'arenaIndex', 'ARENAS', 'DIFFS', 'HEROES', 'MAX_LEVEL', 'foeLevel', 'mulberry32', 'claimSeasonBonus'].map(g);

const BATTLES = +process.argv[2] || 6, SKILL = +(process.argv[3] || 0), DAYS = +process.argv[4] || 1100;
const BASE = { easy: 0.88, normal: 0.72, hard: 0.55, expert: 0.38 };
const rnd = mulberry32(12345);
const start = new Date(2026, 10, 21, 8, 0).getTime();
const s = newSave(start); s.seed = 777;
tick(s, start);

const SHARD_COST = g('SHARD_COST');
function totalShards() { let n = 0; for (const h in s.heroes) { n += s.heroes[h].shards; for (let l = 1; l < s.heroes[h].lvl; l++) n += SHARD_COST[l]; } return n; }
const tally = {}, coinTally = {};
function T(label, fn) { const a = totalShards(), c = s.coins; const r = fn(); tally[label] = (tally[label] || 0) + totalShards() - a; coinTally[label] = (coinTally[label] || 0) + s.coins - c; return r; }
function lvlAvg() { return s.squad.reduce((a, h) => a + s.heroes[h].lvl, 0) / s.squad.length; }
function pickSquad() { s.squad = Object.keys(s.heroes).sort((a, b) => s.heroes[b].lvl - s.heroes[a].lvl || (s.squad.includes(b) - s.squad.includes(a))).slice(0, 6); }
function upgrades() {
  let did = true;
  while (did) {
    did = false;
    // squad first, then anyone (cheapest first)
    const order = Object.keys(s.heroes).sort((a, b) => (s.squad.includes(b) - s.squad.includes(a)) || s.heroes[a].lvl - s.heroes[b].lvl);
    for (const h of order) { const u = upgradeInfo(s, h); if (u && !u.max && u.can) { upgradeHero(s, h); did = true; break; } }
  }
}
const COIN_COST = g('COIN_COST');
function reserve() { return s.squad.reduce((a, h) => a + (COIN_COST[s.heroes[h].lvl] || 0), 0) + 300; }
function housekeeping(now) {
  tick(s, now);
  T('chests', () => { for (let i = 0; i < 4; i++) if (s.chests[i] && s.chests[i].ready) openChest(s, i, now); });
  T('free', () => { while (s.freeDrops > 0) claimFreeDrop(s, now); });
  T('road', () => ROAD.forEach((st, i) => { if (s.best >= st.t && !s.road.includes(i)) claimRoad(s, i, now); }));
  T('season', () => { for (let t = 1; t <= seasonTier(s); t++) if (!s.season.claimed.includes(t)) claimSeason(s, t); });
  claimSeasonBonus(s);
  T('quests', () => ['daily', 'weekly'].forEach(k => s.quests[k].forEach((q, i) => { if (q.done && !q.claimed) claimQuest(s, k === 'weekly', i); })));
  if (s.shop) { if (!s.shop.offers[0].bought) buyOffer(s, 0, now); if (s.shop.recruit && !s.shop.recruit.bought && s.gems >= s.shop.recruit.price + 50) buyRecruit(s); }
  upgrades(); pickSquad();
  // spend spare coins on squad shard offers
  T('shop', () => { if (s.shop) s.shop.offers.forEach((o, i) => { if (o.kind === 'shards' && !o.bought && s.coins > o.price + reserve()) buyOffer(s, i, now); }); });
  // spend gems on gold chests if rich
  T('gemchest', () => { if (s.shop) s.shop.offers.forEach((o, i) => { if (o.kind === 'gemchest' && !o.bought && s.gems >= o.price + 400) buyOffer(s, i, now); }); });
}
function battle(now) {
  const a = arenaIndex(s.trophies), L = lvlAvg();
  let best = null, be = -1e9;
  for (const D of DIFFS) {
    const p = Math.max(0.03, Math.min(0.97, BASE[D.id] + SKILL + 0.12 * (L - foeLevel(a, D.id))));
    const e = p * D.win - (1 - p) * D.loss; if (e > be) { be = e; best = { D, p }; }
  }
  const setup = setupBattle(s, best.D.id, Math.floor(rnd() * 1e9));
  const win = rnd() < best.p;
  const res = { winner: win ? 0 : 1, score: win ? [3, rnd() < 0.3 ? 0 : 1] : [1, 3], rounds: 4, stats: { dmg: 6000 + a * 900, kills: win ? 14 : 9, abil: 30 }, flawless: win ? 1 : 0, syn3: rnd() < 0.3, captain: s.squad[0] };
  T('battle', () => finishBattle(s, setup, res, now));
  return best.D.id;
}
const marks = [1, 7, 30, 60, 90, 180, 270, 365, 545, 730, 910, 1095];
const diffCount = {};
for (let d = 0; d < DAYS; d++) {
  const day0 = start + d * 86400e3;
  housekeeping(day0);                 // morning check-in
  const ev = day0 + 11 * 3600e3;      // evening session
  housekeeping(ev);
  for (let b = 0; b < BATTLES; b++) { const t = ev + b * 4 * 60e3; const id = battle(t); diffCount[id] = (diffCount[id] || 0) + 1; housekeeping(t + 60e3); }
  if (d + 1 === 365) { console.log('YEAR1 shards by source', JSON.stringify(tally)); console.log('YEAR1 coins by source', JSON.stringify(coinTally)); }
  if (marks.includes(d + 1)) {
    const owned = Object.keys(s.heroes); const maxed = owned.filter(h => s.heroes[h].lvl >= MAX_LEVEL).length;
    const tot = owned.reduce((a, h) => a + s.heroes[h].lvl, 0);
    console.log(`day ${String(d + 1).padStart(4)} | trophies ${String(s.trophies).padStart(5)} best ${String(s.best).padStart(5)} | arena ${String(arenaIndex(s.trophies)).padStart(2)} ${ARENAS[arenaIndex(s.trophies)].name.padEnd(16)} | squad lvl ${lvlAvg().toFixed(1)} | owned ${owned.length}/20 maxed ${maxed} | roster lvls ${tot}/220 | coins ${s.coins} gems ${s.gems}`);
  }
}
console.log('difficulty choices:', JSON.stringify(diffCount));

// Rough progression pace: N matches a day, opens every chest it has keys for, unlocks abilities when possible
const load = require('./harness'); const G = load(['data.js', 'battle.js', 'progress.js']);
const [newSave, tick, finishBattle, setupBattle, openShelfChest, unlockAbility, claimRoad, ROAD, buyOffer, HEROES, HERO_ABILITIES, claimQuest, mul] =
  ['newSave', 'tick', 'finishBattle', 'setupBattle', 'openShelfChest', 'unlockAbility', 'claimRoad', 'ROAD', 'buyOffer', 'HEROES', 'HERO_ABILITIES', 'claimQuest', 'mulberry32'].map(G);
const PER_DAY = +process.argv[2] || 8, WINRATE = 0.6;
let now = Date.UTC(2026, 10, 21, 12); const s = newSave(now); const r = mul(9);
const report = [];
for (let day = 1; day <= 365; day++) {
  for (let m = 0; m < PER_DAY; m++) {
    now += 45 * 60e3; tick(s, now);
    const setup = setupBattle(s, 'normal', (day * 100 + m) >>> 0);
    const win = r() < WINRATE;
    finishBattle(s, setup, { winner: win ? 0 : 1, score: win ? [3, 1] : [1, 3], stats: { dmg: 90, kills: 8, abil: 5 }, flawless: 0, rounds: 4, captain: s.squad[0] }, now);
    while (s.keys > 0 && s.shelf.length) openShelfChest(s, 0, now);
    ROAD.forEach((st, i) => { if (s.best >= st.t && !s.road.includes(i)) claimRoad(s, i, now); });
    for (const q of (s.quests.daily || []).concat(s.quests.weekly || [])) { const list = s.quests.daily.includes(q) ? s.quests.daily : s.quests.weekly; claimQuest(s, list === s.quests.weekly, list.indexOf(q)); }
    for (const h in s.heroes) for (let k = 0; k < 3; k++) unlockAbility(s, h, k);
  }
  now += (24 - PER_DAY * 0.75) * 3600e3; tick(s, now);
  if (s.shop && !s.shop.offers[0].bought) buyOffer(s, 0, now);
  if ([1, 3, 7, 14, 30, 60, 90, 180, 365].includes(day)) {
    const owned = Object.keys(s.heroes).filter(h => s.heroes[h].tr >= 1).length;
    const abs = Object.values(s.heroes).reduce((a, o) => a + o.un.reduce((x, y) => x + y, 0), 0);
    const trs = Object.values(s.heroes).reduce((a, o) => a + o.tr, 0);
    report.push(`day ${String(day).padStart(3)}: trophies ${s.trophies} · heroes ${owned}/20 · hero trophies ${trs}/200 · abilities ${abs}/60 · coins ${s.coins} · gems ${s.gems} · keys ${s.keys} · shelf ${s.shelf.length}`);
  }
}
console.log(`${PER_DAY} matches/day, ${WINRATE * 100}% wins\n` + report.join('\n'));

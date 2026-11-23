const load = require('./harness');
const G = load(['data.js', 'battle.js']);
const simulateBattle = G('simulateBattle'), HEROES = G('HEROES'), mul = G('mulberry32');
const ids = HEROES.map(h => h.id);
function match(d0, d1, n, l0 = 5, l1 = 5) {
  let w = 0, l = 0, rounds = 0, relic = 0, games = 0, t0 = Date.now(); const r = mul(99);
  for (let i = 0; i < n; i++) {
    const a = ids.slice().sort(() => r() - 0.5).slice(0, 3), b = ids.slice().sort(() => r() - 0.5).slice(0, 3);
    const s = simulateBattle({ mySquad: a.map(h => ({ hid: h, lvl: l0 })), foeSquad: b.map(h => ({ hid: h, lvl: l1 })), seed: 900 + i }, d0, d1, i + 1);
    const s2 = simulateBattle({ mySquad: b.map(h => ({ hid: h, lvl: l1 })), foeSquad: a.map(h => ({ hid: h, lvl: l0 })), seed: 900 + i }, d1, d0, i + 1);
    if (s.winner === 0) w++; else if (s.winner === 1) l++;
    if (s2.winner === 1) w++; else if (s2.winner === 0) l++;
    for (const x of [s, s2]) { rounds += x.round; games++; if (x.winBy === 'relic') relic++; }
  }
  console.log(`${d0} L${l0} vs ${d1} L${l1}: ${w}-${l} | rounds ${(rounds / games).toFixed(1)} | relic ${relic}/${games} | ${((Date.now() - t0) / games).toFixed(0)}ms/game`);
}
const N = +process.argv[2] || 20;
match('easy', 'normal', N); match('normal', 'hard', N); match('hard', 'expert', N); match('easy', 'expert', N);
match('normal', 'normal', N, 5, 6); match('normal', 'normal', N, 5, 7);

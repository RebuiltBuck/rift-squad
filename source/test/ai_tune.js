const load = require('./harness');
const G = load(['data.js', 'battle.js']);
const simulateBattle = G('simulateBattle'), HEROES = G('HEROES'), AI_CFG = G('AI_CFG'), mul = G('mulberry32');
const ids = HEROES.map(h => h.id);
function match(d0, d1, n) {
  let w = 0, l = 0; const r = mul(7);
  for (let i = 0; i < n; i++) {
    const a = ids.slice().sort(() => r() - 0.5).slice(0, 3), b = ids.slice().sort(() => r() - 0.5).slice(0, 3);
    for (const flip of [false, true]) {
      const A = flip ? b : a, B = flip ? a : b;
      const s = simulateBattle({ mySquad: A.map(h => ({ hid: h, lvl: 5 })), foeSquad: B.map(h => ({ hid: h, lvl: 5 })), seed: 500 + i }, d0, d1, i + 1);
      if (s.winner === 0) w++; else if (s.winner === 1) l++;
      // mirrored: same squads, swap who's who
      const s2 = simulateBattle({ mySquad: A.map(h => ({ hid: h, lvl: 5 })), foeSquad: B.map(h => ({ hid: h, lvl: 5 })), seed: 500 + i }, d1, d0, i + 1);
      if (s2.winner === 1) w++; else if (s2.winner === 0) l++;
    }
  }
  return `${w}-${l}`;
}
const N = +process.argv[2] || 25;
const variants = {
  hardA: { rand: 0, noise: 2, threat: 1.0, orders: 2 },
  exp_t1_o6: { rand: 0, noise: 0, threat: 1.0, orders: 6 },
  exp_t125_o6: { rand: 0, noise: 0, threat: 1.25, orders: 6 },
  exp_t08_o6: { rand: 0, noise: 0, threat: 0.8, orders: 6 },
  exp_t1_o2: { rand: 0, noise: 0, threat: 1.0, orders: 2 },
  exp_t06_o6: { rand: 0, noise: 0, threat: 0.6, orders: 6 },
};
for (const k in variants) AI_CFG[k] = variants[k];
for (const k of ['exp_t1_o6', 'exp_t125_o6', 'exp_t08_o6', 'exp_t1_o2', 'exp_t06_o6']) console.log(k, 'vs hardA:', match(k, 'hardA', N));
console.log('normal vs hardA:', match('normal', 'hardA', N));

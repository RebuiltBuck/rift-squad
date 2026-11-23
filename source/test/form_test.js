const load = require('./harness');
const G = load(['data.js', 'battle.js']);
const [simulateRound, roleFormation, randomFormation, HEROES, EVENT_IDS, mul, HERO] = ['simulateRound', 'roleFormation', 'randomFormation', 'HEROES', 'EVENT_IDS', 'mulberry32', 'HERO'].map(G);
const ids = HEROES.map(h => h.id); const r = mul(99);
const sq = a => a.map(h => ({ hid: h, lvl: 5 }));
function test(name, fA, fB, N = 1500) {
  let w = 0, l = 0;
  for (let i = 0; i < N; i++) {
    const A = sq(ids.slice().sort(() => r() - 0.5).slice(0, 5)), B = sq(ids.slice().sort(() => r() - 0.5).slice(0, 5));
    for (const flip of [0, 1]) {
      const X = flip ? B : A, Y = flip ? A : B;
      const s = simulateRound({ sides: [{ units: fA(X, 0), captain: X[0].hid }, { units: fB(Y, 1), captain: Y[0].hid }], event: EVENT_IDS[i % 7], variant: i % 2, seed: i * 3 + flip });
      if (s.winner === 0) w++; else if (s.winner === 1) l++;
    }
  }
  console.log(name.padEnd(34), w, '-', l, ((w / (w + l)) * 100).toFixed(1) + '%');
}
const role = (q, side) => roleFormation(q, side, r, true);
const rand = (q, side) => randomFormation(q, side, r);
const allFront = (q, side) => q.map((h, i) => ({ hid: h.hid, lvl: h.lvl, x: i, y: side === 0 ? 5 : 4 }));
const allBack = (q, side) => q.map((h, i) => ({ hid: h.hid, lvl: h.lvl, x: i, y: side === 0 ? 9 : 0 }));
// ranged front, melee back (inverse)
const inverse = (q, side) => G('sloppyFormation')(q, side, mul(7));
test('role vs random', role, rand);
test('allFront vs role', allFront, role);
test('allBack vs role', allBack, role);
test('inverse vs role', inverse, role);
const RD = G('ROLE_DEPTH');
const deeper = (q, side) => { const save = { ...RD }; Object.assign(RD, { tank: 2, fighter: 2, assassin: 3, ranged: 4, control: 4, support: 4 }); const f = roleFormation(q, side, r, true); Object.assign(RD, save); return f; };
const mid = (q, side) => { const save = { ...RD }; Object.assign(RD, { tank: 1, fighter: 1, assassin: 2, ranged: 3, control: 3, support: 4 }); const f = roleFormation(q, side, r, true); Object.assign(RD, save); return f; };
test('deeper vs allBack', deeper, allBack);
test('mid vs allBack', mid, allBack);
test('deeper vs role', deeper, role);

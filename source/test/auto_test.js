const load = require('./harness');
const G = load(['data.js', 'battle.js']);
const [simulateRound, simulateMatch, aiLineup, roleFormation, HEROES, EVENT_IDS, mul] = ['simulateRound', 'simulateMatch', 'aiLineup', 'roleFormation', 'HEROES', 'EVENT_IDS', 'mulberry32'].map(G);
const ids = HEROES.map(h => h.id);
const r = mul(1234);
const pick5 = () => ids.slice().sort(() => r() - 0.5).slice(0, 5);
const CAPS = HEROES.filter(h => h.captain).map(h => h.id), REGS = HEROES.filter(h => !h.captain).map(h => h.id);
const pick6 = () => [CAPS[Math.floor(r() * CAPS.length)]].concat(REGS.slice().sort(() => r() - 0.5).slice(0, 5));
const sq = (a, l) => a.map(h => ({ hid: h, lvl: l || 5 }));
const mode = process.argv[2] || 'rounds';
if (mode === 'rounds') {
  // round length + outcome mix with role formations
  let tsum = 0, n = 0, time = 0, draws = 0, t0 = Date.now(); const lens = [];
  for (let i = 0; i < 300; i++) {
    const A = sq(pick5()), B = sq(pick5()); const ev = EVENT_IDS[i % EVENT_IDS.length];
    const L0 = { units: roleFormation(A, 0, r, true), captain: A[0].hid }, L1 = { units: roleFormation(B, 1, r, true), captain: B[0].hid };
    const s = simulateRound({ sides: [L0, L1], event: ev, variant: i % 2, seed: i + 1 });
    tsum += s.t; n++; lens.push(s.t); if (s.winBy === 'time') time++; if (s.winner === 'draw') draws++;
  }
  lens.sort((a, b) => a - b);
  console.log(`rounds: avg ${(tsum / n).toFixed(1)}s, median ${lens[n >> 1].toFixed(1)}s, p10 ${lens[n / 10 | 0].toFixed(1)} p90 ${lens[n * 0.9 | 0].toFixed(1)} | timeouts ${time} draws ${draws} | ${((Date.now() - t0) / n).toFixed(1)}ms/round`);
}
if (mode === 'heroes') {
  // per-hero win rate in random 5v5 role-formation rounds (same level)
  const W = {}, P = {}; const N = +process.argv[3] || 3000;
  for (let i = 0; i < N; i++) {
    const A = pick6().slice(0, 5), B = pick6().slice(0, 5); const ev = EVENT_IDS[i % EVENT_IDS.length];
    const L0 = { units: roleFormation(sq(A), 0, r, true), captain: A[0] }, L1 = { units: roleFormation(sq(B), 1, r, true), captain: B[0] };
    const s = simulateRound({ sides: [L0, L1], event: ev, variant: i % 2, seed: i + 7 });
    if (s.winner === 'draw') continue;
    for (const h of A) { P[h] = (P[h] || 0) + 1; if (s.winner === 0) W[h] = (W[h] || 0) + 1; }
    for (const h of B) { P[h] = (P[h] || 0) + 1; if (s.winner === 1) W[h] = (W[h] || 0) + 1; }
  }
  const rows = ids.map(h => [h, (W[h] || 0) / P[h]]).sort((a, b) => b[1] - a[1]);
  console.log(rows.map(([h, w]) => `${h.padEnd(7)} ${(w * 100).toFixed(1)}%`).join('\n'));
}
if (mode === 'ladder') {
  const N = +process.argv[3] || 30;
  function match(d0, d1, l0 = 5, l1 = 5) {
    let w = 0, l = 0, rounds = 0, t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const A = sq(pick6(), l0), B = sq(pick6(), l1); const ctx = { event: EVENT_IDS[i % EVENT_IDS.length], variant: i % 2 };
      const m1 = simulateMatch(A, B, d0, d1, ctx, 1000 + i), m2 = simulateMatch(B.map(x => ({ ...x, lvl: l0 })), A.map(x => ({ ...x, lvl: l1 })), d0, d1, ctx, 2000 + i);
      for (const m of [m1, m2]) { if (m.winner === 0) w++; else if (m.winner === 1) l++; rounds += m.rounds; }
    }
    console.log(`${d0} L${l0} vs ${d1} L${l1}: ${w}-${l} | avg rounds ${(rounds / (2 * N)).toFixed(1)} | ${((Date.now() - t0) / (2 * N)).toFixed(0)}ms/match`);
  }
  match('easy', 'normal'); match('normal', 'hard'); match('hard', 'expert'); match('normal', 'expert');
  match('normal', 'normal', 5, 6); match('normal', 'normal', 5, 7);
}

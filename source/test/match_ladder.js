// AI difficulty ladder for the auto-battler: each pairing plays mirrored matches
const load = require('./harness'); const G = load(['data.js', 'battle.js']);
const simulateMatch = G('simulateMatch'), HEROES = G('HEROES'), mul = G('mulberry32'), CAP = G('CAPTAIN_IDS');
const regs = HEROES.filter(h => !h.captain).map(h => h.id);
function deck(r, lvl) { const c = CAP[Math.floor(r() * CAP.length)]; return [c, ...regs.slice().sort(() => r() - 0.5).slice(0, 5)].map(h => ({ hid: h, lvl })); }
function pair(d0, d1, n, l0 = 5, l1 = 5) {
  let w = 0, l = 0, rounds = 0; const r = mul(7); const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const a = deck(r, l0), b = deck(r, l1), ctx = { event: ['clear', 'lava', 'springs', 'rocks'][i % 4], variant: i % 2 };
    const m1 = simulateMatch(a, b, d0, d1, ctx, 100 + i), m2 = simulateMatch(b, a, d1, d0, ctx, 100 + i);
    if (m1.winner === 0) w++; else if (m1.winner === 1) l++;
    if (m2.winner === 1) w++; else if (m2.winner === 0) l++;
    rounds += m1.rounds + m2.rounds;
  }
  console.log(`${d0} L${l0} vs ${d1} L${l1}: ${w}-${l} | ${(rounds / n / 2).toFixed(1)} rounds/match | ${((Date.now() - t0) / n / 2).toFixed(0)}ms/match`);
}
const N = +process.argv[2] || 30;
pair('easy', 'normal', N); pair('normal', 'hard', N); pair('hard', 'expert', N); pair('normal', 'normal', N, 5, 7);

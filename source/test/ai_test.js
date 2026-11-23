const load = require('./harness');
const G = load(['data.js', 'battle.js']);
const simulateBattle = G('simulateBattle'), HEROES = G('HEROES');
const diffs = ['easy', 'normal', 'hard', 'expert'];
const ids = HEROES.map(h => h.id);
function rsq(r) { const a = ids.slice().sort(() => r() - 0.5).slice(0, 3); return a; }
const mul = G('mulberry32');
function match(d0, d1, n, lvl0 = 5, lvl1 = 5) {
  let w = 0, l = 0, dr = 0, rounds = 0, relic = 0, t0 = Date.now(); const r = mul(42);
  for (let i = 0; i < n; i++) {
    const a = rsq(r), b = rsq(r);
    // alternate sides to remove first-move bias
    const flip = i % 2 === 1;
    const opts = { mySquad: (flip ? b : a).map(h => ({ hid: h, lvl: flip ? lvl1 : lvl0 })), foeSquad: (flip ? a : b).map(h => ({ hid: h, lvl: flip ? lvl0 : lvl1 })), seed: 1000 + i };
    const s = simulateBattle(opts, flip ? d1 : d0, flip ? d0 : d1, i + 1);
    const me = flip ? 1 : 0;
    if (s.winner === me) w++; else if (s.winner === 'draw') dr++; else l++;
    rounds += s.round; if (s.winBy === 'relic') relic++;
  }
  console.log(`${d0}(L${lvl0}) vs ${d1}(L${lvl1}): W ${w} L ${l} D ${dr} | avg rounds ${(rounds / n).toFixed(1)} | relic wins ${relic} | ${((Date.now() - t0) / n).toFixed(0)} ms/battle`);
}
const N = +process.argv[2] || 40;
match('easy', 'normal', N); match('normal', 'hard', N); match('hard', 'expert', N); match('easy', 'expert', N);
match('expert', 'expert', N);
match('hard', 'hard', N, 5, 6);

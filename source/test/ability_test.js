// Every ability: does it fire, and does it do something? Runs random 5v5 rounds with the ability on one hero.
const load = require('./harness'); const G = load(['data.js', 'battle.js']);
const [newRound, step, roleFormation, mul, HEROES, HA, ABIL] = ['newRound', 'step', 'roleFormation', 'mulberry32', 'HEROES', 'HERO_ABILITIES', 'ABILITIES'].map(G);
const ids = HEROES.map(h => h.id); let bad = 0; const rows = []; let tot = 0, totT = 0;
for (const hid of ids) for (const ab of HA[hid]) {
  let casts = 0, caps = 0, err = 0, wins = 0, n = 0, sampleCap = '';
  for (let i = 0; i < 40; i++) {
    const r = mul(i * 31 + ab.length); const pick = (ex) => ids.filter(x => x !== ex).sort(() => r() - 0.5).slice(0, 4);
    const randAb = h => { const l = HA[h]; return r() < 0.8 ? l[Math.floor(r() * 3)] : null; };
    const mine = [{ hid, ab }].concat(pick(hid).map(h => ({ hid: h, ab: randAb(h) })));
    const foe = pick(hid).concat([ids[Math.floor(r() * ids.length)]]).slice(0, 5).map(h => ({ hid: h, ab: randAb(h) }));
    try {
      const s = newRound({ sides: [{ units: roleFormation(mine, 0, r, true), captain: 'bruno' }, { units: roleFormation(foe, 1, r, true), captain: 'rocco' }], event: ['clear', 'rocks', 'lava'][i % 3], seed: i + 1 });
      const me = s.units.find(u => u.side === 0 && u.hid === hid).uid;
      for (let k = 0; k < 2000 && s.winner == null; k++) { const ev = []; step(s, ev); for (const e of ev) { if (e.uid === me && e.t === 'cast') casts++; if (e.uid === me && e.t === 'cap') { caps++; if (!sampleCap || Math.random() < 0.05) sampleCap = e.msg; } } }
      if (s.winner === 0) wins++; n++; tot++; totT += s.t;
    } catch (e) { err++; if (err === 1) console.log(hid, ab, e.stack.split('\n').slice(0, 3).join(' | ')); }
  }
  const kind = ABIL[ab].kind; const ok = !err && (kind === 'passive' ? caps > 0 || ['poison', 'lifedrain'].includes(ab) : casts > 0);
  if (!ok) bad++;
  rows.push(`${ok ? 'ok ' : 'BAD'} ${hid.padEnd(6)} ${ab.padEnd(10)} ${kind.padEnd(7)} casts/round ${(casts / n).toFixed(2).padStart(5)} caps ${(caps / n).toFixed(2).padStart(5)}  win ${Math.round(wins / n * 100)}%  e.g. "${sampleCap}"`);
}
console.log(rows.join('\n'));
console.log(`\n${bad} problems · avg round ${(totT / tot).toFixed(1)}s`);

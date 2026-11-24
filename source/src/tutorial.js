// ===== Rift Squad: first-time tutorial =====
// One guided practice match. Sir Bruno explains things in a speech bubble; some steps wait for the player to do something.
let TUT = null; // { waits: [], first }

function tutHook(ev, data) {
  if (!TUT) return;
  const keep = [];
  for (const w of TUT.waits) { if (w.ev === ev && (!w.pred || w.pred(data))) w.res(data); else keep.push(w); }
  TUT.waits = keep;
}
function tutWait(ev, pred) { return new Promise(res => { if (TUT) TUT.waits.push({ ev, pred, res }); }); }
const tutSleep = ms => new Promise(r => setTimeout(r, ms));

// speech bubble. opts: { next: 'label', wait: Promise, auto: ms, pos: 'top'|'home' }
function coach(html, opts) {
  opts = opts || {};
  let el = $('#coach');
  if (!el) {
    el = document.createElement('div'); el.id = 'coach';
    el.innerHTML = `<div class="cface">${liveHero('bruno', 2.5)}</div><div class="cbody"><div class="ctext"></div><div class="cbtns"><a href="#" class="cskip">Skip tutorial</a><button class="btn sm gold cnext"></button></div></div>`;
    document.body.appendChild(el);
    $('.cskip', el).onclick = e => { e.preventDefault(); tutSkip(); };
  }
  el.className = 'coach ' + (opts.pos || 'top');
  const tx = $('.ctext', el); tx.innerHTML = html; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  liveHop($('canvas', el)); tone(520, 0.05, 'square', 0.025); tone(780, 0.06, 'square', 0.02, null, 0.05);
  const nb = $('.cnext', el); nb.classList.toggle('hidden', !opts.next); nb.textContent = opts.next || '';
  $('.cskip', el).classList.toggle('hidden', !!opts.noSkip);
  const done = [];
  if (opts.next) done.push(new Promise(r => { nb.onclick = () => { SFX.tap(); r(); }; }));
  if (opts.wait) done.push(opts.wait);
  if (opts.auto) done.push(tutSleep(opts.auto));
  return done.length ? Promise.race(done) : Promise.resolve();
}
function coachHide() { const el = $('#coach'); if (el) el.remove(); document.body.dataset.tut = ''; if (M) M.mark = null; }
function tutGlow(what) { document.body.dataset.tut = what || ''; }
function tutMark(m) { if (M) M.mark = m; }
const tutUid = hid => { const u = M && M.rs && M.rs.units.find(q => q.side === 0 && q.hid === hid && q.alive); return u ? u.uid : null; };

function tutSkip() {
  confirmBox('Skip the tutorial? You can play it again from Settings.', 'Skip', () => {
    const t = TUT; TUT = null; coachHide();
    if (M && M.setup.tut) { M.tutSkipped = true; finishMatch(true); }
    else { finishTutorial(S); persist(); render(); }
    if (t) t.waits = [];
  }, 'gold');
}

async function runTutorial() {
  if (M || TUT) return;
  TUT = { waits: [], first: !S.tutorialDone };
  const alive = () => !!TUT;
  startTutorialMatch();

  // ---- round 1: placement, targeting, abilities ----
  await tutWait('setup');
  if (!alive()) return;
  await coach(`This is your half. The <b>faded hero</b> on top is the enemy captain. The rest of their team stays hidden until the fight.`, { next: 'Next' });
  if (!alive()) return;
  if (GRID_MODE) {
    await coach(`${icon('i_tnear', 'ii')} Heroes step <b>one tile at a time</b>, never diagonally, and can't walk through anyone. They always hit the <b>closest</b> enemy.`, { next: 'Next' });
  } else {
    tutMark({ uid: tutUid('gus') });
    await coach(`Every hero picks a target its own way. <b>Tap Gus</b> to see how he picks.`, { wait: tutWait('sel', uid => { const u = byUid(M.rs, uid); return u && u.hid === 'gus'; }) });
    if (!alive()) return;
    await coach(`${icon('i_tback', 'ii')} Gus hits the <b>back line</b>: he runs past the front row to reach enemies at the back. Most heroes just hit the <b>closest</b> enemy.`, { next: 'Next' });
  }
  if (!alive()) return;
  tutMark({ uid: tutUid('bruno') });
  await coach(`${icon('i_taunt', 'ii')} Sir Bruno knows <b>Taunt</b>. When his purple bar fills up, <b>every enemy</b> has to attack him for 3 seconds.`, { next: 'Next' });
  if (!alive()) return;
  tutMark({ uid: tutUid('zip') }); tutGlow('fight');
  await coach(`${icon('i_laser', 'ii')} Zip's <b>Laser</b> fires straight up his lane the moment the fight starts. <b>Drag</b> heroes to move them, then tap <b>FIGHT!</b>`, { wait: tutWait('fight') });
  if (!alive()) return;
  tutMark(null); tutGlow('');

  // ---- the fight ----
  coach(`Green bar = health, purple bar = ability charging. <b>Tap any hero</b> to see who it's going after.`, { auto: 4500 });
  const r1 = await Promise.race([tutWait('taunt', e => e.uid && e.uid[0] === 'p'), tutWait('roundOver').then(() => null)]);
  if (!alive()) return;
  if (r1) {
    const n = r1.tuids.length;
    coach(`${icon('i_taunt', 'ii')} <b>Taunt!</b> ${n > 1 ? `All ${n} enemies have to attack Bruno now` : 'The enemy has to attack Bruno now'}, so his friends get free hits.`, { auto: 4000 });
    await tutWait('roundOver');
  }
  if (!alive()) return;

  // ---- round 2: Rift Orbs and the faded enemies ----
  await tutWait('setup');
  if (!alive()) return;
  tutGlow('bench');
  await coach(`You get <b>1 more Rift Orb</b> every round. Each hero costs the blue orbs on its card. <b>Tap a hero on the bench</b> to bring it in!`, { wait: tutWait('benchAdd'), noSkip: true });
  if (!alive()) return;
  tutGlow('');
  const gh = M.prev && M.prev[1] && M.prev[1].units[0];
  if (gh) tutMark({ x: gh.x, y: gh.y }); tutGlow('fight');
  await coach(`<b>Faded red heroes</b> show where the enemy stood last round. Line Zip's laser up with one, then <b>FIGHT!</b>`, { wait: tutWait('fight') });
  if (!alive()) return;
  tutMark(null); tutGlow('');
  coach(`Win ${M.setup.toWin} rounds to win the match.`, { auto: 3000 });

  // ---- results ----
  const res = await tutWait('matchDone');
  if (!alive()) return;
  if (res && res.fled) { TUT = null; coachHide(); return; }
  await coach(res && res.win ? `You won! In real matches, every win puts a <b>chest</b> on your shelf.` : `Close one! In real matches, every win puts a <b>chest</b> on your shelf.`, { wait: tutWait('home'), noSkip: true });
  if (!alive()) return;

  // ---- open a chest ----
  if (TUT.first && S.keys > 0 && S.shelf.length) {
    const sh = $('.shelf'); if (sh) sh.scrollIntoView({ block: 'center', behavior: 'smooth' });
    tutGlow('shelf');
    await coach(`Chests open with ${icon('i_key', 'ii')} <b>keys</b>. You get a new key every 5 hours. <b>Tap a chest</b> to open it!`, { wait: tutWait('chestDone'), pos: 'athome' });
    if (!alive()) return;
    tutGlow('');
  }
  await coach(`${icon('i_htrophy', 'ii')} <b>Hero trophies</b> unlock new heroes and abilities. Equip abilities in the <b>Heroes</b> tab. Good luck out there!`, { next: "Let's go", pos: 'athome', noSkip: true });
  TUT = null; coachHide();
  const sc = $('#screen'); if (sc) sc.scrollTop = 0;
}

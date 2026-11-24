// ===== Rift Squad: UI + game flow =====
const STORE_NS = BUILD === 'test' ? 'riftsquad.test' : 'riftsquad';
const STORE = STORE_NS + '.save.v1', STORE_BAK = STORE_NS + '.save.bak', STORE_BATTLE = STORE_NS + '.battle.v1';
let S = null; let TAB = 'battle';
const $ = (q, el) => (el || document).querySelector(q);
const fmt = n => Math.round(n).toLocaleString('en-US');
function fmtK(n) { return n >= 1e6 ? (Math.floor(n / 1e5) / 10).toFixed(1) + 'M' : n >= 1e4 ? (Math.floor(n / 100) / 10).toFixed(1) + 'k' : fmt(n); }
function fmtDur(ms) {
  ms = Math.max(0, ms); const s = Math.ceil(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return d + 'd ' + h + 'h'; if (h) return h + 'h ' + m + 'm'; if (m) return m + 'm ' + (s % 60) + 's'; return (s % 60) + 's';
}
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function now() { return Date.now() + (BUILD === 'test' && S && S.testOffset ? S.testOffset : 0); }

// ---------- storage ----------
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
let memSave = null;
function persist() {
  const json = JSON.stringify(S); memSave = json;
  lsSet(STORE, json);
  const bak = lsGet(STORE_BAK + '.day');
  if (bak !== dayKey(now())) { lsSet(STORE_BAK, json); lsSet(STORE_BAK + '.day', dayKey(now())); }
}
function loadSave() {
  let raw = lsGet(STORE) || memSave;
  if (raw) { try { return migrate(JSON.parse(raw)); } catch (e) { const b = lsGet(STORE_BAK); if (b) try { return migrate(JSON.parse(b)); } catch (e2) { } } }
  return null;
}

// ---------- sound ----------
let AC = null;
function tone(f, d, type, vol, f2, delay) {
  if (!S || !S.settings.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) { }
}
const SFX = {
  tap: () => tone(700, 0.05, 'square', 0.03),
  step: () => tone(300, 0.04, 'triangle', 0.04),
  hit: () => { tone(180, 0.09, 'sawtooth', 0.06, 70); },
  crit: () => { tone(260, 0.12, 'sawtooth', 0.07, 60); tone(900, 0.06, 'square', 0.03); },
  heal: () => { tone(520, 0.12, 'sine', 0.06, 1040); },
  die: () => tone(240, 0.35, 'square', 0.05, 50),
  cast: () => { tone(400, 0.1, 'triangle', 0.05, 900); },
  relic: () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.15, 'triangle', 0.05, null, i * 0.08)); },
  coin: () => { tone(1320, 0.06, 'square', 0.03); tone(1760, 0.08, 'square', 0.03, null, 0.06); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'square', 0.04, null, i * 0.12)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.05, null, i * 0.15)); },
  fanfare: () => { [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32], [784, 0.5], [1046, 0.6]].forEach(([f, d]) => tone(f, d >= 0.6 ? 0.5 : 0.14, 'square', 0.045, null, d)); [262, 330, 392].forEach(f => tone(f, 0.6, 'triangle', 0.05, null, 0.6)); },
  defeat: () => { [[392, 0], [370, 0.18], [349, 0.36], [262, 0.6]].forEach(([f, d]) => tone(f, d >= 0.6 ? 0.7 : 0.18, 'triangle', 0.06, d >= 0.6 ? 180 : null, d)); tone(70, 0.5, 'sawtooth', 0.05, 40, 0.38); },
  chest: () => { tone(200, 0.2, 'sawtooth', 0.05, 600); [784, 988, 1318].forEach((f, i) => tone(f, 0.15, 'square', 0.035, null, 0.2 + i * 0.08)); },
};
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

// ---------- toasts & modals ----------
function toast(msg) { const d = document.createElement('div'); d.innerHTML = msg; $('#toast').appendChild(d); setTimeout(() => d.remove(), 2200); }
function modal(html, opts) {
  opts = opts || {};
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${opts.noClose ? '' : `<button class="x" data-close>${icon('i_x','ii')}</button>`}${html}</div>`;
  $('#modal-root').appendChild(bg);
  const close = () => { if (opts.beforeClose) opts.beforeClose(bg); bg.remove(); if (opts.onClose) opts.onClose(); };
  bg.addEventListener('click', e => { if (e.target === bg && !opts.noClose) close(); if (e.target.closest('[data-close]')) close(); });
  bg.close = close; return bg;
}
function confirmBox(text, yes, onYes, cls) {
  const m = modal(`<p class="center" style="font-size:21px">${text}</p><div class="row" style="justify-content:center;gap:10px;margin-top:12px"><button class="btn gray" data-close>Cancel</button><button class="btn ${cls || 'red'}" id="cf-yes">${yes}</button></div>`);
  $('#cf-yes', m).onclick = () => { m.close(); onYes(); };
}

// ---------- rewards display ----------
function rewardTiles(r) {
  const out = []; let i = 0; const d = () => `style="animation-delay:${(i++) * 0.12}s"`;
  for (const h of (r.newHeroes || [])) out.push(`<div class="rw new" ${d()}>${heroImg(h, '')}<span>NEW HERO!</span><small>${esc(HERO[h].name)}</small></div>`);
  if (r.wild) out.push(`<div class="rw new wildrw" ${d()}>${icon('i_wild')}<span>+${r.wild} Wild</span><small>any hero</small></div>`);
  for (const h in (r.trophies || {})) if (!(r.newHeroes || []).includes(h) || r.trophies[h] > 1) out.push(`<div class="rw" ${d()}>${heroImg(h, '')}<span>Lv ${heroTr(S, h)}</span><small>${esc(HERO[h].name)} ${heroTr(S, h)}/10</small></div>`);
  if (r.coins) out.push(`<div class="rw" data-res="coins" ${d()}>${icon('coin')}<span>+${fmt(r.coins)}</span><small>coins</small></div>`);
  if (r.gems) out.push(`<div class="rw" data-res="gems" ${d()}>${icon('gem')}<span>+${fmt(r.gems)}</span><small>gems</small></div>`);
  if (r.keys) out.push(`<div class="rw" ${d()}>${icon('i_key')}<span>+${fmt(r.keys)}</span><small>key${r.keys > 1 ? 's' : ''}</small></div>`);
  if (r.xp) out.push(`<div class="rw" ${d()}>${icon('star')}<span>+${fmt(r.xp)}</span><small>season XP</small></div>`);
  if (!out.length) out.push('<div class="mute">Nothing this time</div>');
  const unlockable = Object.keys(r.trophies || {}).filter(h => heroClaimable(S, h) > 0);
  return `<div class="rewards">${out.join('')}</div>${unlockable.length ? `<p class="center small" style="color:var(--green)">${icon('i_up', 'ii')} New hero road rewards: ${unlockable.map(h => esc(HERO[h].name)).join(', ')}</p>` : ''}`;
}
function showRewards(title, r, sub) {
  SFX.coin(); const g = { coins: r.coins || 0, gems: r.gems || 0 }; holdRes(g);
  modal(`<h2>${title}</h2>${sub ? `<p class="center mute small">${sub}</p>` : ''}${rewardTiles(r)}<button class="btn gold full" data-close>Nice!</button>`, { beforeClose: m => flood(g, m) });
}
// ===== resource flood: reward icons burst out and pour into the top-bar counters, which count up as they land =====
const FLY = { hold: { coins: 0, gems: 0, trophies: 0 }, t: 0, tick: 0 };
const FLY_TO = { coins: ['r-coin', 'coin'], gems: ['r-gem', 'gem'], trophies: ['r-tro', 'trophy'] };
function shownRes(k) { return Math.max(0, S[k] - (FLY.hold[k] || 0)); }
function topCounts() { $('#r-tro').textContent = fmt(shownRes('trophies')); $('#r-coin').textContent = fmtK(shownRes('coins')); $('#r-gem').textContent = fmt(shownRes('gems')); }
// keep freshly earned amounts off the counters until their icons arrive (with a safety release)
function holdRes(g) { for (const k in FLY.hold) if (g[k] > 0) FLY.hold[k] += g[k]; clearTimeout(FLY.t); FLY.t = setTimeout(() => { for (const k in FLY.hold) FLY.hold[k] = 0; topCounts(); }, 12000); topCounts(); }
function resSnap() { return { coins: S.coins, gems: S.gems, trophies: S.trophies }; }
function gainsSince(b) { const g = {}; for (const k in b) g[k] = Math.max(0, S[k] - b[k]); return g; }
function releaseRes(k, n) { FLY.hold[k] = Math.max(0, (FLY.hold[k] || 0) - n); topCounts(); }
// from: an element (its [data-res=...] tiles are used when present) or a rect
function flood(g, from) {
  const rectOf = k => { const t = from && from.querySelector && from.querySelector(`[data-res="${k}"]`); const el = t || from; const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : el; return r && r.width ? r : { left: innerWidth / 2 - 20, top: innerHeight / 2 - 20, width: 40, height: 40 }; };
  let lag = 0;
  for (const k of ['coins', 'gems', 'trophies']) {
    const amt = Math.round(g[k] || 0); if (amt <= 0) continue;
    const src = rectOf(k), tgtEl = document.getElementById(FLY_TO[k][0]), box = tgtEl && tgtEl.parentElement;
    const tr = box && box.getBoundingClientRect(); if (!tr || !tr.width || !$('#battle').classList.contains('hidden')) { releaseRes(k, amt); continue; }
    const n = Math.max(5, Math.min(16, Math.round(4 + Math.log2(amt + 1) * 1.4))), img = sprURL(FLY_TO[k][1]);
    const sx = src.left + src.width / 2, sy = src.top + src.height / 2, tx = tr.left + 16, ty = tr.top + tr.height / 2;
    let left = amt;
    for (let i = 0; i < n; i++) {
      const share = i === n - 1 ? left : Math.floor(amt / n); left -= share;
      const p = document.createElement('img'); p.className = 'flyc px'; p.src = img; p.style.left = (sx - 13) + 'px'; p.style.top = (sy - 13) + 'px'; document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 46, bx = Math.cos(a) * d, by = Math.sin(a) * d - 14, ex = tx - sx, ey = ty - sy;
      const t0 = lag + i * 45;
      const anim = p.animate([
        { transform: 'translate(0,0) scale(.3)', opacity: 0 },
        { transform: `translate(${bx}px,${by}px) scale(1.25)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${bx}px,${by}px) scale(1.1)`, opacity: 1, offset: 0.42, easing: 'cubic-bezier(.55,0,.85,.45)' },
        { transform: `translate(${ex}px,${ey}px) scale(.75)`, opacity: 1 }], { duration: 820, delay: t0, fill: 'both' });
      anim.onfinish = () => {
        p.remove(); releaseRes(k, share);
        box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
        const now2 = performance.now(); if (now2 - FLY.tick > 55) { FLY.tick = now2; tone(k === 'gems' ? 1320 : k === 'trophies' ? 880 : 1046 + Math.random() * 120, 0.04, 'square', 0.025); }
        if (left === 0 && i === n - 1) buzz(12);
      };
    }
    lag += 160;
  }
}
function rewardSpecLabel(st) {
  if (st.kind === 'coins') return { ic: sprURL('coin'), txt: fmt(st.n) + ' coins' };
  if (st.kind === 'gems') return { ic: sprURL('gem'), txt: st.n + ' gems' };
  if (st.kind === 'keys') return { ic: sprURL('i_key'), txt: st.n + ' key' + (st.n > 1 ? 's' : '') };
  if (st.kind === 'trophy') return { ic: sprURL('i_htrophy'), txt: st.n + ' hero troph' + (st.n > 1 ? 'ies' : 'y') };
  if (st.kind === 'chest') return { ic: chestURL(st.chest), txt: CHESTS[st.chest].name };
  if (st.kind === 'hero') return { ic: sprURL(st.hid), txt: HERO[st.hid].name };
  return { ic: sprURL('star'), txt: '?' };
}
// ---------- top bar & tabs ----------
let ACH_QUIET = true;
function renderTop() {
  const fresh = checkAchievements(S);
  if (fresh.length) {
    persist();
    if (!ACH_QUIET) { if (fresh.length > 2) toast(`${icon('i_medal', 'ii')} ${fresh.length} achievements unlocked!`); else fresh.forEach(a => toast(`${icon('i_medal', 'ii')} Achievement: <b>${esc(a.name)}</b>`)); SFX.relic(); }
  }
  $('#i-prof').src = sprURL(S.squad[0]);
  const pb = $('#prof .badge'), an = achClaimable(S); if (an) { pb.textContent = an; pb.classList.remove('hidden'); } else pb.classList.add('hidden');
  topCounts();
  const heroN = ownedIds(S).reduce((n, h) => n + heroClaimable(S, h), 0) + (S.wild || 0);
  const seasonN = questsClaimable(S) + Math.max(0, seasonTier(S) - S.season.claimed.length) + (seasonBonus(S) > 0 ? 1 : 0);
  const roadN = roadClaimableCount(S);
  const shopN = S.shop && !S.shop.offers[0].bought ? 1 : 0;
  const readyN = Math.min(S.keys, S.shelf.length);
  const set = (id, n) => { const b = $(`#tabs [data-tab=${id}] .badge`); if (n > 0) { b.textContent = n; b.classList.remove('hidden'); } else b.classList.add('hidden'); };
  set('heroes', heroN); set('season', seasonN); set('road', roadN); set('shop', shopN); set('battle', readyN);
}
// the five main tabs, left to right (swipe between them)
const TAB_ORDER = ['shop', 'heroes', 'battle', 'season', 'road'];
function go(tab, from) {
  const a = TAB_ORDER.indexOf(TAB), b = TAB_ORDER.indexOf(tab), dir = from != null ? from : b > a ? 1 : b < a ? -1 : 0;
  TAB = tab; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === tab)); render();
  const sc = $('#screen'); sc.scrollTop = 0;
  if (dir && !REDUCED_MOTION && sc.animate) { // new tab slides in from the side it lives on
    if (sc._anim) sc._anim.cancel();
    sc.style.transform = ''; sc.style.opacity = '';
    sc._anim = sc.animate([{ transform: `translateX(${dir * 34}%)`, opacity: 0.15 }, { transform: 'none', opacity: 1 }], { duration: 230, easing: 'cubic-bezier(.2,.85,.25,1)' });
  }
}
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// swipe left / right anywhere on the main screen to move between the five tabs
function initTabSwipe() {
  const sc = $('#screen'); let sx = 0, sy = 0, t0 = 0, dx = 0, lock = 0, on = false;
  const reset = () => { sc.style.transition = 'transform .22s cubic-bezier(.2,.9,.3,1.2), opacity .22s'; sc.style.transform = ''; sc.style.opacity = ''; setTimeout(() => { sc.style.transition = ''; }, 240); };
  const eatClick = () => { const f = e => { e.stopPropagation(); e.preventDefault(); }; window.addEventListener('click', f, true); setTimeout(() => window.removeEventListener('click', f, true), 350); };
  sc.addEventListener('touchstart', e => {
    on = false;
    if (e.touches.length !== 1 || (typeof TUT !== 'undefined' && TUT) || e.target.closest('.synrow, [data-noswipe], input, textarea, select')) return;
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = performance.now(); dx = 0; lock = 0; on = true;
  }, { passive: true });
  sc.addEventListener('touchmove', e => {
    if (!on) return;
    const t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
    if (!lock) {
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) lock = 1;
      else if (Math.abs(my) > 10) { on = false; return; } else return;
    }
    if (e.cancelable) e.preventDefault();
    dx = mx;
    const i = TAB_ORDER.indexOf(TAB), edge = (dx > 0 && i === 0) || (dx < 0 && i === TAB_ORDER.length - 1);
    const d = edge ? dx * 0.2 : dx * 0.55; // rubber-band at the first / last tab
    if (sc._anim) { sc._anim.cancel(); sc._anim = null; }
    sc.style.transition = ''; sc.style.transform = `translateX(${d}px)`; sc.style.opacity = 1 - Math.min(0.45, Math.abs(d) / 500);
  }, { passive: false });
  const end = () => {
    if (!on) return; on = false; if (lock !== 1) return;
    eatClick();
    const i = TAB_ORDER.indexOf(TAB), dir = dx < 0 ? 1 : -1, j = i + dir, v = Math.abs(dx) / Math.max(1, performance.now() - t0);
    if (j < 0 || j >= TAB_ORDER.length || !(Math.abs(dx) > sc.clientWidth * 0.22 || (v > 0.4 && Math.abs(dx) > 40))) { reset(); return; }
    SFX.tap();
    sc.style.transition = 'transform .09s ease-in, opacity .09s'; sc.style.transform = `translateX(${-dir * 40}%)`; sc.style.opacity = 0;
    setTimeout(() => { sc.style.transition = ''; go(TAB_ORDER[j], dir); }, 90);
  };
  sc.addEventListener('touchend', end); sc.addEventListener('touchcancel', () => { if (on && lock === 1) reset(); on = false; });
}
function render() {
  renderTop();
  const el = $('#screen');
  if (TAB === 'battle') el.innerHTML = homeHTML(); else if (TAB === 'heroes') el.innerHTML = heroesHTML();
  else if (TAB === 'season') el.innerHTML = seasonHTML(); else if (TAB === 'road') el.innerHTML = roadHTML(); else if (TAB === 'shop') el.innerHTML = shopHTML();
  if (TAB === 'battle') { const a = selArena(); const c = arenaBanner(a, [], 12, 3); const old = $('#arena-cv'); if (old) { c.id = 'arena-cv'; old.replaceWith(c); } }
  if (TAB === 'road') { const h = $('#road-here'); if (h) setTimeout(() => h.scrollIntoView({ block: 'center' }), 30); }
  updateTimers();
}
function updateTimers() {
  const t = now();
  document.querySelectorAll('[data-until]').forEach(e => { e.textContent = fmtDur(+e.dataset.until - t); });
}

// ---------- HOME / BATTLE TAB ----------
// hero cards: background in the hero's rarity colour, world shown as a small icon
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function rarStyle(hid) { const c = RARITIES[HERO[hid].rarity].color; return `style="background:linear-gradient(180deg,${hexA(c, 0.55)},${hexA(c, 0.16)} 70%);border-color:${c}"`; }
function worldIc(hid) { return WORLDS_ON ? `<span class="wic">${icon('w_' + HERO[hid].world, 'ii')}</span>` : ''; }
function abIcon(ab, cls) { return ab ? icon(ABILITIES[ab].icon, cls || 'ii') : ''; }
// arena picked on the home screen (null = your current arena)
function selArena() { const top = arenaIndex(S.trophies); return S.pickArena == null ? top : Math.max(0, Math.min(top, S.pickArena)); }
function pickArena(dir) { const top = arenaIndex(S.trophies), a = Math.max(0, Math.min(top, selArena() + dir)); S.pickArena = a === top ? null : a; persist(); SFX.tap(); render(); }
// Duel popup: pick the arena (any you've reached) and the difficulty
function openDuel() {
  const m = modal(`<h2>Duel</h2><div id="duel"></div><button class="btn gold big full" id="duel-go" style="margin-top:10px">${icon('i_swords', 'ib')} BATTLE</button>`);
  const draw = () => {
    const top = arenaIndex(S.trophies), a = selArena(), A = ARENAS[a], next = ARENAS[top + 1], older = a < top, d = DIFF[S.lastDiff] || DIFF.normal, ft = foeTier(a, d.id);
    const pr = next ? (S.trophies - ARENAS[top].t) / (next.t - ARENAS[top].t) : 1;
    $('#duel', m).innerHTML = `<div class="arena slim ${older ? 'older' : ''}"><canvas id="duel-cv"></canvas>
        <div class="lbl"><div><small>Arena ${a + 1} of ${ARENAS.length}${older ? ' · older arena' : ''}</small><b>${esc(A.name)}</b></div></div>
        <button class="anav l ${a > 0 ? '' : 'off'}" data-dir="-1" aria-label="Previous arena">${icon('i_left', 'ii')}</button>
        <button class="anav r ${a < top ? '' : 'off'}" data-dir="1" aria-label="Next arena">${icon('i_right', 'ii')}</button>
        <div class="prog">${older ? `<div class="oldnote">No trophies won or lost here</div>` : `<div class="bar gold"><i style="width:${Math.round(pr * 100)}%"></i><span>${next ? `${fmt(S.trophies)} / ${fmt(next.t)} ${icon('i_right','ii')} ${esc(next.name)}` : `${fmt(S.trophies)} trophies · Final arena`}</span></div>`}</div></div>
      <h3 style="margin:10px 0 6px">Difficulty</h3>
      <div class="diffs">${DIFFS.map(x => `<button class="${x.id === d.id ? 'on' : ''}" style="--dc:${x.color}" data-diff="${x.id}">${x.name}</button>`).join('')}</div>
      <div class="diffinfo">${older ? `<span>Rewards from this arena</span>` : `<span>Win <b style="color:var(--gold)">+${d.win}</b> · Loss <b style="color:var(--red)">−${d.loss}</b> ${icon('trophy','ii')}</span>`}<span>Enemy abilities: <b>${ft ? (ft === 3 ? 'any' : 'first ' + ft) : 'none'}</b></span></div>`;
    const c = arenaBanner(a, [], 12, 4); c.id = 'duel-cv'; $('#duel-cv', m).replaceWith(c);
    m.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => { pickArena(+b.dataset.dir); draw(); });
    m.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { setDiff(b.dataset.diff); draw(); });
  };
  draw();
  $('#duel-go', m).onclick = () => { m.close(); startBattle(); };
}
function homeHTML() {
  const top = arenaIndex(S.trophies), a = selArena(), A = ARENAS[a], next = ARENAS[top + 1], older = a < top;
  const pr = next ? (S.trophies - ARENAS[top].t) / (next.t - ARENAS[top].t) : 1;
  const d = DIFF[S.lastDiff] || DIFF.normal;
  const ft = foeTier(a, d.id);
  const squad = S.squad.map((h, i) => {
    const H = HERO[h], ab = equippedAb(S, h);
    return `<button class="hcard ${i === 0 ? 'capcard' : ''} ${goldCard(h)}" ${rarStyle(h)} onclick="pickSquad(${i})">${i === 0 ? `<span class="crownb">${icon('i_crown','ii')}</span>` : ''}${heroImg(h)}<div class="nm">${esc(H.name)}</div>${orbsHTML(heroCost(h), 'under')}</button>`;
  }).join('');
  const syn = activeSynergies(S.squad).filter(x => x.n >= 2);
  const SH = 4, more = S.shelf.length - SH;
  const shelf = S.shelf.slice(0, more > 0 ? SH - 1 : SH).map((c, i) => `<button class="shelfc ${S.keys > 0 ? 'can' : ''}" onclick="tapShelf(${i})"><img class="px" src="${chestURL(c.type)}"></button>`).join('')
    + (more > 0 ? `<button class="shelfc more" onclick="openShelf()"><b>+${more + 1}</b><span>more</span></button>` : Array.from({ length: Math.max(0, SH - S.shelf.length) }, () => '<div class="shelfc empty"></div>').join(''));
  return `<div class="home">
  <div class="panel tight"><div class="squad">${squad}</div>
    <div class="capline">${icon('i_crown','ii')} ${esc(HERO[S.squad[0]].cap.desc)}</div>${syn.length ? `<div class="synrow" style="margin-top:4px">${syn.map(x => `<span class="chip2" style="border-color:${WORLDS[x.world].color}">${icon('w_' + x.world, 'ii')} <b style="color:${WORLDS[x.world].color}">${WORLDS[x.world].name} ×${x.n}</b></span>`).join('')}</div>` : ''}</div>
  <div class="panel tight chestp"><button class="keyb" onclick="keyInfo()">${icon('i_key', 'ib')}<div><b>${S.keys}</b><small>${S.keys < KEY_MAX ? `<span data-until="${S.keyNext}"></span>` : 'full'}</small></div></button><div class="shelf">${shelf}</div></div>
  <button class="duelbtn ${older ? 'older' : ''}" onclick="openDuel()"><canvas id="arena-cv"></canvas><span class="dtxt"><small>${icon('i_swords', 'ii')} Duel · tap to change</small><b>${esc(A.name)}</b>
    <span class="drow"><span class="dchip" style="--dc:${d.color}">${d.name}</span>${older ? '<span class="tiny">no trophies at stake</span>' : `<span class="bar gold thin"><i style="width:${Math.round(pr * 100)}%"></i></span>`}</span></span><span class="dgo">${icon('i_right', 'ii')}</span></button>
  <button class="btn gold big full battlebtn" onclick="startBattle()">${icon('i_swords','ib')} BATTLE</button>
  </div>`;
}
function keyInfo() { modal(`<h2>Keys</h2><div class="center">${icon('i_key', 'ib')}</div><p class="center">You have <b>${S.keys}</b> of ${KEY_MAX} keys. 1 key opens 1 chest.</p><p class="center small mute">${S.keys < KEY_MAX ? `Next key in <b data-until="${S.keyNext}">${fmtDur(S.keyNext - now())}</b>. ` : ''}A new key every ${KEY_HOURS} hours, or buy them in the Shop. Every win puts a chest on your shelf (up to ${SHELF_MAX}).</p><button class="btn gold full" data-close>OK</button>`); }
function openShelf() {
  const m = modal(`<h2>Chest shelf</h2><p class="center small mute" style="margin-top:-6px">${S.shelf.length} / ${SHELF_MAX} · ${icon('i_key', 'ii')} ${S.keys} key${S.keys === 1 ? '' : 's'}</p>
    <div class="shelf all">${S.shelf.map((c, i) => `<button class="shelfc ${S.keys > 0 ? 'can' : ''}" data-i="${i}"><img class="px" src="${chestURL(c.type)}"><span>${CHESTS[c.type].name.split(' ')[0]}</span></button>`).join('')}</div>`);
  m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { m.close(); tapShelf(+b.dataset.i); });
}
function setDiff(id) { S.lastDiff = id; persist(); SFX.tap(); render(); }
function tapShelf(i) {
  const c = S.shelf[i]; if (!c) return;
  const C = CHESTS[c.type];
  if (S.keys <= 0) { modal(`<h2>${C.name}</h2><img class="bigspr px" src="${chestURL(c.type)}"><p class="center">${esc(C.what)}</p><p class="center small mute">You're out of keys. The next one arrives in <b data-until="${S.keyNext}">${fmtDur(S.keyNext - now())}</b>, or buy keys in the Shop.</p><button class="btn gold full" data-close>OK</button>`); return; }
  openChestAnim(i);
}
function openChestAnim(i) {
  const c = S.shelf[i]; if (!c || S.keys <= 0) return;
  const type = c.type;
  chestSequence(type, () => { const r = openShelfChest(S, i, now()); persist(); render(); return r; });
}
function openSpecChest(title, r) { chestSequence(r.type || 'hero', () => r); }

// ===== chest opening =====
// 1) the chest bobs; tap -> it shakes harder and harder, then bursts open
// 2) for every hero that gets trophies a reel of hero cards spins and slows down until it lands on that hero
// 3) currencies land on a reel too; then a summary of everything
const REEL_CW = 92; // card width + gap (px)
function chestSequence(type, getReward) {
  const C = CHESTS[type];
  const el = document.createElement('div'); el.className = 'copen';
  el.innerHTML = `<div class="co-top"><b>${esc(C.name)}</b><button class="btn sm gray hidden" id="co-skip">Skip all</button></div>
    <div class="co-body"><div class="co-stage"><div class="co-rays" style="--rc:${C.pal.b}"></div><img class="co-chest px" src="${chestURL(type)}"><div class="co-hint">Tap to open!</div></div></div>
    <div class="co-flash"></div>`;
  document.body.appendChild(el);
  const body = $('.co-body', el), chest = $('.co-chest', el);
  let r = null, skipAll = false, step = 0;
  $('#co-skip', el).onclick = e => { e.stopPropagation(); skipAll = true; finish(); };
  const flash = (col) => { const f = $('.co-flash', el); f.style.background = col || '#fff'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };
  const stage = $('.co-stage', el);
  stage.onclick = () => {
    if (step) return; step = 1; $('.co-hint', el).textContent = '';
    chest.classList.add('crack'); buzz(20);
    [0, 140, 260, 360, 440, 500].forEach((d, i) => setTimeout(() => { tone(220 + i * 90, 0.08, 'square', 0.04); buzz(8); }, d));
    setTimeout(() => {
      r = getReward(); if (!r) { el.remove(); return; }
      holdRes({ coins: r.coins || 0, gems: r.gems || 0 });
      flash(); SFX.chest(); buzz(40); chest.classList.add('burst'); confetti(stage, C.pal.b, 30);
      setTimeout(() => { $('#co-skip', el).classList.remove('hidden'); runDrops(); }, 650);
    }, 620);
  };
  function drops() {
    const out = [];
    const heroes = Object.keys(r.trophies || {}).sort((a, b) => ((r.newHeroes || []).includes(b) - (r.newHeroes || []).includes(a)) || RARITIES[HERO[b].rarity].order - RARITIES[HERO[a].rarity].order);
    heroes.forEach(h => out.push({ kind: 'hero', hid: h, n: r.trophies[h], isNew: (r.newHeroes || []).includes(h) }));
    if (r.coins) out.push({ kind: 'cur', cur: 'coin', n: r.coins });
    if (r.gems && type !== 'resource') out.push({ kind: 'cur', cur: 'gem', n: r.gems });
    if (r.wild) out.push({ kind: 'cur', cur: 'i_wild', n: r.wild });
    return out;
  }
  async function runDrops() {
    const list = drops();
    for (let i = 0; i < list.length && !skipAll; i++) await reel(list[i], i, list.length);
    if (!skipAll) finish();
  }
  function finish() {
    if (el.dataset.done) return; el.dataset.done = 1;
    $('#co-skip', el).classList.add('hidden');
    body.innerHTML = `<div class="co-sum"><h2>${esc(C.name)}</h2>${rewardTiles(r)}<button class="btn gold full" id="co-ok">Collect</button></div>`;
    SFX.coin();
    $('#co-ok', el).onclick = () => { const sum = $('.co-sum', el), g = { coins: r.coins || 0, gems: r.gems || 0 }, rects = {}; for (const k in g) { const t = sum.querySelector(`[data-res="${k}"]`); if (t) rects[k] = t.getBoundingClientRect(); }
      el.classList.add('out'); setTimeout(() => el.remove(), 200); render(); for (const k in g) if (g[k]) flood({ [k]: g[k] }, rects[k] || null); tutHook('chestDone'); };
  }
  function cardHTML(it) {
    if (it.kind === 'hero') { const c = RARITIES[HERO[it.hid].rarity].color; return `<div class="rc" style="--rc:${c};background:linear-gradient(180deg,${hexA(c, 0.6)},${hexA(c, 0.15)})"><img class="px" src="${sprURL(it.hid, null, '', 64)}"><span>${esc(HERO[it.hid].name)}</span></div>`; }
    const col = it.cur === 'gem' ? '#4ff0ff' : it.cur === 'i_key' ? '#ffd23f' : it.cur === 'i_wild' ? '#c07bff' : '#ffb020';
    return `<div class="rc cur" style="--rc:${col};background:linear-gradient(180deg,${hexA(col, 0.45)},${hexA(col, 0.12)})">${icon(it.cur, 'ib')}<span>×${fmt(it.n)}</span></div>`;
  }
  function filler(d, rnd) {
    if (d.kind === 'hero') { const pool = HEROES.filter(h => RARITIES[h.rarity].arena <= Math.max(1, arenaIndex(S.trophies) + 1)); const h = pickWeighted(rnd, pool, x => RARITIES[x.rarity].weight); return { kind: 'hero', hid: h.id }; }
    const k = rnd(); if (k < 0.55) return { kind: 'cur', cur: 'coin', n: Math.round(d.n * (0.4 + rnd() * 2.2) / 5) * 5 || 10 };
    if (k < 0.85) return { kind: 'cur', cur: 'gem', n: 1 + Math.floor(rnd() * 12) };
    return { kind: 'cur', cur: 'i_key', n: 1 + Math.floor(rnd() * 3) };
  }
  function reel(d, idx, total) {
    return new Promise(resolve => {
      const N = 46, WIN = 38, rnd = mulberry32((Math.random() * 1e9) | 0);
      const items = []; for (let i = 0; i < N; i++) items.push(filler(d, rnd));
      items[WIN] = d.kind === 'hero' ? { kind: 'hero', hid: d.hid } : { kind: 'cur', cur: d.cur, n: d.n };
      body.innerHTML = `<div class="co-count">${idx + 1} / ${total}</div>
        <div class="reel"><div class="reel-strip">${items.map(cardHTML).join('')}</div><div class="reel-mark"></div><div class="reel-fade l"></div><div class="reel-fade r"></div></div>
        <div class="co-info"></div><div class="co-hint small">Tap to ${idx + 1 < total ? 'skip' : 'skip'}</div>`;
      const box = $('.reel', body), strip = $('.reel-strip', body), info = $('.co-info', body), hint = $('.co-hint', body);
      const W = box.clientWidth, jitter = (rnd() - 0.5) * (REEL_CW - 26);
      const target = WIN * REEL_CW + REEL_CW / 2 + jitter - W / 2;
      let t0 = performance.now(), dur = 4300 - Math.min(1500, idx * 400), last = -1, lastTick = 0, landed = false;
      const ease = q => 1 - Math.pow(1 - q, 4);
      body.onclick = () => { if (!landed) { t0 = performance.now() - dur * 0.92; } else if (body.dataset.ready) { body.onclick = null; delete body.dataset.ready; resolve(); } };
      const mark = $('.reel-mark', body);
      function frame(nowT) {
        if (!el.isConnected || skipAll) return resolve();
        const q = Math.min(1, (nowT - t0) / dur), x = target * ease(q);
        strip.style.transform = `translateX(${-x}px)`;
        const ci = Math.floor((x + W / 2) / REEL_CW);
        if (ci !== last) { last = ci; if (nowT - lastTick > 28) { lastTick = nowT; tone(1100 + (q * 300), 0.025, 'square', 0.022); mark.classList.remove('bump'); void mark.offsetWidth; mark.classList.add('bump'); } }
        if (q < 1) { requestAnimationFrame(frame); return; }
        // settle onto the middle of the winning card, then reveal it
        landed = true;
        strip.style.transition = 'transform .35s cubic-bezier(.3,1.6,.5,1)'; strip.style.transform = `translateX(${-(target - jitter)}px)`;
        setTimeout(() => reveal(strip.children[WIN]), 360);
      }
      requestAnimationFrame(frame);
      function reveal(card) {
        card.classList.add('win');
        let col = '#ffd23f', big = false;
        if (d.kind === 'hero') {
          const H = HERO[d.hid], R = RARITIES[H.rarity]; col = R.color; big = R.order >= 3 || d.isNew;
          const trNow = heroTr(S, d.hid), trWas = Math.max(0, trNow - d.n);
          const crossed = ABILITY_TROPHIES.map((need, k) => trWas < need && trNow >= need ? k : -1).filter(k => k >= 0);
          const perks = []; for (let L = trWas + 1; L <= trNow; L++) { const R = HERO_ROAD[L]; if (R.kind !== 'ab') perks.push(roadRewardLabel(R)); }
          info.innerHTML = `${d.isNew ? `<div class="co-new">NEW HERO!</div>` : ''}
            <div class="co-hero">${liveHero(d.hid, 4)}</div>
            <div><b style="color:${col}">${esc(H.name)}</b> <span class="small" style="color:${col}">${R.name}</span></div>
            <div class="co-lv"><span class="lvb">Lv ${trWas || '–'}</span>${icon('i_right', 'ii')}<span class="lvb up">Lv ${trNow}</span></div>
            ${crossed.map(k => `<div class="small" style="color:var(--green)">${icon(ABILITIES[HERO_ABILITIES[d.hid][k]].icon, 'ii')} ${esc(ABILITIES[HERO_ABILITIES[d.hid][k]].name)} ${k === 0 ? 'unlocked!' : 'ready to unlock!'}</div>`).join('')}
            ${perks.length ? `<div class="small" style="color:var(--gold)">New on ${esc(H.name)}'s road: ${perks.join(', ')}</div>` : ''}`;
          setTimeout(() => { const lb = $('.co-lv .up', info); if (lb) { lb.classList.add('pop'); tone(880, 0.12, 'square', 0.04); } }, 450);
          if (d.isNew) { SFX.win(); buzz([30, 40, 60]); } else if (big) { SFX.relic(); buzz(40); } else { SFX.coin(); buzz(20); }
        } else {
          col = d.cur === 'gem' ? '#4ff0ff' : d.cur === 'i_wild' ? '#c07bff' : '#ffd23f'; if (d.cur === 'i_wild') big = true;
          const extra = type === 'resource' ? [r.gems ? `+${r.gems} ${icon('gem', 'ii')}` : '', r.keys ? `+${r.keys} ${icon('i_key', 'ii')}` : ''].filter(Boolean) : [];
          info.innerHTML = d.cur === 'i_wild' ? `<div class="co-new" style="color:#c07bff">WILD TROPHY!</div><div class="co-big">${icon('i_wild', 'ib')}</div><div class="small">Put it on any hero you like: open a hero in the Heroes tab.</div>`
            : `<div class="co-big">+${fmt(d.n)} ${icon(d.cur, 'ib')}</div>${extra.length ? `<div class="co-extra">${extra.join(' &nbsp; ')}</div>` : ''}`;
          SFX.coin(); buzz(20);
        }
        flash(hexA(col, 0.5)); confetti(box, col, big ? 40 : 22);
        box.style.setProperty('--rc', col); box.classList.add('won'); if (big) box.classList.add('big');
        hint.textContent = idx + 1 < total ? 'Tap for the next one' : 'Tap to continue';
        setTimeout(() => { body.dataset.ready = 1; }, 350);
      }
    });
  }
}
// pixel confetti burst inside an element
function confetti(host, col, n) {
  const cols = [col, '#ffffff', '#ffd23f', col];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'conf';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
    p.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--rot:${(Math.random() - 0.5) * 720}deg;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.08}s`;
    host.appendChild(p); setTimeout(() => p.remove(), 1100);
  }
}
function pickSquad(slot) {
  const owned = ownedIds(S).filter(h => !!HERO[h].captain === (slot === 0)).sort((a, b) => S.heroes[b].tr - S.heroes[a].tr || RARITIES[HERO[b].rarity].order - RARITIES[HERO[a].rarity].order);
  const cards = owned.map(h => `<button class="pcard ${S.squad[slot] === h ? 'sel' : ''}" ${rarStyle(h)} data-h="${h}">${costTag(h)}${heroImg(h)}<div class="nm">${esc(HERO[h].name)}</div></button>`).join('');
  const m = modal(`<h2>${slot === 0 ? 'Pick your Captain' : 'Pick a hero'}</h2>${slot === 0 ? '<p class="center tiny mute" style="margin-top:-4px">Captains always start the match.</p>' : ''}<div class="pgrid">${cards}</div>${slot === 0 && owned.length < CAPTAIN_IDS.length ? `<p class="center tiny mute">${CAPTAIN_IDS.length - owned.length} more Captains to unlock on the Trophy Road</p>` : ''}`);
  m.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
    const h = b.dataset.h; const j = S.squad.indexOf(h);
    if (j >= 0) S.squad[j] = S.squad[slot]; S.squad[slot] = h;
    persist(); m.close(); SFX.tap(); render();
  });
}
// ---------- HEROES ----------
// hero level badge for cards: Lv 1-9, gold MAX at 10
function lvTag(hid) { const tr = heroTr(S, hid); return tr >= HERO_MAX ? '<div class="lvl max">MAX</div>' : `<div class="lvl">Lv ${tr}</div>`; }
function goldCard(hid) { const o = S.heroes[hid]; return o && o.un[2] ? 'goldc' : ''; }
function roadRewardLabel(R, hid) {
  if (R.kind === 'ab') return hid ? esc(ABILITIES[HERO_ABILITIES[hid][R.k]].name) : 'Ability';
  if (R.kind === 'chest') return CHESTS[R.chest].name;
  return `${R.n} ${R.kind === 'coins' ? 'coins' : R.kind === 'gems' ? 'gems' : 'keys'}`;
}
function roadRewardIcon(R, hid) { return R.kind === 'ab' ? ABILITIES[HERO_ABILITIES[hid][R.k]].icon : R.kind === 'chest' ? null : R.kind === 'coins' ? 'coin' : R.kind === 'gems' ? 'gem' : 'i_key'; }
function trBar(tr) { // hero trophies 0..10 with ability marks at 2 / 5 / 10
  return `<div class="trbar"><i style="width:${tr * 10}%"></i>${ABILITY_TROPHIES.map(n => `<b class="${tr >= n ? 'on' : ''}" style="left:${n * 10}%"></b>`).join('')}<span>${icon('i_htrophy', 'ii')} ${tr}/10</span></div>`;
}
function heroesHTML() {
  const ownedN = ownedIds(S);
  const sorted = HEROES.slice().sort((a, b) => (heroTr(S, b.id) >= 1) - (heroTr(S, a.id) >= 1) || heroTr(S, b.id) - heroTr(S, a.id) || RARITIES[a.rarity].order - RARITIES[b.rarity].order);
  const cards = sorted.map(H => {
    const o = S.heroes[H.id];
    if (!o || o.tr < 1) return `<button class="hcard locked" ${rarStyle(H.id)} onclick="heroInfo('${H.id}')">${heroImg(H.id, 'spr', true)}<div class="nm">???</div><div class="lvl">${RARITIES[H.rarity].name}</div></button>`;
    const ab = equippedAb(S, H.id);
    const cl = heroClaimable(S, H.id);
    return `<button class="hcard ${goldCard(H.id)}" ${rarStyle(H.id)} onclick="heroInfo('${H.id}')">${cl ? `<span class="up">${cl}</span>` : ''}${costTag(H.id)}${heroImg(H.id)}<div class="nm">${esc(H.name)}</div>${lvTag(H.id)}</button>`;
  });
  const capCards = cards.filter((c, i) => sorted[i].captain).join(''), regCards = cards.filter((c, i) => !sorted[i].captain).join('');
  const capOwned = sorted.filter(h => h.captain && heroTr(S, h.id) >= 1).length;
  return `${S.wild ? `<div class="panel wildp">${icon('i_wild', 'ib')}<div class="grow"><b>${S.wild} wild troph${S.wild > 1 ? 'ies' : 'y'}</b><div class="small mute">Open any hero below to give it a level.</div></div></div>` : ''}
  <div class="panel"><h3><span class="hic">${icon('i_crown','ih')} Captains</span><small>${capOwned} / ${CAPTAIN_IDS.length}</small></h3><div class="grid3">${capCards}</div></div>
  <div class="panel"><h3>Heroes <small>${ownedN.length - capOwned} / ${HEROES.length - CAPTAIN_IDS.length} collected</small></h3><div class="grid3">${regCards}</div></div>
  <p class="small mute center">Card colour = rarity. Each hero trophy is +1 level: level 1 unlocks the hero and its first ability, 5 and 10 open the others, and every level has a reward on the hero's road.</p>`;
}
function heroInfo(hid, pick, opts) {
  opts = opts || {};
  const H = HERO[hid], o = S.heroes[hid] && S.heroes[hid].tr >= 1 ? S.heroes[hid] : null, R = RARITIES[H.rarity], W = WORLDS[H.world];
  const st = heroStats(hid), TG = TARGETING[heroTarget(hid)], lv = o ? o.tr : 0;
  // tiles: captain power (captains only), then the 3 abilities. Tap one to read it below.
  const tiles = [];
  if (H.captain) tiles.push({ k: 'cap', ic: 'i_crown', name: H.cap.name, cls: 'cap' });
  HERO_ABILITIES[hid].forEach((ab, k) => { const s2 = abilityState(S, hid, k); tiles.push({ k, ic: ABILITIES[ab].icon, name: ABILITIES[ab].name, cls: o ? s2.state : 'locked', s2 }); });
  if (typeof pick === 'string' && pick[0] === 'L') { opts.page = 1; opts.at = +pick.slice(1); pick = null; }
  let selK = pick != null ? pick : o && o.eq >= 0 ? o.eq : 0;
  const tileHTML = tiles.map(t => `<button class="abt ${t.cls} ${t.k === selK ? 'sel' : ''}" data-k="${t.k}">${icon(t.ic, 'ib')}${t.cls === 'locked' ? `<i class="lk">${icon('lock', 'ii')}</i>` : t.cls === 'equipped' ? `<i class="ck">${icon('i_check', 'ii')}</i>` : t.cls === 'ready' ? '<i class="nw">!</i>' : ''}<span>${esc(t.name)}</span></button>`).join('');
  // page sizes: both pages of the card are the same height, as tall as the screen allows
  const PH = Math.max(420, Math.min(600, ($('#modal-root').clientHeight || innerHeight) - 108)), big = PH >= 540;
  // the hero's road (page 2): level 1 at the bottom, climbing up, every reward the same size, framed by type
  const ROW = big ? 118 : 104, PADR = 44, TH = HERO_MAX * ROW + PADR * 2, yOf = L => TH - PADR - (L - 0.5) * ROW;
  let road = `<div class="hr2-line" style="top:${yOf(HERO_MAX)}px;height:${yOf(1) - yOf(HERO_MAX)}px"><i style="height:${lv > 1 ? (Math.min(lv, HERO_MAX) - 1) * ROW : 0}px"></i></div>`;
  for (let L = 1; L <= HERO_MAX; L++) {
    const rs = roadStep(S, hid, L), Rw = rs.R, y = yOf(L), left = L % 2 === 1, ic = roadRewardIcon(Rw, hid);
    const kind = Rw.kind === 'ab' ? 'ab' : Rw.kind === 'chest' ? 'chest' : 'cur';
    const amt = Rw.kind === 'coins' || Rw.kind === 'gems' || Rw.kind === 'keys' ? Rw.n : 0;
    const mark = rs.state === 'done' ? `<span class="st">${icon('i_check', '')}</span>` : rs.state === 'locked' ? `<span class="st">${icon('lock', '')}</span>` : '';
    const pill = rs.state !== 'claim' || !o ? '' : Rw.kind === 'ab' && rs.cost ? `<span class="clp btn sm ${rs.can ? 'green' : 'gray'}">${fmt(rs.cost)} ${icon('coin', 'ii')}</span>` : `<span class="clp btn sm green">Claim</span>`;
    road += `<button class="rt k-${kind} ${o ? rs.state : 'locked'} ${rs.state === 'claim' && !rs.can ? 'poor' : ''}" data-rl="${L}" style="top:${y}px;${left ? 'right' : 'left'}:calc(50% + 34px)">${ic ? icon(ic, 'ri') : `<img class="ri" src="${chestURL(Rw.chest)}">`}${amt ? `<span class="amt">${fmt(amt)}</span>` : ''}${mark}${pill}</button>`;
    road += `<i class="hr2-arm" style="top:${y}px;${left ? 'right' : 'left'}:50%"></i><span class="hr2-node ${o ? rs.state : 'locked'} ${o && L === lv ? 'here' : ''}" style="top:${y}px">${L}</span>`;
  }
  const claimN = o ? heroClaimable(S, hid) : 0;
  const detail = k => {
    if (k === 'cost') return `<div class="abd-h">${orbsHTML(heroCost(hid), 'in big')} <b>${heroCost(hid)} Rift Orb${heroCost(hid) > 1 ? 's' : ''}</b> <span class="tag sm">Cost</span></div><div class="abd-t">Each round you get Rift Orbs to spend on heroes for the board: ${SLOT_START} in round 1, then 1 more every round (and 1 extra after losing a round). Bigger heroes cost more orbs but are built much stronger.</div>`;
    if (k === 'tg') return `<div class="abd-h">${icon('i_bow', 'ii')} <b>Range ${st.rng}</b> <span class="tag sm">Attack</span></div><div class="abd-t">${rangeText(st.rng)} Every hero goes after the closest enemy.</div>`;
    if (k === 'cap') return `<div class="abd-h">${icon('i_crown', 'ii')} <b style="color:var(--gold)">${esc(H.cap.name)}</b> <span class="tag sm">Captain power</span></div><div class="abd-t">${esc(H.cap.desc)}</div><div class="abd-b tiny mute">Always on while ${esc(H.name)} is your Captain.</div>`;
    const ab = HERO_ABILITIES[hid][k], A = ABILITIES[ab], s2 = abilityState(S, hid, k);
    const btn = !o ? `<span class="small mute">Unlock ${esc(H.name)} first</span>`
      : s2.state === 'equipped' ? `<span class="tag" style="background:var(--green)">${icon('i_check', 'ii')} Equipped</span>`
      : s2.state === 'unlocked' ? `<button class="btn sm" data-eq="${k}">Equip</button>`
      : s2.state === 'ready' ? `<button class="btn sm green ${s2.can ? '' : 'off'}" data-un="${k}">Unlock ${fmt(s2.cost)} ${icon('coin', 'ii')}</button>`
      : `<span class="small mute">${icon('lock', 'ii')} Reach level ${ABILITY_TROPHIES[k]}</span>`;
    return `<div class="abd-h">${icon(A.icon, 'ii')} <b>${esc(A.name)}</b> <span class="tag sm">${AB_KIND[A.kind]}${A.cd ? ' · ' + A.cd + 's' : ''}</span></div><div class="abd-t">${esc(A.desc)}</div><div class="abd-b">${btn}</div>`;
  };
  let how = '';
  if (!o) { const road = Object.entries(ROAD_HEROES).find(([t, h]) => h === hid);
    how = `<div class="hhow small">${road ? `Trophy Road at <b style="color:var(--gold)">${fmt(+road[0])}</b> ${icon('trophy', 'ii')} or ` : ''}Hero Chests from ${esc(ARENAS[R.arena].name)}</div>`; }
  const canWild = S.wild > 0 && lv < HERO_MAX;
  const m = modal(`<div class="hdots"><i class="${opts.page ? '' : 'on'}"></i><i class="${opts.page ? 'on' : ''}"></i></div><div class="hpager">
   <div class="hpage hinfo ${big ? 'big' : ''}" style="height:${PH}px">
    <div class="hi-top">
      <div class="livewrap sm ${o && o.un[2] ? 'goldc' : ''}" ${rarStyle(hid)}>${o ? liveHero(hid, big ? 5.6 : 4.5) : `<img class="bigspr px" src="${sprURL(hid, null, 'sil', 128)}">`}</div>
      <div class="hi-side"><h2>${esc(H.name)}</h2>
        <div class="row" style="gap:4px;flex-wrap:wrap"><span class="tag" style="background:${R.color}">${R.name}</span><button class="tag costchip ${selK === 'cost' ? 'sel' : ''}" data-k="cost">${orbsHTML(heroCost(hid), 'in')}${heroCost(hid)} Rift Orb${heroCost(hid) > 1 ? 's' : ''}</button>${WORLDS_ON ? `<span class="tag" style="background:${W.color}">${icon('w_' + H.world, 'ii')} ${W.name}</span>` : ''}</div>
        <div class="hstats"><span>${icon('i_heart', 'ii')}<b>${st.hp}</b></span><span>${icon('i_swords', 'ii')}<b>${st.atk}</b></span><span>${icon('i_boot', 'ii')}<b>${SPEEDS[heroSpeed(hid)].name}</b></span>
          <button class="tgchip ${selK === 'tg' ? 'sel' : ''}" data-k="tg">${icon('i_bow', 'ii')}<b>Range ${st.rng}</b></button></div>
      </div></div>
    ${o ? '' : how}
    <div class="hlvrow"><b>${o ? `Lv ${lv}` : 'Locked'}</b><span class="hpips">${[...Array(HERO_MAX)].map((x, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><button class="hgo" data-page="1">Road ${icon('i_right', 'ii')}${claimN ? '<i class="dot"></i>' : ''}</button></div>
    <div class="abts">${tileHTML}</div>
    <div class="abd" id="abd">${detail(selK)}</div>
    <div class="row" style="gap:8px">${o ? `<button class="btn grow ${S.squad.includes(hid) ? 'off' : 'gold'}" id="sq">${S.squad[0] === hid ? 'Captain ' + icon('i_crown', 'ii') : S.squad.includes(hid) ? 'In squad ' + icon('i_check', 'ii') : H.captain ? 'Make Captain' : 'Add to squad'}</button>` : ''}
      ${canWild ? `<button class="btn purple ${o ? '' : 'grow'}" id="wild">${icon('i_wild', 'ii')} ${o ? `+1 level (${S.wild})` : `Unlock with a wild trophy (${S.wild})`}</button>` : ''}</div>
   </div>
   <div class="hpage hroad2 ${big ? 'big' : ''}" style="height:${PH}px">
    <div class="hr2-hd"><img class="px" src="${sprURL(hid, null, o ? '' : 'sil')}"><h2>${esc(H.name)}</h2><span class="lvc">${o ? `Lv ${lv}` : 'Locked'}</span></div>
    <div class="hr2-box"><div class="hr2-track" style="height:${TH}px">${road}</div></div>
    <div class="hr2-key"><span><i class="k-ab"></i>Ability</span><span><i class="k-chest"></i>Chest</span><span><i class="k-cur"></i>Coins, keys, gems</span></div>
   </div>
  </div>`);
  m.classList.add('hcardm');
  // two pages you swipe between
  const pager = $('.hpager', m), dots = m.querySelectorAll('.hdots i'), box = $('.hr2-box', m);
  const atL = opts.at || (o ? [...Array(HERO_MAX)].map((x, i) => i + 1).find(L => roadStep(S, hid, L).state === 'claim' && roadStep(S, hid, L).can) || Math.max(1, lv) : 1);
  box.scrollTop = yOf(atL) - box.clientHeight * 0.55;
  if (opts.page) { pager.style.scrollBehavior = 'auto'; pager.scrollLeft = pager.clientWidth; pager.style.scrollBehavior = ''; }
  pager.addEventListener('scroll', () => { const pi = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)); dots.forEach((d, i) => d.classList.toggle('on', i === pi)); }, { passive: true });
  m.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { SFX.tap(); pager.scrollTo({ left: +b.dataset.page * pager.clientWidth, behavior: 'smooth' }); });
  dots.forEach((d, i) => d.onclick = () => pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' }));
  // road tiles: claim what's ready, otherwise say what it is
  m.querySelectorAll('[data-rl]').forEach(b => b.onclick = () => {
    const L = +b.dataset.rl, rs = roadStep(S, hid, L), Rw = rs.R, what = `Level ${L}: ${roadRewardLabel(Rw, hid)}${Rw.kind === 'ab' ? ' (ability)' : ''}`;
    if (!o) { toast(`Unlock ${esc(H.name)} first`); return; }
    if (rs.state !== 'claim') { SFX.tap(); toast(rs.state === 'done' ? `${what} · claimed` : `${what} · reach level ${L}`); return; }
    if (!rs.can) { toast(`Need ${fmt(rs.cost - S.coins)} more coins`); return; }
    const b0 = resSnap(), src = b.getBoundingClientRect(), r = claimHeroRoad(S, hid, L, now()); if (!r) return;
    if (Rw.kind === 'ab') { persist(); SFX.heal(); buzz(20); m.close(); render(); heroInfo(hid, null, { page: 1, at: L }); toast(`${esc(H.name)} learned ${esc(ABILITIES[r.ability].name)}!`); return; }
    const gn = gainsSince(b0); if (Rw.kind !== 'chest') holdRes(gn); persist(); render(); m.close(); if (Rw.kind !== 'chest') setTimeout(() => flood(gn, src), 30);
    if (Rw.kind === 'chest') { openSpecChest(CHESTS[Rw.chest].name, r); return; }
    SFX.coin(); buzz(20); toast(`+ ${roadRewardLabel(Rw, hid)}`); heroInfo(hid, null, { page: 1, at: L });
  });
  const wire = () => {
    m.querySelectorAll('[data-un]').forEach(b => b.onclick = () => { const k = +b.dataset.un; if (!unlockAbility(S, hid, k)) { toast(`Need ${fmt(ABILITY_COINS[k] - S.coins)} more coins`); return; } persist(); SFX.heal(); buzz(20); m.close(); render(); heroInfo(hid, k); toast(`${esc(H.name)} learned ${esc(ABILITIES[HERO_ABILITIES[hid][k]].name)}!`); });
    m.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const k = +b.dataset.eq; equipAbility(S, hid, k); persist(); SFX.tap(); m.close(); render(); heroInfo(hid, k); });
  };
  m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const raw = b.dataset.k, k = raw === 'tg' || raw === 'cap' || raw === 'cost' ? raw : +raw;
    m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('sel', x === b)); SFX.tap();
    const d = $('#abd', m); d.innerHTML = detail(k); d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); wire();
  });
  wire();
  const wb = $('#wild', m); if (wb) wb.onclick = () => confirmBox(`Use a wild trophy on <b>${esc(H.name)}</b>? ${o ? `Level ${lv} ${icon('i_right', 'ii')} ${lv + 1}` : 'This unlocks the hero.'}`, 'Use it', () => {
    const r = useWild(S, hid); if (!r) return; persist(); render(); m.close(); SFX.relic(); buzz([30, 40]);
    toast(o ? `${esc(H.name)} reached level ${lv + 1}!` : `${esc(H.name)} unlocked!`); heroInfo(hid);
  }, 'purple');
  const sq = $('#sq', m); if (sq) sq.onclick = () => {
    if (S.squad.includes(hid)) return;
    if (H.captain) { S.squad[0] = hid; persist(); m.close(); render(); toast(`${esc(H.name)} is your Captain`); return; }
    m.close();
    const mm = modal(`<h2>Replace who?</h2><div class="pgrid">${S.squad.map((h, i) => i === 0 ? '' : `<button class="pcard" ${rarStyle(h)} data-i="${i}">${heroImg(h)}<div class="nm">${esc(HERO[h].name)}</div></button>`).join('')}</div>`);
    mm.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { S.squad[+b.dataset.i] = hid; persist(); mm.close(); toast(`${esc(H.name)} joined the squad`); render(); });
  };
}
// ---------- SEASON ----------
function seasonHTML() {
  const tier = seasonTier(S), xpIn = S.season.xp - tier * SEASON_TIER_XP;
  const maxed = tier >= SEASON_TIERS;
  const q = (list, weekly) => list.map((x, i) => `<div class="item ${x.claimed ? 'done' : x.done ? 'hot' : ''}">
    <div class="grow"><div class="small"><b>${esc(x.text)}</b></div><div class="bar ${x.done ? 'gold' : 'blue'}" style="margin-top:4px"><i style="width:${Math.round(x.prog / x.target * 100)}%"></i><span>${fmt(x.prog)} / ${fmt(x.target)}</span></div>
    <div class="row tiny mute" style="margin-top:3px;gap:8px"><span class="chip">${icon('star')}${x.xp}</span><span class="chip">${icon('coin')}${x.coins}</span>${x.gems ? `<span class="chip">${icon('gem')}${x.gems}</span>` : ''}</div></div>
    ${x.claimed ? icon('i_check','ib') : `<button class="btn sm ${x.done ? 'gold' : 'gray off'}" onclick="tapQuest(${weekly},${i})">Claim</button>`}</div>`).join('');
  let tiers = '';
  for (let t = 1; t <= SEASON_TIERS; t++) {
    const r = scaledSeasonReward(S, t), L = rewardSpecLabel(r), got = S.season.claimed.includes(t), can = t <= tier && !got;
    const amt = ['coins', 'gems', 'keys', 'trophy'].includes(r.kind) ? r.n : '';
    tiers += `<button class="tier ${got ? 'got' : can ? 'claim' : t > tier ? 'lock' : ''}" onclick="tapTier(${t})"><span class="n">${t}</span><img class="px" src="${L.ic}"><div>${amt || (r.kind === 'chest' ? CHESTS[r.chest].name.split(' ')[0] : '')}</div></button>`;
  }
  const bonus = seasonBonus(S);
  return `<div class="panel"><h3>Season ${seasonNumber(S.season.id)} · ${seasonLabel(S.season.id)} <small>ends in <span data-until="${seasonEndsAt(now())}"></span></small></h3>
    <div class="row"><img class="px" src="${sprURL('star')}" style="width:44px;height:44px"><div class="grow"><b>Tier ${tier} / ${SEASON_TIERS}</b>
    <div class="bar tall purple" style="margin-top:4px"><i style="width:${maxed ? 100 : Math.round(xpIn / SEASON_TIER_XP * 100)}%"></i><span>${maxed ? 'Track complete! Bonus XP ' + icon('i_right','ii') + ' coins' : `${xpIn} / ${SEASON_TIER_XP} XP`}</span></div></div></div>
    <p class="tiny mute" style="margin:8px 0 0">Earn XP from battles and quests. When the month ends you keep any rewards you reached (auto-claimed), get an end-of-season bonus, and trophies above ${fmt(SEASON_RESET_FLOOR)} shrink by 10%.</p></div>
  <div class="panel"><h3>Daily Quests <small>new in <span data-until="${nextMidnight(now())}"></span></small></h3><div class="list">${q(S.quests.daily, false)}</div></div>
  <div class="panel"><h3>Weekly Quests <small>new in <span data-until="${nextWeek(now())}"></span></small></h3><div class="list">${q(S.quests.weekly, true)}</div></div>
  <div class="panel"><h3>Reward Track <small>tap a glowing tier to claim</small></h3><div class="tiers">${tiers}</div>
    ${bonus > 0 ? `<button class="btn gold full" style="margin-top:10px" onclick="tapBonus()">Claim ${bonus} bonus tier${bonus > 1 ? 's' : ''}</button>` : ''}</div>`;
}
function tapQuest(weekly, i) { const r = claimQuest(S, weekly, i); if (!r) return; persist(); render(); showRewards('Quest complete!', r); }
function tapTier(t) {
  if (t > seasonTier(S)) { toast(`Reach tier ${t} to claim`); return; }
  const before = scaledSeasonReward(S, t); const r = claimSeason(S, t); if (!r) return; persist(); render();
  if (before.kind === 'chest') openSpecChest(CHESTS[before.chest].name, r); else showRewards(`Tier ${t} reward`, r);
}
function tapBonus() { const r = claimSeasonBonus(S); if (!r) return; persist(); render(); showRewards('Bonus tiers', r); }

// ---------- ROAD ----------
function roadHTML() {
  let html = '<div class="panel"><h3>Trophy Road <small>rewards stay unlocked even if trophies drop</small></h3><div class="small mute">Highest ever: <b style="color:var(--gold)">' + fmt(S.best) + '</b> ' + icon('trophy','ii') + '</div></div>';
  let lastArena = -1, hereShown = false;
  ROAD.forEach((st, i) => {
    const a = arenaIndex(st.t);
    if (!hereShown && S.best < st.t) { html += `<div id="road-here" class="road-here">${icon('trophy')} You · ${fmt(S.best)}</div>`; hereShown = true; }
    if (st.arenaStart > 0 || (a !== lastArena && st.arenaStart > 0)) {
      const A = ARENAS[st.arenaStart], nr = HEROES.filter(h => RARITIES[h.rarity].arena === st.arenaStart).length;
      html += `<div class="road-arena" style="background:${A.bg};border-color:${A.floor[2]}"><span>Arena ${st.arenaStart + 1} · ${esc(A.name)}</span><span class="small">${nr ? nr + ' new heroes in chests' : ''}</span></div>`;
    }
    lastArena = a;
    const L = rewardSpecLabel(st), reached = S.best >= st.t, got = S.road.includes(i);
    const label = st.kind === 'hero' ? `<b style="color:${RARITIES[HERO[st.hid].rarity].color}">Unlock ${esc(HERO[st.hid].name)}</b>` : st.kind === 'chest' ? CHESTS[st.chest].name : L.txt;
    html += `<div class="road-step ${reached ? 'reached' : ''}"><span class="tr">${icon('trophy')}${fmt(st.t)}</span><img class="ic px" src="${st.kind === 'hero' ? sprURL(st.hid, null, reached || S.heroes[st.hid] ? '' : 'sil') : L.ic}"><span class="grow small">${label}</span>
      ${got ? icon('i_check','ib') : reached ? `<button class="btn sm gold" onclick="tapRoad(${i})">Claim</button>` : '<span class="mute tiny">locked</span>'}</div>`;
  });
  if (!hereShown) html += `<div id="road-here" class="road-here">${icon('trophy')} You · ${fmt(S.best)} — road complete!</div>`;
  return html;
}
function tapRoad(i) {
  const st = ROAD[i]; const r = claimRoad(S, i, now()); if (!r) return; persist(); render();
  if (st.kind === 'hero') { SFX.win(); modal(`<h2>${r.newHeroes && r.newHeroes.length ? 'New hero unlocked!' : 'Hero trophies'}</h2><img class="bigspr px" src="${sprURL(st.hid, null, '', 128)}"><p class="center"><b>${esc(HERO[st.hid].name)}</b> · ${esc(WORLDS[HERO[st.hid].world].name)}</p>${r.newHeroes && r.newHeroes.length ? '' : rewardTiles(r)}<button class="btn gold full" data-close>Awesome</button>`); }
  else if (st.kind === 'chest') openSpecChest(CHESTS[st.chest].name, r); else showRewards('Trophy Road', r);
}

// ---------- SHOP ----------
function shopHTML() {
  const sh = S.shop; const o = sh.offers;
  const free = o[0];
  const row = (img, title, sub, btn, cls) => `<div class="item ${cls || ''}">${img}<div class="grow"><b>${title}</b><div class="small mute">${sub}</div></div>${btn}</div>`;
  const buyBtn = (i, price, cur, ok, label) => `<button class="btn sm ${cur === 'gem' ? 'purple' : 'gold'} ${ok ? '' : 'off'}" onclick="tapBuy(${i})">${label || fmt(price)} ${icon(cur)}</button>`;
  const coinDeals = o.map((x, i) => {
    if (x.kind === 'key') return row(icon('i_key', 'ic'), 'Key', `opens 1 chest · ${x.left} left today`, x.left ? buyBtn(i, x.price, 'coin', S.coins >= x.price) : '<b class="mute">Sold out</b>', x.left ? '' : 'done');
    if (x.kind === 'chest') return row(`<img class="ic px" src="${chestURL(x.chest)}">`, CHESTS[x.chest].name, 'opens right away, no key needed', x.bought ? '<b class="mute">Sold</b>' : buyBtn(i, x.price, 'coin', S.coins >= x.price), x.bought ? 'done' : '');
    if (x.kind === 'trophy') { const H = HERO[x.hid]; return row(heroImg(x.hid, 'ic'), esc(H.name), `+1 hero trophy (${heroTr(S, x.hid)}/10) · <span style="color:${RARITIES[H.rarity].color}">${RARITIES[H.rarity].name}</span>`, x.bought ? '<b class="mute">Sold</b>' : buyBtn(i, x.price, 'coin', S.coins >= x.price), x.bought ? 'done' : ''); }
    return '';
  }).join('');
  const gemDeals = o.map((x, i) => {
    if (x.kind === 'gemchest') return row(`<img class="ic px" src="${chestURL(x.chest)}">`, CHESTS[x.chest].name, 'opens right away', x.bought ? '<b class="mute">Sold</b>' : buyBtn(i, x.price, 'gem', S.gems >= x.price), x.bought ? 'done' : '');
    if (x.kind === 'gemkeys') return row(icon('i_key', 'ic'), `${x.keys} Keys`, 'once a day', x.bought ? '<b class="mute">Sold</b>' : buyBtn(i, x.price, 'gem', S.gems >= x.price), x.bought ? 'done' : '');
    if (x.kind === 'coinbag') return row(icon('coin', 'ic'), 'Coin Bag', `+${fmt(x.coins)} coins`, x.bought ? '<b class="mute">Sold</b>' : buyBtn(i, x.price, 'gem', S.gems >= x.price), x.bought ? 'done' : '');
    return '';
  }).join('');
  const rc = sh.recruit;
  const recruit = rc ? `<div class="item ${rc.bought || heroTr(S, rc.hid) >= 1 ? 'done' : 'hot'}">${heroImg(rc.hid, 'ic')}<div class="grow"><b>${esc(HERO[rc.hid].name)}</b><div class="small mute"><span style="color:${RARITIES[HERO[rc.hid].rarity].color}">${RARITIES[HERO[rc.hid].rarity].name}</span> · ${esc(WORLDS[HERO[rc.hid].world].name)}</div></div>
    ${rc.bought || heroTr(S, rc.hid) >= 1 ? '<b class="mute">Owned</b>' : `<button class="btn sm purple ${S.gems < rc.price ? 'off' : ''}" onclick="tapRecruit()">${fmt(rc.price)} ${icon('gem')}</button>`}</div>` : `<p class="small mute">${arenaIndex(S.trophies) < 1 ? 'Recruits appear once you reach Goblin Woods (300 ' + icon('trophy','ii') + ').' : 'No recruit this week. Climb to new arenas to find more heroes!'}</p>`;
  return `<div class="panel"><h3>Daily Gift <small>new in <span data-until="${nextMidnight(now())}"></span></small></h3>
    <div class="item ${free.bought ? 'done' : 'hot'}">${icon('coin', 'ic')}<div class="grow"><b>${fmt(free.coins)} coins</b><div class="small mute">free, once a day</div></div>${free.bought ? '<b class="mute">Claimed</b>' : `<button class="btn sm green" onclick="tapBuy(0)">Free!</button>`}</div></div>
  <div class="panel"><h3>Coin Shop <small>new deals daily</small></h3><div class="list">${coinDeals}</div></div>
  <div class="panel"><h3>Weekly Recruit <small>new in <span data-until="${nextWeek(now())}"></span></small></h3>${recruit}</div>
  <div class="panel"><h3>Gem Offers <small>gems come from chests, quests and the road</small></h3><div class="list">${gemDeals}</div></div>`;
}
function tapBuy(i) {
  const o = S.shop.offers[i]; const gemsKind = ['gemchest', 'gemkeys', 'coinbag'].includes(o.kind);
  const r = buyOffer(S, i, now()); if (!r) { toast('Not enough ' + (gemsKind ? 'gems' : 'coins')); return; }
  persist(); render();
  if (o.kind === 'gemchest' || o.kind === 'chest') openSpecChest(CHESTS[o.chest].name, r); else showRewards(o.kind === 'free' ? 'Daily Gift' : 'Purchased!', r);
}
function tapRecruit() { const rc = S.shop.recruit; const r = buyRecruit(S); if (!r) { toast('Not enough gems'); return; } persist(); render(); SFX.win(); modal(`<h2>Recruited!</h2><img class="bigspr px" src="${sprURL(rc.hid, null, '', 128)}"><p class="center"><b>${esc(HERO[rc.hid].name)}</b> joined your collection.</p><button class="btn gold full" data-close>Let's go</button>`); }

// ---------- PROFILE & ACHIEVEMENTS ----------
function achRewardHTML(r) { return Object.entries(r).map(([k, n]) => `<span class="chip">${icon(k === 'gems' ? 'gem' : k === 'keys' ? 'i_key' : 'coin', 'ii')}${n}</span>`).join(''); }
function openProfile(tab) {
  tab = tab || 'stats';
  const st = S.stats, a = arenaIndex(S.trophies), fav = favHeroes(S), cap = S.squad[0];
  const wr = st.battles ? Math.round(st.wins / st.battles * 100) + '%' : '–';
  const rows = [['Matches', fmt(st.battles)], ['Win rate', wr], ['Rounds won', fmt(st.roundWins)], ['Best streak', fmt(st.bestStreak)], ['3–0 sweeps', fmt(st.sweeps)], ['Flawless rounds', fmt(st.flawless)],
    ['Defeated', fmt(st.kills)], ['Damage', fmt(st.dmg)], ['Abilities used', fmt(st.abil)], ['Chests', fmt(st.chests)], ['Heroes', `${ownedIds(S).length}/${HEROES.length}`], ['Abilities', `${abilitiesUnlocked(S)}/${HEROES.length * 3}`]];
  const favRow = (lbl, e, val) => e && e[1].m ? `<div class="fav" ${rarStyle(e[0])}>${heroImg(e[0], '')}<div><small>${lbl}</small><b>${esc(HERO[e[0]].name)}</b><span class="tiny">${val}</span></div></div>` : '';
  const favs = [favRow('Most played', fav.most, fav.most && `${fmt(fav.most[1].m)} matches`), favRow('Most damage', fav.dmg, fav.dmg && `${fmt(fav.dmg[1].d)} dmg`), favRow('Most defeats', fav.kills, fav.kills && `${fmt(fav.kills[1].k)} enemies`)].join('');
  const doneN = ACHIEVEMENTS.filter(x => S.ach[x.id]).length, claimN = achClaimable(S);
  const grid = ACHIEVEMENTS.map(x => { const k = S.ach[x.id] || 0, v = Math.min(x.n, achValue(S, x.v));
    return `<button class="acht ${k === 2 ? 'got' : k === 1 ? 'hot' : ''}" data-a="${x.id}">${icon(x.icon, 'ib')}${k ? '' : `<i class="ap" style="width:${Math.round(v / x.n * 100)}%"></i>`}${k === 1 ? '<i class="nw">!</i>' : ''}</button>`; }).join('');
  const achDetail = id => { const x = ACH[id], k = S.ach[id] || 0, v = Math.min(x.n, achValue(S, x.v));
    return `<div class="abd-h">${icon(x.icon, 'ii')} <b>${esc(x.name)}</b><span class="row" style="gap:3px;margin-left:auto">${achRewardHTML(x.r)}</span></div><div class="abd-t">${esc(x.desc)}</div>
      <div class="abd-b">${k === 2 ? `<span class="tag" style="background:var(--green)">${icon('i_check', 'ii')} Claimed</span>` : k === 1 ? `<button class="btn sm gold" data-claim="${id}">Claim reward</button>` : `<div class="bar blue grow"><i style="width:${Math.round(v / x.n * 100)}%"></i><span>${fmt(v)} / ${fmt(x.n)}</span></div>`}</div>`; };
  const first = (ACHIEVEMENTS.find(x => S.ach[x.id] === 1) || ACHIEVEMENTS.find(x => !S.ach[x.id]) || ACHIEVEMENTS[0]).id;
  const m = modal(`<h2>Profile</h2>
    <div class="phead"><div class="pav" ${rarStyle(cap)}>${liveHero(cap, 2.8)}</div><div class="grow"><input class="txt" id="nm" maxlength="18" value="${esc(S.name)}" aria-label="Player name">
      <div class="small">${icon('relic', 'ii')} Arena ${a + 1}: <b>${esc(ARENAS[a].name)}</b></div><div class="small">${icon('trophy', 'ii')} <b style="color:var(--gold)">${fmt(S.trophies)}</b> <span class="mute">· best ${fmt(S.best)} · since ${new Date(S.created).toLocaleDateString()}</span></div></div></div>
    <div class="seg" style="margin:8px 0"><button class="${tab === 'stats' ? 'on' : ''}" data-tab="stats">Stats</button><button class="${tab === 'ach' ? 'on' : ''}" data-tab="ach">Achievements ${doneN}/${ACHIEVEMENTS.length}${claimN ? ` <i class="dot">${claimN}</i>` : ''}</button></div>
    ${tab === 'stats' ? `${favs ? `<div class="favs">${favs}</div>` : ''}<div class="pstats">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`
      : `<div class="achg">${grid}</div><div class="abd" id="achd" style="margin-top:8px">${achDetail(first)}</div>`}`);
  $('#nm', m).onchange = e => { S.name = e.target.value.trim() || 'Rift Rookie'; persist(); };
  m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { SFX.tap(); m.remove(); openProfile(b.dataset.tab); });
  if (tab !== 'ach') return;
  let sel = first;
  const wireClaim = () => m.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
    const id = b.dataset.claim, b0 = resSnap(), src = b.getBoundingClientRect(), r = claimAchievement(S, id); if (!r) return; const gn = gainsSince(b0); holdRes(gn); persist(); renderTop(); flood(gn, src);
    SFX.coin(); buzz(20); confetti($('#achd', m), '#ffd23f', 18);
    const t = m.querySelector(`[data-a="${id}"]`); t.classList.remove('hot'); t.classList.add('got'); const nw = t.querySelector('.nw'); if (nw) nw.remove();
    $('#achd', m).innerHTML = achDetail(id);
    toast(`+ ${Object.entries(r).map(([k, n]) => `${n} ${icon(k === 'gems' ? 'gem' : k === 'keys' ? 'i_key' : 'coin', 'ii')}`).join(' ')}`);
  });
  const pick = id => { sel = id; m.querySelectorAll('.acht').forEach(x => x.classList.toggle('sel', x.dataset.a === id)); const d = $('#achd', m); d.innerHTML = achDetail(id); d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); wireClaim(); };
  m.querySelectorAll('.acht').forEach(b => b.onclick = () => { SFX.tap(); pick(b.dataset.a); });
  pick(first);
}
// ---------- SETTINGS / HELP ----------
function helpHTML() {
  return `<div class="help">
  <p>${icon('i_swords','ib')}<span><b>Matches</b> are first to 3 round wins.</span></p>
  <p>${icon('i_crown','ib')}<span>Your <b>Captain</b> starts every round. Before rounds 1–3 you pick a hero to add.</span></p>
  <p>${icon('i_hand','ib')}<span><b>Drag</b> your heroes where you want them, then tap <b>Fight!</b> They battle on their own.</span></p>
  <p>${icon('i_laser','ib')}<span><b>Round-start abilities</b> go off before anyone moves, so guess where the enemy will stand.</span></p>
  <p>${icon('i_tnear','ib')}<span>Heroes step <b>one tile at a time</b>, never diagonally, and can't walk through anyone. They always go after the <b>closest</b> enemy.</span></p>
  <p>${icon('i_orb','ib')}<span><b>Rift Orbs:</b> every hero costs 1 to 4 orbs (the blue orbs on its card). You get ${SLOT_START} orbs in round 1 and 1 more every round, plus a gold one after losing a round. Your captain always fights; tap or drag heroes from the bench to spend the rest, and double-tap a hero on the board to send it back.</span></p>
  <p>${icon('i_bow','ib')}<span>Each hero has a <b>range</b> from 1 (the 8 tiles around it) to 4 tiles, diagonals included. Heroes still walk only up, down, left and right. Tap a hero to see the tiles it can hit.</span></p>
  ${WORLDS_ON ? `<p>${icon('i_globe','ib')}<span>Heroes from the <b>same world</b> are stronger together.</span></p>` : ''}
  <p>${icon('i_key','ib')}<span>Every win adds a chest to your shelf. Open chests with keys: you get a new key every 5 hours.</span></p>
  <p>${icon('i_htrophy','ib')}<span>Every Hero Chest holds <b>1 hero trophy</b>: each one is +1 hero level. Level 1 unlocks the hero and its first ability, level 5 the second, level 10 the third. Every level has a reward on that hero's road.</span></p>
  <p>${icon('i_wild','ib')}<span><b>Wild trophies</b> are rare chest drops you can put on any hero you like.</span></p>
  <p>${icon('i_save','ib')}<span>Your progress is saved on this phone. Make a backup code in Settings sometimes.</span></p></div>`;
}
function openSettings() {
  const tg = (id, label, on) => `<div class="toggle"><span>${label}</span><button class="btn sm ${on ? 'green' : 'gray'}" id="${id}">${on ? 'On' : 'Off'}</button></div>`;
  const m = modal(`<h2>Settings</h2>
    ${tg('snd', 'Sound effects', S.settings.sound)}${tg('mus', 'Music', S.settings.music)}${tg('fast', 'Fast animations', S.settings.fast)}
    <div class="setbtns"><button class="btn sm" id="hlp">How to play</button><button class="btn sm" id="tut">Tutorial</button><button class="btn sm" id="bku">Backup</button></div>
    ${BUILD === 'test' ? testToolsHTML() : ''}
    <p class="tiny mute center" style="margin:8px 0 0">Rift Squad · offline build · font: Jersey 10 (SIL OFL)</p>`);
  $('#snd', m).onclick = () => { S.settings.sound = !S.settings.sound; persist(); m.close(); openSettings(); };
  $('#mus', m).onclick = () => { S.settings.music = !S.settings.music; persist(); if (!S.settings.music) musicStop(true); else musicPreview(); m.close(); openSettings(); };
  $('#fast', m).onclick = () => { S.settings.fast = !S.settings.fast; persist(); m.close(); openSettings(); };
  $('#tut', m).onclick = () => { m.close(); runTutorial(); };
  $('#hlp', m).onclick = () => { m.close(); openHelp(); };
  $('#bku', m).onclick = () => { m.close(); openBackup(); };
  if (BUILD === 'test') wireTestTools(m);
}
function openBackup() {
  const m = modal(`<h2>Backup</h2>
    ${BUILD !== 'artifact' ? '' : '<p class="small" style="margin:0 0 6px;color:var(--gold)">This is the preview build. Its save can be cleared by the browser, so install the home-screen version for long-term play and move your progress over with a backup code.</p>'}
    <p class="small mute" style="margin:0 0 6px">Progress lives on this device. Copy a backup code to Notes, or paste one to restore (also how you move to a new phone).</p>
    <div class="row" style="gap:8px"><button class="btn grow" id="exp">Make backup code</button><button class="btn gray grow" id="imp">Restore</button></div>
    <div id="bk" style="margin-top:8px"></div>
    <button class="btn red sm" style="margin-top:12px" id="rst">Reset all progress</button>`);
  $('#exp', m).onclick = () => {
    const code = exportSave(S);
    $('#bk', m).innerHTML = `<textarea class="code" readonly>${code}</textarea><div class="row" style="gap:8px;margin-top:6px"><button class="btn sm grow" id="cp">Copy</button>${BUILD === 'pwa' ? '<button class="btn sm gray grow" id="dl">Download</button>' : ''}</div>`;
    $('#cp', m).onclick = () => { const ta = $('textarea', m); ta.select(); try { navigator.clipboard.writeText(code).then(() => toast('Copied!'), () => { document.execCommand('copy'); toast('Copied!'); }); } catch (e) { document.execCommand('copy'); toast('Copied!'); } };
    if ($('#dl', m)) $('#dl', m).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = 'rift-squad-backup-' + dayKey(now()) + '.txt'; a.click(); };
  };
  $('#imp', m).onclick = () => {
    $('#bk', m).innerHTML = `<textarea class="code" id="ta" placeholder="Paste backup code (starts with RIFT1:)"></textarea><button class="btn green sm full" style="margin-top:6px" id="go">Restore this backup</button>`;
    $('#go', m).onclick = () => {
      try { const ns = importSave($('#ta', m).value); confirmBox('Replace current progress with this backup?', 'Restore', () => { S = ns; tick(S, now()); persist(); lsDel(STORE_BATTLE); m.close(); render(); toast('Backup restored'); }); }
      catch (e) { toast(esc(e.message)); }
    };
  };
  $('#rst', m).onclick = () => confirmBox('Erase ALL progress? This cannot be undone (unless you have a backup code).', 'Erase', () => confirmBox('Really erase everything?', 'Yes, erase', () => { S = newSave(now()); tick(S, now()); persist(); lsDel(STORE_BATTLE); m.close(); go('battle'); }));
}
// How to play, in short pages instead of one long scroll
function openHelp() {
  const items = helpHTML().match(/<p>[\s\S]*?<\/p>/g) || [], per = 4, pages = Math.ceil(items.length / per); let pg = 0;
  const m = modal(`<h2>How to play</h2><div class="help" id="hp"></div><div class="row" style="gap:8px;margin-top:10px"><button class="btn gray" id="hprev">${icon('i_left', 'ii')}</button><span class="grow center small mute" id="hpn"></span><button class="btn gold" id="hnext">Next</button></div>`);
  const show = () => { $('#hp', m).innerHTML = items.slice(pg * per, pg * per + per).join(''); $('#hpn', m).textContent = `${pg + 1} / ${pages}`; $('#hprev', m).classList.toggle('off', pg === 0); $('#hnext', m).textContent = pg === pages - 1 ? 'Got it' : 'Next'; };
  $('#hprev', m).onclick = () => { if (pg > 0) { pg--; show(); } };
  $('#hnext', m).onclick = () => { if (pg < pages - 1) { pg++; show(); } else m.close(); };
  show();
}
// ---------- BATTLE FLOW (auto-battle, best of 5, board grows 3 -> 4 -> 5) ----------
let M = null;
function startBattle() {
  if (M) return;
  if (!S.tutorialDone) { runTutorial(); return; }
  const seed = (now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const setup = setupBattle(S, S.lastDiff || 'normal', seed, selArena());
  const D = DIFF[setup.diff], E = EVENTS[setup.event];
  const deckRow = (deck) => `<div class="deckrow">${deck.map((h, i) => `<div class="dk">${costTag(h.hid, 'sm')}${heroImg(h.hid, '')}${i === 0 ? `<span class="crown">${icon('i_crown','ii')}</span>` : ''}<small>${h.ab ? abIcon(h.ab) : '–'}</small></div>`).join('')}</div>`;
  const m = modal(`<h2>${esc(ARENAS[setup.arena].name)}</h2>
    <div class="evcard" style="border-color:${E.color}"><b style="color:${E.color}">${E.name}</b> <span class="small">${E.desc}</span></div>
    <p class="small" style="margin:10px 0 4px"><b>${esc(S.name)}</b></p>${deckRow(setup.myDeck)}
    <p class="small" style="margin:10px 0 4px"><b style="color:${D.color}">${esc(setup.foeName)}</b> <span class="mute">· ${D.name} AI</span></p>${deckRow(setup.foeDeck)}
    <p class="center small mute" style="margin:10px 0">First to 3 round wins · ${SLOT_START} Rift Orbs in round 1, +1 every round${setup.older ? ' · older arena: no trophies won or lost' : ''}</p>
    <button class="btn gold big full" id="fight">START MATCH</button>`);
  $('#fight', m).onclick = () => { m.close(); beginMatch(setup, null); };
}

function startTutorialMatch() { beginMatch(tutorialSetup(), null); }
function toWin() { return (M && M.setup.toWin) || ROUNDS_TO_WIN; }
function matchRnd(tag) { return mulberry32((M.setup.seed ^ hashStr(tag)) >>> 0); }
function roundSeed() { return (M.setup.seed + M.round * 7919) >>> 0; }

function beginMatch(setup, saved) {
  M = { setup, phase: 'prep', vis: {}, sel: null, drag: null, hover: null, speed: (S.settings.fast && !setup.tut ? 2 : 1), acc: 0, rt: 0, last: performance.now(), sfxT: 0, mark: null, cheer: null, slowUntil: 0 };
  const fresh = { lastW: null, round: 1, score: [0, 0], prev: [null, null], agg: { dmg: 0, kills: 0, abil: 0 }, flawless: 0, rounds: 0, lineups: null, heroes: {}, clutch: 0, down02: false, feats: {} };
  if (saved) Object.assign(M, fresh, { lastW: saved.lastW != null ? saved.lastW : null, sides: saved.sides, round: saved.round, score: saved.score, prev: saved.prev, agg: saved.agg, flawless: saved.flawless, rounds: saved.rounds, lineups: saved.lineups || null, heroes: saved.heroes || {}, clutch: saved.clutch || 0, down02: !!saved.down02, feats: saved.feats || {} });
  else Object.assign(M, fresh, { sides: [newMatchSide(setup.myDeck), newMatchSide(setup.foeDeck)] });
  M.style = setup.tut ? 'mix' : aiStyleFor(setup.seed >>> 2);
  M.variant = setup.variant; const eb = eventBoard(setup.event, M.variant); M.obs = eb.obs;
  M.floor = buildFloor(eb, setup.arena, setup.seed);
  M.rs = { t: 0, tiles: eb.tiles, obs: eb.obs, units: [], winner: null };
  BV.speed = S.settings.fast ? 0.6 : 1;
  $('#battle').classList.remove('hidden');
  bvInit($('#bc')); requestAnimationFrame(() => bvLayout());
  const loop = nowT => { if (!M) return; frame(nowT); M.raf = requestAnimationFrame(loop); }; M.raf = requestAnimationFrame(loop);
  S.activeBattle = !setup.tut; persist(); saveMatch();
  musicMode('calm', true); musicStart(setup.arena);
  hud(); panel();
  (saved ? Promise.resolve() : matchIntro()).then(() => { if (M) prepRound(); });
}
function saveMatch() {
  if (!M || M.setup.tut) return;
  lsSet(STORE_BATTLE, JSON.stringify({ bh: BH, lastW: M.lastW, setup: M.setup, sides: M.sides, round: M.round, score: M.score, prev: M.prev, agg: M.agg, flawless: M.flawless, rounds: M.rounds, lineups: M.lineups, heroes: M.heroes, clutch: M.clutch, down02: M.down02, feats: M.feats }));
}

// ----- iOS Home Screen app fix -----
// WebKit bug: in a Home Screen app, full-screen fixed layers can stop short of the bottom of the screen,
// leaving the tab bar floating high with a dead band under it. When that happens, size them to the real screen.
let VP_PROBE = null;
function fixViewport() {
  const root = document.documentElement;
  const st = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!st) { if (root.classList.contains('vfix')) { root.classList.remove('vfix'); root.style.removeProperty('--app-h'); root.style.removeProperty('--sab'); } return; }
  if (!VP_PROBE) { VP_PROBE = document.createElement('div'); VP_PROBE.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:1px;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box'; document.body.appendChild(VP_PROBE); }
  const portrait = innerHeight >= innerWidth, sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const cs = getComputedStyle(VP_PROBE), vh = VP_PROBE.offsetHeight, sat = parseFloat(cs.paddingTop) || 0, sab = parseFloat(cs.paddingBottom) || 0, gap = Math.round(sh - vh);
  if (gap < 8 || gap > 220) { root.classList.remove('vfix'); root.style.removeProperty('--app-h'); root.style.removeProperty('--sab'); return; }
  root.style.setProperty('--app-h', sh + 'px'); root.classList.add('vfix');
  const fixB = Math.max(sab, Math.min(34, gap - sat)); // the home-indicator inset gets lost along with the gap
  if (fixB > sab) root.style.setProperty('--sab', fixB + 'px'); else root.style.removeProperty('--sab');
}

// ----- bench: heroes you brought but aren't using this round -----
function freeSlots() { return M.caps ? M.caps[0] - slotsUsed(M.sides[0].board) : 0; }
function benchHTML() {
  const cap = M.caps ? M.caps[0] : 0, used = slotsUsed(M.sides[0].board), bonus = M.lastW === 1 && M.round > 1;
  const was = M.capShown || 0; M.capShown = cap; // sockets added since last time pop in
  const socks = Array.from({ length: cap }, (x, i) => { const gold = bonus && i === cap - 1, on = i < used;
    return `<img class="px sk ${on ? 'on' : ''} ${gold ? 'gold' : ''} ${i >= was && was > 0 ? 'new' : ''}" data-i="${i}" src="${on ? (gold ? sprURL('i_orb', ORB_GOLD) : sprURL('i_orb')) : (gold ? sprURL('i_orb0', { r: '#b37a00' }) : sprURL('i_orb0'))}" alt="">`; }).join('');
  const cards = M.sides[0].bench.map(h => `<button class="bcard ${heroCost(h.hid) > cap - used ? 'off' : 'fit'}" data-bh="${h.hid}"><img class="px" src="${sprURL(h.hid)}" alt="">${costTag(h.hid)}</button>`).join('');
  return `<div class="bslots" aria-label="Rift Orbs ${used} of ${cap}">${socks}</div><div class="bcards">${cards || '<span class="tiny mute">Everyone is on the board</span>'}</div>`;
}
// ----- Rift Orbs (hero cost) -----
const ORB_GOLD = { b: '#ffd23f', h: '#fff3a8', w: '#ffffff', B: '#b37a00' };
function orbsHTML(n, cls) { const u = sprURL('i_orb'); return `<i class="orbs ${cls || ''}">${`<img class="px" src="${u}" alt="">`.repeat(n)}</i>`; }
// orbs fly between a card and the meter (add: card -> sockets a..b-1, back: sockets -> card)
function orbFly(rects, to, gold) {
  rects.forEach((fr, k) => {
    const tr = typeof to === 'function' ? to(k) : to; if (!fr || !tr) return;
    const p = document.createElement('img'); p.className = 'orbfly px'; p.src = gold && gold(k) ? sprURL('i_orb', ORB_GOLD) : sprURL('i_orb');
    const sx = fr.left + fr.width / 2 - 8, sy = fr.top + fr.height / 2 - 8; p.style.left = sx + 'px'; p.style.top = sy + 'px'; document.body.appendChild(p);
    const ex = tr.left + tr.width / 2 - 8 - sx, ey = tr.top + tr.height / 2 - 8 - sy;
    const a = p.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${ex * .5}px,${ey * .5 - 26}px) scale(1.3)`, offset: .5 }, { transform: `translate(${ex}px,${ey}px) scale(1)` }],
      { duration: 380, delay: k * 70, easing: 'ease-in-out', fill: 'both' });
    a.onfinish = () => { p.remove(); if (tr.el) { tr.el.classList.remove('pending'); tr.el.classList.remove('pop'); void tr.el.offsetWidth; tr.el.classList.add('pop'); } tone(1100 + k * 140, 0.04, 'square', 0.025); };
  });
}
const sockEl = i => document.querySelector(`#b-bench .bslots img[data-i="${i}"]`);
function sockRect(i) { const e = sockEl(i); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, el: e }; }
function costTag(hid, cls) { return orbsHTML(heroCost(hid), 'corner ' + (cls || '')); }
function wireBench() {
  const el = $('#b-bench'); if (!el) return;
  el.querySelectorAll('[data-bh]').forEach(b => b.onpointerdown = e => benchDown(e, b.dataset.bh));
}
// put a bench hero on the board (at a tile, or the best free spot)
function benchAdd(hid, at) {
  if (!M || M.phase !== 'setup') return false;
  const side = M.sides[0], h = side.bench.find(x => x.hid === hid); if (!h) return false;
  const L = M.lineups[0].units, occ = at && L.find(u => u.x === at.x && u.y === at.y);
  let freed = 0; if (occ) { if (occ.hid === side.captain) { toast(`${icon('i_crown', 'ii')} Your captain always fights`); return false; } freed = heroCost(occ.hid); }
  if (heroCost(hid) > freeSlots() + freed) { toast(`${esc(HERO[hid].name)} needs ${heroCost(hid)} Rift Orb${heroCost(hid) > 1 ? 's' : ''}. Drag a hero off the board to free some.`); SFX.tap(); buzz(30); return false; }
  const card = document.querySelector(`#b-bench [data-bh="${hid}"]`), fromR = card && card.getBoundingClientRect();
  if (occ) benchRemove(occ.hid, true);
  const u0 = slotsUsed(side.board);
  side.bench = side.bench.filter(x => x !== h); side.board.push(h);
  let p = at && !L.some(u => u.x === at.x && u.y === at.y) ? at : null;
  if (!p) { const used = new Set(L.map(u => u.x + ',' + u.y)), mem = S.formation[hid];
    const ok = q => q && q.y >= P0 && q.y < BH && q.x >= 0 && q.x < BW && !M.obs[q.y * BW + q.x] && !used.has(q.x + ',' + q.y);
    if (ok(mem)) p = mem; else { const obs2 = M.obs.map((o, i) => (o || used.has((i % BW) + ',' + Math.floor(i / BW))) ? 1 : 0); const f = roleFormation([h], 0, mulberry32(3), false, obs2)[0]; p = f && { x: f.x, y: f.y }; } }
  if (!p) { side.board.pop(); side.bench.push(h); toast('No room on the board'); return false; }
  L.push({ hid, ab: h.ab, x: p.x, y: p.y }); SFX.step(); buzz(10);
  rebuildPreview(); M.sel = null; panel();
  if (fromR) { const n = heroCost(hid), idx = Array.from({ length: n }, (x, k) => u0 + k), bonusI = M.lastW === 1 && M.round > 1 ? M.caps[0] - 1 : -1;
    idx.forEach(i => { const e = sockEl(i); if (e) e.classList.add('pending'); });
    orbFly(idx.map(() => fromR), k => sockRect(idx[k]), k => idx[k] === bonusI); }
  tutHook('benchAdd', hid); return true;
}
function benchRemove(hid, quiet) {
  const side = M.sides[0]; if (hid === side.captain) { toast(`${icon('i_crown', 'ii')} Your captain always fights`); return false; }
  const h = side.board.find(x => x.hid === hid); if (!h) return false;
  const u0 = slotsUsed(side.board), n = heroCost(hid), from = quiet ? [] : Array.from({ length: n }, (x, k) => sockRect(u0 - n + k));
  side.board = side.board.filter(x => x !== h); side.bench.push(h);
  M.lineups[0].units = M.lineups[0].units.filter(u => u.hid !== hid);
  if (!quiet) { SFX.tap(); rebuildPreview(); M.sel = null; panel();
    const c = document.querySelector(`#b-bench [data-bh="${hid}"]`); if (c && from.some(Boolean)) { const r = c.getBoundingClientRect(); orbFly(from.filter(Boolean), { left: r.left, top: r.top, width: r.width, height: r.height, el: c }); } }
  return true;
}
// drag a bench card onto the board (a short tap just adds it)
function benchDown(e, hid) {
  if (!M || M.phase !== 'setup') return; e.preventDefault();
  M.drag = { bench: true, hid, sx: e.clientX, sy: e.clientY, px: -99, py: -99, moved: false };
  const mv = ev => { if (!M || !M.drag) return; const d = M.drag; if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 8) d.moved = true;
    const p = boardPoint(ev); d.px = p.px; d.py = p.py; M.hover = (p.y >= P0 && p.y < BH && p.x >= 0 && p.x < BW && !M.obs[p.y * BW + p.x]) ? { x: p.x, y: p.y } : null; };
  const up = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!M || !M.drag) return; const d = M.drag, h = M.hover; M.drag = null; M.hover = null;
    if (!d.moved) benchAdd(d.hid); else if (h) benchAdd(d.hid, h); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
const overBench = e => { const b = $('#b-bench'); if (!b || b.classList.contains('hidden')) return false; const r = b.getBoundingClientRect(); return e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 14 && e.clientY <= r.bottom + 6; };

function myLineup() {
  const used = new Set(); const units = []; const cur = M.lineups && M.lineups[0];
  const ok = p => p && p.y >= P0 && p.y < BH && p.x >= 0 && p.x < BW && !M.obs[p.y * BW + p.x] && !used.has(p.x + ',' + p.y);
  for (const h of M.sides[0].board) {
    let p = cur && cur.units.find(u => u.hid === h.hid); if (!ok(p)) p = S.formation[h.hid];
    if (ok(p)) { used.add(p.x + ',' + p.y); units.push({ hid: h.hid, ab: h.ab, x: p.x, y: p.y }); }
  }
  const rest = M.sides[0].board.filter(h => !units.some(u => u.hid === h.hid));
  if (rest.length) { const obs2 = M.obs.map((o, i) => (o || used.has((i % BW) + ',' + Math.floor(i / BW))) ? 1 : 0); units.push(...roleFormation(rest, 0, mulberry32(1), false, obs2)); }
  return { units, captain: M.sides[0].captain };
}

async function prepRound() {
  if (!M) return;
  M.phase = 'prep'; M.sel = null; M.info = null; M.cheer = null; hud(); panel(); musicMode('calm');
  const D = M.setup.diff, r = M.round;
  // a fresh hazard layout every round (round 1 uses the match's own layout)
  const moved = setRoundBoard(r);
  if (moved && r > 1) { await hazardShift(); if (!M) return; }
  // slots: the limit grows every round, and whoever lost the last round gets 1 extra
  M.caps = [sideCap(r, M.lastW === 1), sideCap(r, M.lastW === 0)];
  aiPickBoard(M.sides[1], M.caps[1], M.style || 'mix', D, matchRnd('fb' + r), M.prev[0]);
  if (r === 1 && M.setup.tut) autoFill(M.sides[0], M.caps[0]); else trimBoard(M.sides[0], M.caps[0]);
  const my = myLineup(); if (M.setup.tut && r === 1) my.charge0 = 0.8;
  $('#b-hint2') && ($('#b-hint2').textContent = 'Enemy is planning…');
  await new Promise(r2 => setTimeout(r2, 40));
  const ctx = { event: M.setup.event, variant: M.variant, captain: M.sides[1].captain, oppBoard: M.sides[0].board };
  const guess = M.prev[0] ? estimateLineup(M.sides[0].board, M.prev[0], 0, M.sides[0].captain, M.obs) : (DIFF[D].idx >= 2 ? my : null);
  const foe = aiLineup(M.sides[1].board, 1, D, guess, ctx, (M.setup.seed + r * 131) >>> 0);
  if (M.setup.foeHp) foe.hpMul = M.setup.foeHp;
  // before round 1 you already know who they brought: show them faded in their usual spots (the real spots can differ)
  if (r === 1) M.scout = { units: aiLineup(M.sides[1].board, 1, D, null, ctx, (M.setup.seed ^ 0x9e37) >>> 0).units, captain: M.sides[1].captain };
  M.lineups = [my, foe];
  M.phase = 'setup'; rebuildPreview(); saveMatch(); hud(); panel(); tutHook('setup', r);
  if (r === 1 && !M.setup.tut) toast(`${icon('i_orb', 'ii')} Spend your <b>${M.caps[0]} Rift Orbs</b>: tap or drag heroes from the bench`);
  if (r > 1) { const free = M.caps[0] - slotsUsed(M.sides[0].board); toast(`${icon('i_orb', 'ii')} <b>${M.caps[0]} Rift Orbs</b> this round${M.lastW === 1 ? ' (gold one for losing the last round)' : ''}${free > 0 && M.sides[0].bench.length ? ` · ${free} to spend` : ''}`); }
}
// faded enemies: last round's spots, or before round 1 their usual spots
// faded enemies: where they stood last round; before round 1 you only know their captain
function ghostLine() { return M.prev && M.prev[1] ? M.prev[1] : M.round === 1 && M.scout ? Object.assign({}, M.scout, { units: M.scout.units.filter(u => u.hid === M.sides[1].captain) }) : null; }
function roundVariant(r) { return r <= 1 || M.setup.tut ? M.setup.variant : (((hashStr('hz' + r) ^ M.setup.seed) >>> 0) % 1e9) + 2; }
function setRoundBoard(r) {
  const E = EVENTS[M.setup.event], v = roundVariant(r), changed = v !== M.variant;
  M.variant = v; const eb = eventBoard(M.setup.event, v); M.obs = eb.obs;
  if (changed || !M.floor) M.floor = buildFloor(eb, M.setup.arena, M.setup.seed);
  M.rs = { t: 0, tiles: eb.tiles, obs: eb.obs, units: [], winner: null }; M.rt = 0;
  return changed && !!E.tile;
}
function hazTiles() { const out = []; M.rs.tiles.forEach((t, i) => { if (t) out.push(i); }); M.obs.forEach((o, i) => { if (o && !out.includes(i)) out.push(i); }); return out; }
// "the hazards moved!": the new tiles blink before you pick and place
function hazardShift() {
  const E = EVENTS[M.setup.event];
  bvFx({ type: 'hazpulse', tiles: hazTiles(), color: E.color, dur: 1500, raw: true });
  banner('HAZARDS MOVED!', E.color); tone(300, 0.15, 'square', 0.04); tone(450, 0.15, 'square', 0.04, null, 0.12); tone(600, 0.2, 'square', 0.04, null, 0.24);
  return new Promise(r => setTimeout(r, 1500));
}
// match intro: arena, both captains, VS, then the hazard for this match
function matchIntro() {
  return new Promise(done => {
    const st = M.setup, E = EVENTS[st.event], D = DIFF[st.diff], A = ARENAS[st.arena], el = document.createElement('div');
    el.className = 'mintro';
    el.innerHTML = `<div class="mi-top"><small>Arena ${st.arena + 1}${st.older ? ' · no trophies at stake' : ''}</small><b>${esc(A.name)}</b></div>
      <div class="mi-vs"><div class="mi-side me">${liveHero(M.sides[0].captain, 5)}<b>${esc(S.name)}</b><small>You</small></div><div class="mi-x">VS</div>
        <div class="mi-side foe">${liveHero(M.sides[1].captain, 5)}<b style="color:${D.color}">${esc(st.foeName)}</b><small>${D.name} AI</small></div></div>
      <div class="mi-haz" style="--hc:${E.color}"><div class="mi-tile"></div><div class="mi-ht"><small>${E.tile ? 'This match' : 'Weather'}</small><b style="color:${E.color}">${E.name}</b><span>${esc(E.desc)}${E.tile ? ' The tiles move every round!' : ''}</span></div></div>
      <div class="mi-tap">Tap to skip</div>`;
    $('.mi-tile', el).appendChild(hazardStrip(st.event, st.arena));
    $('#battle').appendChild(el);
    const timers = [], at = (ms, f) => timers.push(setTimeout(f, ms));
    let over = false;
    const end = () => { if (over) return; over = true; timers.forEach(clearTimeout); el.classList.add('out'); setTimeout(() => el.remove(), 260); done(); };
    tone(220, 0.25, 'sawtooth', 0.03, 440);
    at(520, () => { el.classList.add('slam'); tone(90, 0.35, 'square', 0.06, 50); tone(1200, 0.08, 'square', 0.03); buzz(40); });
    at(1350, () => { el.classList.add('haz'); if (E.tile) bvFx({ type: 'hazpulse', tiles: hazTiles(), color: E.color, dur: 1900, raw: true }); [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.035, null, i * 0.08)); });
    at(E.tile ? 3500 : 2900, end);
    el.onclick = end;
  });
}
function rebuildPreview() {
  M.rs = newRound({ sides: M.lineups, event: M.setup.event, variant: M.variant, seed: roundSeed() });
  M.rt = 0; M.vis = {};
}

function fight(sure) {
  if (!M || M.phase !== 'setup') return;
  const left = freeSlots(), fits = M.sides[0].bench.some(h => heroCost(h.hid) <= left);
  if (!sure && !M.setup.tut && fits) { confirmBox(`You still have <b>${left} Rift Orb${left > 1 ? 's' : ''}</b> to spend. Fight anyway?`, 'Fight', () => fight(true)); return; }
  M.lineups[0].units.forEach(u => S.formation[u.hid] = { x: u.x, y: u.y }); persist();
  rebuildPreview(); M.phase = 'fight'; M.acc = -0.45; M.sel = null; BV.fx = []; BV.floats = []; M.revealAt = bvNow(); M.slowUntil = 0; M.cheer = null;
  musicMode('fight'); tutHook('fight');
  for (const u of M.rs.units) if (u.side === 1) bvFx({ type: 'ring', x: u.x, y: u.y, color: '#ff4f6b', dur: 420 });
  hud(); panel(); banner('FIGHT!', '#ffd23f'); SFX.cast();
}
function skipRound() {
  if (!M || M.phase !== 'fight') return;
  while (M.rs.winner == null) step(M.rs, null);
  roundOver();
}
function frame(realT) {
  const rdt = Math.min(0.1, (realT - M.last) / 1000); M.last = realT;
  const slow = M.slowUntil > realT, ts = slow ? 0.2 : 1;
  if (!slow && M.zoomed) { M.zoomed = false; bvZoom(null); }
  BV.vt = (BV.vt == null ? realT : BV.vt) + rdt * 1000 * ts; const nowT = BV.vt;
  if (M.phase === 'fight' && M.rs.winner == null) {
    M.acc += rdt * M.speed * ts;
    while (M.acc >= DT && M.rs.winner == null) { const ev = []; step(M.rs, ev); M.acc -= DT; fxEvents(ev, nowT); }
    M.rt = Math.max(0, M.rs.t + Math.min(M.acc, DT)); // the short countdown before a fight must not count as negative time
    if (realT - (M.hudT || 0) > 250) { M.hudT = realT; hud(); if (M.sel) panel(); }
  } else M.rt = M.rs.t;
  if (M.phase === 'fight' && M.rs.winner != null && !(M.slowUntil > realT)) roundOver();
  const setupMode = M.phase === 'setup' || M.phase === 'prep';
  bvDraw({ rs: M.rs, rt: M.rt, mode: setupMode ? 'setup' : 'fight', hideFoe: true, ghosts: setupMode && ghostLine() ? ghostLine().units.map(u => ({ hid: u.hid, x: u.x, y: u.y, cap: u.hid === ghostLine().captain })) : null, revealAt: M.revealAt, vis: M.vis, sel: M.sel, drag: M.drag && M.drag.moved ? M.drag : null, hover: M.hover, floor: M.floor, mark: M.mark, cheer: M.cheer }, nowT);
  tipPlace();
}

function fxEvents(evs, nowT) {
  const rs = M.rs; const pos = uid => { const u = byUid(rs, uid); return u ? unitPos(u, rs.t) : [0, 0]; };
  for (const e of evs) {
    const v = e.uid ? (M.vis[e.uid] || (M.vis[e.uid] = { flash: 0, deadAt: 0, lunge: null, leapT: 0 })) : null;
    switch (e.t) {
      case 'atk': { // every hero has its own attack look; d = ms until the hit lands (synced with the sim)
        const a = pos(e.uid), b = e.tuid ? pos(e.tuid) : [e.x1, e.y1], dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]), d = (e.d || 0.1) * 1000 / M.speed, L = LOOKS[e.look] || LOOKS.slash;
        if (e.ranged) { v.anim = { t0: nowT, body: e.look === 'lob' ? 'throw' : 'recoil', dx, dy, d: Math.min(d, 120) }; bvFx({ type: 'shot', raw: true, look: e.look, x0: a[0], y0: a[1], x1: b[0], y1: b[1], color: e.color, dur: d }); }
        else { v.anim = { t0: nowT, body: L.body, dx, dy, d }; bvFx({ type: 'swing', raw: true, look: e.look, x: b[0], y: b[1], x0: a[0], y0: a[1], dx, dy, color: e.color, delay: d, dur: e.look === 'smash' || e.look === 'chop' ? 320 : 230 }); }
        if (e.look === 'smash' || e.look === 'chop') setTimeout(() => { if (M) bvShake(2, 180); }, d);
        if (e.tuid && finalBlow(e)) startSlowmo(b, 1400);
        break; }
      case 'lunge': { const a = pos(e.uid), b = pos(e.tuid); v.anim = { t0: nowT, body: 'lunge', dx: Math.sign(b[0] - a[0]), dy: Math.sign(b[1] - a[1]), d: 70 }; break; }
      case 'shot': { const a = pos(e.uid), b = pos(e.tuid); bvFx({ type: 'proj', x0: a[0], y0: a[1], x1: b[0], y1: b[1], color: e.color, big: e.big, dur: 160 }); break; }
      case 'lob': { const a = pos(e.uid); bvFx({ type: 'proj', x0: a[0], y0: a[1], x1: e.x, y1: e.y, color: e.color, big: true, bomb: e.bomb, arc: e.bomb ? 30 : 14, dur: (e.dur || 300) / M.speed / BV.speed }); break; }
      case 'charge': { const a = pos(e.uid); bvFx({ type: 'charge', uid: e.uid, x: a[0], y: a[1], color: e.color, dur: e.dur * 1000 / M.speed / BV.speed }); SFX.tap(); break; }
      case 'laser': bvFx({ type: 'laser', x: e.x, y0: e.y0, y1: e.y1, color: e.color, dur: 480 }); bvShake(2, 260); SFX.cast(); buzz(25); break;
      case 'beam': { const a = pos(e.uid), b = pos(e.tuid); bvFx({ type: 'line', x0: a[0], y0: a[1], x1: b[0], y1: b[1], color: e.color, w: e.drone ? 1 : 2, dur: 320 }); if (!e.drone) SFX.heal(); break; }
      case 'hook': { const a = pos(e.uid), b = pos(e.tuid); bvFx({ type: 'line', x0: a[0], y0: a[1], x1: b[0], y1: b[1], color: e.color, w: 1, rope: true, dur: 380 }); break; }
      case 'chain': { const pts = e.uids.map(pos); for (let i = 1; i < pts.length; i++) bvFx({ type: 'zapline', x0: pts[i - 1][0], y0: pts[i - 1][1], x1: pts[i][0], y1: pts[i][1], color: '#ffe94f', dur: 320 }); SFX.cast(); break; }
      case 'lanefx': bvFx({ type: 'lane', x: e.x, y0: e.y0, y1: e.y1, color: e.color, dur: 500 }); bvShake(2, 250); break;
      case 'quake': { const p = pos(e.uid); bvFx({ type: 'ringfx', x: p[0], y: p[1], r: 1.4, color: '#c8b8a8', dur: 420 }); bvShake(3, 300); break; }
      case 'ringfx': { const p = pos(e.uid); bvFx({ type: 'ringfx', x: p[0], y: p[1], r: Math.min(e.r, 3) + 0.4, color: e.color, dur: 480 }); break; }
      case 'hole': bvFx({ type: 'hole', x: e.x, y: e.y, dur: 600 }); break;
      case 'spin': v.spinT = nowT; break;
      case 'smoke': { const p = pos(e.uid), list = []; for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; list.push({ x: p[0] * TILE + 9, y: p[1] * TILE + 10, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.4 - 0.3, color: i % 2 ? '#b8b2d6' : '#ece9ff', big: 1 }); } bvFx({ type: 'parts', list, dur: 600 }); break; }
      case 'abduct': { const p = pos(e.uid); bvFx({ type: 'ufo', x: p[0], y: p[1], hid: byUid(rs, e.uid).hid, up: true, dur: 700 }); break; }
      case 'return': { const p = pos(e.uid); bvFx({ type: 'ufo', x: p[0], y: p[1], hid: byUid(rs, e.uid).hid, up: false, dur: 500 }); break; }
      case 'spawn': { const p = pos(e.uid); bvFx({ type: 'ring', x: p[0], y: p[1], color: '#7dff6b', dur: 400 }); break; }
      case 'meteor': { const p = pos(e.tuid); bvFx({ type: 'meteor', x: p[0], y: p[1], dur: e.dur * 1000 / M.speed }); break; }
      case 'screen': bvFx({ type: 'tint', color: '#4fa3ff', dur: 900 }); break;
      case 'zone': bvFx({ type: 'zone', kind: e.kind, tiles: e.tiles, cx: e.cx, cy: e.cy, raw: true, dur: e.dur * 1000 / M.speed }); break;
      case 'mine': case 'drone': { const p = e.uid ? pos(e.uid) : [e.x, e.y]; bvFx({ type: 'ring', x: p[0], y: p[1], color: '#4ff0ff', dur: 400 }); break; }
      case 'shove': break;
      case 'opening': { const box = $('#b-cap'); if (box && M.round === 1) { const d = document.createElement('div'); d.className = 'capl'; d.innerHTML = `${icon('i_clock', 'ii')} <b>Round-start abilities</b> go off first. Nobody moves yet!`; box.appendChild(d); while (box.children.length > 2) box.firstChild.remove(); setTimeout(() => d.classList.add('fade'), 2200); setTimeout(() => d.remove(), 2700); } break; }
      case 'taunt': { tutHook('taunt', e); const p = pos(e.uid); bvFx({ type: 'ringfx', x: p[0], y: p[1], r: 2.4, color: '#ff4f6b', dur: 520 }); for (const tu of e.tuids) { const q = pos(tu); bvFx({ type: 'line', x0: p[0], y0: p[1], x1: q[0], y1: q[1], color: '#ff4f6b', w: 1, dur: 700 }); } bvShake(2, 200); tone(160, 0.25, 'sawtooth', 0.05, 320); break; }
      case 'cap': addCaption(e); break;
      case 'blast': bvFx({ type: 'blast', tiles: e.tiles, color: e.color, dur: e.boom ? 450 : 350 }); if (e.boom) { bvShake(3, 300); const c = e.tiles[Math.floor(e.tiles.length / 2)], list = []; for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2; list.push({ x: c.x * TILE + 9, y: c.y * TILE + 9, vx: Math.cos(a) * (0.8 + Math.random()), vy: Math.sin(a) * (0.8 + Math.random()) - 0.5, color: i % 3 ? '#ff8a2a' : '#ffd23f' }); } bvFx({ type: 'parts', list, dur: 500 }); SFX.die(); } buzz(15); break;
      case 'dmg': {
        const p = pos(e.uid); v.flash = nowT + 70;
        if (e.src && e.kind !== 'poison' && e.kind !== 'burn') { const sp = pos(e.src); v.knock = { t0: nowT, dx: Math.sign(p[0] - sp[0]), dy: Math.sign(p[1] - sp[1]) }; }
        const col = e.kind === 'poison' ? '#7dff6b' : e.kind === 'burn' ? '#ff8a2a' : e.kind === 'crit' ? '#ffd23f' : e.kind === 'abil' ? '#ff9af0' : '#ff6b6b';
        if (e.amt === 0 && e.absorbed > 0) bvFloat(p[0], p[1], 'BLOCK', '#4ff0ff', 6, 700);
        else if (e.amt > 0) bvFloat(p[0] + (Math.random() - 0.5) * 0.3, p[1], '-' + e.amt, col, e.kind === 'abil' ? 7.5 : 6.5, 800);
        if (nowT - M.sfxT > 70) { M.sfxT = nowT; if (e.kind === 'crit') SFX.crit(); else if (e.kind !== 'poison' && e.kind !== 'burn') SFX.hit(); }
        break;
      }
      case 'heal': { const p = pos(e.uid); bvFloat(p[0], p[1] - 0.2, '+' + e.amt, '#5fd068', 6.5, 800); break; }
      case 'die': {
        const u = byUid(rs, e.uid); const p = pos(e.uid); v.deadAt = nowT; const col = HERO[u.hid].color; const list = [];
        for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2; list.push({ x: p[0] * TILE + 9, y: p[1] * TILE + 9, vx: Math.cos(a) * (0.5 + Math.random()), vy: Math.sin(a) * (0.5 + Math.random()) - 0.6, color: i % 3 ? col : '#ffffff' }); }
        bvFx({ type: 'parts', list, dur: 500 }); SFX.die(); buzz(30);
        if (!u.clone && !rs.units.some(o => o.alive && o.side === u.side && !o.clone)) finalKill(p, col);
        break;
      }
      case 'status': { const p = pos(e.uid); const L = { stun: ['STUN', '#ffd23f'], freeze: ['FROZEN', '#8fe3ff'], wrap: ['WRAPPED', '#ece0c4'], frog: ['FROG!', '#7dff6b'], float: ['FLOAT', '#c07bff'], shock: ['SHOCKED', '#4ff0ff'], shield: ['SHIELD', '#4ff0ff'], haste: ['FAST', '#ffe94f'], rage: ['+1 DMG', '#ff6b6b'], slow: ['SLOW', '#8cc6ff'], burn: ['BURN', '#ff8a2a'], curse: ['CURSED', '#c07bff'], taunt: ['TAUNTED', '#ff4f6b'], charm: ['CHARMED', '#ff8ac8'], shrink: ['SHRUNK', '#c07bff'], revive: ['REVIVED!', '#ffd23f'] }[e.kind] || [e.kind, '#fff']; bvFloat(p[0], p[1] - 0.45, L[0], L[1], 5, 900); bvFx({ type: 'ring', x: p[0], y: p[1], color: L[1], dur: 400 }); break; }
      case 'cast': { tutHook('cast', e); const p = pos(e.uid); const A = ABILITIES[e.ab]; v.castT = nowT; bvFloat(p[0], p[1] - 0.7, A.name.toUpperCase(), '#d6b3ff', 6.5, 1000, A.icon); bvFx({ type: 'ring', x: p[0], y: p[1], color: e.color || '#b36bff', dur: 400 }); SFX.cast(); break; }
      case 'tele': { const p = pos(e.uid); bvFx({ type: 'ring', x: p[0], y: p[1], color: '#b36bff', dur: 350 }); break; }
      case 'leap': v.leapT = e.at; break;
    }
  }
}

// ----- slow motion on the last kill of a round -----
function finalBlow(e) { // a normal hit that will finish the last enemy hero
  const rs = M.rs, t = byUid(rs, e.tuid), src = byUid(rs, e.uid); if (!t || !src || !t.alive || t.clone || rs.revive[t.side] > 0) return false;
  if (rs.units.some(o => o !== t && o.alive && o.side === t.side && !o.clone)) return false;
  let d = dmgOf(src) + (t.st.vulnT > rs.t ? 1 : 0); if (t.st.shrinkT > rs.t) d *= 2;
  return t.pas.stone <= 0 && d >= t.hp + (t.st.shield > 0 && t.st.shieldT > rs.t ? t.st.shield : 0);
}
function startSlowmo(p, ms) {
  const real = performance.now(); if (M.slowUntil > real) return;
  M.slowUntil = real + ms; M.zoomed = true; bvZoom(p); tone(90, 0.5, 'sine', 0.06, 50);
}
function finalKill(p, col) {
  const real = performance.now();
  if (!(M.slowUntil > real)) { M.zoomed = true; bvZoom(p); }
  M.slowUntil = real + 850;
  bvFx({ type: 'tint', color: '#ffffff', dur: 260 }); bvShake(4, 420); buzz([40, 30, 60]);
  const list = []; for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6; list.push({ x: p[0] * TILE + 9, y: p[1] * TILE + 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, color: i % 3 ? col : i % 2 ? '#ffd23f' : '#ffffff', big: i % 4 === 0 }); }
  bvFx({ type: 'parts', list, dur: 700 }); bvFx({ type: 'ringfx', x: p[0], y: p[1], r: 2.2, color: '#ffffff', dur: 600 });
  tone(70, 0.6, 'sawtooth', 0.06, 40); tone(1200, 0.3, 'square', 0.03, 300, 0.05);
}

// "what just happened" line under the board, so every ability is easy to follow
function addCaption(e) {
  const box = $('#b-cap'); if (!box || !M) return; const u = byUid(M.rs, e.uid); if (!u) return;
  const A = ABILITIES[e.ab] || (u.ab && ABILITIES[u.ab]); if (!A) return;
  const d = document.createElement('div'); d.className = 'capl ' + (u.side === 0 ? 'me' : 'foe');
  d.innerHTML = `${icon(A.icon, 'ii')} <b>${esc(HERO[u.hid].name)}</b> <span class="an">${esc(A.name)}:</span> ${esc(e.msg)}`;
  box.appendChild(d); while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => d.classList.add('fade'), 2000); setTimeout(() => d.remove(), 2500);
}
function roundOver() {
  if (!M || M.phase !== 'fight') return;
  M.phase = 'between'; const w = M.rs.winner; const st = M.rs.stats[0];
  M.rounds++; M.agg.dmg += Math.round(st.dmg); M.agg.kills += st.kills; M.agg.abil += st.abil;
  if (w === 0 && st.lost === 0) M.flawless++;
  if (w === 0 && M.rs.units.filter(u => u.side === 0 && u.alive && !u.clone).length === 1) M.clutch++;
  for (const u of M.rs.units) if (u.side === 0 && !u.clone) { const h = M.heroes[u.hid] || (M.heroes[u.hid] = { d: 0, k: 0 }); h.d += Math.round(u.dealt); h.k += u.kills; }
  for (const f in M.rs.feats[0]) M.feats[f] = 1;
  if (w === 0) M.score[0]++; else if (w === 1) M.score[1]++;
  M.lastW = w === 0 || w === 1 ? w : null;
  if (M.score[0] === 0 && M.score[1] >= 2) M.down02 = true;
  if (w === 0 || w === 1) M.cheer = { side: w, t0: bvNow() };
  if (M.zoomed) { M.zoomed = false; bvZoom(null); }
  tutHook('roundOver', w);
  M.prev = M.lineups.map(l => ({ captain: l.captain, units: l.units.map(u => ({ ...u })) }));
  banner(w === 0 ? 'ROUND WON' : w === 1 ? 'ROUND LOST' : 'DRAW', w === 0 ? '#ffd23f' : w === 1 ? '#ff4f6b' : '#c9c3ee');
  if (w === 0) SFX.relic(); else if (w === 1) SFX.lose();
  hud(); panel();
  const over = M.score[0] >= toWin() || M.score[1] >= toWin() || M.rounds >= 9;
  setTimeout(() => { if (!M) return; if (over) finishMatch(); else { M.round++; saveMatch(); prepRound(); } }, S.settings.fast ? 1000 : 1700);
}

function hud() {
  if (!M) return; const E = EVENTS[M.setup.event];
  const pips = (n, cls) => `<span class="pips ${cls}">${Array.from({ length: toWin() }, (x, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  $('#b-ev').innerHTML = `<div class="hs-row">${pips(M.score[0], 'me')}<b class="me">${M.score[0]}</b><i>–</i><b class="foe">${M.score[1]}</b>${pips(M.score[1], 'foe')}</div>`;
  const ph = { setup: 'Set up', prep: 'Get ready', fight: 'Fight!' }[M.phase] || '';
  $('#b-rl').innerHTML = `<b>Round ${M.round}</b><small>${ph || '&nbsp;'}</small>`;
  $('#b-rnd').innerHTML = M.phase === 'fight' ? `<span class="tmr">${icon('i_clock', 'ii')}${Math.max(0, Math.ceil(M.rs.timeLimit - M.rs.t))}</span>`
    : `<button class="hazchip" onclick="hazInfo()"><i class="evdot" style="background:${E.color}"></i>${E.name.split(' ')[0]}</button>`;
}
function hazInfo() { if (!M) return; M.sel = null; M.info = M.info === 'haz' ? null : 'haz'; SFX.tap(); panel(); }
function panel() {
  if (!M) return;
  const rs = M.rs, capH = HERO[M.sides[0].captain], E = EVENTS[M.setup.event];
  const u = M.sel && byUid(rs, M.sel);
  if (u) {
    const A = u.ab ? ABILITIES[u.ab] : null;
    $('#b-info').innerHTML = A ? `<div class="abig"><span class="abig-ic" style="border-color:${u.side === 0 ? '#4fa3ff' : '#ff4f6b'}">${icon(A.icon, 'ib')}</span><div class="grow"><div class="abig-h"><b>${esc(A.name)}</b><span class="tag sm">${AB_KIND[A.kind]}${A.cd ? ' · ' + A.cd + 's' : ''}</span></div><div class="abig-t">${esc(A.desc)}</div></div></div>`
      : `<div class="abig"><span class="abig-ic">${icon('i_swords', 'ib')}</span><div class="grow"><div class="abig-h"><b>No ability</b></div><div class="abig-t">${esc(HERO[u.hid].name)} just attacks.</div></div></div>`;
  } else if (M.info === 'haz' && M.phase !== 'fight') {
    $('#b-info').innerHTML = `<div class="abig"><span class="abig-ic haz" style="border-color:${E.color}"></span><div class="grow"><div class="abig-h"><b style="color:${E.color}">${E.name}</b></div><div class="abig-t">${esc(E.desc)}${E.tile ? ' The tiles move every round.' : ''}</div></div></div>`;
    $('#b-info .abig-ic').appendChild(hazardStrip(M.setup.event, M.setup.arena));
  } else $('#b-info').innerHTML = ''; // nothing selected: just the arena
  $('.bpanel').classList.toggle('capmode', !u && M.phase !== 'setup' && M.phase !== 'prep');
  const bench = $('#b-bench'), showBench = M.phase === 'setup' && !$('#b-info').innerHTML && M.caps;
  bench.classList.toggle('hidden', !showBench); if (showBench) { bench.innerHTML = benchHTML(); wireBench(); }
  $('.bpanel').classList.toggle('solo', M.phase !== 'fight' && !$('#b-info').innerHTML && !showBench); // just the FIGHT button, full width
  hud();
  tipFill(u);
  const btns = $('#b-btns');
  btns.classList.toggle('one', M.phase !== 'fight');
  if (M.phase === 'setup') btns.innerHTML = `<button class="btn gold big" onclick="fight()">FIGHT!</button>`;
  else if (M.phase === 'fight') btns.innerHTML = `<button class="btn gray sq" onclick="toggleSpeed()" aria-label="Speed"><small>Speed</small>×${M.speed}</button>${M.setup.tut ? '' : `<button class="btn purple sq" onclick="skipRound()" aria-label="Skip round"><small>Skip</small>${icon('i_ff','ii')}</button>`}`;
  else btns.innerHTML = `<button class="btn gold big off">FIGHT!</button>`;
}
// stat bubble over the selected hero
function tipFill(u) {
  const tip = $('#b-tip'); if (!tip) return;
  if (!u || !u.alive) { tip.classList.add('hidden'); tip.dataset.uid = ''; return; }
  const col = u.side === 0 ? '#8cc6ff' : '#ff9aa8';
  tip.innerHTML = `<b style="color:${col}">${u.cap ? icon('i_crown', 'ii') + ' ' : ''}${esc(HERO[u.hid].name)}${u.clone ? ' (copy)' : ''}</b>
    <div class="tip-s"><span>${icon('i_heart', 'ii')}${u.hp}/${u.maxHp}</span><span>${icon('i_swords', 'ii')}${u.atk + (u.bonus || 0)}</span><span>${icon('i_boot', 'ii')}${SPEEDS[heroSpeed(u.hid)].name}</span></div>
    <div class="tip-s"><span>${icon('i_bow', 'ii')}Range ${u.rng}</span></div>`;
  tip.dataset.uid = u.uid; tip.classList.remove('hidden');
}
function tipPlace() {
  const tip = $('#b-tip'); if (!tip || tip.classList.contains('hidden') || !M) return;
  const u = byUid(M.rs, tip.dataset.uid), cv = BV.cv;
  if (!u || !u.alive || (M.drag && M.drag.moved)) { tip.style.opacity = 0; return; }
  const [ux, uy] = unitPos(u, M.rt), sc = BV.scale, bw = cv.parentElement.clientWidth;
  const cx = cv.offsetLeft + (ux * TILE + 9) * sc, top = cv.offsetTop + (PADT + uy * TILE - 5) * sc, w = tip.offsetWidth, h = tip.offsetHeight;
  const below = top - h < 2;
  tip.style.left = Math.max(2, Math.min(bw - w - 2, cx - w / 2)) + 'px';
  tip.style.top = (below ? cv.offsetTop + (PADT + (uy + 1) * TILE + 2) * sc : top - h) + 'px';
  tip.classList.toggle('below', below); tip.style.opacity = 1;
}
function toggleSpeed() { M.speed = M.speed === 1 ? 2 : M.speed === 2 ? 3 : 1; panel(); }
function autoArrange() {
  if (!M || M.phase !== 'setup') return;
  const units = roleFormation(M.sides[0].board, 0, mulberry32(now() & 0xffff), true, M.obs);
  M.lineups[0] = { units, captain: M.sides[0].captain }; rebuildPreview(); SFX.tap(); panel();
}

// ----- board input: drag to move/swap during setup, tap to inspect -----
function boardPoint(e) {
  const r = BV.cv.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width * BW * TILE, py = (e.clientY - r.top) / r.height * (BH * TILE + PADT) - PADT;
  return { px, py, x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}
function onBoardDown(e) {
  if (!M || !M.rs) return; const p = boardPoint(e); if (p.x < 0 || p.y < 0 || p.x >= BW || p.y >= BH) return;
  const u = M.rs.units.find(q => q.alive && q.x === p.x && q.y === p.y && !(M.phase !== 'fight' && q.side === 1));
  if (M.phase === 'setup' && u && u.side === 0) { M.drag = { uid: u.uid, hid: u.hid, sx: p.px, sy: p.py, px: p.px, py: p.py, moved: false }; try { BV.cv.setPointerCapture(e.pointerId); } catch (er) { } return; }
  M.sel = u ? u.uid : null; M.info = null; if (u) { SFX.tap(); tutHook('sel', u.uid); } panel();
}
function onBoardMove(e) {
  if (!M || !M.drag) return; const p = boardPoint(e);
  M.drag.px = p.px; M.drag.py = p.py; if (Math.hypot(p.px - M.drag.sx, p.py - M.drag.sy) > 5) M.drag.moved = true;
  M.hover = (p.y >= P0 && p.y < BH && p.x >= 0 && p.x < BW && !M.obs[p.y * BW + p.x]) ? { x: p.x, y: p.y } : null;
  const ob = M.drag.moved && overBench(e); M.drag.toBench = ob; if (ob) M.hover = null; const bb = $('#b-bench'); if (bb) bb.classList.toggle('drop', !!ob);
}
function onBoardUp(e) {
  if (!M || !M.drag) return; const d = M.drag; M.drag = null; const h = M.hover; M.hover = null; const bb = $('#b-bench'); if (bb) bb.classList.remove('drop');
  if (!d.moved) {
    const nowT = performance.now(), dbl = M.phase === 'setup' && M.lastTap && M.lastTap.uid === d.uid && nowT - M.lastTap.t < 380;
    M.lastTap = dbl ? null : { uid: d.uid, t: nowT };
    if (dbl && d.hid) { benchRemove(d.hid); return; } // double-tap: back to the bench
    M.sel = d.uid; M.info = null; SFX.tap(); panel(); tutHook('sel', d.uid); return; }
  if (d.toBench && M.phase === 'setup') { benchRemove(d.hid); return; }
  if (!h || M.phase !== 'setup') return;
  const L = M.lineups[0].units; const me = L.find(u => u.hid === d.hid); const other = L.find(u => u.x === h.x && u.y === h.y);
  if (other && other !== me) { other.x = me.x; other.y = me.y; }
  me.x = h.x; me.y = h.y; SFX.step(); buzz(8);
  const sel = M.sel; rebuildPreview(); M.sel = sel; panel();
}

function flee() {
  if (!M) return;
  confirmBox('Leave the match? It counts as a loss.', 'Leave', () => finishMatch(true));
}
async function finishMatch(fled) {
  if (!M || M.finishing) return; M.finishing = true; M.phase = 'done';
  const sc = M.score; const winner = fled ? 1 : sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : 'draw';
  const win = winner === 0, draw = winner === 'draw';
  musicStop();
  if (!fled) await matchEndShow(win, draw);
  if (!M) return;
  if (M.setup.tut) { finishTutorialMatch(win, fled, sc); return; }
  const finalHids = M.lineups ? M.lineups[0].units.map(u => u.hid) : [];
  const res = finishBattle(S, M.setup, { winner, score: sc, stats: M.agg, flawless: M.flawless, rounds: M.rounds, syn3: activeSynergies(finalHids).some(x => x.n >= 3), captain: M.sides[0].captain,
    heroes: M.heroes, clutch: M.clutch, comeback: win && M.down02, feats: M.feats }, now());
  S.activeBattle = false; lsDel(STORE_BATTLE); persist();
  const newArena = res.arenaAfter > res.arenaBefore;
  const mvp = Object.entries(M.heroes).sort((a, b) => b[1].d - a[1].d)[0];
  const m = modal(`${resultHeader(win ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT', win ? 'win' : draw ? 'draw' : 'lose')}
    <p class="center" style="margin:0 0 8px;font-size:26px"><b>${sc[0]} – ${sc[1]}</b>${fled ? ' <span class="small mute">(left match)</span>' : ''}</p>
    <div class="rewards">
      <div class="rw" data-res="trophies">${icon('trophy')}<span style="color:${res.trophies >= 0 ? 'var(--gold)' : 'var(--red)'}" class="cup" data-to="${res.trophies}">${res.trophies >= 0 ? '+' : ''}0</span><small>${res.older ? 'older arena' : fmt(res.after) + ' total'}</small></div>
      ${res.coins ? `<div class="rw" data-res="coins">${icon('coin')}<span class="cup" data-to="${res.coins}">+0</span><small>coins</small></div>` : ''}
      <div class="rw">${icon('star')}<span class="cup" data-to="${res.xp}">+0</span><small>season XP</small></div>
      ${res.chest ? `<div class="rw new drop"><img src="${chestURL(res.chest)}"><span>${CHESTS[res.chest].name.split(' ')[0]}</span><small>chest won</small></div>` : ''}
    </div>
    ${res.chestFull ? `<p class="center small" style="color:var(--red)">Your chest shelf is full (${SHELF_MAX}), so no chest this time. Open some with keys!</p>` : ''}
    ${newArena ? `<div class="ab center newarena"><b style="color:var(--gold)">NEW ARENA!</b><br>${esc(ARENAS[res.arenaAfter].name)}</div>` : ''}
    ${mvp && mvp[1].d > 0 ? `<div class="mvp">${heroImg(mvp[0], '')}<div><small>Top hero</small><b>${esc(HERO[mvp[0]].name)}</b><span class="tiny mute">${fmt(mvp[1].d)} damage · ${mvp[1].k} defeated</span></div></div>` : ''}
    <div class="stat small" style="margin:8px 0"><span>Damage dealt</span><b>${fmt(M.agg.dmg)}</b><span></span><span>Enemies defeated</span><b>${M.agg.kills}</b><span></span><span>Abilities used</span><b>${M.agg.abil}</b><span></span></div>
    <button class="btn gold full" id="cont">Continue</button>`, { noClose: true });
  countUp(m); const gEnd = { coins: res.coins || 0, trophies: Math.max(0, res.trophies || 0) }; holdRes(gEnd);
  $('#cont', m).onclick = () => { const rects = {}; for (const k in gEnd) { const t = m.querySelector(`[data-res="${k}"]`); if (t) rects[k] = t.getBoundingClientRect(); } m.remove(); closeBattle(); setTimeout(() => { for (const k in gEnd) if (gEnd[k]) flood({ [k]: gEnd[k] }, rects[k] || null); }, 60); };
}
function closeBattle() {
  if (M && M.raf) cancelAnimationFrame(M.raf);
  musicStop(); bvZoom(null);
  M = null; $('#battle').classList.add('hidden'); TAB = 'battle'; go('battle'); pendingEvents();
  tutHook('home');
}
// big end-of-match moment on the board: letters drop in, confetti and hopping heroes for a win, a heavy slam for a loss
function matchEndShow(win, draw) {
  return new Promise(done => {
    const host = $('.bboard'), cv = $('#bc'), d = document.createElement('div');
    const txt = win ? 'VICTORY!' : draw ? 'DRAW' : 'DEFEAT';
    d.className = 'bigban ' + (win ? 'win' : draw ? 'draw' : 'lose');
    d.innerHTML = `${win ? '<div class="bb-rays"></div>' : ''}<div class="bb-txt">${[...txt].map((c, i) => `<span style="animation-delay:${0.05 + i * 0.07}s">${c}</span>`).join('')}</div>`;
    host.appendChild(d);
    if (win) { SFX.fanfare(); buzz([30, 40, 60]); [0, 300, 650].forEach(t => setTimeout(() => confetti(host, '#ffd23f', 36), t)); if (M) M.cheer = { side: 0, t0: bvNow(), big: true }; }
    else if (draw) SFX.lose();
    else { SFX.defeat(); setTimeout(() => { bvShake(4, 450); buzz(90); }, 380); cv.classList.add('gloom'); if (M) M.cheer = { side: 1, t0: bvNow() }; }
    setTimeout(() => d.classList.add('out'), 1950);
    setTimeout(() => { d.remove(); cv.classList.remove('gloom'); done(); }, 2250);
  });
}
function resultHeader(txt, cls) { return `<div class="result-h ${cls}">${[...txt].map((c, i) => `<span style="animation-delay:${0.1 + i * 0.06}s">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>`; }
// numbers in the results tick up from 0
function countUp(root) {
  root.querySelectorAll('.cup').forEach(el => {
    const to = +el.dataset.to, t0 = performance.now(), D = 700;
    const f = nowT => { const q = Math.min(1, (nowT - t0) / D), v = Math.round(to * (1 - Math.pow(1 - q, 3))); el.textContent = (to >= 0 ? '+' : '') + fmt(v); if (q < 1 && el.isConnected) requestAnimationFrame(f); else if (q >= 1 && to !== 0) { el.classList.add('pop'); } };
    setTimeout(() => requestAnimationFrame(f), 250);
  });
}
function finishTutorialMatch(win, fled, sc) {
  const first = finishTutorial(S); persist();
  if (fled) { const skipped = M.tutSkipped; tutHook('matchDone', { win: false, fled: true }); TUT = null; coachHide(); closeBattle(); if (first) toast(skipped ? 'Tutorial skipped. A Hero Chest is waiting on your shelf!' : 'A Hero Chest is waiting on your shelf!'); return; }
  const m = modal(`${resultHeader(win ? 'PRACTICE WON' : 'PRACTICE DONE', win ? 'win' : 'lose')}
    <p class="center" style="margin:0 0 8px;font-size:26px"><b>${sc[0]} – ${sc[1]}</b></p>
    ${first ? `<div class="rewards"><div class="rw new drop"><img src="${chestURL('hero')}"><span>Hero Chest</span><small>for finishing</small></div></div>` : ''}
    <p class="center small mute">Practice matches don't change your trophies.</p>
    <button class="btn gold full" id="cont">Continue</button>`, { noClose: true });
  $('#cont', m).onclick = () => { m.remove(); closeBattle(); };
  tutHook('matchDone', { win, fled: false });
}
function banner(text, color) { const d = document.createElement('div'); d.className = 'banner'; d.style.color = color || '#fff'; d.textContent = text; $('.bboard').appendChild(d); setTimeout(() => d.remove(), 1100); }

// ---------- season / pending events ----------
function pendingEvents() {
  if (!S.pendingEvents || !S.pendingEvents.length) return;
  const ev = S.pendingEvents.shift(); persist();
  if (ev.type === 'season') {
    const all = { coins: 0, gems: 0, keys: 0, trophies: {}, newHeroes: [] };
    for (const r of ev.rewards.concat([ev.endReward])) { all.coins += r.coins || 0; all.gems += r.gems || 0; all.keys += r.keys || 0; for (const h in (r.trophies || {})) all.trophies[h] = (all.trophies[h] || 0) + r.trophies[h]; (r.newHeroes || []).forEach(h => all.newHeroes.push(h)); }
    modal(`<h2>Season ${seasonNumber(ev.old)} ended!</h2><p class="center small mute">You reached tier ${ev.tierReached}. Unclaimed rewards were collected for you, plus a season bonus.</p>${rewardTiles(all)}
      ${ev.reset ? `<p class="center small">Trophies reset: ${fmt(ev.reset[0])} ${icon('i_right','ii')} <b style="color:var(--gold)">${fmt(ev.reset[1])}</b></p>` : ''}
      <button class="btn gold full" data-close>Start Season ${seasonNumber(S.season.id)}</button>`, { onClose: pendingEvents });
  }
}

// ---------- boot ----------
function boot() {
  S = loadSave(); const fresh = !S;
  if (!S) { S = newSave(now()); if (BUILD === 'test') testSeed(S); }
  tick(S, now()); persist();
  if (BUILD === 'test') { const tg = document.createElement('span'); tg.className = 'tag'; tg.style.cssText = 'background:var(--red);color:#fff;font-size:14px;padding:2px 4px;flex:none'; tg.textContent = 'TEST'; $('#topbar').insertBefore(tg, $('#gear')); }
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { SFX.tap(); go(b.dataset.tab); });
  initTabSwipe();
  $('#gear').innerHTML = icon('i_gear', 'ib'); $('#b-flee').innerHTML = icon('i_x', 'ii');
  $('#gear').onclick = openSettings;
  $('#tabs [data-tab=shop] img').src = sprURL('coin'); $('#tabs [data-tab=heroes] img').src = sprURL('bruno');
  $('#prof').onclick = () => { SFX.tap(); openProfile(); };
  $('#tabs [data-tab=battle] img').src = sprURL('relic'); $('#tabs [data-tab=season] img').src = sprURL('star'); $('#tabs [data-tab=road] img').src = sprURL('trophy');
  $('#i-tro').src = sprURL('trophy'); $('#i-coin').src = sprURL('coin'); $('#i-gem').src = sprURL('gem');
  const cv = $('#bc'); cv.addEventListener('pointerdown', onBoardDown); cv.addEventListener('pointermove', onBoardMove); cv.addEventListener('pointerup', onBoardUp); cv.addEventListener('pointercancel', () => { if (M) { M.drag = null; M.hover = null; } });
  $('#b-flee').onclick = flee; $('#b-ev').onclick = () => { if (M) toast(esc(EVENTS[M.setup.event].desc)); };
  window.addEventListener('resize', () => { fixViewport(); if (M) bvLayout(); });
  window.addEventListener('orientationchange', () => setTimeout(fixViewport, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fixViewport(); });
  fixViewport(); setTimeout(fixViewport, 500);
  go('battle'); ACH_QUIET = false;
  let lastSig = '';
  setInterval(() => {
    if (M) return;
    tick(S, now());
    const sig = S.keys + ':' + S.shelf.length + S.quests.day + S.season.id + S.shop.day;
    if (sig !== lastSig) { if (lastSig) { persist(); if (!document.querySelector('.modal-bg')) render(); else renderTop(); } lastSig = sig; }
    updateTimers();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { musicStop(true); return; }
    if (M) { if (M.phase !== 'done') { musicMode(M.phase === 'fight' ? 'fight' : 'calm', true); musicStart(M.setup.arena); } return; }
    tick(S, now()); persist(); render(); pendingEvents();
  });
  // resume an interrupted match
  const raw = lsGet(STORE_BATTLE);
  if (raw && S.activeBattle) {
    try {
      const sv = JSON.parse(raw); if (!sv.sides) throw new Error('old battle format');
      // matches saved on the old 5-row board: keep the score, drop stored positions so they're rebuilt for the new board
      const offBoard = l => l && l.units.some(u => u.y >= BH);
      if (sv.bh !== BH || (sv.lineups && sv.lineups.some(offBoard)) || (sv.prev && sv.prev.some(offBoard))) { sv.lineups = null; sv.prev = [null, null]; }
      const m = modal(`<h2>Match in progress</h2><p class="center">You left a match against <b>${esc(sv.setup.foeName)}</b> (${sv.score[0]}–${sv.score[1]}). Jump back in?</p><div class="row" style="gap:8px"><button class="btn red grow" id="ff">Forfeit</button><button class="btn gold grow" id="rs">Resume</button></div>`, { noClose: true });
      $('#rs', m).onclick = () => { m.remove(); beginMatch(sv.setup, sv); };
      $('#ff', m).onclick = () => { m.remove(); finishBattle(S, sv.setup, { winner: 1, score: sv.score, stats: sv.agg, flawless: 0, rounds: sv.rounds }, now()); S.activeBattle = false; lsDel(STORE_BATTLE); persist(); render(); toast('Match forfeited'); };
    } catch (e) { S.activeBattle = false; lsDel(STORE_BATTLE); persist(); }
  } else if (S.activeBattle) { S.activeBattle = false; persist(); }
  if (fresh && BUILD === 'test') modal(`<h2>Test Build</h2><p class="center small">All 20 heroes are unlocked with all 3 abilities, plus 999,999 coins, 99,999 gems and 10 keys. This save is separate from the normal preview.</p><p class="center small mute">More tools in ${icon('i_gear','ii')} Settings ${icon('i_right','ii')} Test tools: jump to any arena, reset hero trophies, skip time to test keys, fill the chest shelf.</p><button class="btn gold full" data-close>Show me the heroes</button>`, { onClose: () => go('heroes') });
  else if (!S.tutorialDone && !S.activeBattle) tutorialIntro();
  else pendingEvents();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}

function tutorialIntro() {
  const m = modal(`<h2>Welcome to Rift Squad!</h2><div class="center">${liveHero('bruno', 5)}</div>
    <p class="center">Heroes from every world got pulled through the Rift. I'm <b>Sir Bruno</b>. Let me show you how battles work in a quick practice match.</p>
    <button class="btn gold big full" id="tut-go">Play the tutorial</button><button class="btn gray sm full" style="margin-top:8px" id="tut-skip">Skip, I know how to play</button>`, { noClose: true });
  $('#tut-go', m).onclick = () => { m.remove(); runTutorial(); };
  $('#tut-skip', m).onclick = () => { m.remove(); finishTutorial(S); persist(); render(); openHelp(); toast('A Hero Chest is waiting on your shelf!'); };
}
// short taste of the current arena's tune when music is switched on in Settings
function musicPreview() { if (M) return; musicMode('fight', true); musicStart(arenaIndex(S.trophies)); setTimeout(() => { if (!M) musicStop(); }, 4000); }

// ---------- TEST BUILD tools ----------
function testSeed(s) {
  HEROES.forEach(h => { s.heroes[h.id] = { tr: 10, un: [1, 1, 1], eq: 0, rc: [] }; });
  s.coins = 999999; s.gems = 99999; s.keys = 10; s.wild = 3; s.squad = ['chrono', 'zorp', 'ember', 'vex', 'ragnar', 'luna']; s.tutorialDone = true;
}
function testToolsHTML() {
  return `<h3 style="margin:14px 0 6px;color:var(--red)">Test tools</h3>
  <div class="row" style="gap:6px"><input class="txt grow" id="tt-tro" type="number" inputmode="numeric" value="${S.trophies}" style="min-width:0"><button class="btn sm" id="tt-set">Set trophies</button></div>
  <div class="small mute" style="margin:4px 0 8px">${ARENAS.map((a, i) => `<a href="#" data-ar="${a.t}" style="color:var(--blue)">${i + 1}</a>`).join(' · ')} ${icon('i_left','ii')} jump to arena</div>
  <div class="grid3" style="gap:6px">
    <button class="btn sm green" id="tt-max">All abilities</button><button class="btn sm gray" id="tt-l1">Trophies to 1</button><button class="btn sm gold" id="tt-cash">+Coins/Gems</button>
    <button class="btn sm purple" id="tt-1h">+1 hour</button><button class="btn sm purple" id="tt-1d">+1 day</button><button class="btn sm purple" id="tt-31d">+31 days</button>
    <button class="btn sm" id="tt-chests">Fill shelf</button><button class="btn sm" id="tt-keys">+10 keys</button><button class="btn sm" id="tt-xp">+3000 XP</button>
  </div>
  <p class="tiny mute" style="margin:6px 0 0">Clock offset: ${fmtDur(S.testOffset || 0) || '0s'} ahead</p>`;
}
function wireTestTools(m) {
  const done = (msg) => { tick(S, now()); persist(); m.close(); render(); toast(msg); };
  const setTro = v => { S.trophies = Math.max(0, v | 0); S.best = Math.max(S.best, S.trophies); S.season.peak = Math.max(S.season.peak || 0, S.trophies); };
  $('#tt-set', m).onclick = () => { setTro(+$('#tt-tro', m).value); done('Trophies set'); };
  m.querySelectorAll('[data-ar]').forEach(a => a.onclick = e => { e.preventDefault(); setTro(+a.dataset.ar); done('Jumped to ' + ARENAS[arenaIndex(S.trophies)].name); });
  $('#tt-max', m).onclick = () => { HEROES.forEach(h => S.heroes[h.id] = { tr: 10, un: [1, 1, 1], eq: S.heroes[h.id] && S.heroes[h.id].eq >= 0 ? S.heroes[h.id].eq : 0, rc: (S.heroes[h.id] || {}).rc || [] }); done('Every ability unlocked'); };
  $('#tt-l1', m).onclick = () => { HEROES.forEach(h => S.heroes[h.id] = { tr: 1, un: [0, 0, 0], eq: -1 }); done('All heroes back to 1 trophy'); };
  $('#tt-cash', m).onclick = () => { S.coins += 100000; S.gems += 10000; done('+100k coins, +10k gems'); };
  const skip = ms => { S.testOffset = (S.testOffset || 0) + ms; done('Skipped ' + fmtDur(ms)); };
  $('#tt-1h', m).onclick = () => skip(HOUR); $('#tt-1d', m).onclick = () => skip(DAY); $('#tt-31d', m).onclick = () => skip(31 * DAY);
  $('#tt-chests', m).onclick = () => { const a = arenaIndex(S.trophies); let k = 0; while (S.shelf.length < SHELF_MAX) addToShelf(S, ['hero', 'resource', 'hero', 'mega'][k++ % 4], a); done('Chest shelf filled'); };
  $('#tt-keys', m).onclick = () => { S.keys += 10; done('+10 keys'); };
  $('#tt-xp', m).onclick = () => { S.season.xp += 3000; done('+3000 season XP'); };
}

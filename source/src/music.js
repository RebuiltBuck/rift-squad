// ===== Rift Squad: chiptune battle music =====
// Every arena has its own tune, made up from a key, scale, tempo and chord loop (same notes every time you play there).
// Layers: 'calm' (setup: bass + arpeggio + soft hats) and 'fight' (adds lead melody + drums).
const MUS_SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
const MUS_TUNES = [
  { root: 60, sc: 'major',  bpm: 124, prog: [0, 4, 5, 3], lead: 'square',   bass: 0 }, // Training Meadow
  { root: 57, sc: 'dorian', bpm: 118, prog: [0, 6, 3, 4], lead: 'square',   bass: 1 }, // Goblin Woods
  { root: 62, sc: 'phryg',  bpm: 112, prog: [0, 1, 0, 6], lead: 'triangle', bass: 2 }, // Sandstone Ruins
  { root: 55, sc: 'mixo',   bpm: 132, prog: [0, 6, 3, 0], lead: 'square',   bass: 3 }, // Pirate Cove
  { root: 64, sc: 'minor',  bpm: 108, prog: [0, 5, 2, 6], lead: 'triangle', bass: 2 }, // Frostpeak
  { root: 57, sc: 'minor',  bpm: 138, prog: [0, 5, 6, 4], lead: 'sawtooth', bass: 1 }, // Neon City
  { root: 59, sc: 'harm',   bpm: 116, prog: [0, 5, 3, 4], lead: 'square',   bass: 0 }, // Mummy Tomb
  { root: 52, sc: 'phryg',  bpm: 142, prog: [0, 1, 6, 0], lead: 'sawtooth', bass: 3 }, // Lava Forge
  { root: 62, sc: 'harm',   bpm: 104, prog: [0, 3, 5, 4], lead: 'triangle', bass: 2 }, // Haunted Manor
  { root: 60, sc: 'mixo',   bpm: 136, prog: [0, 3, 6, 4], lead: 'square',   bass: 1 }, // Robot Factory
  { root: 55, sc: 'dorian', bpm: 128, prog: [0, 3, 0, 6], lead: 'square',   bass: 3 }, // Dino Jungle
  { root: 64, sc: 'major',  bpm: 100, prog: [0, 5, 3, 4], lead: 'triangle', bass: 2 }, // Moon Base
  { root: 61, sc: 'minor',  bpm: 120, prog: [0, 6, 5, 6], lead: 'triangle', bass: 0 }, // Crystal Caverns
  { root: 58, sc: 'mixo',   bpm: 126, prog: [0, 4, 6, 3], lead: 'square',   bass: 1 }, // Clockwork Tower
  { root: 53, sc: 'harm',   bpm: 146, prog: [0, 5, 1, 4], lead: 'sawtooth', bass: 3 }, // The Rift
];
const MUS_BASS = ['1000100010001000', '1000101010001010', '1000001010000010', '1010101010101010'];
const MUS_RHY = ['1000100010101000', '1000001010001000', '1010100010001000', '1000100000101010', '1001001000101000', '1000101000100000'];

// build the 8-bar loop for one arena: arrays of { step, midi, len } per voice
function musCompose(a) {
  const T = MUS_TUNES[a % MUS_TUNES.length], sc = MUS_SCALES[T.sc], rnd = mulberry32(0x51ab + a * 977);
  const deg = d => { const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return T.root + o * 12 + sc[i]; };
  const bass = [], arp = [], lead = [], drums = [];
  const BP = MUS_BASS[T.bass];
  for (let bar = 0; bar < 8; bar++) {
    const c = T.prog[bar % 4], chord = [c, c + 2, c + 4];
    for (let i = 0; i < 16; i++) {
      const st = bar * 16 + i;
      if (BP[i] === '1') bass.push({ step: st, midi: deg(c) - 24 + (i % 8 === 4 && T.bass !== 0 ? 12 : 0), len: 1.6 });
      if (i % 2 === 0) arp.push({ step: st, midi: deg(chord[(i / 2) % 3] + (i >= 8 ? 7 : 0)), len: 0.9 });
      if (i === 0 || i === 8 || (T.bpm > 125 && i === 10)) drums.push({ step: st, kind: 'k' });
      if (i === 4 || i === 12) drums.push({ step: st, kind: 's' });
      if (i % 2 === 0) drums.push({ step: st, kind: 'h' });
    }
  }
  // melody: motif A (bars 1-2), A again ending home (3-4), B (5-6), A (7-8)
  const motif = () => {
    const r1 = MUS_RHY[Math.floor(rnd() * MUS_RHY.length)], r2 = MUS_RHY[Math.floor(rnd() * MUS_RHY.length)];
    const out = []; let d = 7 + Math.floor(rnd() * 3);
    for (let b = 0; b < 2; b++) { const R = b ? r2 : r1;
      for (let i = 0; i < 16; i++) if (R[i] === '1') {
        const strong = i % 8 === 0; d += strong ? 0 : [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)]; d = Math.max(4, Math.min(13, d));
        let len = 1; while (i + len < 16 && R[i + len] !== '1') len++;
        out.push({ bar: b, i, d, strong, len });
      } }
    return out;
  };
  const A = motif(), B = motif();
  const place = (m, bar0, home) => m.forEach((n, k) => {
    const c = T.prog[(bar0 + n.bar) % 4];
    let d = n.d;
    if (n.strong) { const tones = [c, c + 2, c + 4, c + 7, c + 9, c + 11]; d = tones.reduce((p, q) => Math.abs(q - n.d) < Math.abs(p - n.d) ? q : p); }
    if (home && k === m.length - 1) d = 7;
    lead.push({ step: (bar0 + n.bar) * 16 + n.i, midi: deg(d), len: Math.min(n.len, 6) * 0.9 });
  });
  place(A, 0, false); place(A, 2, true); place(B, 4, false); place(A, 6, true);
  return { T, steps: 128, bass, arp, lead, drums };
}

const MUS = { on: false, arena: -1, tune: null, timer: 0, next: 0, step: 0, master: null, g: {}, noise: null, mode: 'calm' };
const MUS_LAYERS = { calm: { lead: 0, arp: 1, bass: 0.8, drums: 0.35 }, fight: { lead: 1, arp: 0.7, bass: 1, drums: 1 }, end: { lead: 0, arp: 0, bass: 0, drums: 0 } };
function musCtx() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!MUS.master) {
      MUS.master = AC.createGain(); MUS.master.gain.value = 0; MUS.master.connect(AC.destination);
      for (const k of ['lead', 'arp', 'bass', 'drums']) { const g = AC.createGain(); g.gain.value = 0; g.connect(MUS.master); MUS.g[k] = g; }
      const len = AC.sampleRate * 0.5, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      MUS.noise = buf;
    }
    return AC;
  } catch (e) { return null; }
}
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
function musNote(dest, wave, midi, t, dur, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = wave; o.frequency.setValueAtTime(midiHz(midi), t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function musDrum(kind, t) {
  const dest = MUS.g.drums;
  if (kind === 'k') { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.18); return; }
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); src.buffer = MUS.noise;
  f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
  const v = kind === 's' ? 0.32 : 0.09, d = kind === 's' ? 0.12 : 0.03;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * 0.3); src.stop(t + d + 0.01);
}
function musTick() {
  if (!MUS.on || !AC) return;
  const tune = MUS.tune, spb = 60 / tune.T.bpm / 4;
  while (MUS.next < AC.currentTime + 0.15) {
    const st = MUS.step % tune.steps, t = MUS.next;
    for (const n of tune.bass) if (n.step === st) musNote(MUS.g.bass, 'triangle', n.midi, t, n.len * spb, 0.5);
    for (const n of tune.arp) if (n.step === st) musNote(MUS.g.arp, 'square', n.midi, t, n.len * spb, 0.07);
    for (const n of tune.lead) if (n.step === st) musNote(MUS.g.lead, tune.T.lead, n.midi, t, n.len * spb, tune.T.lead === 'sawtooth' ? 0.1 : tune.T.lead === 'triangle' ? 0.32 : 0.13);
    for (const n of tune.drums) if (n.step === st) musDrum(n.kind, t);
    MUS.step++; MUS.next += spb;
  }
}
function musicStart(arena) {
  if (!S || !S.settings.music) return;
  if (!musCtx()) return;
  if (MUS.on && MUS.arena === arena) return;
  musicStop(true);
  MUS.tune = musCompose(arena); MUS.arena = arena; MUS.on = true; MUS.step = 0; MUS.next = AC.currentTime + 0.08;
  MUS.master.gain.cancelScheduledValues(AC.currentTime); MUS.master.gain.setValueAtTime(0.0001, AC.currentTime); MUS.master.gain.exponentialRampToValueAtTime(0.075, AC.currentTime + 0.8);
  musicMode(MUS.mode || 'calm', true);
  clearInterval(MUS.timer); MUS.timer = setInterval(musTick, 25); musTick();
}
function musicMode(mode, now) {
  MUS.mode = mode; if (!MUS.master || !AC) return;
  const L = MUS_LAYERS[mode] || MUS_LAYERS.calm;
  for (const k in L) MUS.g[k].gain.setTargetAtTime(L[k], AC.currentTime, now ? 0.01 : 0.35);
}
function musicStop(quick) {
  if (!MUS.on) return; MUS.on = false; MUS.arena = -1; clearInterval(MUS.timer);
  if (MUS.master && AC) { MUS.master.gain.cancelScheduledValues(AC.currentTime); MUS.master.gain.setTargetAtTime(0.0001, AC.currentTime, quick ? 0.02 : 0.25); }
}

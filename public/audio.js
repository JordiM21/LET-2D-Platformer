// Synth sound effects (no audio files). Based on the LET Junior activity sound engine.
const LSK = 'letWorld';
let muted = localStorage.getItem(LSK + 'Muted') === '1';
let actx = null, master = null, noiseBuf = null;

function audio() {
  if (actx) return actx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain(); master.gain.value = 0.7;
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 26; comp.ratio.value = 3.2;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(actx.destination);
  } catch { actx = null; }
  return actx;
}
function wake() { const c = audio(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
document.addEventListener('pointerdown', wake, true);
document.addEventListener('keydown', wake, true);

function noise() {
  const c = audio(); if (!c) return null;
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.25);
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) { const k = 1 - i / len; d[i] = (Math.random() * 2 - 1) * k * k; }
  return noiseBuf;
}
function note(o) {
  const c = audio(); if (!c || muted || c.state !== 'running') return;
  const t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.2;
  const osc = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(o.cutoff || 5200, t0); f.Q.value = 0.5;
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur * 0.8);
  const peak = o.gain ?? 0.16, atk = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(f); f.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.04);
}
function tick(o = {}) {
  const c = audio(); if (!c || muted || c.state !== 'running') return;
  const buf = noise(); if (!buf) return;
  const t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.035;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass';
  f.frequency.value = o.freq || 2400; f.Q.value = o.q || 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.05, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.02);
}
function haptic(p) { if (muted) return; try { navigator.vibrate?.(p); } catch { /* unsupported */ } }

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
let tapStep = 0, lastTapAt = -99;

export const sfx = {
  get muted() { return muted; },
  setMuted(v) { muted = v; localStorage.setItem(LSK + 'Muted', v ? '1' : '0'); },

  tap() {
    const now = actx ? actx.currentTime : 0;
    if (now - lastTapAt > 1.5) tapStep = 0;
    lastTapAt = now;
    const f = [987.77, 1108.73, 1318.51, 1479.98, 1760.0][tapStep++ % 5];
    tick({ freq: 3000, gain: 0.03, dur: 0.028 });
    note({ freq: f, dur: 0.075, gain: 0.09, attack: 0.004, cutoff: 7000 });
    haptic(8);
  },
  jump() {
    note({ freq: 330, to: 720, dur: 0.14, type: 'triangle', gain: 0.09, cutoff: 3000 });
    tick({ freq: 1800, gain: 0.02, dur: 0.03 });
  },
  land(strength) {
    const s = Math.min(1, strength);
    tick({ freq: 380, q: 0.7, gain: 0.05 + 0.08 * s, dur: 0.05 + 0.05 * s, filter: 'lowpass' });
    note({ freq: 150, to: 90, dur: 0.09, gain: 0.05 + 0.07 * s, cutoff: 600 });
    if (s > 0.8) haptic(15);
  },
  step() { tick({ freq: 900 + Math.random() * 400, q: 0.8, gain: 0.012, dur: 0.025 }); },
  bounce() {
    note({ freq: 180, to: 900, dur: 0.32, type: 'sine', gain: 0.14, cutoff: 2600 });
    note({ freq: 360, to: 1400, dur: 0.22, type: 'triangle', gain: 0.05, delay: 0.02, cutoff: 4000 });
    haptic([10, 20, 10]);
  },
  star(combo) {
    const f = PENTA[Math.min(combo, PENTA.length - 1)];
    note({ freq: f, dur: 0.18, type: 'triangle', gain: 0.1, cutoff: 6000 });
    note({ freq: f * 2, dur: 0.12, delay: 0.05, gain: 0.05, cutoff: 9000 });
    tick({ freq: 5000, gain: 0.02, dur: 0.02 });
  },
  poof() {
    tick({ freq: 700, q: 0.5, gain: 0.08, dur: 0.18, filter: 'lowpass' });
    note({ freq: 600, to: 200, dur: 0.2, gain: 0.06, cutoff: 1500 });
  },
  appear() {
    [523.25, 783.99, 1046.5].forEach((f, i) => note({ freq: f, delay: 0.05 * i, dur: 0.16, type: 'triangle', gain: 0.07 }));
  },
  near() { note({ freq: 880, dur: 0.1, type: 'sine', gain: 0.05 }); note({ freq: 1318.5, dur: 0.12, delay: 0.06, gain: 0.05 }); },
  open() {
    tick({ freq: 1800, gain: 0.04, dur: 0.035 });
    [392, 523.25, 659.25, 783.99].forEach((f, i) => note({ freq: f, delay: 0.045 * i, dur: 0.22, type: 'triangle', gain: 0.08, cutoff: 4800 }));
    haptic(12);
  },
  close() { [659.25, 523.25].forEach((f, i) => note({ freq: f, delay: 0.05 * i, dur: 0.14, type: 'triangle', gain: 0.07 })); },
  discover() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      note({ freq: f, delay: 0.09 * i, dur: 0.45, type: 'triangle', gain: 0.1, cutoff: 5200 });
      note({ freq: f * 1.5, delay: 0.09 * i, dur: 0.3, gain: 0.03, cutoff: 8000 });
    });
    haptic([12, 50, 12, 50, 24]);
  },
  emote() { note({ freq: 700, to: 1100, dur: 0.12, type: 'sine', gain: 0.08 }); tick({ freq: 2600, gain: 0.03, dur: 0.03 }); },
  join() { note({ freq: 659.25, dur: 0.12, gain: 0.06 }); note({ freq: 987.77, delay: 0.08, dur: 0.16, gain: 0.06 }); },
  select() {
    tick({ freq: 1800, gain: 0.045, dur: 0.035 });
    note({ freq: 659.25, dur: 0.1, type: 'triangle', gain: 0.1, cutoff: 3600 });
    haptic(10);
  },
};

// Procedural WebAudio: hammer-on-chisel clinks, rasp scrapes, cracks and debris thuds.
let ctx = null, master = null, noiseBuf = null;

function ensure() {
  if (ctx) return ctx.state === 'suspended' ? (ctx.resume(), ctx) : ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export const setVolume = (v) => { ensure(); if (master) master.gain.value = v; };

function noiseBurst({ freq, q = 1, dur = 0.08, gain = 0.4, type = 'bandpass', delay = 0 }) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone({ freq, dur = 0.12, gain = 0.15, type = 'triangle', delay = 0 }) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  strike(force = 1) {
    tone({ freq: 2400 + Math.random() * 600, dur: 0.07, gain: 0.08 * force });
    tone({ freq: 1150 + Math.random() * 200, dur: 0.1, gain: 0.06 * force });
    noiseBurst({ freq: 3500, q: 0.8, dur: 0.06 + 0.04 * force, gain: 0.35 * force });
  },
  rasp() { noiseBurst({ freq: 5000, q: 0.5, dur: 0.07, gain: 0.12, type: 'highpass' }); },
  polish() { noiseBurst({ freq: 7000, q: 0.3, dur: 0.06, gain: 0.05, type: 'highpass' }); },
  plaster() { noiseBurst({ freq: 400, q: 0.7, dur: 0.12, gain: 0.18, type: 'lowpass' }); },
  crack(big = false) {
    noiseBurst({ freq: 900, q: 0.6, dur: big ? 0.35 : 0.18, gain: big ? 0.7 : 0.45 });
    tone({ freq: 160, dur: 0.25, gain: 0.2, type: 'sine' });
    for (let i = 1; i < 4; i++) noiseBurst({ freq: 1800 + i * 500, q: 2, dur: 0.05, gain: 0.2, delay: i * 0.03 });
  },
  thud(mass = 1) {
    const g = Math.min(0.6, 0.15 + mass * 0.4);
    noiseBurst({ freq: 220, q: 0.8, dur: 0.18, gain: g, type: 'lowpass' });
    tone({ freq: 90 + Math.random() * 30, dur: 0.16, gain: g * 0.6, type: 'sine' });
  },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.35, gain: 0.12, delay: i * 0.12 })); },
};

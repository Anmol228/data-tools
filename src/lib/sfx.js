// Soft synthesized tones (Web Audio), no files needed.
export const sfx = (() => {
  let ctx = null, master = null, on = true, lastHover = 0;
  const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];   // pentatonic, one note per tool
  const freq = (i) => 392 * Math.pow(2, STEPS[i % STEPS.length] / 12);
  function ready() {
    if (!on) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1.6;   // the notes themselves are soft; this brings them to a clearly audible level
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  }
  // Browsers keep audio locked until the first tap, click or key press: unlock it right then.
  // The silent <audio> clip also lets iPhones play web audio while the silent switch is on.
  let unlocked = false;
  function unlock() {
    if (unlocked || !on) return;
    unlocked = true;
    try { const a = new Audio("data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=="); a.setAttribute("playsinline", ""); a.play().catch(() => {}); } catch (e) {}
    if (ready()) {
      const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    }
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach((ev) => addEventListener(ev, unlock, { capture: true, passive: true }));
  function tone(f, at, dur, type, peak) {
    peak = Math.min(0.5, peak * 2.5);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master);
    o.start(at); o.stop(at + dur + 0.05);
  }
  function whoosh(at, dur, f0, f1, peak) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain();
    peak = Math.min(0.5, peak * 2.5);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(at); src.stop(at + dur);
  }
  return {
    get on() { return on; },
    set(v) { on = v; if (v && ready()) tone(880, ctx.currentTime, 0.12, "sine", 0.05); },
    hover(i) {
      const now = performance.now();
      if (now - lastHover < 90 || !ready()) return;
      lastHover = now;
      const t = ctx.currentTime;
      tone(freq(i) * 2, t, 0.18, "sine", 0.045);
      tone(freq(i) * 4, t, 0.09, "sine", 0.012);
    },
    open(i) {
      if (!ready()) return;
      const t = ctx.currentTime, f = freq(i);
      whoosh(t, 0.35, 260, 2600, 0.03);
      tone(f, t + 0.02, 1.2, "sine", 0.08);
      tone(f * 1.5, t + 0.08, 1.1, "sine", 0.06);
      tone(f * 2, t + 0.14, 1.0, "sine", 0.045);
      tone(f * 4, t + 0.14, 0.5, "triangle", 0.015);
    },
    swap(i) {
      if (!ready()) return;
      const t = ctx.currentTime, f = freq(i);
      tone(f * 2, t, 0.3, "triangle", 0.05);
      tone(f * 3, t + 0.05, 0.35, "sine", 0.035);
    },
    close() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(660, t, 0.2, "sine", 0.05);
      tone(440, t + 0.07, 0.28, "sine", 0.045);
    },
    tab() {
      if (!ready()) return;
      const t = ctx.currentTime;
      whoosh(t, 0.25, 600, 3200, 0.025);
      tone(587.33, t, 0.22, "triangle", 0.05);
      tone(880, t + 0.07, 0.3, "sine", 0.045);
    },
    expand() {
      if (!ready()) return;
      const t = ctx.currentTime;
      whoosh(t, 0.55, 300, 5200, 0.05);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(f, t + 0.1 + k * 0.06, 1.3, "sine", 0.05));
    }
  };
})();

// Bell sound effect synthesized with Web Audio API — no external audio file
// required. Used to celebrate point awards in barstool mode. Designed to
// evoke the classic Price-is-Right "ding": bright, brassy, sharp attack,
// gentle decay over ~1.5s.
//
// Browsers block audio until the user has interacted with the page, so we
// expose `unlockAudio()` — call it from a one-shot user-gesture listener so
// subsequent `playBell()` calls (which come from broadcasts, not gestures)
// can sound.

let ctx = null;
let unlocked = false;

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  if (unlocked) return;
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }
  unlocked = true;
}

// Inharmonic partials chosen to evoke a struck brass bell. The fundamental
// is up at C6 (~1047 Hz) so the ding cuts through ambient room sound.
const PARTIALS = [
  { freq: 1047, gain: 0.42, decay: 1.6 },
  { freq: 1568, gain: 0.22, decay: 1.2 },
  { freq: 2093, gain: 0.16, decay: 0.9 },
  { freq: 3136, gain: 0.10, decay: 0.7 },
  { freq: 4186, gain: 0.05, decay: 0.5 },
];

export function playBell() {
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }
  const now = audio.currentTime;

  const master = audio.createGain();
  master.gain.value = 0.55;
  master.connect(audio.destination);

  PARTIALS.forEach(({ freq, gain, decay }) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(master);
    // Sharp attack (3ms) + exponential decay to silence — the classic bell
    // envelope. exponentialRampToValueAtTime needs a non-zero target.
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  });
}

// Áudio procedural com Web Audio: efeitos sonoros e trilha por zona, sem arquivos externos.
// O contexto só é criado após um gesto do jogador (exigência dos navegadores).
import { settings } from './settings.js';

let ctx = null;
let master = null;
let limiter = null;
// Teto do ganho de saída (amplitude). Nada passa de 1.0 no destino.
export const MAX_OUT = 0.8;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let musicTimer = 0;
let musicState = null;

// Escalas em semitons e configurações por zona
const ZONE_MUSIC = {
  cache: { root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle', tempo: 0.42, drone: 0.05 },
  regs: { root: 196, scale: [0, 2, 4, 7, 9], wave: 'sine', tempo: 0.5, drone: 0.05 },
  alu: { root: 185, scale: [0, 1, 5, 7, 8], wave: 'sawtooth', tempo: 0.36, drone: 0.04 },
  pipeline: { root: 233, scale: [0, 2, 3, 7, 9], wave: 'square', tempo: 0.3, drone: 0.04 },
  memory: { root: 174, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'triangle', tempo: 0.55, drone: 0.06 },
  bus: { root: 262, scale: [0, 2, 4, 7, 9], wave: 'square', tempo: 0.28, drone: 0.05 },
  core: { root: 146, scale: [0, 1, 3, 6, 7], wave: 'sine', tempo: 0.4, drone: 0.07 },
  battle: { root: 165, scale: [0, 1, 3, 6, 7], wave: 'sawtooth', tempo: 0.22, drone: 0.05 },
};

// Só cria o contexto depois de um gesto do jogador (evita o aviso do navegador)
let unlocked = false;

function ensure() {
  if (ctx) return ctx;
  if (!unlocked) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Limitador de saída: o compressor impede picos acima do teto, e o ganho mestre nunca passa de MAX_OUT
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = settings.sound ? MAX_OUT : 0;
    master.connect(limiter);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.6 * settings.volSfx;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.35 * settings.volMusic;
    musicBus.connect(master);
    // Ruído branco para passos e impactos
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

// Deve ser chamada num clique/toque/tecla
export function unlockAudio() {
  unlocked = true;
  const c = ensure();
  if (c && c.state === 'suspended') {
    try { c.resume(); } catch (e) { /* ignorar */ }
  }
  if (c && !musicState) startMusic('cache');
}

export function setSoundEnabled(on) {
  settings.sound = !!on;
  if (master && ctx) {
    master.gain.setTargetAtTime(on ? MAX_OUT : 0, ctx.currentTime, 0.05);
  }
}

// Volume por tipo: 'music' ou 'sfx', valor entre 0 e 1
export function setVolume(kind, v) {
  const val = Math.max(0, Math.min(1, Number(v) || 0));
  if (kind === 'music') { settings.volMusic = val; if (musicBus) musicBus.gain.setTargetAtTime(0.35 * val, ctx.currentTime, 0.05); }
  if (kind === 'sfx') { settings.volSfx = val; if (sfxBus) sfxBus.gain.setTargetAtTime(0.6 * val, ctx.currentTime, 0.05); }
}

// Legendas visuais para sons importantes (aparecem mesmo com o som desligado)
const CAPTIONS = {
  chest: '🔓 Baú aberto', win: '★ Vitória', lose: '✖ Derrota', locked: '⛔ Caminho bloqueado',
  portal: '⇄ Portal', heavy: '💥 Golpe pesado', repair: '🔧 Circuito restaurado', hurt: '💢 Dano recebido',
};
let capTimer = 0;
function caption(name) {
  if (!settings.captions || !CAPTIONS[name]) return;
  try {
    const el = document.getElementById('captions');
    if (!el) return;
    el.textContent = CAPTIONS[name];
    el.classList.add('on');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => el.classList.remove('on'), 1400);
  } catch (e) { /* ignorar */ }
}

// ---- Efeitos ----
function env(node, t, attack, hold, release, peak) {
  node.gain.setValueAtTime(0, t);
  node.gain.linearRampToValueAtTime(peak, t + attack);
  node.gain.setValueAtTime(peak, t + attack + hold);
  node.gain.linearRampToValueAtTime(0.0001, t + attack + hold + release);
}

function tone(freq, t, dur, { type = 'sine', peak = 0.2, bus = null, slideTo = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, 0.005, dur * 0.4, dur * 0.6, peak);
  o.connect(g).connect(bus || sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, { peak = 0.2, filter = 1200, q = 0.7, bus = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.003, dur * 0.2, dur * 0.8, peak);
  src.connect(f).connect(g).connect(bus || sfxBus);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.05);
}

const SFX = {
  step(t) { noise(t, 0.05, { peak: 0.05, filter: 700 + Math.random() * 300 }); },
  ui(t) { tone(880, t, 0.06, { type: 'square', peak: 0.06 }); },
  repair(t) {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.07, 0.12, { type: 'triangle', peak: 0.16 }));
  },
  chest(t) {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.05, 0.18, { type: 'sine', peak: 0.14 }));
  },
  hit(t) {
    noise(t, 0.18, { peak: 0.35, filter: 900, q: 0.5 });
    tone(160, t, 0.2, { type: 'sine', peak: 0.3, slideTo: 60 });
  },
  heavy(t) {
    noise(t, 0.35, { peak: 0.5, filter: 400, q: 0.4 });
    tone(110, t, 0.4, { type: 'triangle', peak: 0.4, slideTo: 40 });
  },
  hurt(t) {
    tone(330, t, 0.25, { type: 'sawtooth', peak: 0.2, slideTo: 90 });
  },
  heal(t) {
    [392, 523, 659].forEach((f, i) => tone(f, t + i * 0.06, 0.2, { type: 'sine', peak: 0.14 }));
  },
  win(t) {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.25, { type: 'triangle', peak: 0.18 }));
  },
  lose(t) {
    [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.2, 0.3, { type: 'sawtooth', peak: 0.14 }));
  },
  portal(t) {
    tone(220, t, 0.5, { type: 'sine', peak: 0.2, slideTo: 880 });
  },
  choice(t) {
    tone(660, t, 0.1, { type: 'triangle', peak: 0.12 });
    tone(990, t + 0.09, 0.14, { type: 'triangle', peak: 0.12 });
  },
  locked(t) {
    tone(140, t, 0.15, { type: 'square', peak: 0.1 });
    tone(110, t + 0.12, 0.2, { type: 'square', peak: 0.1 });
  },
};

// Toca um efeito pelo nome. Silencioso se o áudio não estiver disponível.
export function sfx(name) {
  caption(name);
  const c = ensure();
  if (!c || !settings.sound) return;
  if (c.state === 'suspended') return;
  const fn = SFX[name];
  if (fn) {
    try { fn(c.currentTime + 0.01); } catch (e) { /* ignorar */ }
  }
}

// ---- Trilha por zona ----
export function startMusic(zoneId) {
  const c = ensure();
  if (!c) return;
  const cfg = ZONE_MUSIC[zoneId] || ZONE_MUSIC.cache;
  if (musicState && musicState.zone === zoneId) return;
  stopMusicNodes();
  // Drone de fundo: duas ondas levemente desafinadas
  const drones = [];
  for (const det of [-6, 6]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = cfg.root / 2;
    o.detune.value = det;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = cfg.drone;
    o.connect(f).connect(g).connect(musicBus);
    o.start();
    drones.push(o);
  }
  musicState = {
    zone: zoneId, cfg, drones,
    step: 0,
    next: c.currentTime + 0.1,
  };
  musicTimer = setInterval(scheduleMusic, 60);
}

function scheduleMusic() {
  if (!ctx || !musicState) return;
  const s = musicState;
  while (s.next < ctx.currentTime + 0.25) {
    const { scale, root, wave, tempo } = s.cfg;
    // Melodia com passos pseudo-aleatórios previsíveis (mesma semente por zona)
    const idx = (s.step * 3 + (s.step >> 2) * 2) % scale.length;
    const oct = (s.step % 8 < 4) ? 1 : 2;
    const freq = root * oct * Math.pow(2, scale[idx] / 12);
    if (s.step % 2 === 0 || Math.random() < 0.6) {
      tone(freq, s.next, tempo * 0.9, { type: wave, peak: 0.07, bus: musicBus });
    }
    if (s.step % 4 === 0) {
      tone(root / 4, s.next, tempo * 3.5, { type: 'sine', peak: 0.1, bus: musicBus });
    }
    s.next += tempo;
    s.step += 1;
  }
}

function stopMusicNodes() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = 0;
  if (musicState) {
    for (const o of musicState.drones) { try { o.stop(); } catch (e) { /* já parado */ } }
  }
  musicState = null;
}

export function setMusicZone(zoneId) {
  startMusic(zoneId);
}

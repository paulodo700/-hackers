// Primitivas de síntese: osciladores, notas com envelope, ruído filtrado. Tudo determinístico e puro.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

const TAU = Math.PI * 2;
const TANH4 = Math.tanh(4);

// Formas de onda suaves (sem degraus bruscos), fase em ciclos. Todas começam em 0 na fase 0.
export function osc(wave, ph) {
  const x = ph - Math.floor(ph);
  switch (wave) {
    case 'tri': {
      const y = x + 0.25 - Math.floor(x + 0.25);
      return 1 - 4 * Math.abs(y - 0.5);
    }
    case 'pulse': return Math.tanh(4 * Math.sin(TAU * x)) / TANH4;
    case 'soft': return (Math.sin(TAU * x) + Math.sin(2 * TAU * x) / 2 + Math.sin(3 * TAU * x) / 3) / 1.4;
    case 'bell': return (Math.sin(TAU * x) + 0.4 * Math.sin(TAU * 2.76 * x)) / 1.3;
    default: return Math.sin(TAU * x);
  }
}

// Envelope: ataque linear, sustentação (ou decaimento exponencial) até `dur`, liberação linear `r`.
function envelope(tt, o) {
  const a = o.a ?? 0.005, r = o.r ?? 0.03, dur = o.dur;
  let e = tt < a ? tt / a : 1;
  if (o.decay) e *= Math.exp(-o.decay * tt);
  if (tt > dur) e *= Math.max(0, 1 - (tt - dur) / r);
  if (o.trem) e *= 1 - o.trem.depth * (0.5 + 0.5 * Math.sin(TAU * o.trem.rate * tt));
  return e;
}

// Escreve (somando) uma amostra; com `wrap`, o índice dá a volta no buffer (laço sem emenda).
function put(buf, i, v, wrap) {
  if (wrap) buf[i % buf.length] += v;
  else if (i < buf.length) buf[i] += v;
}

// Nota tonal. o = {t, dur, f, f1?, wave?, vol?, a?, r?, decay?, vib?:{rate, depth}, trem?, wrap?}
export function tone(buf, sr, o) {
  const start = Math.round(o.t * sr);
  const total = Math.ceil((o.dur + (o.r ?? 0.03)) * sr);
  const f0 = o.f, f1 = o.f1 ?? o.f, vol = o.vol ?? 0.5, wave = o.wave ?? 'sine';
  const ratio = f1 / f0;
  let ph = 0;
  for (let k = 0; k < total; k++) {
    const i = start + k;
    if (!o.wrap && i >= buf.length) break;
    const tt = k / sr;
    let f = ratio === 1 ? f0 : f0 * ratio ** Math.min(1, tt / o.dur);
    if (o.vib) f += o.vib.depth * Math.sin(TAU * o.vib.rate * tt);
    put(buf, i, vol * envelope(tt, o) * osc(wave, ph), o.wrap);
    ph += f / sr;
  }
}

// Ruído filtrado (passa-baixa de um polo com varredura lp→lp1; `hp` vira passa-alta).
// `crackle` (0..1) troca o ruído contínuo por estalos esparsos. o = {t, dur, vol, a, r, decay, lp, lp1, hp, seed, wrap}
export function noise(buf, sr, o) {
  const rnd = mulberry32(o.seed ?? 1);
  const start = Math.round(o.t * sr);
  const total = Math.ceil((o.dur + (o.r ?? 0.03)) * sr);
  const lp0 = o.lp ?? 1, lp1 = o.lp1 ?? lp0, vol = o.vol ?? 0.5;
  let y = 0;
  for (let k = 0; k < total; k++) {
    const i = start + k;
    if (!o.wrap && i >= buf.length) break;
    const tt = k / sr;
    let x = rnd() * 2 - 1;
    if (o.crackle) x = rnd() < o.crackle ? x * 4 : 0;
    const c = lp0 + (lp1 - lp0) * Math.min(1, tt / o.dur);
    y += c * (x - y);
    const v = o.hp ? x - y : y;
    put(buf, i, vol * envelope(tt, o) * v, o.wrap);
  }
}

export function peak(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i]);
    if (v > p) p = v;
  }
  return p;
}

// Escala o buffer para que o pico absoluto seja `target` (não mexe em buffers silenciosos).
export function normalize(buf, target) {
  const p = peak(buf);
  if (p > 0) {
    const g = target / p;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  return buf;
}

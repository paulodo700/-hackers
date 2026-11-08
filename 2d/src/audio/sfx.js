// Efeitos sonoros sintetizados. Cada efeito tem duração fixa e uma função que desenha as camadas.
import { tone, noise, normalize } from './synth.js';

export const SFX_IDS = ['mover', 'selecionar', 'voltar', 'erro', 'dano', 'critico', 'cura', 'status', 'passo',
  'coleta', 'bau', 'reparo', 'porta', 'chefe_surge', 'vitoria', 'derrota', 'subir_nivel', 'missao', 'dialogo',
  'compra', 'venda', 'fuga', 'esquiva', 'escudo', 'sobreaquecer', 'fogo'];

const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66,
  E6: 1318.51, G6: 1567.98, C7: 2093, A4: 440, G4: 392, F4: 349.23, E4: 329.63, C4: 261.63 };

function crunch(T, N0) {
  N0({ t: 0, dur: 0.18, vol: 0.9, lp: 0.6, lp1: 0.08, decay: 10, seed: 11 });
  T({ t: 0, dur: 0.2, f: 320, f1: 60, wave: 'tri', vol: 0.7, decay: 9 });
}

function chime(T, notes, step, dur = 0.18, vol = 0.5, wave = 'bell', t0 = 0) {
  notes.forEach((f, i) => T({ t: t0 + i * step, dur, f, wave, vol, decay: 8, r: 0.05 }));
}

const SFX = {
  mover: [0.06, (T) => T({ t: 0, dur: 0.035, f: 1200, f1: 1000, vol: 0.4, decay: 50, a: 0.002, r: 0.02 })],
  selecionar: [0.16, (T) => {
    T({ t: 0, dur: 0.05, f: N.A5, wave: 'pulse', vol: 0.4, r: 0.02 });
    T({ t: 0.065, dur: 0.06, f: N.E6, wave: 'pulse', vol: 0.4, r: 0.03 });
  }],
  voltar: [0.17, (T) => {
    T({ t: 0, dur: 0.05, f: N.E5, wave: 'tri', vol: 0.45, r: 0.02 });
    T({ t: 0.065, dur: 0.06, f: N.A4, f1: 400, wave: 'tri', vol: 0.45, r: 0.03 });
  }],
  erro: [0.3, (T) => {
    T({ t: 0, dur: 0.24, f: 110, wave: 'pulse', vol: 0.4, r: 0.04 });
    T({ t: 0, dur: 0.24, f: 116.5, wave: 'pulse', vol: 0.35, r: 0.04 });
  }],
  dano: [0.32, (T, N0) => crunch(T, N0)],
  critico: [0.5, (T, N0) => {
    crunch(T, N0);
    chime(T, [2093, 2637, 3136], 0.05, 0.15, 0.3, 'sine', 0.06);
  }],
  cura: [0.6, (T) => chime(T, [N.C5, N.E5, N.G5, N.C6], 0.09, 0.22, 0.45, 'sine')],
  status: [0.5, (T) => T({ t: 0, dur: 0.42, f: 330, wave: 'tri', vol: 0.6, vib: { rate: 9, depth: 35 },
    trem: { rate: 7, depth: 0.6 }, a: 0.02, r: 0.06 })],
  passo: [0.05, (T, N0) => N0({ t: 0, dur: 0.02, vol: 0.7, lp: 0.25, decay: 90, a: 0.001, r: 0.02, seed: 3 })],
  coleta: [0.3, (T) => chime(T, [N.C6, N.E6, N.G6], 0.045, 0.12, 0.4)],
  bau: [0.6, (T, N0) => {
    N0({ t: 0, dur: 0.025, vol: 0.6, lp: 0.5, decay: 60, a: 0.001, seed: 5 });
    T({ t: 0, dur: 0.05, f: 190, wave: 'tri', vol: 0.5, decay: 45 });
    chime(T, [N.G5, N.D6], 0.08, 0.25, 0.4, 'bell', 0.12);
  }],
  reparo: [0.7, (T, N0) => {
    N0({ t: 0, dur: 0.42, vol: 0.5, lp: 0.03, lp1: 0.5, a: 0.1, r: 0.05, seed: 7 });
    T({ t: 0.44, dur: 0.2, f: N.C7, wave: 'bell', vol: 0.35, decay: 9, r: 0.05 });
  }],
  porta: [0.6, (T) => {
    T({ t: 0, dur: 0.5, f: 85, f1: 140, wave: 'pulse', vol: 0.45, a: 0.04, r: 0.08 });
    T({ t: 0, dur: 0.5, f: 170, f1: 280, wave: 'sine', vol: 0.15, a: 0.04, r: 0.08 });
  }],
  chefe_surge: [1.2, (T, N0) => {
    T({ t: 0, dur: 0.9, f: 55, f1: 49, wave: 'soft', vol: 0.5, a: 0.7, r: 0.28 });
    T({ t: 0, dur: 0.9, f: 82.4, f1: 73.4, wave: 'pulse', vol: 0.25, a: 0.7, r: 0.28 });
    N0({ t: 0, dur: 0.9, vol: 0.4, lp: 0.02, lp1: 0.15, a: 0.8, r: 0.28, seed: 9 });
  }],
  vitoria: [1.05, (T) => fanfare(T)],
  derrota: [1.15, (T) => {
    [N.A4, N.G4, N.F4].forEach((f, i) => T({ t: i * 0.2, dur: 0.17, f, wave: 'tri', vol: 0.45, r: 0.04 }));
    T({ t: 0.6, dur: 0.38, f: N.E4, f1: 320, wave: 'tri', vol: 0.45, r: 0.12 });
    T({ t: 0.6, dur: 0.38, f: N.C4, wave: 'sine', vol: 0.25, r: 0.12 });
  }],
  subir_nivel: [0.95, (T) => {
    [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => T({ t: i * 0.07, dur: 0.07, f, wave: 'pulse', vol: 0.3, r: 0.02 }));
    [N.C6, N.E6, N.G6].forEach((f) => T({ t: 0.38, dur: 0.4, f, wave: 'tri', vol: 0.25, decay: 3, r: 0.12 }));
  }],
  missao: [0.65, (T) => chime(T, [N.G5, N.D6], 0.14, 0.4, 0.45)],
  dialogo: [0.05, (T) => T({ t: 0, dur: 0.03, f: 620, f1: 780, wave: 'pulse', vol: 0.35, a: 0.003, r: 0.015 })],
  compra: [0.32, (T) => coin(T, N.B5 * 1.5, N.E6 * 1.5)],
  venda: [0.32, (T) => coin(T, N.E6 * 1.5, N.B5 * 1.5)],
  fuga: [0.36, (T, N0) => {
    N0({ t: 0, dur: 0.3, vol: 0.6, lp: 0.7, lp1: 0.03, a: 0.01, r: 0.05, seed: 13 });
    T({ t: 0, dur: 0.28, f: 900, f1: 140, wave: 'sine', vol: 0.3, r: 0.05 });
  }],
  esquiva: [0.26, (T, N0) => {
    N0({ t: 0, dur: 0.2, vol: 0.6, lp: 0.04, lp1: 0.7, a: 0.02, r: 0.04, seed: 17 });
    T({ t: 0, dur: 0.18, f: 300, f1: 1300, wave: 'sine', vol: 0.2, r: 0.04 });
  }],
  escudo: [0.65, (T) => {
    [1200, 1207, 1800, 1811, 2400].forEach((f, i) => T({ t: 0, dur: 0.5, f, wave: 'sine', vol: 0.18 - i * 0.02,
      a: 0.06, r: 0.12, trem: { rate: 11 + i * 2, depth: 0.5 } }));
  }],
  sobreaquecer: [1.0, (T, N0) => {
    N0({ t: 0, dur: 0.85, vol: 0.55, lp: 0.08, lp1: 0.8, a: 0.6, r: 0.12, trem: { rate: 14, depth: 0.7 }, seed: 19 });
    T({ t: 0, dur: 0.85, f: 200, f1: 800, wave: 'pulse', vol: 0.12, a: 0.5, r: 0.12, trem: { rate: 14, depth: 0.7 } });
  }],
  fogo: [0.9, (T, N0) => {
    N0({ t: 0, dur: 0.75, vol: 0.5, crackle: 0.02, lp: 0.6, a: 0.05, r: 0.12, seed: 23 });
    N0({ t: 0, dur: 0.75, vol: 0.7, lp: 0.02, a: 0.1, r: 0.12, seed: 29 });
    T({ t: 0, dur: 0.75, f: 55, wave: 'soft', vol: 0.25, a: 0.1, r: 0.12 });
  }],
};

function fanfare(T) {
  const notes = [[0, 0.1, N.C5], [0.12, 0.1, N.E5], [0.24, 0.1, N.G5], [0.36, 0.55, N.C6]];
  for (const [t, dur, f] of notes) {
    T({ t, dur, f, wave: 'pulse', vol: 0.3, r: 0.06 });
    T({ t, dur, f: f / 2, wave: 'tri', vol: 0.25, r: 0.06 });
  }
  T({ t: 0.36, dur: 0.55, f: N.G5, wave: 'tri', vol: 0.15, r: 0.08 });
}

function coin(T, f1, f2) {
  T({ t: 0, dur: 0.06, f: f1, wave: 'pulse', vol: 0.3, decay: 10, r: 0.02 });
  T({ t: 0.07, dur: 0.2, f: f2, wave: 'pulse', vol: 0.3, decay: 12, r: 0.04 });
}

export function buildSfx(id, sampleRate = 22050) {
  const def = SFX[id];
  if (!def) return new Float32Array(Math.max(1, Math.round(0.05 * sampleRate)));
  const [dur, draw] = def;
  const buf = new Float32Array(Math.round(dur * sampleRate));
  draw((o) => tone(buf, sampleRate, o), (o) => noise(buf, sampleRate, o));
  // Rampa final curta para não estalar ao cortar o buffer.
  const fade = Math.min(buf.length, Math.round(0.004 * sampleRate));
  for (let k = 0; k < fade; k++) buf[buf.length - 1 - k] *= k / fade;
  return normalize(buf, 0.8);
}

// Trilhas chiptune geradas por sequenciador: baixo, arpejo, melodia, pad, pedal e bateria leve.
// O laço não tem emenda: notas que passam do fim são somadas no começo (índice circular), e o
// número de compassos é inteiro, então o ritmo e a progressão fecham exatamente no ponto de volta.
import { tone, noise, normalize, midiHz, hashString } from './synth.js';

export const MUSIC_IDS = ['titulo', 'dissipador', 'metal_m1', 'cache_l3', 'nucleos', 'controlador_memoria',
  'energia', 'interposer', 'substrato', 'batalha', 'chefe', 'vitoria_musica'];

const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
};

// Padrões de 16 semicolcheias por compasso.
// bass: x = fundamental, o = oitava acima, f = quinta, '.' = pausa.
// arp: 0..3 = notas do acorde (3 = fundamental uma oitava acima).
// drums: k = bumbo, s = caixa, h = chimbal.
// lead: um caractere por colcheia ao longo de toda a progressão; dígito = grau da escala (a = 10...),
//       '-' = prolonga a nota anterior, '.' = pausa.
export const TRACKS = {
  titulo: { bpm: 100, root: 57, mode: 'aeolian', prog: [0, 5, 2, 6],
    bass: 'x...x...x.o.x...', bassWave: 'tri',
    arp: { pat: '0.1.2.3.2.1.0.1.', len: 1.5, oct: 12, wave: 'pulse', vol: 0.1 },
    lead: { notes: '4-2-0-2-5---7-5-4-2-4-6-5---3---4-2-0-2-7---5-4-2-4-6-4-3---1---', oct: 12, wave: 'tri', vol: 0.22 },
    pad: { vol: 0.08, wave: 'sine' }, drums: 'k.......s.......' },
  dissipador: { bpm: 84, root: 53, mode: 'ionian', prog: [0, 5, 3, 4],
    bass: 'x.......f.......', bassWave: 'tri', bassLen: 7,
    arp: { pat: '0...1...2...1...', len: 3.5, oct: 12, wave: 'sine', vol: 0.14 },
    pad: { vol: 0.12, wave: 'tri' } },
  metal_m1: { bpm: 132, root: 62, mode: 'mixolydian', prog: [0, 6, 3, 0],
    bass: 'x.x.o.x.x.x.o.f.', bassWave: 'tri',
    arp: { pat: '0123210301232103', len: 0.8, oct: 12, wave: 'pulse', vol: 0.09 },
    pad: { vol: 0.06, wave: 'sine' }, drums: 'k.h.s.h.k.hhs.h.' },
  cache_l3: { bpm: 116, root: 52, mode: 'dorian', prog: [0, 3, 0, 4],
    bass: 'x..x..x.x..x..x.', bassWave: 'pulse', bassLen: 0.6,
    arp: { pat: '0.2.1.3.0.2.1.3.', len: 0.35, oct: 12, wave: 'pulse', vol: 0.11 },
    pad: { vol: 0.05, wave: 'sine' }, drums: 'h.h.h.h.h.h.h.h.' },
  nucleos: { bpm: 128, root: 48, mode: 'aeolian', prog: [0, 5, 6, 4],
    bass: 'xxoxxxoxxxoxxxox', bassWave: 'tri', bassLen: 0.8,
    arp: { pat: '0.2.3.2.0.2.3.2.', len: 0.6, oct: 24, wave: 'pulse', vol: 0.08 },
    pad: { vol: 0.07, wave: 'tri' }, drums: 'k...k...k...k.k.' },
  controlador_memoria: { bpm: 112, root: 47, mode: 'phrygian', prog: [0, 1, 0, 1],
    bass: 'x.x.x.x.x.x.x.x.', bassWave: 'tri', bassLen: 1,
    arp: { pat: '0101010101010101', len: 0.7, oct: 12, wave: 'pulse', vol: 0.08 },
    pad: { vol: 0.08, wave: 'sine' }, drums: 'k...s...k...s..h' },
  energia: { bpm: 124, root: 55, mode: 'lydian', prog: [0, 1, 4, 0],
    bass: 'x...x...x...x.o.', bassWave: 'tri',
    arp: { pat: '0123312001233120', len: 0.6, oct: 24, wave: 'bell', vol: 0.1 },
    pad: { vol: 0.07, wave: 'sine' }, drums: '..h...h...h...hh' },
  interposer: { bpm: 84, root: 62, mode: 'lydian', prog: [0, 4, 5, 1],
    bass: 'x...............', bassWave: 'sine', bassLen: 15,
    lead: { notes: '4-------2-------5-------6---4---', oct: 12, wave: 'sine', vol: 0.2 },
    pad: { vol: 0.14, wave: 'tri' } },
  substrato: { bpm: 80, root: 37, mode: 'phrygian', prog: [0, 1, 5, 0],
    bass: 'x.......x...f...', bassWave: 'soft', bassLen: 6,
    arp: { pat: '0.......2.......', len: 6, oct: 12, wave: 'tri', vol: 0.12 },
    pad: { vol: 0.12, wave: 'sine' }, drums: 'k...............' },
  batalha: { bpm: 140, root: 57, mode: 'aeolian', prog: [0, 5, 6, 4],
    bass: 'xoxoxoxoxoxoxoxo', bassWave: 'tri', bassLen: 0.9,
    arp: { pat: '0123012301230123', len: 0.6, oct: 12, wave: 'pulse', vol: 0.07 },
    lead: { notes: '4-4-5-7-6-5-4---2-2-4-5-4-2-1---0-0-2-4-5-4-2---4-5-6-7-6-5-4---', oct: 12, wave: 'pulse', vol: 0.14 },
    pad: { vol: 0.05, wave: 'sine' }, drums: 'k.h.s.h.k.k.s.hh' },
  chefe: { bpm: 120, root: 38, mode: 'phrygian', prog: [0, 1, 6, 1],
    bass: 'x.xx.x.xx.xx.x.x', bassWave: 'soft', bassLen: 0.9,
    arp: { pat: '0..1..2..1..0.3.', len: 1.2, oct: 24, wave: 'pulse', vol: 0.08 },
    pedal: { note: 26, vol: 0.18, wave: 'soft' },
    pad: { vol: 0.07, wave: 'tri' }, drums: 'k.k.s..kk.k.s.sh' },
  vitoria_musica: { bpm: 120, root: 60, mode: 'ionian', prog: [0, 4, 0], seconds: 6,
    bass: 'x...f...x...o...', bassWave: 'tri',
    lead: { notes: '0-2-4-7-4-6-8---7-------', oct: 12, wave: 'pulse', vol: 0.18 },
    pad: { vol: 0.09, wave: 'tri' }, drums: 'k...s...k...s.h.' },
};

function degreeNote(scale, root, deg) {
  return root + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
}

function chordTones(scale, root, deg) {
  const t = [0, 2, 4].map((k) => degreeNote(scale, root, deg + k));
  return [...t, t[0] + 12];
}

// Converte a linha de melodia em notas [passo inicial (colcheia), duração em colcheias, grau].
function parseLead(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '-' && out.length && out[out.length - 1].open) out[out.length - 1].len++;
    else if (ch === '.' || ch === '-') { if (out.length) out[out.length - 1].open = false; }
    else out.push({ step: i, len: 1, deg: parseInt(ch, 36), open: true });
  }
  return out;
}

export function buildMusic(id, sampleRate = 22050, seconds = 16) {
  const len = Math.max(1, Math.round(seconds * sampleRate));
  const buf = new Float32Array(len);
  const tr = TRACKS[id];
  if (!tr) return buf;
  const scale = MODES[tr.mode];
  const barDur = (4 * 60) / tr.bpm;
  const bars = Math.max(1, Math.round(seconds / barDur));
  const step = len / sampleRate / (bars * 16); // semicolcheia ajustada para fechar o laço
  let seed = hashString(id);
  const T = (o) => tone(buf, sampleRate, { ...o, wrap: true });
  const Nz = (o) => noise(buf, sampleRate, { ...o, wrap: true, seed: seed++ });

  for (let b = 0; b < bars; b++) {
    const deg = tr.prog[b % tr.prog.length];
    const chord = chordTones(scale, tr.root, deg);
    const bassRoot = chord[0] - 12;
    const t0 = b * 16 * step;

    if (tr.pad) {
      for (const m of chord.slice(0, 3)) {
        T({ t: t0, dur: 16 * step, f: midiHz(m), wave: tr.pad.wave, vol: tr.pad.vol, a: 4 * step, r: 3 * step });
      }
    }
    if (tr.pedal) {
      T({ t: t0, dur: 16 * step, f: midiHz(tr.pedal.note), wave: tr.pedal.wave, vol: tr.pedal.vol, a: 2 * step, r: 2 * step,
        trem: { rate: 1 / (8 * step), depth: 0.3 } });
    }
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * step;
      const bc = tr.bass[s];
      if (bc !== '.') {
        const m = bc === 'o' ? bassRoot + 12 : bc === 'f' ? bassRoot + 7 : bassRoot;
        T({ t, dur: (tr.bassLen ?? 1.6) * step, f: midiHz(m), wave: tr.bassWave, vol: 0.32, a: 0.004, r: 0.03 });
      }
      const ac = tr.arp?.pat[s];
      if (ac && ac !== '.') {
        const m = chord[+ac] + tr.arp.oct;
        T({ t, dur: tr.arp.len * step, f: midiHz(m), wave: tr.arp.wave, vol: tr.arp.vol, a: 0.003, r: 0.03, decay: 3 });
      }
      const dc = tr.drums?.[s];
      if (dc === 'k') T({ t, dur: 0.11, f: 150, f1: 42, wave: 'sine', vol: 0.4, a: 0.002, r: 0.03, decay: 18 });
      else if (dc === 's') Nz({ t, dur: 0.1, vol: 0.18, lp: 0.45, a: 0.002, r: 0.03, decay: 30 });
      else if (dc === 'h') Nz({ t, dur: 0.03, vol: 0.06, lp: 0.5, hp: true, a: 0.002, r: 0.02, decay: 90 });
    }
  }

  if (tr.lead) {
    const notes = parseLead(tr.lead.notes);
    const phraseSteps = tr.lead.notes.length; // em colcheias
    const totalEighths = bars * 8;
    for (let base = 0; base < totalEighths; base += phraseSteps) {
      for (const n of notes) {
        const e = base + n.step;
        if (e >= totalEighths) break;
        T({ t: e * 2 * step, dur: n.len * 2 * step * 0.92, f: midiHz(degreeNote(scale, tr.root + tr.lead.oct, n.deg)),
          wave: tr.lead.wave, vol: tr.lead.vol, a: 0.01, r: 0.05, vib: { rate: 5.5, depth: 2 } });
      }
    }
  }

  crossfadeSeam(buf, Math.round(0.02 * sampleRate));
  normalize(buf, 0.5);
  return buf;
}

// Suaviza o ponto de volta: os últimos ~20 ms convergem para o valor que continua no começo do buffer.
function crossfadeSeam(buf, n) {
  n = Math.min(n, Math.floor(buf.length / 4));
  if (n < 2) return;
  const L = buf.length;
  const target = buf[0];
  for (let k = 0; k < n; k++) {
    const i = L - n + k;
    const w = (k + 1) / (n + 1); // 0 → 1 ao se aproximar do fim
    // mistura o fim com uma reta até o primeiro valor, preservando continuidade dos dois lados
    const line = buf[L - n - 1] + (target - buf[L - n - 1]) * w;
    buf[i] = buf[i] * (1 - w * w) + line * w * w;
  }
}

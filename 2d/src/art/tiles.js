// Tiles 16×16 que se repetem sem emenda. As linhas da grade ficam só na borda de cima e da
// esquerda, então tiles vizinhos fecham a grade sozinhos. Paredes: 16 variantes pela máscara
// de vizinhos (norte 1, leste 2, sul 4, oeste 8).
import { Px, sprite, hash } from './px.js';

function floor({ base = '1', line = '0', speck = '2', seed = 1 } = {}) {
  const p = new Px(16, 16, base);
  for (let i = 0; i < 16; i++) { p.set(i, 0, line); p.set(0, i, line); }
  for (let y = 1; y < 16; y++) for (let x = 1; x < 16; x++) if (hash(x, y, seed) < 25) p.set(x, y, speck);
  p.set(1, 1, speck);
  return p;
}

const chaoA = floor();
const chaoB = floor({ seed: 2 });
chaoB.disc(8.5, 8.5, 3, '2').disc(8.5, 8.5, 2, '3').disc(8.5, 8.5, 1, '0');
chaoB.set(7, 7, '4');
const chaoC = floor({ seed: 3 });
chaoC.line(3, 11, 9, 11, '2').line(12, 3, 12, 8, '2');
chaoC.set(3, 11, '3').set(9, 11, '3').set(12, 3, '3').set(12, 8, '3');

function trace() {
  const p = floor({ seed: 4 });
  for (let x = 0; x < 16; x++) {
    p.set(x, 5, 'c'); p.set(x, 6, 'O'); p.set(x, 7, 'o'); p.set(x, 8, 'o'); p.set(x, 9, 'C'); p.set(x, 10, 'c');
  }
  for (const x of [3, 11]) p.set(x, 7, 'O');
  return p;
}
const trilha = trace();
const trilhaRompida = trace();
{
  const base = floor({ seed: 4 });
  for (let y = 5; y <= 10; y++) for (let x = 6; x <= 9; x++) trilhaRompida.set(x, y, base.get(x, y));
  for (const [x, y] of [[6, 6], [6, 7], [9, 8], [9, 9]]) trilhaRompida.set(x, y, 'C');
  for (const [x, y] of [[5, 6], [5, 7], [5, 8], [5, 9], [10, 6], [10, 7], [10, 8], [10, 9]]) trilhaRompida.set(x, y, 'R');
  trilhaRompida.set(5, 7, 'l'); trilhaRompida.set(10, 8, 'l');
  trilhaRompida.set(7, 4, 'u').set(8, 11, 'H').set(8, 3, 'j').set(7, 12, 'h');
}

const portaEnergia = new Px(16, 16, '1');
for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
  portaEnergia.set(x, y, Math.floor((x + y) / 2) % 2 ? 'Y' : 'K');
}
portaEnergia.rect(0, 0, 2, 16, '@').rect(14, 0, 2, 16, '@').rect(0, 0, 16, 2, '@').rect(0, 14, 16, 2, '@');
portaEnergia.shade('@', { hi: '7', mid: '6', lo: '5' });
portaEnergia.rect(4, 6, 8, 4, 'k').rect(5, 7, 6, 2, 'q').set(5, 7, 'Q');
portaEnergia.box(2, 2, 12, 12, 'y');

const encaixe = floor({ seed: 5 });
encaixe.rect(3, 3, 10, 10, '@');
encaixe.shade('@', { hi: 's', mid: 'G', lo: 'g' });
encaixe.rect(5, 5, 6, 6, '0');
for (let i = 5; i < 11; i += 2) { encaixe.set(i, 4, 'k'); encaixe.set(i, 11, 'k'); encaixe.set(4, i, 'k'); encaixe.set(11, i, 'k'); }
encaixe.box(2, 2, 12, 12, 'k');
encaixe.set(5, 5, 'Y').set(6, 5, 'Y').set(5, 6, 'Y');

const portaChefe = new Px(16, 16, '@');
portaChefe.shade('@', { hi: '5', mid: '4', lo: '3' });
portaChefe.rect(0, 0, 16, 3, 'Z');
for (let x = 0; x < 16; x += 4) { portaChefe.set(x, 1, 'R'); portaChefe.set(x + 1, 1, 'R'); }
portaChefe.rect(7, 3, 2, 13, 'k');
portaChefe.line(1, 6, 6, 6, '3').line(9, 6, 14, 6, '3').line(1, 12, 6, 12, '3').line(9, 12, 14, 12, '3');
for (const cx of [4, 11]) {
  portaChefe.disc(cx + 0.5, 9.5, 2.2, 'k').disc(cx + 0.5, 9.5, 1.5, 'R');
  portaChefe.set(cx, 9, 'l');
}
for (const [x, y] of [[1, 4], [14, 4], [1, 14], [14, 14]]) portaChefe.set(x, y, '6');
portaChefe.rect(0, 15, 16, 1, 'k');

function chest(open) {
  const p = floor({ seed: 6 });
  const c = new Px(16, 16);
  c.rect(2, 7, 12, 7, '@');
  if (open) {
    c.rect(2, 2, 12, 4, '#');
  } else {
    c.rect(2, 4, 12, 4, '#');
  }
  c.shade('@', { hi: 'o', mid: 'C', lo: 'c' });
  c.shade('#', { hi: 'O', mid: 'o', lo: 'C' });
  c.rect(2, 10, 12, 1, 'y');
  if (open) {
    c.rect(3, 6, 10, 2, 'k');
    c.set(5, 6, 'u').set(6, 7, 'Y').set(9, 6, 'u').set(10, 7, 'L').set(7, 6, 'j');
    c.rect(2, 3, 12, 1, 'c');
  } else {
    c.rect(2, 7, 12, 1, 'y');
    c.rect(7, 7, 2, 3, 'Y').set(7, 8, 'k');
  }
  c.outline('k');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (c.get(x, y) !== '.') p.set(x, y, c.get(x, y));
  return p;
}

const zonaQuente = floor({ base: 'd', line: 'Z', speck: 'D', seed: 7 });
for (const [x, y, len] of [[3, 12, 3], [10, 6, 2], [13, 13, 2], [6, 4, 1]]) {
  for (let i = 0; i < len; i++) zonaQuente.set(x, y - i, i === len - 1 ? 'H' : 'h');
  zonaQuente.set(x, y + 1, 'r');
}
zonaQuente.set(8, 10, 'j').set(2, 7, 'R').set(14, 3, 'R');

const zonaFria = floor({ base: 'X', line: '0', speck: 'W', seed: 8 });
for (const [x, y] of [[4, 5], [11, 11]]) {
  zonaFria.set(x, y, 'I').set(x - 1, y, 'i').set(x + 1, y, 'i').set(x, y - 1, 'i').set(x, y + 1, 'i');
}
zonaFria.set(12, 4, 'B').set(3, 12, 'B').set(8, 8, 'W').set(13, 5, 'i');

const saida = floor({ seed: 9 });
saida.rect(1, 1, 14, 14, '@');
saida.shade('@', { hi: '5', mid: '3', lo: '2' });
saida.rect(2, 2, 12, 12, 'k');
for (const [i, top, mid] of [[0, '7', '6'], [1, '6', '5'], [2, '5', '4'], [3, '4', '3'], [4, '3', '2']]) {
  const w = 12 - i * 2, x = 2 + i, y = 3 + i * 2;
  saida.rect(x, y, w, 1, top).rect(x, y + 1, w, 1, mid);
}
saida.set(2, 3, 'q').set(13, 3, 'q');

const anel = floor({ seed: 10 });
anel.disc(8, 8, 7, '2');
anel.ring(8, 8, 3.8, 6.4, '@');
anel.shade('@', { hi: 'u', mid: 'Y', lo: 'y' });
anel.ring(8, 8, 3, 3.8, 'H');
anel.disc(8, 8, 2.2, 'L').disc(8, 8, 1.2, 'j');
anel.ring(8, 8, 6.4, 7.2, 'k');

// Parede: tampo de silício com relevo; bordas expostas acesas (norte/oeste) ou em sombra
// (leste), face frontal quando o sul é aberto; encontros com outras paredes ganham juntas escuras.
function wall(mask) {
  const N = mask & 1, E = mask & 2, S = mask & 4, Wt = mask & 8;
  const p = new Px(16, 16, '4');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x % 4 === 1 && y % 4 === 1) p.set(x, y, '3');
    if (x % 8 === 5 && y % 8 === 5) p.set(x, y, '5');
  }
  if (!N) { p.rect(0, 0, 16, 1, 'k'); p.rect(0, 1, 16, 1, '5'); }
  if (!Wt) { p.rect(0, 0, 1, 16, 'k'); p.rect(1, N ? 0 : 1, 1, 16, '5'); }
  if (!E) { p.rect(15, 0, 1, 16, 'k'); p.rect(14, N ? 0 : 1, 1, 16, '3'); }
  if (!S) {
    p.rect(0, 11, 16, 1, '3');
    p.rect(0, 12, 16, 3, '2');
    for (let x = 2; x < 16; x += 4) p.rect(x, 12, 1, 3, '1');
    p.rect(0, 15, 16, 1, 'k');
    if (!Wt) p.rect(0, 11, 1, 5, 'k');
    if (!E) p.rect(15, 11, 1, 5, 'k');
  }
  if (!N && !Wt) p.set(1, 1, '6');
  if (N) { p.set(7, 0, '3'); p.set(8, 0, '3'); }
  if (Wt) { p.set(0, 7, '3'); p.set(0, 8, '3'); }
  if (E) { p.set(15, 7, '3'); p.set(15, 8, '3'); }
  if (S) { p.set(7, 15, '3'); p.set(8, 15, '3'); }
  return p;
}

export const TILE_SPRITES = {
  chao_a: sprite(chaoA),
  chao_b: sprite(chaoB),
  chao_c: sprite(chaoC),
  trilha: sprite(trilha),
  trilha_rompida: sprite(trilhaRompida),
  porta_energia: sprite(portaEnergia),
  encaixe: sprite(encaixe),
  porta_chefe: sprite(portaChefe),
  bau_fechado: sprite(chest(false)),
  bau_aberto: sprite(chest(true)),
  zona_quente: sprite(zonaQuente),
  zona_fria: sprite(zonaFria),
  saida: sprite(saida),
  anel: sprite(anel),
};
for (let m = 0; m < 16; m++) TILE_SPRITES[`parede_${m}`] = sprite(wall(m));

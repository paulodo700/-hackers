// Falhas (16×16) e chefes (24×24). Silhuetas fortes; chefes ganham contorno brilhante.
import { Px, sprite, hash } from './px.js';

// Desenha uma silhueta com '@', sombreia com a rampa dada e contorna. Devolve a grade.
function body(w, h, draw, ramp, { outline = 'k', glow = null } = {}) {
  const p = new Px(w, h);
  draw(p);
  p.shade('@', ramp);
  if (outline) p.outline(outline);
  if (glow) p.outline(glow);
  return p;
}

// ---------- falhas regulares ----------

// Pulga de corrente: corpo oval amarelo-elétrico, pernas saltadoras, faísca na antena.
function pulga() {
  const p = new Px(16, 16);
  for (const [x0, y0, x1, y1] of [[5, 11, 2, 15], [8, 12, 7, 15], [11, 11, 14, 15], [4, 8, 1, 10]]) p.line(x0, y0, x1, y1, '#');
  p.ellipse(8.5, 8.5, 5.5, 3.8, '@');
  p.ellipse(4.5, 6.5, 2.6, 2.4, '@');
  p.shade('@', { hi: 'u', mid: 'Y', lo: 'y' });
  p.shade('#', { hi: '7', mid: '6', lo: '6' });
  p.line(3, 3, 1, 1, '#'); p.line(5, 3, 6, 1, '#');
  p.replace('#', '6');
  p.outline('k');
  p.set(1, 0, 'q'); p.set(6, 0, 'q');
  p.set(3, 6, 'k'); p.set(3, 7, 'l'); p.set(5, 6, 'k'); p.set(5, 7, 'l');
  p.stamp(['jj', 'j.'], 8, 6);
  p.line(9, 10, 12, 10, 'y'); p.line(7, 11, 10, 11, 'y');
  p.set(14, 4, 'q'); p.set(15, 3, 'Q'); p.set(15, 5, 'q');
  return p;
}

// Rasgo de trilha: fita de cobre ondulada com boca rasgada e dentes.
function rasgo() {
  const p = body(16, 16, (q) => {
    q.poly([[1, 6], [5, 4], [10, 5], [15, 3], [15, 12], [10, 13], [5, 11], [1, 12]], '@');
  }, { hi: 'O', mid: 'o', lo: 'C', lo2: 'C' });
  p.poly([[6, 8], [15, 6], [15, 10]], 'k');
  p.stamp(['w.w.w', '.....', '.w.w.'], 9, 7);
  p.set(4, 7, 'k'); p.set(4, 8, 'l'); p.set(5, 7, 'l'); p.set(5, 8, 'R');
  p.line(1, 9, 3, 9, 'c');
  p.set(14, 2, 'u'); p.set(15, 13, 'u'); p.set(12, 14, 'H');
  return p;
}

// Ruído térmico: nuvem de estática laranja com borda pontilhada e olhos acesos.
function ruido() {
  const p = new Px(16, 16);
  p.disc(8, 8.5, 5.6, '@');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5);
    if (d > 5.6 && d < 7.6 && hash(x, y, 3) < 420) p.set(x, y, '@');
  }
  p.shade('@', { hi: 'H', mid: 'h', lo: 'R' });
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (p.get(x, y) === 'h' && hash(x, y, 9) < 260) p.set(x, y, hash(x, y, 4) < 500 ? 'H' : 'R');
  }
  p.outline('r');
  p.stamp(['kk..kk', 'jk..jk'], 5, 7);
  p.stamp(['k.k.k', '.k.k.'], 6, 11);
  return p;
}

// Vazamento de corrente: gota verde-ciano que pinga.
function vazamento() {
  const p = body(16, 16, (q) => {
    q.poly([[8, 1], [12, 7], [3.5, 7]], '@');
    q.ellipse(8, 9.5, 5, 4.5, '@');
    q.rect(4, 13, 2, 2, '@');
    q.rect(10, 13, 1, 2, '@');
  }, { hi: 's', mid: 'G', lo: 'g' });
  p.stamp(['QQ', 'Q.'], 5, 6);
  p.stamp(['kk.kk', 'k...k'], 6, 9);
  p.line(7, 12, 9, 12, 'g');
  p.set(4, 15, 'G'); p.set(13, 15, 's');
  return p;
}

// Eletromigração: aglomerado de grãos metálicos com átomos de cobre migrando.
function eletromigracao() {
  const p = body(16, 16, (q) => {
    q.poly([[4, 3], [10, 2], [13, 6], [12, 13], [6, 14], [2, 10]], '@');
  }, { hi: '7', mid: '6', lo: '5' });
  p.line(4, 8, 12, 6, '5'); p.line(8, 3, 8, 13, '5'); p.line(5, 12, 11, 10, '5');
  p.stamp(['kk.kk'], 5, 5);
  p.stamp(['qk.qk'], 5, 5);
  for (const [x, y] of [[14, 3], [15, 9], [13, 12], [1, 3], [0, 13]]) p.set(x, y, 'o');
  p.set(14, 4, 'C'); p.set(15, 10, 'C');
  p.line(9, 9, 10, 9, 'k');
  return p;
}

// Pico de tensão: criatura em forma de raio, branco-amarelo com borda vermelha.
function pico() {
  const p = body(16, 16, (q) => {
    q.poly([[9, 0], [2, 9], [7, 9], [5, 16], [14, 6], [9, 6], [12, 0]], '@');
  }, { hi: 'j', mid: 'u', lo: 'Y' }, { outline: 'R' });
  p.outline('r');
  p.set(8, 4, 'k'); p.set(10, 4, 'k');
  p.set(7, 8, 'h'); p.set(8, 8, 'h');
  return p;
}

// Fantasma de cache: lençol de dados translúcido com olhos de grade.
function fantasma() {
  const p = body(16, 16, (q) => {
    q.disc(8, 7, 5.5, '@');
    q.rect(3, 7, 11, 6, '@');
    for (let x = 3; x < 14; x++) if (Math.floor((x - 3) / 2) % 2 === 0) q.set(x, 13, '@');
  }, { hi: 'I', mid: 'i', lo: 'B' }, { outline: 'b' });
  p.stamp(['kk..kk', 'kq..kq'], 5, 6);
  p.stamp(['kkk'], 7, 10);
  for (let y = 4; y < 13; y += 3) p.set(12, y, 'Q');
  return p;
}

// Sobrecarga térmica: chip quadrado em brasa com coroa de fogo e pinos.
function sobrecarga() {
  const p = new Px(16, 16);
  p.rect(3, 6, 10, 8, '@');
  p.poly([[3, 6], [4, 2], [6, 5], [8, 0], [10, 5], [12, 2], [13, 6]], '#');
  p.shade('@', { hi: 'h', mid: 'R', lo: 'r' });
  p.shade('#', { hi: 'j', mid: 'H', lo: 'h' });
  for (let x = 4; x < 13; x += 2) { p.set(x, 14, '6'); p.set(x, 15, '6'); }
  p.outline('k');
  p.stamp(['jk..jk', 'kk..kk'], 5, 8);
  p.stamp(['kkkkk'], 6, 11);
  p.set(7, 12, 'H'); p.set(9, 12, 'H');
  return p;
}

// Bit corrompido: cubo magenta com linhas deslocadas (falha de imagem) e um olho.
function bitCorrompido() {
  const p = body(16, 16, (q) => {
    q.rect(3, 3, 10, 10, '@');
  }, { hi: 'P', mid: 'p', lo: 'M' });
  const shifted = p.clone();
  for (const [y, dx] of [[5, 2], [6, 2], [10, -2], [11, -1]]) {
    for (let x = 0; x < 16; x++) shifted.g[y][x] = p.get(x - dx, y);
  }
  shifted.stamp(['kkk', 'kwk', 'kkk'], 6, 7);
  shifted.set(7, 8, 'q');
  shifted.stamp(['M.M', 'M.M'], 10, 3);
  shifted.set(1, 14, 'p'); shifted.set(14, 1, 'P'); shifted.set(15, 13, 'M');
  return shifted;
}

// Falha de pipeline: três segmentos de tubo desalinhados com ponta de seta.
function glitch() {
  const p = new Px(16, 16);
  p.rect(1, 9, 4, 5, '@');
  p.rect(5, 6, 4, 5, '#');
  p.rect(9, 8, 3, 5, '@');
  p.poly([[11, 5], [16, 10.5], [11, 16]], '#');
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.shade('#', { hi: 'P', mid: 'M', lo: 'm' });
  p.outline('k');
  p.set(13, 10, 'k'); p.set(13, 9, 'q');
  p.set(2, 11, 'k'); p.set(6, 8, 'k'); p.set(10, 10, 'k');
  p.set(4, 4, 'p'); p.set(9, 3, 's');
  return p;
}

// ---------- chefes ----------

function bolhaTermica() {
  const p = body(24, 24, (q) => {
    q.disc(12, 13, 9, '@');
  }, { hi: 'H', mid: 'h', lo: 'R', hi2: 'H', lo2: 'R' }, { glow: 'H' });
  p.disc(8.5, 9, 2.4, 'j'); p.set(7, 8, 'I');
  p.stamp(['kkk...kkk', '.jkk.kkj.', '..kk.kk..'], 7, 12);
  p.stamp(['.kkkkk.', 'kjkjkjk'], 9, 17);
  p.ring(3, 4, 0, 1.6, 'H'); p.ring(20.5, 3.5, 0, 1.2, 'h');
  p.set(1, 20, 'H'); p.set(22, 21, 'h');
  return p;
}

function varredor() {
  const p = new Px(24, 24);
  p.poly([[2, 9], [6, 4], [18, 4], [22, 9], [22, 15], [2, 15]], '@');
  p.shade('@', { hi: '7', mid: '6', lo: '5', hi2: '7' });
  for (let x = 2; x < 22; x++) {
    const len = 4 + (hash(x, 1, 7) % 3);
    for (let y = 16; y < 16 + len; y++) p.set(x, y, x % 2 ? 'o' : 'C');
  }
  p.rect(5, 8, 14, 3, 'k');
  p.rect(10, 8, 4, 3, 'l'); p.set(11, 9, 'j'); p.set(10, 8, 'R'); p.set(13, 10, 'R');
  p.stamp(['6.6.6.6.6.6'], 6, 13);
  p.outline('k'); p.outline('o');
  p.set(1, 22, 'O'); p.set(22, 23, 'O');
  return p;
}

function guardiaoCache() {
  const p = new Px(24, 24);
  p.poly([[5, 2], [19, 2], [21, 6], [20, 18], [12, 23], [4, 18], [3, 6]], '@');
  p.rect(0, 5, 5, 5, '#'); p.rect(19, 5, 5, 5, '#');
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  for (let y = 9; y < 19; y += 3) for (let x = 6; x < 18; x += 3) {
    if (p.get(x, y) !== '.' && p.get(x + 1, y + 1) !== '.') p.rect(x, y, 2, 2, (x + y) % 2 ? 'g' : 'Q');
  }
  p.rect(7, 5, 10, 3, 'k');
  p.stamp(['qq....qq'], 8, 6);
  p.outline('k'); p.outline('s');
  return p;
}

function nucleoInstavel() {
  const p = body(24, 24, (q) => {
    q.rect(6, 6, 12, 12, '@');
  }, { hi: '7', mid: '6', lo: '5' });
  p.disc(12, 12, 4, 'h'); p.disc(12, 12, 2.6, 'H'); p.disc(12, 12, 1.4, 'j');
  p.line(6, 8, 9, 11, 'R'); p.line(17, 15, 14, 13, 'R'); p.line(15, 6, 13, 9, 'R');
  for (let i = 7; i < 18; i += 3) { p.set(i, 4, '6'); p.set(i, 19, '6'); p.set(4, i, '6'); p.set(19, i, '6'); }
  p.stamp(['kk..kk'], 9, 11);
  p.outline('k');
  for (const [x, y, c] of [[2, 2, 'H'], [21, 3, 'h'], [1, 20, 'h'], [21, 21, 'H'], [11, 0, 'j'], [23, 12, 'H']]) {
    p.rect(x, y, 2, 2, c); p.set(x + 1, y + 1, 'R');
  }
  p.outline('H');
  return p;
}

function filaInfinita() {
  const p = new Px(24, 24);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    pts.push([12 + 8.6 * Math.cos(t), 12 + 4.6 * Math.sin(2 * t)]);
  }
  pts.forEach(([x, y], i) => p.disc(x, y, 2.6, i % 2 ? '@' : '#'));
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.shade('#', { hi: 'P', mid: 'M', lo: 'm' });
  p.outline('k');
  const [hx, hy] = pts[0];
  p.disc(hx, hy, 3.2, '@');
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.set(Math.floor(hx) - 1, Math.floor(hy) - 1, 'k'); p.set(Math.floor(hx) + 1, Math.floor(hy) - 1, 'k');
  p.set(Math.floor(hx) - 1, Math.floor(hy), 'q'); p.set(Math.floor(hx) + 1, Math.floor(hy), 'q');
  p.outline('s');
  return p;
}

function colapsoTensao() {
  const p = new Px(24, 24);
  p.poly([[7, 3], [17, 3], [18, 17], [6, 17]], '@');
  p.poly([[5, 17], [19, 17], [21, 22], [3, 22]], '#');
  p.shade('@', { hi: '7', mid: '6', lo: '5' });
  p.shade('#', { hi: 'M', mid: 'm', lo: 'A' });
  p.rect(7, 6, 10, 2, 'Y'); p.rect(7, 12, 10, 1, 'y');
  p.line(12, 3, 9, 9, 'k'); p.line(9, 9, 13, 12, 'k'); p.line(13, 12, 10, 17, 'k');
  p.stamp(['kk...kk', 'uk...uk'], 8, 9);
  p.outline('k');
  p.line(1, 2, 4, 7, 'u'); p.line(4, 7, 2, 10, 'u'); p.line(22, 1, 19, 6, 'u'); p.line(19, 6, 22, 9, 'u');
  p.set(0, 14, 'p'); p.set(23, 15, 'p');
  p.outline('Y');
  return p;
}

function pontePartida() {
  const p = new Px(24, 24);
  p.ring(12, 21, 6.5, 11.5, '@');
  p.replace('@', '.', (x, y) => y > 18 || (x >= 11 && x <= 12) || (x === 10 && y < 12) || (x === 13 && y > 12));
  p.rect(1, 17, 4, 4, '#'); p.rect(19, 17, 4, 4, '#');
  p.shade('@', { hi: 'I', mid: 'i', lo: 'B', lo2: 'B' });
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  for (let x = 2; x < 23; x += 3) if (p.get(x, 13) === 'i') p.set(x, 13, 'B');
  p.stamp(['kk.kk', 'qk.qk'], 3, 13);
  p.stamp(['kk.kk', 'qk.qk'], 16, 13);
  p.outline('k');
  for (const [x, y] of [[11, 13], [12, 16], [11, 19]]) { p.set(x, y, 'I'); p.set(x, y + 1, 'i'); }
  p.outline('i');
  return p;
}

function anelEscuro() {
  const p = new Px(24, 24);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const x = 12 + 10.6 * Math.cos(t), y = 12 + 10.6 * Math.sin(t);
    p.disc(x, y, 1.3, '#');
  }
  p.ring(12, 12, 5.6, 10, '@');
  p.shade('@', { hi: 'M', mid: 'A', lo: 'a', hi2: 'm' });
  p.shade('#', { hi: 'm', mid: 'A', lo: 'a' });
  p.ring(12, 12, 5.2, 6.4, 'p');
  p.ring(12, 12, 5.2, 5.8, 'P');
  p.disc(12, 12, 3, 'k'); p.disc(12, 12, 2.2, 'p'); p.disc(12, 12, 1.2, 'j');
  p.set(11, 11, 'w');
  for (const [x, y] of [[12, 3], [12, 20], [3, 12], [20, 12]]) p.set(x, y, 'p');
  p.outline('k'); p.outline('p');
  return p;
}

export const FOE_SPRITES = {
  pulga_corrente: sprite(pulga()),
  rasgo_trilha: sprite(rasgo()),
  ruido_termico: sprite(ruido()),
  vazamento_corrente: sprite(vazamento()),
  eletromigracao: sprite(eletromigracao()),
  pico_de_tensao: sprite(pico()),
  fantasma_de_cache: sprite(fantasma()),
  sobrecarga_termica: sprite(sobrecarga()),
  bit_corrompido: sprite(bitCorrompido()),
  glitch_de_pipeline: sprite(glitch()),
  bolha_termica: sprite(bolhaTermica()),
  varredor_de_trilhas: sprite(varredor()),
  guardiao_do_cache: sprite(guardiaoCache()),
  nucleo_instavel: sprite(nucleoInstavel()),
  fila_infinita: sprite(filaInfinita()),
  colapso_de_tensao: sprite(colapsoTensao()),
  ponte_partida: sprite(pontePartida()),
  anel_escuro: sprite(anelEscuro()),
};

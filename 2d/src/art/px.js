// Ferramentas de pixel art: uma grade de caracteres que vira sprite {w, h, frames, palette}.
// Tudo é determinístico (sem Math.random): mesma entrada, mesmos pixels.

// Paleta mestra. Cada sprite recebe só as cores que usa. '.' é transparente e nunca entra aqui.
export const MASTER = {
  // contornos e sombras
  k: '#0b0e14', K: '#1a1f2b',
  // silício (chão e paredes)
  0: '#0d1218', 1: '#121a23', 2: '#18222d', 3: '#22303d', 4: '#2e4152', 5: '#3e566b',
  // aço
  6: '#5a7489', 7: '#8aa3b6', w: '#e8f1ff', t: '#5c6b7a', T: '#a9b6c2',
  // cobre
  c: '#4a2a14', C: '#8a5a2b', o: '#c07a3e', O: '#eaa66a',
  // ouro
  y: '#7a5a12', Y: '#d4a62a', u: '#ffe07a', L: '#ffd166',
  // calor
  r: '#5a1010', R: '#c22a2a', l: '#ff3355', h: '#ff6a2a', H: '#ffb347', j: '#fff0a0',
  d: '#24120f', D: '#3a1c14',
  // frio
  b: '#0f3a57', B: '#2a8fc2', i: '#7ad8ff', I: '#d8f6ff', X: '#0f1f2a', W: '#1a3344',
  // sinal
  g: '#0c4a40', G: '#1fb894', s: '#7ef0c9', q: '#38f5ff', Q: '#b0fff0',
  // corrupção
  a: '#140a1c', A: '#2d1640', m: '#3a0f45', M: '#8a2aa8', p: '#e040c0', P: '#ff9af0',
  // personagens
  v: '#1b2a52', V: '#3f7cff', e: '#2b6cb0', E: '#5aa0e0', f: '#f5e6a8', F: '#b8a46a',
  n: '#6b4a2a', N: '#a07444', Z: '#2a0a0a',
};

// Hash inteiro determinístico para texturas ("ruído" sem aleatoriedade).
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
}

export class Px {
  constructor(w, h, fill = '.') {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  static from(rows) {
    const p = new Px(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((c, x) => { p.g[y][x] = c; }));
    return p;
  }
  clone() {
    const p = new Px(this.w, this.h);
    p.g = this.g.map((r) => r.slice());
    return p;
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.g[y][x] : '.'; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (this.inb(x, y)) this.g[y][x] = c;
    return this;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  box(x, y, w, h, c) {
    for (let i = x; i < x + w; i++) { this.set(i, y, c); this.set(i, y + h - 1, c); }
    for (let j = y; j < y + h; j++) { this.set(x, j, c); this.set(x + w - 1, j, c); }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  // Elipse cheia; centro e raios podem ser fracionários (centro de pixel = x + 0.5).
  ellipse(cx, cy, rx, ry, c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.g[y][x] = c;
    }
    return this;
  }
  disc(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  ring(cx, cy, r0, r1, c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= r0 && d <= r1) this.g[y][x] = c;
    }
    return this;
  }
  // Polígono cheio (teste pelo centro do pixel).
  poly(pts, c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.g[y][x] = c;
    }
    return this;
  }
  // Cola linhas de texto; '.' é pulado. map troca caracteres ao colar.
  stamp(rows, x = 0, y = 0, map = {}) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '.') this.set(x + i, y + j, map[ch] ?? ch);
    }));
    return this;
  }
  replace(a, b, pred = () => true) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y][x] === a && pred(x, y)) this.g[y][x] = b;
    }
    return this;
  }
  // Luz do alto à esquerda: bordas de cima/esquerda clareiam, de baixo/direita escurecem.
  shade(src, { hi, mid = src, lo, hi2, lo2 } = {}) {
    const snap = this.g.map((r) => r.slice());
    const out = (x, y) => (this.inb(x, y) ? snap[y][x] !== src : true);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (snap[y][x] !== src) continue;
      const s = (out(x, y - 1) ? 1 : 0) + (out(x - 1, y) ? 1 : 0) - (out(x, y + 1) ? 1 : 0) - (out(x + 1, y) ? 1 : 0);
      let c = mid;
      if (s > 0 && hi) c = hi;
      else if (s < 0 && lo) c = lo;
      else if (s === 0) {
        if (hi2 && (out(x - 1, y - 1) || out(x - 2, y) || out(x, y - 2))
          && !(out(x + 1, y + 1) || out(x + 2, y) || out(x, y + 2))) c = hi2;
        else if (lo2 && (out(x + 1, y + 1) || out(x + 2, y) || out(x, y + 2))
          && !(out(x - 1, y - 1) || out(x - 2, y) || out(x, y - 2))) c = lo2;
      }
      this.g[y][x] = c;
    }
    return this;
  }
  // Contorno: pixels vazios encostados no desenho recebem a cor c.
  outline(c, diag = false) {
    const snap = this.g.map((r) => r.slice());
    const solid = (x, y) => this.inb(x, y) && snap[y][x] !== '.';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (snap[y][x] !== '.') continue;
      let hit = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      if (!hit && diag) hit = solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1);
      if (hit) this.g[y][x] = c;
    }
    return this;
  }
  mirrorX() {
    for (let y = 0; y < this.h; y++) for (let x = Math.ceil(this.w / 2); x < this.w; x++) {
      this.g[y][x] = this.g[y][this.w - 1 - x];
    }
    return this;
  }
  flipX() {
    const p = new Px(this.w, this.h);
    p.g = this.g.map((r) => r.slice().reverse());
    return p;
  }
  shift(dx, dy) {
    const p = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.inb(x - dx, y - dy)) p.g[y][x] = this.g[y - dy][x - dx];
    }
    return p;
  }
  rows() { return this.g.map((r) => r.join('')); }
}

// Monta a sprite final: cada quadro vira linhas de texto e a paleta só leva as cores usadas.
export function sprite(...frames) {
  const rowsList = frames.map((f) => (f instanceof Px ? f.rows() : f.slice()));
  const h = rowsList[0].length, w = rowsList[0][0].length;
  const palette = {};
  for (const rows of rowsList) {
    if (rows.length !== h) throw new Error('quadros com alturas diferentes');
    for (const row of rows) {
      if (row.length !== w) throw new Error(`linha com largura errada: "${row}"`);
      for (const ch of row) {
        if (ch === '.') continue;
        if (!MASTER[ch]) throw new Error(`cor desconhecida: ${ch}`);
        palette[ch] = MASTER[ch];
      }
    }
  }
  return { w, h, frames: rowsList, palette };
}

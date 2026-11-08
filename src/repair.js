// Minijogo de reparo: gire os segmentos de trilha até ligar a fonte ao destino.
// Cada célula tem uma máscara de conexões (N=1, L=2, S=4, O=8). Girar troca a máscara.
const N = 1, E = 2, S = 4, W = 8;
const DIRS = [[0, -1, N, S], [1, 0, E, W], [0, 1, S, N], [-1, 0, W, E]];

const el = (id) => document.getElementById(id);
let cur = null;

function rotMask(m, r) {
  let out = m;
  for (let i = 0; i < r; i++) out = ((out << 1) | (out >> 3)) & 15;
  return out;
}

function popcount(m) { let c = 0; for (let i = 0; i < 4; i++) if (m & (1 << i)) c++; return c; }

// Gera um caminho aleatório auto-evitante de (0,0) até (n-1,n-1)
function randomPath(n, rand) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const path = [[0, 0]];
    const seen = new Set(['0,0']);
    let x = 0, y = 0, ok = false;
    for (let step = 0; step < n * n * 2; step++) {
      if (x === n - 1 && y === n - 1) { ok = true; break; }
      const opts = DIRS.map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < n && !seen.has(`${nx},${ny}`));
      if (!opts.length) break;
      // Prefere se aproximar do destino, com algum acaso
      opts.sort((a, b) => (Math.abs(a[0] - (n - 1)) + Math.abs(a[1] - (n - 1))) - (Math.abs(b[0] - (n - 1)) + Math.abs(b[1] - (n - 1))) + (rand() - 0.5) * 2.5);
      const [nx, ny] = opts[0];
      seen.add(`${nx},${ny}`);
      path.push([nx, ny]);
      x = nx; y = ny;
    }
    if (ok) return path;
  }
  // Fallback: caminho em L
  const path = [];
  for (let i = 0; i < n; i++) path.push([i, 0]);
  for (let j = 1; j < n; j++) path.push([n - 1, j]);
  return path;
}

function buildPuzzle(n, rand) {
  const cells = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ base: 0, rot: 0 })));
  const path = randomPath(n, rand);
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    let m = 0;
    if (i > 0) {
      const [px, py] = path[i - 1];
      const d = DIRS.find(([dx, dy]) => x - px === dx && y - py === dy);
      if (d) m |= d[3]; // conexão voltada para o anterior (bit oposto ao movimento)
    }
    if (i < path.length - 1) {
      const [nx, ny] = path[i + 1];
      const d = DIRS.find(([dx, dy]) => nx - x === dx && ny - y === dy);
      if (d) m |= d[2];
    }
    cells[y][x].base = m;
  }
  // Células fora do caminho recebem ramos aleatórios (decoração que também pode confundir)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (cells[y][x].base) continue;
    const r = rand();
    cells[y][x].base = r < 0.35 ? 0 : r < 0.7 ? (E | W) : (N | E | S);
  }
  // Embaralha rotações; garante que o puzzle não começa resolvido
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    cells[y][x].rot = Math.floor(rand() * 4);
  }
  const p = { n, cells };
  if (solved(p)) cells[0][0].rot = (cells[0][0].rot + 1) % 4;
  return p;
}

function curMask(p, x, y) {
  return rotMask(p.cells[y][x].base, p.cells[y][x].rot);
}

// Conjunto de células energizadas (a partir da fonte em (0,0))
function powered(p) {
  const on = new Set(['0,0']);
  const queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const m = curMask(p, x, y);
    for (const [dx, dy, bit, opp] of DIRS) {
      if (!(m & bit)) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.n || ny >= p.n) continue;
      if (!(curMask(p, nx, ny) & opp)) continue;
      const key = `${nx},${ny}`;
      if (on.has(key)) continue;
      on.add(key);
      queue.push([nx, ny]);
    }
  }
  return on;
}

function solved(p) {
  return powered(p).has(`${p.n - 1},${p.n - 1}`);
}

function draw() {
  const canvas = el('rp-canvas');
  const g = canvas.getContext('2d');
  const { n } = cur.puzzle;
  const size = canvas.width;
  const cell = size / n;
  const on = powered(cur.puzzle);
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#04121a';
  g.fillRect(0, 0, size, size);

  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = x * cell, py = y * cell;
    const lit = on.has(`${x},${y}`);
    g.strokeStyle = 'rgba(31,230,208,0.12)';
    g.lineWidth = 1;
    g.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
    const m = curMask(cur.puzzle, x, y);
    const cx = px + cell / 2, cy = py + cell / 2;
    const color = lit ? '#ffd166' : '#1fe6d0';
    g.lineCap = 'round';
    g.strokeStyle = color;
    g.shadowColor = color;
    g.shadowBlur = lit ? 14 : 6;
    g.lineWidth = Math.max(6, cell * 0.14);
    g.globalAlpha = lit ? 1 : 0.55;
    const dirsPt = { [N]: [cx, py + 6], [E]: [px + cell - 6, cy], [S]: [cx, py + cell - 6], [W]: [px + 6, cy] };
    for (const bit of [N, E, S, W]) {
      if (!(m & bit)) continue;
      const [ex, ey] = dirsPt[bit];
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, g.lineWidth * 0.6, 0, Math.PI * 2); g.fillStyle = color; g.fill();
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }
  // Fonte (verde) e destino (magenta)
  const dot = (x, y, c) => {
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 16;
    g.beginPath(); g.arc(cx, cy, cell * 0.12, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  };
  dot(0, 0, '#7CFC9A');
  dot(n - 1, n - 1, '#ff3ea5');
  el('rp-help').textContent = solved(cur.puzzle)
    ? 'Circuito restaurado!'
    : 'Toque nos segmentos para girá-los. Ligue a fonte verde ao destino magenta.';
}

function onClick(ev) {
  if (!cur) return;
  const canvas = el('rp-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / rect.width * canvas.width;
  const y = (ev.clientY - rect.top) / rect.height * canvas.height;
  const n = cur.puzzle.n;
  const cx = Math.floor(x / (canvas.width / n));
  const cy = Math.floor(y / (canvas.height / n));
  if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
  cur.puzzle.cells[cy][cx].rot = (cur.puzzle.cells[cy][cx].rot + 1) % 4;
  cur.moves++;
  draw();
  if (solved(cur.puzzle) && !cur.done) {
    cur.done = true;
    el('rp-title').textContent = 'Circuito Restaurado';
    setTimeout(() => finish(true), 900);
  }
}

function finish(success) {
  const cb = cur && cur.onDone;
  cur = null;
  el('rp-canvas').removeEventListener('click', onClick);
  el('repair').classList.add('hidden');
  cb && cb(success);
}

// Gancho de teste: expõe o puzzle atual (somente leitura de referência)
export function repairDebug() {
  return cur;
}

// Inicia o reparo. size = 4..6, rand = gerador aleatório determinístico opcional.
export function startRepair({ size = 4, title = 'Reparo de Trilha', onDone } = {}) {
  const rand = Math.random;
  const puzzle = buildPuzzle(size, rand);
  cur = { puzzle, moves: 0, done: false, onDone };
  el('rp-title').textContent = title;
  el('repair').classList.remove('hidden');
  el('rp-canvas').addEventListener('click', onClick);
  draw();
}

export function cancelRepair() {
  if (cur) finish(false);
}

export function isRepairOpen() {
  return !!cur;
}

// Bind do botão cancelar, feito uma vez
export function bindRepairUI() {
  el('rp-cancel').addEventListener('click', () => cancelRepair());
}

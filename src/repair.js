// Minijogo de reparo: gire os segmentos de trilha até ligar a fonte ao destino.
// Máscaras de conexão: N=1, L=2, S=4, O=8. Girar troca a máscara (rotação de 90°).
// Segmentos:
//   reto, curva, T, ponta (fonte/destino): giram normalmente
//   cruzamento: liga as 4 direções e não gira (encaixe fixo)
//   fusível: gira, mas queima ao ser energizado e não pode mais ser girado
import { recordRepairScore, repairBestOf as recordRepairScoreOf } from './state.js';
import { settings, saveSettings } from './settings.js';

// Tempo decorrido sem contar as pausas
function elapsedSec() {
  const now = cur.paused ? cur.pausedAt : performance.now();
  return (now - cur.startedAt - cur.pausedTotal) / 1000;
}
import { sfx } from './audio.js';
import { vibrate } from './settings.js';

const N = 1, E = 2, S = 4, W = 8;
const DIRS = [[0, -1, N, S], [1, 0, E, W], [0, 1, S, N], [-1, 0, W, E]];
const CROSS = N | E | S | W;

const el = (id) => document.getElementById(id);
let cur = null;

function rotMask(m, r) {
  let out = m;
  for (let i = 0; i < r; i++) out = ((out << 1) | (out >> 3)) & 15;
  return out;
}

function typeOf(mask) {
  if (mask === CROSS) return 'cruzamento';
  const bits = [N, E, S, W].filter((b) => mask & b).length;
  if (bits === 1) return 'ponta';
  if (bits === 3) return 'T';
  if (mask === (N | S) || mask === (E | W)) return 'reto';
  return 'curva';
}

// Caminho aleatório auto-evitante de (0,0) até (n-1,n-1)
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
      opts.sort((a, b) => (Math.abs(a[0] - (n - 1)) + Math.abs(a[1] - (n - 1))) - (Math.abs(b[0] - (n - 1)) + Math.abs(b[1] - (n - 1))) + (rand() - 0.5) * 2.5);
      const [nx, ny] = opts[0];
      seen.add(`${nx},${ny}`);
      path.push([nx, ny]);
      x = nx; y = ny;
    }
    if (ok) return path;
  }
  const path = [];
  for (let i = 0; i < n; i++) path.push([i, 0]);
  for (let j = 1; j < n; j++) path.push([n - 1, j]);
  return path;
}

function buildPuzzle(n, rand, fuses) {
  const cells = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ type: 'vazio', base: 0, rot: 0, locked: false })));
  const path = randomPath(n, rand);
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    let m = 0;
    if (i > 0) {
      const [px, py] = path[i - 1];
      const d = DIRS.find(([dx, dy]) => x - px === dx && y - py === dy);
      if (d) m |= d[3];
    }
    if (i < path.length - 1) {
      const [nx, ny] = path[i + 1];
      const d = DIRS.find(([dx, dy]) => nx - x === dx && ny - y === dy);
      if (d) m |= d[2];
    }
    cells[y][x].base = m;
    cells[y][x].type = typeOf(m);
  }
  // Fusíveis: segmentos retos no meio do caminho
  const straights = path.slice(1, -1).filter(([x, y]) => cells[y][x].type === 'reto');
  for (let k = 0; k < fuses && straights.length; k++) {
    const idx = Math.floor(rand() * straights.length);
    const [x, y] = straights.splice(idx, 1)[0];
    cells[y][x].type = 'fusivel';
  }
  // Células fora do caminho: decoração que também pode confundir
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (cells[y][x].type !== 'vazio' || cells[y][x].base) continue;
    const r = rand();
    if (r < 0.2) { cells[y][x].base = CROSS; cells[y][x].type = 'cruzamento'; }
    else if (r < 0.5) { cells[y][x].base = E | W; cells[y][x].type = 'reto'; }
    else if (r < 0.8) { cells[y][x].base = N | E | S; cells[y][x].type = 'T'; }
  }
  // Embaralha rotações; garante que o puzzle não começa resolvido
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (cells[y][x].type === 'cruzamento') continue;
    cells[y][x].rot = Math.floor(rand() * 4);
  }
  const p = { n, cells };
  if (solved(p)) {
    const c = cells[0][0];
    if (c.type !== 'cruzamento') c.rot = (c.rot + 1) % 4;
  }
  return p;
}

function curMask(p, x, y) {
  const c = p.cells[y][x];
  return rotMask(c.base, c.rot);
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

// Fusíveis energizados ficam travados para sempre
function lockFuses(p, on) {
  let burned = 0;
  for (const key of on) {
    const [x, y] = key.split(',').map(Number);
    const c = p.cells[y][x];
    if (c.type === 'fusivel' && !c.locked) { c.locked = true; burned++; }
  }
  return burned;
}

function solved(p) {
  return powered(p).has(`${p.n - 1},${p.n - 1}`);
}

// Pontuação: menos giros e menos tempo rendem mais pontos
function scoreNow() {
  const elapsed = elapsedSec();
  let s = Math.max(0, 1000 - cur.moves * 15 - Math.round(elapsed * 3));
  if (cur.timeLimit) s += Math.round(Math.max(0, cur.timeLimit - elapsed) * 5);
  return Math.round(s);
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
    const c = cur.puzzle.cells[y][x];
    const lit = on.has(`${x},${y}`);
    g.strokeStyle = 'rgba(31,230,208,0.12)';
    g.lineWidth = 1;
    g.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
    const m = curMask(cur.puzzle, x, y);
    const cx = px + cell / 2, cy = py + cell / 2;
    let color = lit ? '#ffd166' : '#1fe6d0';
    if (c.type === 'fusivel') color = c.locked ? '#ff5566' : (lit ? '#ffe9a8' : '#ff9a6b');
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
    if (c.type === 'cruzamento') {
      g.strokeStyle = '#9be7ff';
      g.strokeRect(cx - cell * 0.14, cy - cell * 0.14, cell * 0.28, cell * 0.28);
    }
    if (c.type === 'fusivel') {
      g.fillStyle = c.locked ? '#ff5566' : '#ffb07a';
      g.font = `bold ${Math.round(cell * 0.2)}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(c.locked ? 'X' : 'F', cx, cy - cell * 0.28);
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }
  // Cursor do teclado
  if (cur.keyboard) {
    g.setLineDash([6, 4]); g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.strokeRect(cur.cursor.x * cell + 5, cur.cursor.y * cell + 5, cell - 10, cell - 10);
    g.setLineDash([]);
  }
  // Fonte (verde) e destino (magenta)
  const dot = (x, y, col) => {
    const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16;
    g.beginPath(); g.arc(cx, cy, cell * 0.12, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  };
  dot(0, 0, '#7CFC9A');
  dot(n - 1, n - 1, '#ff3ea5');

  el('rp-moves').textContent = `Giros: ${cur.moves}`;
  el('rp-score').textContent = `Pontos: ${scoreNow()}`;
  el('rp-help').textContent = solved(cur.puzzle)
    ? 'Circuito restaurado!'
    : (cur.feedback || 'Gire os segmentos. Fusíveis (F) queimam ao receber energia. Cruzamentos (quadrados) não giram.');
}

function tick() {
  if (!cur) return;
  if (cur.timeLimit) {
    const left = Math.max(0, cur.timeLimit - elapsedSec());
    el('rp-timer').textContent = `Tempo: ${Math.ceil(left)}s`;
    if (left <= 0 && !cur.done) {
      cur.done = true;
      el('rp-title').textContent = 'Tempo esgotado';
      sfx('locked');
      setTimeout(() => finish(false, 0, 'timeout'), 900);
      return;
    }
  }
  draw();
}

function onClick(ev) {
  if (!cur || cur.done || cur.paused) return;
  const canvas = el('rp-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / rect.width * canvas.width;
  const y = (ev.clientY - rect.top) / rect.height * canvas.height;
  const n = cur.puzzle.n;
  const cx = Math.floor(x / (canvas.width / n));
  const cy = Math.floor(y / (canvas.height / n));
  if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
  const c = cur.puzzle.cells[cy][cx];
  if (c.type === 'cruzamento') { cur.feedback = 'Cruzamento: encaixe fixo, não gira.'; sfx('ui'); draw(); return; }
  if (c.locked) { cur.feedback = 'Fusível queimado: não pode mais ser girado.'; sfx('locked'); draw(); return; }
  c.rot = (c.rot + 1) % 4;
  cur.moves++;
  sfx('ui');
  const burned = lockFuses(cur.puzzle, powered(cur.puzzle));
  if (burned) { vibrate(25); sfx('hit'); }
  draw();
  if (solved(cur.puzzle) && !cur.done) {
    cur.done = true;
    const score = scoreNow();
    const best = recordRepairScore(scoreKey(), score);
    el('rp-title').textContent = best ? `Circuito Restaurado — recorde!` : 'Circuito Restaurado';
    el('rp-score').textContent = `Pontos: ${score}`;
    sfx('repair');
    vibrate([30, 30, 60]);
    setTimeout(() => finish(true, score, 'solved'), 900);
  }
}

// reason: 'solved' | 'timeout' | 'cancel'
function finish(success, score = 0, reason = 'cancel') {
  const cb = cur && cur.onDone;
  clearInterval(cur && cur.timer);
  cur = null;
  el('rp-canvas').removeEventListener('click', onClick);
  window.removeEventListener('keydown', onKey);
  el('repair').classList.add('hidden');
  cb && cb(success, score, reason);
}

// Inicia o reparo.
//   size: 4..6 · timeLimit: segundos (0 ou ausente = sem limite) · zoneId: chave do recorde
//   onDone(success, score)
// Tutorial exibido na primeira vez que o reparo abre (ver main.js)
export const REPAIR_TUTORIAL = [
  { s: 'Tutorial', t: 'Cada trilha partida precisa ligar a fonte verde ao destino magenta.' },
  { s: 'Tutorial', t: 'Clique num segmento para girá-lo 90°. Pelo teclado: setas movem o cursor, Enter gira, H liga o modo difícil.' },
  { s: 'Tutorial', t: 'Cruzamentos (quadrados) não giram. Fusíveis (F) queimam quando recebem energia e travam para sempre.' },
  { s: 'Tutorial', t: 'Menos giros e menos tempo rendem mais pontos. Seu melhor resultado fica salvo na zona.' },
];

function sizeFor(size, hard) { return hard ? Math.min(7, size + 1) : size; }
function fusesFor(fuses, hard) { return hard ? fuses + 1 : fuses; }

// Chave do recorde: zona, com sufixo quando o modo difícil está ligado
function scoreKey() {
  return cur.hard ? `${cur.base.zoneId}-hard` : cur.base.zoneId;
}

function showBest() {
  const best = recordRepairScoreOf(scoreKey());
  el('rp-best').textContent = best ? `Recorde: ${best}` : 'Sem recorde ainda';
}

function updateHardButton() {
  const b = el('rp-hard');
  b.textContent = cur.hard ? 'Modo difícil: ligado (H)' : 'Modo difícil: desligado (H)';
  b.setAttribute('aria-pressed', String(!!cur.hard));
}

function buildFor(hard) {
  return buildPuzzle(sizeFor(cur.base.size, hard), Math.random, fusesFor(cur.base.fuses, hard));
}

export function startRepair({ size = 4, title = 'Reparo de Trilha', zoneId = 'geral', timeLimit = 0, fuses = 1, hard = false, onDone } = {}) {
  cur = {
    base: { size, fuses, zoneId },
    hard: hard || !!settings.repairHard, // a última escolha de dificuldade vale para o próximo reparo
    paused: false, pausedAt: 0, pausedTotal: 0,
    onDone, timeLimit, moves: 0, done: false,
    startedAt: performance.now(), feedback: '',
    cursor: { x: 0, y: 0 }, keyboard: false,
  };
  cur.puzzle = buildFor(cur.hard);
  el('rp-title').textContent = title;
  el('repair').classList.remove('hidden');
  el('rp-timer').classList.toggle('hidden', !timeLimit);
  el('rp-canvas').addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  updateHardButton();
  showBest();
  cur.timer = setInterval(tick, 250);
  tick();
  el('rp-canvas').focus();
}

// Troca a dificuldade e recomeça o quebra-cabeça
export function toggleHard() {
  if (!cur || cur.done) return;
  cur.hard = !cur.hard;
  settings.repairHard = cur.hard;
  saveSettings();
  cur.puzzle = buildFor(cur.hard);
  cur.moves = 0;
  cur.startedAt = performance.now();
  cur.cursor = { x: 0, y: 0 };
  cur.feedback = cur.hard ? 'Modo difícil: quebra-cabeça novo.' : 'Modo normal: quebra-cabeça novo.';
  updateHardButton();
  showBest();
  draw();
}

// Teclado: setas movem o cursor, Enter/Espaço giram, H alterna o modo difícil, Esc cancela
function onKey(ev) {
  if (!cur) return;
  const n = cur.puzzle.n;
  const handled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space', 'KeyH', 'KeyP', 'Escape'].includes(ev.code);
  if (!handled) return;
  // Com um botão focado (ex.: Modo difícil), Enter/Espaço pertencem ao botão
  if ((ev.code === 'Enter' || ev.code === 'Space') && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
  ev.preventDefault();
  ev.stopPropagation();
  cur.keyboard = true;
  if (ev.code === 'ArrowUp') cur.cursor.y = Math.max(0, cur.cursor.y - 1);
  if (ev.code === 'ArrowDown') cur.cursor.y = Math.min(n - 1, cur.cursor.y + 1);
  if (ev.code === 'ArrowLeft') cur.cursor.x = Math.max(0, cur.cursor.x - 1);
  if (ev.code === 'ArrowRight') cur.cursor.x = Math.min(n - 1, cur.cursor.x + 1);
  if (ev.code === 'Enter' || ev.code === 'Space') {
    // Mesmo caminho do clique: calcula o centro da célula e reaproveita onClick
    const canvas = el('rp-canvas');
    const rect = canvas.getBoundingClientRect();
    const cs = rect.width / n;
    onClick({ clientX: rect.left + (cur.cursor.x + 0.5) * cs, clientY: rect.top + (cur.cursor.y + 0.5) * cs });
  }
  if (ev.code === 'KeyH') toggleHard();
  if (ev.code === 'KeyP') togglePause();
  if (ev.code === 'Escape') { cancelRepair(); return; }
  draw();
}

export function cancelRepair() {
  if (cur) finish(false, 0, 'cancel');
}

export function isRepairOpen() {
  return !!cur;
}

// Gancho de teste: expõe o puzzle atual
export function repairDebug() {
  return cur;
}

// Bind do botão cancelar, feito uma vez
export function bindRepairUI() {
  el('rp-cancel').addEventListener('click', () => cancelRepair());
  el('rp-hard').addEventListener('click', () => toggleHard());
  el('rp-canvas').tabIndex = 0;
}

// Pausa: congela o cronômetro e bloqueia os cliques (teclado: P)
export function togglePause() {
  if (!cur || cur.done || !cur.timeLimit) return;
  if (cur.paused) {
    cur.pausedTotal += performance.now() - cur.pausedAt;
    cur.paused = false;
    cur.feedback = 'Reparo retomado.';
  } else {
    cur.paused = true;
    cur.pausedAt = performance.now();
    cur.feedback = 'PAUSADO. Pressione P para continuar.';
  }
  draw();
}

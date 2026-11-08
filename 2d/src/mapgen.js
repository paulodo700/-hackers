// Gera o mapa de cada camada a partir de uma semente. Cada mapa é um labirinto com corredores
// garantidos entre a entrada (canto superior esquerdo) e a saída (canto inferior direito).
// O gerador só aceita um mapa se: a saída continua alcançável com os bloqueios abertos,
// os materiais e falhas ficam alcançáveis antes de qualquer bloqueio, e o técnico não corta o caminho.
import { mulberry32 } from './rng.js';
import { FLOOR, TRACE, WALL, DAMAGED, GATE, SOCKET, NPC, UP, DOWN, GOAL, SPAWN } from './grid.js';

export const MAP_W = 19;
export const MAP_H = 11;
export const START = [1, 1];
export const EXIT = [MAP_W - 2, MAP_H - 2];
const BLOCKER_CHARS = new Set([DAMAGED, GATE, SOCKET]);
const FLOORS = new Set([FLOOR, TRACE]);
const FOE_CHAR_OF = { pulga_corrente: 'f', rasgo_trilha: 'F', ruido_termico: 'Q' };
const MATERIAL_CHARS = new Set(['a', 'w', 'k']);

const key = (c, r) => `${c},${r}`;

function carveMaze(rnd) {
  const g = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(WALL));
  const cw = (MAP_W - 1) / 2, ch = (MAP_H - 1) / 2;
  const seen = new Set();
  const stack = [[0, 0]];
  seen.add('0,0');
  g[1][1] = FLOOR;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen.has(`${nx},${ny}`));
    if (!options.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = options[Math.floor(rnd() * options.length)];
    seen.add(`${nx},${ny}`);
    g[2 * cy + 1 + dy][2 * cx + 1 + dx] = FLOOR;
    g[2 * ny + 1][2 * nx + 1] = FLOOR;
    stack.push([nx, ny]);
  }
  return g;
}

// Abre paredes internas entre dois corredores para criar ciclos (mais de um caminho).
function addLoops(g, rnd, count) {
  let opened = 0;
  for (let tries = 0; tries < 2000 && opened < count; tries++) {
    const r = 1 + Math.floor(rnd() * (MAP_H - 2));
    const c = 1 + Math.floor(rnd() * (MAP_W - 2));
    if (g[r][c] !== WALL) continue;
    const horiz = g[r][c - 1] === FLOOR && g[r][c + 1] === FLOOR;
    const vert = g[r - 1][c] === FLOOR && g[r + 1][c] === FLOOR;
    if (horiz !== vert) { g[r][c] = FLOOR; opened++; }
  }
}

function floorsAt(g) {
  const out = [];
  for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) if (FLOORS.has(g[r][c]) || g[r][c] === 'a' || g[r][c] === 'w' || g[r][c] === 'k') out.push([c, r]);
  return out;
}

// Alcance por BFS. blockedChars: células que fecham o caminho (bloqueios e técnico).
function reach(g, from, blockedChars) {
  const seen = new Set([key(...from)]);
  const q = [from];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nr < 0 || nc < 0 || nr >= MAP_H || nc >= MAP_W) continue;
      const ch = g[nr][nc];
      if (ch === WALL || blockedChars.has(ch) || seen.has(key(nc, nr))) continue;
      seen.add(key(nc, nr));
      q.push([nc, nr]);
    }
  }
  return seen;
}

function pathBetween(g, from, to) {
  const prev = new Map([[key(...from), null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur[0] === to[0] && cur[1] === to[1]) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur[0] + dc, nr = cur[1] + dr;
      if (nr < 0 || nc < 0 || nr >= MAP_H || nc >= MAP_W) continue;
      if (g[nr][nc] === WALL || prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), cur);
      q.push([nc, nr]);
    }
  }
  if (!prev.has(key(...to))) return null;
  const path = [];
  for (let cur = to; cur; cur = prev.get(key(...cur))) path.unshift(cur);
  return path;
}

function pickCell(rnd, cells) {
  return cells.length ? cells[Math.floor(rnd() * cells.length)] : null;
}

// Monta um mapa a partir da especificação da camada. Devolve as linhas, ou null se não couber.
function buildOnce(spec, seed) {
  const rnd = mulberry32(seed);
  const g = carveMaze(rnd);
  addLoops(g, rnd, spec.loops ?? 0);
  // Decoração: parte dos corredores vira trilha de metal (passável).
  for (let r = 1; r < MAP_H - 1; r++) for (let c = 1; c < MAP_W - 1; c++) if (g[r][c] === FLOOR && rnd() < 0.25) g[r][c] = TRACE;

  const start = START, exit = EXIT;
  const path = pathBetween(g, start, exit);
  if (!path) return null;
  // Bloqueios sobre o caminho principal (não nas pontas).
  const blockerCells = path.slice(3, path.length - 3);
  for (const ch of spec.blockers ?? []) {
    const cell = pickCell(rnd, blockerCells.filter(([c, r]) => g[r][c] !== 'x' && g[r][c] !== 'g' && g[r][c] !== 'o'));
    if (!cell) return null;
    g[cell[1]][cell[0]] = ch;
  }
  g[start[1]][start[0]] = spec.first ? SPAWN : UP;
  g[exit[1]][exit[0]] = spec.goal ? GOAL : DOWN;

  // Técnico: bloqueia, então não pode cortar o caminho nem o alcance dos materiais.
  if (spec.npc) {
    const candidates = floorsAt(g).filter(([c, r]) => g[r][c] === FLOOR || g[r][c] === TRACE);
    const cell = pickCell(rnd, candidates);
    if (!cell) return null;
    g[cell[1]][cell[0]] = NPC;
  }
  const closed = new Set(['x', 'g', 'o', 'N']);
  const open = reach(g, start, closed);
  if (!open.has(key(...exit))) return null;

  const free = floorsAt(g).filter(([c, r]) => open.has(key(c, r)) && g[r][c] !== UP && g[r][c] !== DOWN && g[r][c] !== SPAWN && g[r][c] !== GOAL && g[r][c] !== NPC);
  const used = new Set();
  const take = () => {
    const cells = free.filter(([c, r]) => !used.has(key(c, r)));
    const cell = pickCell(rnd, cells);
    if (cell) used.add(key(...cell));
    return cell;
  };
  for (const [ch, n] of Object.entries(spec.pickups ?? {})) {
    for (let i = 0; i < n; i++) {
      const cell = take();
      if (!cell) return null;
      g[cell[1]][cell[0]] = ch;
    }
  }
  const foes = spec.foes ?? [];
  for (let i = 0; i < (spec.foeCount ?? 0) && foes.length; i++) {
    const cell = take();
    if (!cell) return null;
    g[cell[1]][cell[0]] = FOE_CHAR_OF[foes[i % foes.length]];
  }
  return g.map((row) => row.join(''));
}

export function generateMap(spec, seed) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const rows = buildOnce(spec, seed + attempt * 7919);
    if (rows) return rows;
  }
  throw new Error(`não foi possível gerar o mapa com semente ${seed}`);
}

export { MATERIAL_CHARS, BLOCKER_CHARS, reach, key };

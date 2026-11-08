// Gera o mapa de cada camada a partir de uma semente: um labirinto com atalhos, uma sala do chefe fechada
// por uma porta, bloqueios que são pontes obrigatórias, e os demais elementos (técnicos, baús, materiais,
// falhas, zonas quentes e frias). O gerador só aceita um mapa que passa nos invariantes abaixo.
//
// Ordem: labirinto em árvore → sala e porta → bloqueios (em pontes da árvore) → atalhos (só os que não
// permitem contornar nada) → técnicos e baús → materiais, chave, falhas e zonas.
import { mulberry32 } from './rng.js';
import {
  WALL, FLOOR, TRACE, DAMAGED, GATE, SOCKET, DOOR, NPC, MERCHANT, CHEST, HOT, COOL, KEY, BOSS,
  UP, DOWN, GOAL, SPAWN, PICKUP_ITEMS, FOE_CHARS,
} from './grid.js';

export const MAP_W = 31;
export const MAP_H = 21;
export const START = [1, 1];
export const EXIT = [MAP_W - 2, MAP_H - 2];
// Sala do chefe: 3x3 no canto inferior direito, com a saída dentro. Um anel de parede a fecha.
const ROOM = { c0: MAP_W - 4, r0: MAP_H - 4, c1: MAP_W - 2, r1: MAP_H - 2 };
const BOSS_CELL = [ROOM.c0 + 1, ROOM.r0 + 1];
const CLOSED_TOOLS = [NPC, MERCHANT, CHEST, DAMAGED, GATE, SOCKET, DOOR];
const CLOSED_NO_TOOLS = [NPC, MERCHANT, CHEST];
const FOE_CHAR_OF = Object.fromEntries(Object.entries(FOE_CHARS).map(([ch, id]) => [id, ch]));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const key = (c, r) => `${c},${r}`;
const inRoom = (c, r) => c >= ROOM.c0 && c <= ROOM.c1 && r >= ROOM.r0 && r <= ROOM.r1;
const inRing = (c, r) => !inRoom(c, r) && c >= ROOM.c0 - 1 && c <= ROOM.c1 + 1 && r >= ROOM.r0 - 1 && r <= ROOM.r1 + 1;

// Labirinto em árvore (DFS): exatamente um caminho entre quaisquer duas células.
function carveMaze(rnd) {
  const g = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(WALL));
  const cw = (MAP_W - 1) / 2, ch = (MAP_H - 1) / 2;
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];
  g[1][1] = FLOOR;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = DIRS.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
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

// Sala do chefe: piso dentro, parede no anel, e uma única porta no anel, ligada ao labirinto.
function buildRoom(g, rnd) {
  for (let r = ROOM.r0; r <= ROOM.r1; r++) for (let c = ROOM.c0; c <= ROOM.c1; c++) g[r][c] = FLOOR;
  for (let r = ROOM.r0 - 1; r <= ROOM.r1 + 1; r++) {
    for (let c = ROOM.c0 - 1; c <= ROOM.c1 + 1; c++) if (inRing(c, r)) g[r][c] = WALL;
  }
  const doorOptions = [];
  for (let r = ROOM.r0 - 1; r <= ROOM.r1 + 1; r++) {
    for (let c = ROOM.c0 - 1; c <= ROOM.c1 + 1; c++) {
      if (!inRing(c, r)) continue;
      const outside = DIRS.map(([dc, dr]) => [c + dc, r + dr]).filter(([nc, nr]) => !inRoom(nc, nr) && !inRing(nc, nr));
      if (outside.some(([nc, nr]) => nr >= 0 && nr < MAP_H && nc >= 0 && nc < MAP_W && g[nr][nc] !== WALL)) doorOptions.push([c, r]);
    }
  }
  const door = doorOptions[Math.floor(rnd() * doorOptions.length)];
  if (!door) return null;
  g[door[1]][door[0]] = DOOR;
  return door;
}

// Alcance por BFS. closed: caracteres que fecham o caminho.
function reach(g, from, closed) {
  const seen = new Set([key(...from)]);
  const q = [from];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nr < 0 || nc < 0 || nr >= MAP_H || nc >= MAP_W) continue;
      const ch = g[nr][nc];
      if (ch === WALL || closed.has(ch) || seen.has(key(nc, nr))) continue;
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
    for (const [dc, dr] of DIRS) {
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

const pick = (rnd, list) => (list.length ? list[Math.floor(rnd() * list.length)] : null);
const floorCells = (g) => {
  const out = [];
  for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) if (g[r][c] === FLOOR || g[r][c] === TRACE) out.push([c, r]);
  return out;
};

// Atalhos (ciclos no labirinto). Um atalho só fica se a saída continuar fora de alcance sem ferramentas.
function addLoops(g, rnd, count) {
  let opened = 0;
  const semFerramentas = () => !reach(g, START, new Set(CLOSED_TOOLS)).has(key(...EXIT));
  for (let tries = 0; tries < 3000 && opened < count; tries++) {
    const r = 1 + Math.floor(rnd() * (MAP_H - 2));
    const c = 1 + Math.floor(rnd() * (MAP_W - 2));
    if (g[r][c] !== WALL || inRing(c, r) || inRoom(c, r)) continue;
    const horiz = g[r][c - 1] === FLOOR && g[r][c + 1] === FLOOR;
    const vert = g[r - 1][c] === FLOOR && g[r + 1][c] === FLOOR;
    if (horiz === vert) continue;
    g[r][c] = FLOOR;
    if (semFerramentas()) opened++;
    else g[r][c] = WALL;
  }
}

// Coloca um elemento que bloqueia (técnico, mercador, baú) sem cortar o caminho até a saída.
function placeBlocker(g, rnd, ch, avoid) {
  const candidates = floorCells(g).filter(([c, r]) => !avoid(c, r) && !inRing(c, r) && !inRoom(c, r));
  for (let t = 0; t < 60 && candidates.length; t++) {
    const idx = Math.floor(rnd() * candidates.length);
    const [c, r] = candidates.splice(idx, 1)[0];
    const old = g[r][c];
    g[r][c] = ch;
    if (reach(g, START, new Set([NPC, MERCHANT, CHEST])).has(key(...EXIT))) return true;
    g[r][c] = old;
  }
  return false;
}

// Monta um mapa a partir da especificação. Devolve as linhas, ou null se o sorteio não der certo.
function buildOnce(spec, seed) {
  const rnd = mulberry32(seed);
  const g = carveMaze(rnd);
  if (!buildRoom(g, rnd)) return null;

  // Bloqueios em pontes: no labirinto em árvore, cada célula do caminho até a sala é uma ponte.
  const path = pathBetween(g, START, EXIT);
  if (!path) return null;
  const candidates = path.slice(3, path.length - 3).filter(([c, r]) => g[r][c] === FLOOR && !inRoom(c, r) && !inRing(c, r));
  const usados = [];
  for (const ch of spec.blockers ?? []) {
    const options = candidates.filter(([c, r]) => g[r][c] === FLOOR && !usados.some(([uc, ur]) => uc === c && ur === r));
    const cell = pick(rnd, options);
    if (!cell) return null;
    g[cell[1]][cell[0]] = ch;
    usados.push(cell);
  }

  addLoops(g, rnd, spec.loops ?? 0);
  for (const [c, r] of floorCells(g)) if (!inRing(c, r) && !inRoom(c, r) && g[r][c] === FLOOR && rnd() < 0.25) g[r][c] = TRACE;

  g[START[1]][START[0]] = spec.first ? SPAWN : UP;
  g[EXIT[1]][EXIT[0]] = spec.goal ? GOAL : DOWN;
  if (spec.boss) g[BOSS_CELL[1]][BOSS_CELL[0]] = BOSS;

  // Técnicos, mercadores e baús: nunca cortam o caminho até a saída.
  const avoid = (c, r) => (c === START[0] && r === START[1]) || (c === EXIT[0] && r === EXIT[1]) || inRoom(c, r);
  for (const ch of spec.npcs ?? []) if (!placeBlocker(g, rnd, ch, avoid)) return null;
  for (let i = 0; i < (spec.baus ?? 0); i++) if (!placeBlocker(g, rnd, CHEST, avoid)) return null;

  // Invariantes: com ferramentas a saída é alcançável; sem elas, a porta e os bloqueios a fecham.
  if (!reach(g, START, new Set(CLOSED_NO_TOOLS)).has(key(...EXIT))) return null;
  if (reach(g, START, new Set(CLOSED_TOOLS)).has(key(...EXIT))) return null;

  // Tudo o que é coletado precisa estar ao alcance sem ferramentas.
  const free = reach(g, START, new Set(CLOSED_TOOLS));
  const isFreeFloor = ([c, r]) => free.has(key(c, r)) && (g[r][c] === FLOOR || g[r][c] === TRACE) && !(c === START[0] && r === START[1]);
  const taken = new Set();
  const place = (ch, cells) => {
    const options = cells.filter(([c, r]) => !taken.has(key(c, r)));
    const cell = pick(rnd, options);
    if (!cell) return false;
    taken.add(key(...cell));
    g[cell[1]][cell[0]] = ch;
    return true;
  };
  const freeCells = floorCells(g).filter(isFreeFloor).filter(([c, r]) => !inRoom(c, r));
  for (const [ch, n] of Object.entries(spec.pickups ?? {})) {
    if (!PICKUP_ITEMS[ch]) return null;
    for (let i = 0; i < n; i++) if (!place(ch, freeCells)) return null;
  }
  if (spec.chave && !place(KEY, freeCells)) return null;

  // Falhas: longe da entrada, fora da sala.
  const farFromStart = freeCells.filter(([c, r]) => Math.abs(c - START[0]) + Math.abs(r - START[1]) >= 5);
  for (const [foeId, n] of spec.enemies ?? []) {
    const ch = FOE_CHAR_OF[foeId];
    if (!ch) return null;
    for (let i = 0; i < n; i++) if (!place(ch, farFromStart)) return null;
  }

  // Zonas quentes e frias: passáveis, não bloqueiam nada.
  for (let i = 0; i < (spec.quentes ?? 0); i++) if (!place(HOT, freeCells)) return null;
  for (let i = 0; i < (spec.frias ?? 0); i++) if (!place(COOL, freeCells)) return null;

  return g.map((row) => row.join(''));
}

export function generateMap(spec, seed) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rows = buildOnce(spec, seed + attempt * 7919);
    if (rows) return rows;
  }
  throw new Error(`não foi possível gerar o mapa com semente ${seed}`);
}

export { reach, key, ROOM, BOSS_CELL };

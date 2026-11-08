// Progresso de cada camada, calculado a partir do estado atual (sem DOM).
// Compara a grade atual com a grade original (origin) e com as células visitadas.
import { WALL, TOOL_CELLS, FOE_CHARS, PICKUP_ITEMS, cellKey } from './grid.js';
import { LAYER_ORDER, LAYERS } from './layers.js';

export function layerProgress(game, id) {
  const w = game.world[id];
  const origin = w.origin, grid = w.grid;
  const p = {
    id,
    nome: LAYERS[id].nome,
    index: LAYER_ORDER.indexOf(id) + 1,
    current: game.player.layer === id,
    walkable: 0, visited: 0,
    blockers: 0, repaired: 0,
    foes: 0, defeated: 0,
    pickups: 0, collected: 0,
  };
  for (let r = 0; r < origin.length; r++) {
    for (let c = 0; c < origin[r].length; c++) {
      const o = origin[r][c], now = grid.at(c, r);
      if (o !== WALL) {
        p.walkable++;
        if (w.visited.has(cellKey(c, r))) p.visited++;
      }
      if (TOOL_CELLS[o]) { p.blockers++; if (now !== o) p.repaired++; }
      if (FOE_CHARS[o]) { p.foes++; if (now !== o) p.defeated++; }
      if (PICKUP_ITEMS[o]) { p.pickups++; if (now !== o) p.collected++; }
    }
  }
  p.percent = p.walkable ? Math.round((100 * p.visited) / p.walkable) : 0;
  p.status = statusOf(p);
  return p;
}

function statusOf(p) {
  if (p.current) return 'você está aqui';
  if (p.visited === 0) return 'não visitada';
  const done = p.percent === 100 && p.repaired === p.blockers && p.defeated === p.foes && p.collected === p.pickups;
  return done ? 'concluída' : 'em andamento';
}

// Oito camadas na ordem da campanha, do dissipador ao substrato.
export function chipOverview(game) {
  return LAYER_ORDER.map((id) => layerProgress(game, id));
}

// Porcentagem de exploração de todo o chip (células caminháveis visitadas sobre o total).
export function overallPercent(overview) {
  const walkable = overview.reduce((s, p) => s + p.walkable, 0);
  const visited = overview.reduce((s, p) => s + p.visited, 0);
  return walkable ? Math.round((100 * visited) / walkable) : 0;
}

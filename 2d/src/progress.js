// Progresso de cada camada: exploração, reparos, falhas vencidas, materiais, baús e o chefe. Sem DOM.
import { WALL, TOOL_CELLS, PICKUP_ITEMS, KEY, CHEST, cellKey } from './grid.js';
import { LAYER_ORDER, LAYERS } from './layers.js';

export function layerProgress(game, id) {
  const w = game.world[id];
  const origin = w.origin, atual = w.grid;
  const p = {
    id,
    nome: LAYERS[id].nome,
    index: LAYER_ORDER.indexOf(id) + 1,
    current: game.player.camada === id,
    walkable: 0, visited: 0,
    blockers: 0, repaired: 0,
    foes: w.totalFalhas, defeated: 0,
    pickups: 0, collected: 0,
    chests: 0, opened: 0,
    boss: w.boss ? (game.chefes[w.boss] ? 'derrotado' : 'vivo') : null,
  };
  p.defeated = p.foes - w.entities.filter((e) => !e.boss).length;
  for (let r = 0; r < origin.length; r++) {
    for (let c = 0; c < origin[r].length; c++) {
      const o = origin[r][c], now = atual.at(c, r);
      if (o !== WALL) {
        p.walkable++;
        if (w.visited.has(cellKey(c, r))) p.visited++;
      }
      if (TOOL_CELLS[o]) { p.blockers++; if (now !== o) p.repaired++; }
      if (PICKUP_ITEMS[o] || o === KEY) { p.pickups++; if (now !== o) p.collected++; }
      if (o === CHEST) { p.chests++; if (now !== o) p.opened++; }
    }
  }
  p.percent = p.walkable ? Math.round((100 * p.visited) / p.walkable) : 0;
  p.status = statusOf(p);
  return p;
}

function statusOf(p) {
  if (p.current) return 'você está aqui';
  if (p.visited === 0) return 'não visitada';
  const feito = p.percent === 100 && p.repaired === p.blockers && p.defeated === p.foes
    && p.collected === p.pickups && p.opened === p.chests && (p.boss === null || p.boss === 'derrotado');
  return feito ? 'concluída' : 'em andamento';
}

export const chipOverview = (game) => LAYER_ORDER.map((id) => layerProgress(game, id));

export function overallPercent(overview) {
  const walkable = overview.reduce((s, p) => s + p.walkable, 0);
  const visited = overview.reduce((s, p) => s + p.visited, 0);
  return walkable ? Math.round((100 * visited) / walkable) : 0;
}

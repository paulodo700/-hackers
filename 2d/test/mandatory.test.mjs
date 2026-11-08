import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_ORDER, LAYERS } from '../src/layers.js';
import { generateMap } from '../src/mapgen.js';
import { Grid, SPAWN, UP, DOWN, GOAL } from '../src/grid.js';

// Alcance a partir do início, tratando como fechadas as células indicadas.
function reachFrom(grid, start, closed) {
  const seen = new Set([start.join(',')]);
  const q = [start];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, ch = grid.at(nc, nr);
      if (ch === '#' || closed.has(ch) || seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`);
      q.push([nc, nr]);
    }
  }
  return seen;
}

test('cada camada com bloqueio exige a ferramenta: sem ela, a saída fica inalcançável', () => {
  const TOOL_BLOCKERS = new Set(['x', 'g', 'o']);
  LAYER_ORDER.forEach((id, i) => {
    const spec = LAYERS[id];
    if (!(spec.blockers ?? []).length) return;
    const grid = new Grid(generateMap(spec, 1000 + i * 101));
    const start = grid.find(SPAWN)[0] || grid.find(UP)[0];
    const exit = grid.find(DOWN)[0] || grid.find(GOAL)[0];
    const seen = reachFrom(grid, start, new Set(['N', ...TOOL_BLOCKERS]));
    assert.equal(seen.has(exit.join(',')), false, `${id}: a saída não pode ser alcançada sem a ferramenta`);
  });
});

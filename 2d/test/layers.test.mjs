import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LAYER_ORDER, LAYERS } from '../src/layers.js';
import { generateMap, START, EXIT } from '../src/mapgen.js';
import { Grid, UP, DOWN, SPAWN, GOAL } from '../src/grid.js';
import { scene } from './helpers.mjs';

const OPEN_WHEN_REPAIRED = new Set(['x', 'g', 'o']);
const CLOSED = new Set(['#', 'N']);

function reachable(grid, from, closed) {
  const seen = new Set([from.join(',')]);
  const q = [from];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, ch = grid.at(nc, nr);
      if (closed.has(ch) || seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`);
      q.push([nc, nr]);
    }
  }
  return seen;
}

test('cada camada tem uma entrada < (exceto a primeira) e uma saída > (exceto a última)', () => {
  LAYER_ORDER.forEach((id, i) => {
    const g = new Grid(generateMap(LAYERS[id], 1000 + i * 101));
    assert.equal(g.count(UP), i > 0 ? 1 : 0, `${id}: entrada <`);
    assert.equal(g.count(DOWN) + g.count(GOAL), 1, `${id}: saída > ou anel A`);
    assert.equal(g.count(DOWN), i < LAYER_ORDER.length - 1 ? 1 : 0, `${id}: saída >`);
  });
});

test('mapas são determinísticos: a mesma semente gera o mesmo mapa', () => {
  const a = generateMap(LAYERS.cache_l3, 4242);
  const b = generateMap(LAYERS.cache_l3, 4242);
  assert.deepEqual(a, b);
});

test('descer leva à próxima camada, na entrada <', () => {
  const g = new Game();
  const next = LAYER_ORDER[1];
  const exit = g.grid.find(DOWN)[0];
  g.player.c = exit[0] - 1; g.player.r = exit[1];
  g.player.fc = 1; g.player.fr = 0;
  const res = g.move(1, 0);
  assert.equal(res.type, 'layer');
  assert.equal(res.layer, next);
  assert.equal(g.player.layer, next);
  assert.equal(g.grid.at(g.player.c, g.player.r), UP, 'chegou sobre a entrada <');
});

test('subir pela primeira camada é bloqueado', () => {
  const g = new Game();
  const start = g.grid.find(SPAWN)[0];
  g.player.c = start[0]; g.player.r = start[1];
  const res = g.changeLayer(-1);
  assert.equal(res.type, 'blocked');
  assert.equal(g.player.layer, LAYER_ORDER[0]);
});

test('subir e descer preserva a posição da entrada correspondente', () => {
  const g = new Game();
  const exit = g.grid.find(DOWN)[0];
  g.player.c = exit[0] - 1; g.player.r = exit[1];
  g.move(1, 0); // desce para a segunda camada
  assert.equal(g.player.layer, LAYER_ORDER[1]);
  const back = g.changeLayer(-1); // sobe de volta
  assert.equal(back.type, 'layer');
  assert.equal(g.player.layer, LAYER_ORDER[0]);
  assert.equal(g.grid.at(g.player.c, g.player.r), DOWN, 'voltou sobre a saída >');
});

test('em cada camada a saída é alcançável a partir do início, com as ferramentas', () => {
  LAYER_ORDER.forEach((id, i) => {
    const grid = new Grid(generateMap(LAYERS[id], 1000 + i * 101));
    const start = grid.find(SPAWN)[0] || grid.find(UP)[0];
    const exit = grid.find(DOWN)[0] || grid.find(GOAL)[0];
    const seen = reachable(grid, start, CLOSED);
    assert.ok(seen.has(exit.join(',')), `${id}: saída alcançável`);
  });
});

test('materiais coletáveis até cada camada cobrem as ferramentas exigidas até ali', () => {
  const COST = {
    x: { liga_ferrugem: 2, fio_cobre: 1 },   // reparo de trilha
    g: { cristal_silicio: 2, fio_cobre: 1 }, // ajuste de energia
    o: { fio_cobre: 3, liga_ferrugem: 1 },   // reforço do núcleo
  };
  const ITEM = { a: 'liga_ferrugem', w: 'fio_cobre', k: 'cristal_silicio' };
  const supply = { liga_ferrugem: 0, fio_cobre: 0, cristal_silicio: 0 };
  const need = { liga_ferrugem: 0, fio_cobre: 0, cristal_silicio: 0 };
  LAYER_ORDER.forEach((id, i) => {
    const grid = new Grid(generateMap(LAYERS[id], 1000 + i * 101));
    const start = grid.find(SPAWN)[0] || grid.find(UP)[0];
    // Coleta sem ferramenta: só conta o que dá para alcançar com os bloqueios fechados.
    const seen = reachable(grid, start, new Set(['#', 'N', 'x', 'g', 'o']));
    for (const [ch, item] of Object.entries(ITEM)) {
      for (const [c, r] of grid.find(ch)) if (seen.has(`${c},${r}`)) supply[item]++;
    }
    for (const ch of ['x', 'g', 'o']) {
      for (let k = 0; k < grid.count(ch); k++) {
        for (const [m, n] of Object.entries(COST[ch])) need[m] += n;
      }
    }
    for (const m of Object.keys(need)) {
      assert.ok(supply[m] >= need[m], `até ${id}: ${m} coletável ${supply[m]}, exigido ${need[m]}`);
    }
  });
});

test('a camada final tem o anel e chegar nele dá a vitória', () => {
  const last = LAYER_ORDER[LAYER_ORDER.length - 1];
  const g = new Game();
  g.world[last].grid = new Grid(generateMap(LAYERS[last], 1000 + (LAYER_ORDER.length - 1) * 101));
  g.placeAt(last, UP);
  const goal = g.grid.find(GOAL)[0];
  assert.ok(goal, 'há um anel A');
  g.player.c = goal[0] - 1; g.player.r = goal[1];
  g.move(1, 0);
  assert.equal(g.won, true);
  assert.equal(g.move(0, 1).type, 'won', 'depois de vencer o jogo para');
});

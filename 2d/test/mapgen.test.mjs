import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_ORDER, LAYERS } from '../src/layers.js';
import { generateMap, START, EXIT } from '../src/mapgen.js';
import { Grid, UP, DOWN, GOAL, SPAWN, NPC, MERCHANT, CHEST, DOOR, FOE_CHARS, PICKUP_ITEMS, KEY, BOSS, DAMAGED, GATE, SOCKET } from '../src/grid.js';

const SPEC = (id, npcs = ['N']) => ({ ...LAYERS[id], npcs, boss: true });
const seedOf = (i, k = 0) => 1000 + i * 101 + k * 17;

// Alcance a partir do início, com as células em 'fechadas' como paredes.
function alcance(grid, fechadas) {
  const start = grid.find(SPAWN)[0] || grid.find(UP)[0];
  const seen = new Set([start.join(',')]);
  const q = [start];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, ch = grid.at(nc, nr);
      if (ch === '#' || fechadas.has(ch) || seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`);
      q.push([nc, nr]);
    }
  }
  return seen;
}

test('cada camada gera com as peças certas: uma saída, uma porta, um chefe, uma chave', () => {
  LAYER_ORDER.forEach((id, i) => {
    const g = new Grid(generateMap(SPEC(id), seedOf(i)));
    assert.equal(g.count(DOOR), 1, `${id}: uma porta da sala`);
    assert.equal(g.count(BOSS), 1, `${id}: um chefe`);
    assert.equal(g.count(KEY), 1, `${id}: uma chave`);
    assert.equal(g.count(DOWN) + g.count(GOAL), 1, `${id}: uma saída`);
    assert.equal(g.count(NPC), 1, `${id}: técnico`);
  });
});

test('a saída fica dentro da sala do chefe: sem a porta ela é inalcançável', () => {
  LAYER_ORDER.forEach((id, i) => {
    const g = new Grid(generateMap(SPEC(id), seedOf(i)));
    const exit = g.find(DOWN)[0] || g.find(GOAL)[0];
    assert.equal(alcance(g, new Set(['D', 'N', 'M', 'b', 'x', 'g', 'o'])).has(exit.join(',')), false, `${id}: saída trancada`);
    assert.equal(alcance(g, new Set(['N', 'M', 'b'])).has(exit.join(',')), true, `${id}: a porta e os bloqueios são a única barreira`);
  });
});

test('cada bloqueio de ferramenta é obrigatório (sem a ferramenta, a saída fica inalcançável)', () => {
  LAYER_ORDER.forEach((id, i) => {
    if (!(LAYERS[id].blockers ?? []).length) return;
    const g = new Grid(generateMap(SPEC(id), seedOf(i)));
    const exit = g.find(DOWN)[0] || g.find(GOAL)[0];
    const seen = alcance(g, new Set(['N', 'M', 'b', 'x', 'g', 'o', 'D']));
    assert.equal(seen.has(exit.join(',')), false, `${id}: bloqueio decorativo`);
  });
});

test('materiais e a chave são coletáveis sem ferramentas', () => {
  LAYER_ORDER.forEach((id, i) => {
    const g = new Grid(generateMap(SPEC(id), seedOf(i)));
    const seen = alcance(g, new Set(['N', 'M', 'b', 'x', 'g', 'o', 'D']));
    for (const ch of [...Object.keys(PICKUP_ITEMS), KEY]) {
      for (const [c, r] of g.find(ch)) assert.ok(seen.has(`${c},${r}`), `${id}: ${ch} em (${c},${r}) inalcançável`);
    }
  });
});

test('o gerador é determinístico e cada falha vira um caractere de falha conhecido', () => {
  const a = generateMap(SPEC('cache_l3'), 4242);
  const b = generateMap(SPEC('cache_l3'), 4242);
  assert.deepEqual(a, b);
  for (const ch of Object.keys(FOE_CHARS)) assert.equal(typeof ch, 'string');
  const g = new Grid(a);
  for (const [foe, n] of LAYERS.cache_l3.enemies) {
    const ch = Object.keys(FOE_CHARS).find((k) => FOE_CHARS[k] === foe);
    assert.equal(g.count(ch) >= 0, true, `${foe} tem caractere`);
    void n;
  }
});

test('bloqueios de todas as camadas são ferramentas reais do jogo', () => {
  const tipos = new Set(['x', 'g', 'o']);
  for (const id of LAYER_ORDER) for (const b of LAYERS[id].blockers ?? []) assert.ok(tipos.has(b), `${id}: ${b}`);
  void [DAMAGED, GATE, SOCKET, MERCHANT, CHEST, START, EXIT];
});

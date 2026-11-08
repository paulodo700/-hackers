import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LAYER_ORDER } from '../src/layers.js';
import { OPENED, FLOOR, TOOL_CELLS, FOE_CHARS, PICKUP_ITEMS, WALL, cellKey } from '../src/grid.js';
import { layerProgress, chipOverview, overallPercent } from '../src/progress.js';

function firstCell(rows, pred) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) if (pred(rows[r][c])) return [c, r];
  }
  return null;
}

test('no início: oito camadas na ordem da campanha, só a atual marcada, e nenhum progresso de reparo', () => {
  const g = new Game({ seed: 2 });
  const ov = chipOverview(g);
  assert.deepEqual(ov.map((p) => p.id), LAYER_ORDER);
  assert.equal(ov.filter((p) => p.current).length, 1);
  assert.equal(ov[0].current, true);
  assert.equal(ov[0].status, 'você está aqui');
  assert.equal(ov[1].status, 'não visitada');
  assert.ok(ov.every((p) => p.repaired === 0 && p.defeated === 0 && p.collected === 0));
});

test('reparar uma trilha conta como reparo na camada certa', () => {
  const g = new Game({ seed: 2 });
  const [c, r] = firstCell(g.world.metal_m1.origin, (ch) => ch === 'x');
  g.world.metal_m1.grid.set(c, r, OPENED.x);
  const p = layerProgress(g, 'metal_m1');
  assert.equal(p.blockers, 1);
  assert.equal(p.repaired, 1);
  assert.equal(layerProgress(g, 'cache_l3').repaired, 0);
});

test('vencer uma falha conta como falha vencida', () => {
  const g = new Game({ seed: 2 });
  const [c, r] = firstCell(g.world.dissipador.origin, (ch) => FOE_CHARS[ch]);
  g.world.dissipador.grid.set(c, r, FLOOR);
  const p = layerProgress(g, 'dissipador');
  assert.equal(p.defeated, 1);
  assert.equal(p.foes, p.defeated + (p.foes - 1));
});

test('coletar um material conta como material coletado', () => {
  const g = new Game({ seed: 2 });
  const [c, r] = firstCell(g.world.dissipador.origin, (ch) => PICKUP_ITEMS[ch]);
  g.world.dissipador.grid.set(c, r, FLOOR);
  const p = layerProgress(g, 'dissipador');
  assert.equal(p.collected, 1);
  assert.ok(p.collected <= p.pickups);
});

test('exploração conta só células caminháveis e nunca passa de 100%', () => {
  const g = new Game({ seed: 2 });
  const before = layerProgress(g, 'dissipador');
  g.move(1, 0);
  g.move(1, 0);
  g.move(1, 0);
  const after = layerProgress(g, 'dissipador');
  assert.ok(after.visited >= before.visited);
  assert.ok(after.visited <= after.walkable);
  assert.equal(after.percent, Math.round((100 * after.visited) / after.walkable));
  assert.ok(after.percent <= 100);
});

test('camada explorada e resolvida (sem bloqueios, falhas nem materiais pendentes) fica concluída', () => {
  const g = new Game({ seed: 2 });
  const id = 'interposer'; // não é a camada atual
  const w = g.world[id];
  w.origin.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== WALL) w.visited.add(cellKey(c, r));
    if (TOOL_CELLS[ch]) w.grid.set(c, r, OPENED[ch]);
    if (FOE_CHARS[ch] || PICKUP_ITEMS[ch]) w.grid.set(c, r, FLOOR);
  }));
  const p = layerProgress(g, id);
  assert.equal(p.percent, 100);
  assert.equal(p.status, 'concluída');
});

test('exploração total do chip começa baixa e cresce com as visitas', () => {
  const g = new Game({ seed: 2 });
  const start = overallPercent(chipOverview(g));
  g.move(1, 0);
  g.move(1, 0);
  const later = overallPercent(chipOverview(g));
  assert.ok(start >= 0 && later >= start && later <= 100);
});

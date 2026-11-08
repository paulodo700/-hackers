import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { layerProgress, chipOverview, overallPercent } from '../src/progress.js';
import { LAYER_ORDER } from '../src/layers.js';
import { FLOOR } from '../src/grid.js';

test('no início: nenhuma trilha reparada, nenhuma falha vencida, nenhum material coletado', () => {
  const g = novoJogo(2);
  const ov = chipOverview(g);
  assert.deepEqual(ov.map((p) => p.id), LAYER_ORDER);
  assert.equal(ov.filter((p) => p.current).length, 1);
  assert.ok(ov.every((p) => p.repaired === 0 && p.defeated === 0 && p.collected === 0 && p.opened === 0));
  assert.equal(ov[0].status, 'você está aqui');
  assert.equal(ov[1].status, 'não visitada');
});

test('reparar uma trilha conta na camada certa', () => {
  const g = novoJogo(2);
  const [c, r] = g.world.metal_m1.grid.find('x')[0];
  g.world.metal_m1.grid.set(c, r, '=');
  assert.equal(layerProgress(g, 'metal_m1').repaired, 1);
  assert.equal(layerProgress(g, 'cache_l3').repaired, 0);
});

test('falha que sai do mapa conta como vencida', () => {
  const g = novoJogo(2);
  const ent = g.world.dissipador.entities.find((e) => !e.boss);
  g.removerEntidade(ent.id);
  assert.equal(layerProgress(g, 'dissipador').defeated, 1);
});

test('material coletado e baú aberto aparecem no progresso', () => {
  const g = novoJogo(2);
  const [c, r] = g.world.dissipador.grid.find('a')[0];
  g.world.dissipador.grid.set(c, r, FLOOR);
  assert.equal(layerProgress(g, 'dissipador').collected, 1);
});

test('exploração conta só células que não são parede e nunca passa de 100%', () => {
  const g = novoJogo(2);
  const p = layerProgress(g, 'dissipador');
  assert.ok(p.visited <= p.walkable);
  assert.ok(p.percent >= 0 && p.percent <= 100);
  const todas = g.world.dissipador.origin.flatMap((row, r) => [...row].map((ch, c) => [ch, c, r])).filter(([ch]) => ch !== '#');
  for (const [, c, r] of todas) g.world.dissipador.visited.add(`${c},${r}`);
  assert.equal(layerProgress(g, 'dissipador').percent, 100);
});

test('a visão geral do chip soma a exploração de todas as camadas', () => {
  const g = novoJogo(2);
  assert.equal(overallPercent(chipOverview(g)) >= 0, true);
  assert.ok(overallPercent(chipOverview(g)) <= 100);
});

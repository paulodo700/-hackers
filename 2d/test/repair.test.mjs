import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from './helpers.mjs';

const brokenTrace = ['#####', '#Sx.#', '#####'];

test('sem ferramenta, trilha rompida continua bloqueando e avisa a falta', () => {
  const g = scene(brokenTrace, 1, 1);
  g.move(1, 0);
  assert.deepEqual([g.player.c, g.player.r], [1, 1]);
  const res = g.useTool();
  assert.equal(res.type, 'missing');
  assert.equal(res.tool, 'reparo_trilha');
  assert.equal(g.grid.at(2, 1), 'x');
});

test('criar reparo com materiais insuficientes não gasta nada', () => {
  const g = scene(brokenTrace, 1, 1);
  g.materials.liga_ferrugem = 1;
  g.materials.fio_cobre = 1;
  const res = g.craft('reparo_trilha');
  assert.equal(res.type, 'missing_materials');
  assert.deepEqual(res.missing, ['liga_ferrugem']);
  assert.equal(g.materials.liga_ferrugem, 1);
  assert.equal(g.materials.fio_cobre, 1);
  assert.equal(g.tools.reparo_trilha, 0);
});

test('criar reparo consome os materiais da receita', () => {
  const g = scene(brokenTrace, 1, 1);
  g.materials.liga_ferrugem = 2;
  g.materials.fio_cobre = 1;
  assert.equal(g.craft('reparo_trilha').type, 'crafted');
  assert.equal(g.materials.liga_ferrugem, 0);
  assert.equal(g.materials.fio_cobre, 0);
  assert.equal(g.tools.reparo_trilha, 1);
});

test('reparo abre a trilha x virando trilha metálica e libera a passagem', () => {
  const g = scene(brokenTrace, 1, 1);
  g.tools.reparo_trilha = 1;
  g.move(1, 0);
  const res = g.useTool();
  assert.equal(res.type, 'used');
  assert.equal(g.grid.at(2, 1), '=');
  assert.equal(g.tools.reparo_trilha, 0, 'a ferramenta foi consumida');
  assert.equal(g.move(1, 0).type, 'moved');
  assert.equal(g.player.c, 2);
});

test('ajuste de energia abre a porta g', () => {
  const g = scene(['#####', '#Sg.#', '#####'], 1, 1);
  g.tools.ajuste_energia = 1;
  g.move(1, 0); // bate na porta, continua virado para ela
  assert.equal(g.useTool().tool, 'ajuste_energia');
  assert.equal(g.grid.at(2, 1), '=');
});

test('reforço no encaixe o aumenta a vida máxima e vira piso', () => {
  const g = scene(['#####', '#So.#', '#####'], 1, 1);
  g.tools.reforco_nucleo = 1;
  const before = { maxHp: g.player.maxHp, hp: g.player.hp };
  g.move(1, 0);
  g.useTool();
  assert.equal(g.grid.at(2, 1), '.');
  assert.equal(g.player.maxHp, before.maxHp + 8);
  assert.equal(g.player.hp, before.hp + 8);
});

test('cada ferramenta abre só um bloqueio: uma trilha não usa dois reparos', () => {
  const g = scene(brokenTrace, 1, 1);
  g.tools.reparo_trilha = 2;
  g.move(1, 0);
  g.useTool();
  assert.equal(g.tools.reparo_trilha, 1);
  assert.equal(g.useTool().type, 'none', 'a célula já foi aberta, não há o que reparar');
  assert.equal(g.tools.reparo_trilha, 1);
});

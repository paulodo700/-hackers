import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from './helpers.mjs';

const room = [
  '#######',
  '#S.=.x#',
  '#.#.#o#',
  '#.gN.A#',
  '#######',
];

test('parede bloqueia o movimento e o jogador não sai da célula', () => {
  const g = scene(room, 1, 1);
  const res = g.move(0, 1); // (1,2) é piso; (2,2) é parede
  assert.equal(res.type, 'moved');
  assert.deepEqual([g.player.c, g.player.r], [1, 2]);
  const blocked = g.move(1, 0); // (2,2) é '#'
  assert.equal(blocked.type, 'blocked');
  assert.equal(blocked.ch, '#');
  assert.deepEqual([g.player.c, g.player.r], [1, 2]);
});

test('trilha danificada, porta de energia, encaixe e técnico bloqueiam', () => {
  const g = scene(room, 4, 1);
  assert.equal(g.move(1, 0).ch, 'x', 'trilha rompida (x) bloqueia');
  assert.deepEqual([g.player.c, g.player.r], [4, 1]);
  const g2 = scene(room, 1, 3);
  assert.equal(g2.move(1, 0).ch, 'g', 'porta de energia (g) bloqueia');
  assert.deepEqual([g2.player.c, g2.player.r], [1, 3]);
  const g3 = scene(room, 1, 1);
  assert.equal(g3.move(0, 1).type, 'moved', 'anda na coluna livre');
  const g4 = scene(['#####', '#SN.#', '#####'], 1, 1);
  assert.equal(g4.move(1, 0).ch, 'N', 'técnico (N) bloqueia');
  assert.deepEqual([g4.player.c, g4.player.r], [1, 1]);
});

test('trilha metálica (=) e piso (.) são passáveis', () => {
  const g = scene(room, 1, 1);
  assert.equal(g.move(1, 0).type, 'moved');
  assert.equal(g.move(1, 0).type, 'moved', 'entra na trilha metálica');
  assert.equal(g.grid.at(3, 1), '=');
  assert.equal(g.player.c, 3);
});

test('bater numa falha inicia combate e não move o jogador', () => {
  const foeRows = ['#####', '#S.f#', '#####'];
  const g = scene(foeRows, 1, 1);
  g.move(1, 0);
  const res = g.move(1, 0);
  assert.equal(res.type, 'battle');
  assert.equal(res.foe, 'pulga_corrente');
  assert.deepEqual([g.player.c, g.player.r], [2, 1]);
  assert.ok(g.battle, 'o combate começou');
});

test('coleta de material remove o item do mapa e soma no inventário', () => {
  const g = scene(['#####', '#Sa.#', '#####'], 1, 1);
  const res = g.move(1, 0);
  assert.equal(res.type, 'pickup');
  assert.equal(res.item, 'liga_ferrugem');
  assert.equal(g.materials.liga_ferrugem, 1);
  assert.equal(g.grid.at(2, 1), '.');
});

test('com combate ativo o movimento é ignorado', () => {
  const g = scene(['#####', '#Sf.#', '#####'], 1, 1);
  g.move(1, 0);
  assert.equal(g.battle !== null, true);
  assert.equal(g.move(0, 1).type, 'battle');
  assert.deepEqual([g.player.c, g.player.r], [1, 1]);
});

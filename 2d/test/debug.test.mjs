import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from './helpers.mjs';

const corridor = ['#########', '#S.......', '#########'];

test('modo depuração mostra a grade com névoa: células não visitadas aparecem como ?', () => {
  const g = scene(corridor, 1, 1);
  const view = g.debugView();
  assert.equal(view.lines[1][1], '@', 'a posição do jogador aparece');
  assert.equal(view.lines[1][2], '.', 'célula vizinha visitada mostra o caractere real');
  assert.equal(view.lines[1][6], '?', 'célula distante ainda não visitada aparece como ?');
});

test('cada passo marca as células vizinhas como visitadas', () => {
  const g = scene(corridor, 1, 1);
  const before = g.debugView().visitedCount;
  g.move(1, 0);
  g.move(1, 0);
  g.move(1, 0);
  const after = g.debugView();
  assert.ok(after.visitedCount > before, 'a névoa avançou');
  assert.equal(after.player.c, 4);
  assert.equal(after.lines[1][5], '.', 'a célula à frente já foi revelada');
  assert.equal(after.lines[1][7], '?', 'a célula ainda longe segue oculta');
});

test('alternar a depuração liga e desliga a visão', () => {
  const g = scene(corridor, 1, 1);
  assert.equal(g.debug, false);
  g.toggleDebug();
  assert.equal(g.debug, true);
  g.toggleDebug();
  assert.equal(g.debug, false);
});

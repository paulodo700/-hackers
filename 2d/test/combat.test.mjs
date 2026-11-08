import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene, fixedRng } from './helpers.mjs';

const arena = ['#####', '#Sf.#', '#####'];

function fight(foe = 'f', rows = arena) {
  const g = scene(rows, 1, 1);
  if (foe !== 'f') g.grid.set(2, 1, foe);
  g.move(1, 0);
  g.move(1, 0);
  return g;
}

test('atacar reduz a vida da falha e a vitória remove a falha do mapa', () => {
  const g = fight();
  g.rng = fixedRng(0.99); // rolagem +1: dano 4 - 0 + 1 = 5 (pulga tem 6 de vida)
  assert.equal(g.battleAction('atacar').type, 'turn');
  assert.equal(g.battle.hp, 1);
  g.rng = fixedRng(0.5);  // rolagem 0: dano 4
  const res = g.battleAction('atacar');
  assert.equal(res.type, 'won');
  assert.equal(g.battle, null);
  assert.equal(g.grid.at(2, 1), '.', 'a falha saiu do mapa');
});

test('vencer pode soltar material com a chance da falha', () => {
  const g = fight();
  g.rng = fixedRng(0); // rolagem -1 no dano e chance sempre passa
  g.battle.hp = 1;
  const res = g.battleAction('atacar');
  assert.equal(res.type, 'won');
  assert.deepEqual(res.drops, ['fio_cobre']);
  assert.equal(g.materials.fio_cobre, 1);
});

test('defender reduz o dano recebido pela metade', () => {
  const g = fight('Q', ['#####', '#SQ.#', '#####']);
  g.rng = fixedRng(0.5); // rolagem 0
  const hpBefore = g.player.hp;
  g.battleAction('defender');
  const hitWhileDefending = hpBefore - g.player.hp; // ruído: 4 - 1 = 3, metade = 1

  const h = fight('Q', ['#####', '#SQ.#', '#####']);
  h.rng = fixedRng(0.5);
  const hpBefore2 = h.player.hp;
  h.battleAction('atacar');
  const hitWhileAttacking = hpBefore2 - h.player.hp;

  assert.equal(hitWhileDefending, 1);
  assert.equal(hitWhileAttacking, 3);
});

test('fugir com sucesso encerra o combate sem perder vida', () => {
  const g = fight();
  g.rng = fixedRng(0); // abaixo de 0,5: a fuga dá certo
  const hp = g.player.hp;
  assert.equal(g.battleAction('fugir').type, 'fled');
  assert.equal(g.battle, null);
  assert.equal(g.player.hp, hp);
  assert.equal(g.grid.at(2, 1), 'f', 'a falha continua no lugar');
});

test('fugir sem sucesso dá o turno à falha', () => {
  const g = fight();
  g.rng = fixedRng(0.99);
  const hp = g.player.hp;
  assert.equal(g.battleAction('fugir').type, 'turn');
  assert.ok(g.player.hp < hp, 'a falha atacou');
});

test('derrota renasce no ponto inicial da camada com metade da vida', () => {
  const g = fight('Q', ['#####', '#SQ.#', '#####']);
  g.rng = fixedRng(0.99);
  g.player.hp = 2;
  g.player.maxHp = 20;
  const res = g.battleAction('atacar');
  assert.equal(res.type, 'defeated');
  assert.equal(g.battle, null);
  assert.deepEqual([g.player.c, g.player.r], [1, 1], 'voltou ao S');
  assert.equal(g.player.hp, 10);
  assert.equal(g.grid.at(2, 1), 'Q', 'a falha que venceu continua no mapa');
});

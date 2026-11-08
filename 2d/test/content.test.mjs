import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { scene, fixedRng } from './helpers.mjs';
import { FOES } from '../src/content.js';
import { FOE_CHARS } from '../src/grid.js';
import { LAYERS, LAYER_ORDER } from '../src/layers.js';

test('toda falha tem um caractere no mapa, e o caractere aponta para uma falha conhecida', () => {
  for (const id of Object.keys(FOES)) assert.ok(Object.values(FOE_CHARS).includes(id), `${id} tem caractere`);
  for (const id of Object.values(FOE_CHARS)) assert.ok(FOES[id], `${id} existe em FOES`);
});

test('todas as camadas usam apenas falhas conhecidas', () => {
  for (const id of LAYER_ORDER) {
    for (const foe of LAYERS[id].foes ?? []) assert.ok(FOES[foe], `${id} usa ${foe}`);
  }
});

test('o vazamento de corrente tem vida, ataque, defesa e queda definidos', () => {
  const f = FOES.vazamento_corrente;
  assert.equal(typeof f.nome, 'string');
  assert.ok(f.hp > 0 && f.atk > 0 && f.def >= 0);
  assert.ok(Object.keys(f.drop).length >= 1);
});

test('o vazamento de corrente aparece no mapa da rede de energia', () => {
  const g = new Game({ seed: 2 });
  const count = g.world.energia.origin.join('').split('V').length - 1;
  assert.ok(count >= 1, `energia tem ${count} vazamento(s)`);
});

test('o vazamento de corrente pode ser combatido e vencido', () => {
  const g = scene(['#####', '#SV.#', '#####'], 1, 1);
  g.rng = fixedRng(0.99); // rolagem +1 no ataque: dano 4 - 2 + 1 = 3 por turno
  g.move(1, 0);
  g.move(1, 0);
  assert.equal(g.battle.foe, 'vazamento_corrente');
  g.battleAction('atacar');
  g.battleAction('atacar');
  const res = g.battleAction('atacar');
  assert.equal(res.type, 'won');
  assert.equal(g.grid.at(2, 1), '.');
});

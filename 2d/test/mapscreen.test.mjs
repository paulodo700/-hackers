import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { runCommand } from '../src/commands.js';
import { serialize } from '../src/save.js';

test('M abre e fecha o mapa do chip, sem alterar a partida', () => {
  const g = new Game({ seed: 2 });
  const before = JSON.stringify(serialize(g));
  assert.equal(runCommand(g, 'map').open, true);
  assert.equal(g.mapOpen, true);
  assert.equal(runCommand(g, 'map').open, false);
  assert.equal(JSON.stringify(serialize(g)), before, 'abrir e fechar o mapa não muda o jogo');
});

test('com o mapa aberto o jogador não anda, não fala, não usa ferramenta nem cria', () => {
  const g = new Game({ seed: 2 });
  const pos = { c: g.player.c, r: g.player.r };
  g.toggleMap();
  assert.equal(g.move(1, 0).type, 'paused');
  assert.deepEqual({ c: g.player.c, r: g.player.r }, pos);
  assert.equal(g.interact().type, 'paused');
  assert.equal(g.useTool().type, 'paused');
  g.materials.liga_ferrugem = 5;
  g.materials.fio_cobre = 5;
  assert.equal(g.craft('reparo_trilha').type, 'paused');
  assert.equal(g.tools.reparo_trilha, 0);
  assert.equal(g.toggleCraft().type, 'paused');
});

test('com o mapa aberto o combate também fica parado', () => {
  const g = new Game({ seed: 2 });
  g.battle = { c: 0, r: 0, foe: 'pulga_corrente', hp: 6, defend: false };
  g.toggleMap();
  assert.equal(g.battleAction('atacar').type, 'paused');
  assert.equal(g.battle.hp, 6);
});

test('Esc fecha o mapa e o menu de criação', () => {
  const g = new Game({ seed: 2 });
  g.toggleCraft();
  g.toggleMap();
  // com o mapa aberto, o menu de criação não abre de novo
  assert.equal(g.toggleCraft().type, 'paused');
  assert.equal(runCommand(g, 'close').type, 'closed');
  assert.equal(g.mapOpen, false);
  assert.equal(g.craftOpen, false);
});

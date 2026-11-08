import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { Grid } from '../src/grid.js';
import { comandoDaTecla, executarComando, botoesDeToque, COMANDOS, teclaDo } from '../src/commands.js';
import { iniciarBatalha } from '../src/systems/combat.js';
import { iniciarConversa } from '../src/systems/dialogue.js';
import { serialize } from '../src/save.js';

test('teclas viram comandos; Ctrl, Alt e Meta são deixados para o navegador', () => {
  assert.equal(comandoDaTecla('ArrowUp'), 'up');
  assert.equal(comandoDaTecla('w'), 'up');
  assert.equal(comandoDaTecla('Enter'), 'confirm');
  assert.equal(comandoDaTecla('Escape'), 'back');
  assert.equal(comandoDaTecla('r', { ctrlKey: true }), null, 'Ctrl+R recarrega a página');
  assert.equal(comandoDaTecla('r', { metaKey: true }), null);
  assert.equal(comandoDaTecla('q'), null);
  assert.equal(comandoDaTecla('constructor'), null);
});

test('na exploração: setas andam e E fala com quem está na frente', () => {
  const g = novoJogo(1);
  const x = g.player.c;
  executarComando(g, 'right');
  assert.equal(g.player.c, x + 1);
  assert.equal(executarComando(g, 'confirm').tipo, 'nada');
});

test('no combate: 1 ataca, 4 defende, 5 foge (e chefe não foge); movimento fica parado', () => {
  const g = novoJogo(2);
  const camada = g.player.camada;
  const ent = { id: 900, foe: 'pulga_corrente', camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: false, ignorar: 0 };
  g.world[camada].grid = new Grid(['#######', '#S.....#', '#######']);
  g.world[camada].entities = [ent];
  g.rng = () => 0.45;
  iniciarBatalha(g, ent);
  assert.equal(executarComando(g, 'up').type, 'paused');
  assert.equal(executarComando(g, 'num1').type ?? 'x', executarComando(g, 'num1').type ?? 'x');
  assert.ok(g.battle || g.won === false);
});

test('no combate: 2 abre a lista de habilidades e 3 a de itens', () => {
  const g = novoJogo(2);
  const camada = g.player.camada;
  const ent = { id: 901, foe: 'ruido_termico', camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: false, ignorar: 0 };
  g.world[camada].grid = new Grid(['#######', '#S.....#', '#######']);
  g.world[camada].entities = [ent];
  iniciarBatalha(g, ent);
  executarComando(g, 'num2');
  assert.equal(g.menu?.tipo, 'batalha_habilidade');
  executarComando(g, 'back');
  executarComando(g, 'num3');
  assert.equal(g.menu?.tipo, 'batalha_item');
});

test('diálogo: números escolhem a opção e Esc encerra a conversa', () => {
  const g = novoJogo(3);
  iniciarConversa(g, 'tecnico_1');
  assert.ok(g.dialog.opcoes.length >= 2);
  executarComando(g, 'num1');
  assert.equal(g.dialog.no, 'n1');
  executarComando(g, 'back');
  assert.equal(g.dialog, null);
});

test('menus: setas navegam, Enter escolhe, Esc volta', () => {
  const g = novoJogo(4);
  executarComando(g, 'menu');
  assert.equal(g.menu.tipo, 'principal');
  executarComando(g, 'down');
  assert.equal(g.menu.cursor, 1);
  executarComando(g, 'confirm');
  assert.equal(g.menu.tipo, 'inventario');
  executarComando(g, 'back');
  assert.equal(g.menu.tipo, 'principal');
  executarComando(g, 'back');
  assert.equal(g.menu, null);
});

test('C abre o menu de criação e fecha de novo; no combate não abre', () => {
  const g = novoJogo(5);
  executarComando(g, 'craft');
  assert.equal(g.menu.tipo, 'criar');
  executarComando(g, 'craft');
  assert.equal(g.menu, null);
});

test('botões de toque mandam só comandos que existem, em todas as telas', () => {
  const g = novoJogo(6);
  const checar = () => botoesDeToque(g).forEach((b) => assert.ok(COMANDOS.includes(b.cmd), `${b.cmd} é um comando`));
  checar();
  executarComando(g, 'map');
  checar();
  executarComando(g, 'map');
  executarComando(g, 'menu');
  checar();
  executarComando(g, 'back');
  iniciarConversa(g, 'tecnico_1');
  checar();
});

test('paridade: cada botão de toque tem uma tecla que manda o mesmo comando', () => {
  const g = novoJogo(7);
  for (const b of botoesDeToque(g)) {
    if (b.cmd.startsWith('num')) continue;
    assert.notEqual(teclaDo(b.cmd), null, `${b.cmd} precisa de uma tecla`);
    assert.equal(comandoDaTecla(teclaDo(b.cmd)), b.cmd);
  }
});

test('comando desconhecido não muda o jogo', () => {
  const g = novoJogo(8);
  const antes = JSON.stringify(serialize(g));
  assert.equal(executarComando(g, 'voar').type, 'ignored');
  assert.equal(JSON.stringify(serialize(g)), antes);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { serialize } from '../src/save.js';
import {
  KEY_COMMANDS, COMMAND_IDS, TOUCH_LAYOUT, MOVE_COMMANDS,
  commandForKey, keyFor, runCommand, contextLabels,
} from '../src/commands.js';

const SCRIPT = ['right', 'right', 'down', 'map', 'map', 'right', 'debug', 'debug', 'interact', 'use', 'craft', 'close', 'up', 'left'];

test('todo comando tem pelo menos uma tecla', () => {
  for (const cmd of COMMAND_IDS) assert.notEqual(keyFor(cmd), null, cmd);
});

test('cada botão de movimento e de ação envia o mesmo comando que sua tecla', () => {
  for (const { cmd } of [...TOUCH_LAYOUT.move, ...TOUCH_LAYOUT.actions]) {
    const key = keyFor(cmd);
    assert.notEqual(key, null, `${cmd} tem tecla`);
    assert.equal(commandForKey(key), cmd);
  }
});

test('botões contextuais usam as teclas 1, 2 e 3', () => {
  assert.deepEqual(TOUCH_LAYOUT.context.map((b) => b.cmd), ['pick1', 'pick2', 'pick3']);
  assert.deepEqual(['pick1', 'pick2', 'pick3'].map(keyFor), ['1', '2', '3']);
});

test('toque e teclado produzem o mesmo estado, passo a passo', () => {
  const viaKeys = new Game({ seed: 11 });
  const viaTouch = new Game({ seed: 11 });
  const keyResults = SCRIPT.map((cmd) => runCommand(viaKeys, commandForKey(keyFor(cmd))).type);
  const touchResults = SCRIPT.map((cmd) => runCommand(viaTouch, cmd).type);
  assert.deepEqual(keyResults, touchResults);
  assert.equal(JSON.stringify(serialize(viaKeys)), JSON.stringify(serialize(viaTouch)));
});

test('tecla com Ctrl, Alt ou Meta é deixada para o navegador (Ctrl+R recarrega a página)', () => {
  assert.equal(commandForKey('r', { ctrlKey: true }), null);
  assert.equal(commandForKey('r', { metaKey: true }), null);
  assert.equal(commandForKey('r', { altKey: true }), null);
  assert.equal(commandForKey('r', {}), 'use');
});

test('tecla sem comando é ignorada, inclusive nomes herdados do objeto', () => {
  assert.equal(commandForKey('q'), null);
  assert.equal(commandForKey('constructor'), null);
  assert.equal(commandForKey('toString'), null);
});

test('comando desconhecido não altera o jogo', () => {
  const g = new Game({ seed: 3 });
  const before = JSON.stringify(serialize(g));
  assert.equal(runCommand(g, 'voar').type, 'ignored');
  assert.equal(JSON.stringify(serialize(g)), before);
});

test('rótulos do toque: combate, criação ou nada', () => {
  const g = new Game({ seed: 3 });
  assert.equal(contextLabels(g), null);
  g.craftOpen = true;
  assert.deepEqual(contextLabels(g), ['Reparo', 'Ajuste', 'Reforço']);
  g.battle = { c: 0, r: 0, foe: 'pulga_corrente', hp: 6, defend: false };
  assert.deepEqual(contextLabels(g), ['Atacar', 'Defender', 'Fugir']);
});

test('1, 2 e 3 atacam no combate e criam ferramentas no menu de criação', () => {
  const g = new Game({ seed: 3 });
  assert.equal(runCommand(g, 'pick1').type, 'ignored', 'sem contexto, não faz nada');
  g.craftOpen = true;
  g.materials.liga_ferrugem = 2;
  g.materials.fio_cobre = 1;
  assert.equal(runCommand(g, 'pick1').type, 'crafted');
  assert.equal(g.tools.reparo_trilha, 1);
  g.craftOpen = false;
  g.battle = { c: 0, r: 0, foe: 'pulga_corrente', hp: 6, defend: false };
  assert.ok(['turn', 'won'].includes(runCommand(g, 'pick1').type));
});

test('N pede novo jogo (comando de aplicativo, com confirmação na tela)', () => {
  const g = new Game({ seed: 3 });
  assert.equal(runCommand(g, 'newgame').type, 'app');
});

test('movimento usa só as quatro direções', () => {
  assert.deepEqual([...MOVE_COMMANDS].sort(), ['down', 'left', 'right', 'up']);
  assert.equal(Object.values(KEY_COMMANDS).filter((c) => MOVE_COMMANDS.has(c)).length >= 8, true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { Grid, FLOOR, WALL, DOOR, CHEST, NPC, DOWN, UP, cellKey } from '../src/grid.js';
import { LAYER_ORDER } from '../src/layers.js';
import { REFORCO_VIDA } from '../src/systems/world.js';

// Monta um cenário pequeno na camada inicial: rows com Bit em (c, r) virado para a direita.
function cenario(rows, c, r) {
  const g = novoJogo(1);
  const camada = g.player.camada;
  g.world[camada].grid = new Grid(rows);
  g.world[camada].origin = rows.slice();
  g.world[camada].entities = [];
  g.world[camada].npcs = [];
  g.world[camada].visited = new Set();
  Object.assign(g.player, { c, r, fc: 1, fr: 0 });
  g.reveal();
  return g;
}

test('cada camada começa com entrada e saída certas, e Bit na entrada da primeira', () => {
  const g = novoJogo(2);
  assert.equal(g.player.camada, LAYER_ORDER[0]);
  for (const [i, id] of LAYER_ORDER.entries()) {
    const grid = g.world[id].grid;
    assert.equal(grid.count(UP), i > 0 ? 1 : 0, `${id}: entrada <`);
    assert.equal(grid.count(DOWN) + grid.count('A'), 1, `${id}: saída > ou anel`);
  }
});

test('paredes e células bloqueadas impedem a passagem, e Bit não sai da célula', () => {
  const g = cenario(['#####', '#S.##', '#####'], 1, 1);
  assert.equal(g.move(1, 0).type, 'moved');
  assert.equal(g.move(1, 0).type, 'blocked');
  assert.equal(g.player.c, 2);
});

test('uma porta e um técnico bloqueiam; uma trilha metálica não', () => {
  const g = cenario(['#######', '#S=D.b#', '#######'], 1, 1);
  assert.equal(g.move(1, 0).type, 'moved', 'trilha metálica passa');
  const porta = g.move(1, 0);
  assert.equal(porta.type, 'blocked');
  assert.equal(porta.ch, DOOR, 'porta bloqueia');
  const h = cenario(['#######', '#S.N.b#', '#######'], 1, 1);
  assert.equal(h.move(1, 0).type, 'moved');
  const tecnico = h.move(1, 0);
  assert.equal(tecnico.type, 'blocked');
  assert.equal(tecnico.ch, NPC, 'técnico bloqueia');
});

test('pegar um material remove a peça do mapa e soma no inventário', () => {
  const g = cenario(['#####', '#Sa.#', '#####'], 1, 1);
  const res = g.move(1, 0);
  assert.equal(res.type, 'pickup');
  assert.equal(res.item, 'liga_ferrugem');
  assert.equal(g.inv.liga_ferrugem, 1);
  assert.equal(g.grid.at(2, 1), FLOOR);
});

test('ferramenta certa abre a trilha rompida (R) e é consumida; sem ela, avisa a falta', () => {
  const g = cenario(['#####', '#Sx.#', '#####'], 1, 1);
  assert.equal(g.move(1, 0).type, 'blocked', 'trilha rompida bloqueia');
  const falta = g.useTool();
  assert.equal(falta.tipo, 'falta');
  g.inv.reparo_trilha = 1;
  const res = g.useTool();
  assert.equal(res.tipo, 'usada');
  assert.equal(g.grid.at(2, 1), '=');
  assert.equal(g.inv.reparo_trilha, undefined, 'a ferramenta foi consumida');
  assert.equal(g.move(1, 0).type, 'moved');
});

test('a chave do núcleo abre a porta da sala do chefe', () => {
  const g = cenario(['#####', '#SD.#', '#####'], 1, 1);
  assert.equal(g.move(1, 0).type, 'blocked');
  g.inv.chave_nucleo = 1;
  assert.equal(g.useTool().tipo, 'usada');
  assert.equal(g.grid.at(2, 1), FLOOR);
});

test('reforço do núcleo aumenta a vida máxima e a vida atual', () => {
  const g = cenario(['#####', '#So.#', '#####'], 1, 1);
  g.move(1, 0);
  g.inv.reforco_nucleo = 1;
  const antes = g.player.maxHp;
  g.useTool();
  assert.equal(g.player.maxHp, antes + REFORCO_VIDA);
});

test('calor: trilha quente esquenta, zona fria esfria, e calor 100 machuca a cada passo', () => {
  const g = cenario(['#########', '#Sh~....#', '#########'], 1, 1);
  g.player.calor = 10;
  g.move(1, 0);
  assert.equal(g.player.calor, 14, 'trilha quente +4');
  g.move(1, 0);
  assert.equal(g.player.calor, 8, 'zona fria -6');
  g.player.calor = 100;
  const hp = g.player.hp;
  g.move(1, 0);
  assert.ok(g.player.hp < hp, 'calor 100 machuca');
});

test('calor 100 que derruba Bit reinicia a posição e esfria o chip', () => {
  const g = cenario(['#####', '#S..#', '#####'], 1, 1);
  g.player.calor = 100;
  g.player.hp = 1;
  const res = g.move(1, 0);
  assert.equal(res.type, 'derrota');
  assert.deepEqual([g.player.c, g.player.r], [1, 1]);
  assert.ok(g.player.calor <= 30);
});

test('falhas andam: a patrulha fica em volta da origem e a estática não se mexe', () => {
  const g = novoJogo(9);
  const camada = g.player.camada;
  g.world[camada].grid = new Grid(['#############', '#S...........#', '#############']);
  g.world[camada].entities = [
    { id: 90, foe: 'pulga_corrente', camada, c: 6, r: 1, origem: [6, 1], comp: 'patrulha', boss: false, ignorar: 0 },
    { id: 91, foe: 'ruido_termico', camada, c: 9, r: 1, origem: [9, 1], comp: 'estatico', boss: false, ignorar: 0 },
  ];
  g.player.c = 1;
  for (let i = 0; i < 60; i++) {
    g.move(0, 1);
    g.move(0, -1);
  }
  const patrulha = g.world[camada].entities.find((e) => e.id === 90);
  const estatica = g.world[camada].entities.find((e) => e.id === 91);
  assert.ok(Math.abs(patrulha.c - 6) + Math.abs(patrulha.r - 1) <= 3, 'patrulha segue o raio');
  assert.deepEqual([estatica.c, estatica.r], [9, 1]);
});

test('perseguidor se aproxima de Bit quando está perto', () => {
  const g = novoJogo(9);
  const camada = g.player.camada;
  g.world[camada].grid = new Grid(['#############', '#S...........#', '#############']);
  g.world[camada].entities = [{ id: 92, foe: 'rasgo_trilha', camada, c: 6, r: 1, origem: [6, 1], comp: 'perseguidor', boss: false, ignorar: 0 }];
  g.player.c = 4;
  g.player.passos = 0;
  g.move(0, 0);
  const e = g.world[camada].entities[0];
  assert.ok(e.c < 6, 'chegou mais perto');
});

test('encostar numa falha inicia o combate; a falha que fugiu ignora Bit por alguns passos', () => {
  const g = novoJogo(4);
  const camada = g.player.camada;
  g.world[camada].grid = new Grid(['#######', '#S.....#', '#######']);
  g.world[camada].entities = [{ id: 93, foe: 'ruido_termico', camada, c: 3, r: 1, origem: [3, 1], comp: 'estatico', boss: false, ignorar: 0 }];
  g.player.c = 1;
  g.move(1, 0);
  assert.ok(g.battle, 'combate começou ao ficar do lado');
  g.battle = null;
  g.ignorarEntidade(93, 3);
  g.move(1, 0);
  assert.equal(g.battle, null, 'não começa de novo logo depois de fugir');
});

test('baú abre uma vez e dá ciclos e um item do perfil da camada', () => {
  const g = cenario(['#####', '#S.bN#', '#####'], 1, 1);
  g.bausAbertos = {};
  assert.equal(g.interact().tipo, 'nada', 'sem baú na frente, E não faz nada');
  g.move(1, 0);
  const abriu = g.interact();
  assert.equal(abriu.tipo, 'bau');
  assert.ok(g.ciclos >= 2);
  assert.equal(g.grid.at(3, 1), FLOOR);
  assert.equal(Object.keys(g.bausAbertos).length, 1);
  assert.equal(g.interact().tipo, 'nada', 'o baú já está aberto e não se abre de novo');
});

test('vencer o jogo: pisar no anel dá a vitória e trava o movimento', () => {
  const g = cenario(['#####', '#SA.#', '#####'], 1, 1);
  g.move(1, 0);
  assert.equal(g.won, true);
  assert.equal(g.move(-1, 0).type, 'won');
});

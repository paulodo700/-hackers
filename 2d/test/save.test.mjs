import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { LAYER_ORDER } from '../src/layers.js';
import { Grid, FLOOR, cellKey } from '../src/grid.js';
import {
  memoryStorage, browserStorage, createSaver, serialize, loadGame, clearSave, allKeys, layerKey, RUN_KEY, VERSION, fingerprint,
} from '../src/save.js';
import { aplicarEfeito } from '../src/systems/dialogue.js';

// Partida com progresso variado: itens, missão, ciclos, bestiário, baús, sorteio avançado e mapa mudado.
function partidaComProgresso(seed = 5) {
  const g = novoJogo(seed);
  g.player.c = 2;
  g.move(1, 0);
  g.inv.fio_cobre = 4;
  g.inv.liga_ferrugem = 2;
  g.ciclos = 77;
  aplicarEfeito(g, { tipo: 'quest_iniciar', id: 'capitulo_dissipador' });
  aplicarEfeito(g, { tipo: 'flag', id: 'conheceu_lia' });
  g.bestiario.pulga_corrente = { vistas: 3, vencidas: 2, escaneada: false };
  g.bausAbertos = { 'dissipador|5,5': true };
  g.diario.push('Anotação de teste.');
  g.rng();
  g.rng();
  const camada = 'metal_m1';
  const alvo = g.world[camada].grid.find('x')[0];
  if (alvo) g.world[camada].grid.set(alvo[0], alvo[1], '=');
  g.world[camada].visited.add(cellKey(4, 4));
  return g;
}

const salvar = (g) => {
  const st = memoryStorage(true);
  createSaver(st).save(g);
  return st;
};

test('o salvamento tem uma chave para a partida e uma por camada, todas da versão atual', () => {
  const keys = serialize(novoJogo(1)).map((e) => e.key);
  assert.equal(keys.length, 1 + LAYER_ORDER.length);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((k) => k.startsWith(`anelzero2d.v${VERSION}.`)));
  assert.ok(keys.includes(RUN_KEY));
  for (const id of LAYER_ORDER) assert.ok(keys.includes(layerKey(id)));
});

test('carregar restaura a partida inteira: jogador, inventário, missão, mapa, falhas, visitas e sorteio', () => {
  const g = partidaComProgresso();
  const st = salvar(g);
  const h = novoJogo(99);
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'restored');
  assert.deepEqual(rep.discarded, []);
  assert.deepEqual(h.player, g.player);
  assert.deepEqual(h.inv, g.inv);
  assert.equal(h.ciclos, g.ciclos);
  assert.deepEqual(h.missoes, g.missoes);
  assert.deepEqual(h.flags, g.flags);
  assert.deepEqual(h.bestiario, g.bestiario);
  assert.deepEqual(h.bausAbertos, g.bausAbertos);
  assert.deepEqual(h.diario, g.diario);
  for (const id of LAYER_ORDER) {
    assert.deepEqual(h.world[id].grid.rows, g.world[id].grid.rows, `mapa de ${id}`);
    assert.deepEqual([...h.world[id].visited].sort(), [...g.world[id].visited].sort(), `visitas de ${id}`);
    assert.deepEqual(h.world[id].entities, g.world[id].entities, `falhas de ${id}`);
  }
  assert.equal(h.rng.state(), g.rng.state(), 'o sorteio continua de onde parou');
});

test('salvar grava só o que mudou: sem mudança, nada; mudança numa camada, só essa camada', () => {
  const g = partidaComProgresso();
  const saver = createSaver(memoryStorage(true));
  assert.equal(saver.save(g).written.length, 1 + LAYER_ORDER.length);
  assert.equal(saver.save(g).written.length, 0);
  g.world.cache_l3.visited.add(cellKey(7, 2));
  assert.deepEqual(saver.save(g).written, [layerKey('cache_l3')]);
});

test('partida com JSON inválido é descartada e o jogo começa novo, sem lançar erro', () => {
  const st = memoryStorage(true);
  st.setItem(RUN_KEY, '{quebrado');
  const h = novoJogo(1);
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'discarded');
  assert.equal(h.player.camada, LAYER_ORDER[0]);
});

test('partida de outra versão é descartada', () => {
  const st = salvar(partidaComProgresso());
  const run = JSON.parse(st.getItem(RUN_KEY));
  run.version = 99;
  st.setItem(RUN_KEY, JSON.stringify(run));
  assert.equal(loadGame(novoJogo(1), st).status, 'discarded');
});

test('camada de um mapa diferente (impressão digital) é descartada; as outras são restauradas', () => {
  const st = salvar(partidaComProgresso());
  const data = JSON.parse(st.getItem(layerKey('metal_m1')));
  data.fingerprint = 'deadbeef';
  st.setItem(layerKey('metal_m1'), JSON.stringify(data));
  const h = novoJogo(1);
  const rep = loadGame(h, st);
  assert.deepEqual(rep.discarded, ['metal_m1']);
  assert.ok(rep.restored.includes('dissipador'));
  assert.equal(h.world.metal_m1.grid.rows.join(''), h.world.metal_m1.origin.join(''), 'a camada descartada volta ao original');
});

test('mudança no mapa que aponta para uma célula inválida faz a camada ser descartada', () => {
  const st = salvar(partidaComProgresso());
  const data = JSON.parse(st.getItem(layerKey('metal_m1')));
  data.changes = [[999, 999, '.']];
  st.setItem(layerKey('metal_m1'), JSON.stringify(data));
  assert.ok(loadGame(novoJogo(1), st).discarded.includes('metal_m1'));
});

test('falha com comportamento inválido faz a camada ser descartada', () => {
  const st = salvar(partidaComProgresso());
  const data = JSON.parse(st.getItem(layerKey('dissipador')));
  if (data.entities.length) data.entities[0].comp = 'voador';
  st.setItem(layerKey('dissipador'), JSON.stringify(data));
  assert.ok(loadGame(novoJogo(1), st).discarded.includes('dissipador'));
});

test('leitura que falha não trava: o jogo começa novo e avisa', () => {
  const st = { ...memoryStorage(true), getItem() { throw new Error('SecurityError'); } };
  const h = novoJogo(1);
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'unavailable');
  assert.equal(h.player.camada, LAYER_ORDER[0]);
});

test('escrita que falha é reportada e tentada de novo na gravação seguinte', () => {
  const base = memoryStorage(true);
  let falhando = true;
  const st = {
    ...base,
    setItem(k, v) {
      if (falhando && k === layerKey('energia')) throw new Error('QuotaExceededError');
      base.setItem(k, v);
    },
  };
  const g = partidaComProgresso();
  const saver = createSaver(st);
  const primeira = saver.save(g);
  assert.equal(primeira.ok, false);
  assert.deepEqual(primeira.failed, [layerKey('energia')]);
  falhando = false;
  const segunda = saver.save(g);
  assert.equal(segunda.ok, true);
  assert.deepEqual(segunda.written, [layerKey('energia')]);
});

test('sem localStorage, cai para a memória e avisa que não é persistente', () => {
  const st = browserStorage({});
  assert.equal(st.persistent, false);
  st.setItem('a', '1');
  assert.equal(st.getItem('a'), '1');
});

test('localStorage que lança exceção (modo privado, cota) também cai para a memória', () => {
  const win = { localStorage: { setItem() { throw new Error('QuotaExceededError'); }, getItem() { return null; }, removeItem() {} } };
  assert.equal(browserStorage(win).persistent, false);
});

test('posição salva sobre parede é corrigida para o início da camada', () => {
  const st = salvar(partidaComProgresso());
  const run = JSON.parse(st.getItem(RUN_KEY));
  run.player.camada = 'dissipador';
  run.player.c = 0;
  run.player.r = 0;
  st.setItem(RUN_KEY, JSON.stringify(run));
  const h = novoJogo(1);
  loadGame(h, st);
  assert.equal(h.grid.at(h.player.c, h.player.r) === '#', false);
});

test('novo jogo apaga todas as chaves salvas', () => {
  const st = salvar(partidaComProgresso());
  assert.equal(clearSave(st), true);
  for (const key of allKeys()) assert.equal(st.getItem(key), null, key);
  assert.equal(loadGame(novoJogo(1), st).status, 'new');
});

test('a impressão digital é estável para o mesmo mapa e muda quando o mapa muda', () => {
  assert.equal(fingerprint(['#S.#', '#..#']), fingerprint(['#S.#', '#..#']));
  assert.notEqual(fingerprint(['#S.#', '#..#']), fingerprint(['#S.#', '#.#']));
  void Grid; void FLOOR;
});

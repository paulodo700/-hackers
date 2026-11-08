import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LAYER_ORDER } from '../src/layers.js';
import { WALL, OPENED, FOE_CHARS, PICKUP_ITEMS, TOOL_CELLS, cellKey } from '../src/grid.js';
import {
  memoryStorage, browserStorage, createSaver, serialize, loadGame, clearSave, allKeys,
  layerKey, RUN_KEY,
} from '../src/save.js';

function firstCell(rows, pred) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) if (pred(rows[r][c])) return [c, r];
  }
  return null;
}

// Partida com progresso: passos, um reparo, uma falha vencida, um material, visitas, uma fala e sorteios.
function playedGame(seed = 5) {
  const g = new Game({ seed });
  g.move(1, 0);
  g.move(1, 0);
  const [xc, xr] = firstCell(g.world.metal_m1.origin, (ch) => TOOL_CELLS[ch]);
  g.world.metal_m1.grid.set(xc, xr, OPENED.x);
  const [fc, fr] = firstCell(g.world.dissipador.origin, (ch) => FOE_CHARS[ch]);
  g.world.dissipador.grid.set(fc, fr, '.');
  const [pc, pr] = firstCell(g.world.dissipador.origin, (ch) => PICKUP_ITEMS[ch]);
  g.world.dissipador.grid.set(pc, pr, '.');
  g.materials.fio_cobre = 3;
  g.tools.reparo_trilha = 1;
  g.world.cache_l3.npc = 2;
  g.world.cache_l3.visited.add(cellKey(3, 3));
  g.roll();
  g.roll();
  return g;
}

function savedStorage(g) {
  const st = memoryStorage(true);
  createSaver(st).save(g);
  return st;
}

test('a partida e cada camada têm chaves separadas', () => {
  const keys = serialize(new Game({ seed: 1 })).map((e) => e.key);
  assert.equal(keys.length, 1 + LAYER_ORDER.length);
  assert.equal(new Set(keys).size, keys.length);
  for (const id of LAYER_ORDER) assert.ok(keys.includes(layerKey(id)), `chave da camada ${id}`);
  assert.ok(keys.includes(RUN_KEY));
});

test('carregar restaura partida e camadas exatamente como estavam', () => {
  const g = playedGame();
  const st = savedStorage(g);
  const h = new Game({ seed: 99 });
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'restored');
  assert.deepEqual(rep.discarded, []);
  assert.deepEqual(h.player, g.player);
  assert.deepEqual(h.materials, g.materials);
  assert.deepEqual(h.tools, g.tools);
  for (const id of LAYER_ORDER) {
    assert.deepEqual(h.world[id].grid.rows, g.world[id].grid.rows, `grade de ${id}`);
    assert.deepEqual([...h.world[id].visited].sort(), [...g.world[id].visited].sort(), `visitas de ${id}`);
    assert.equal(h.world[id].npc, g.world[id].npc, `falas de ${id}`);
  }
  assert.equal(h.rng.state(), g.rng.state(), 'o sorteio continua de onde parou');
});

test('salvar grava só as chaves que mudaram desde a última gravação', () => {
  const g = playedGame();
  const st = memoryStorage(true);
  const saver = createSaver(st);
  assert.equal(saver.save(g).written.length, 1 + LAYER_ORDER.length);
  assert.equal(saver.save(g).written.length, 0, 'nada mudou, nada é gravado');
  g.world.cache_l3.npc = 1;
  assert.deepEqual(saver.save(g).written, [layerKey('cache_l3')]);
});

test('partida corrompida (JSON inválido) é descartada e o jogo começa novo, sem lançar erro', () => {
  const st = memoryStorage(true);
  st.setItem(RUN_KEY, '{quebrado');
  const h = new Game({ seed: 1 });
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'discarded');
  assert.equal(h.player.layer, LAYER_ORDER[0]);
  assert.equal(h.grid.at(h.player.c, h.player.r) !== WALL, true);
});

test('partida de outra versão é descartada', () => {
  const st = savedStorage(playedGame());
  const run = JSON.parse(st.getItem(RUN_KEY));
  run.version = 99;
  st.setItem(RUN_KEY, JSON.stringify(run));
  const rep = loadGame(new Game({ seed: 1 }), st);
  assert.equal(rep.status, 'discarded');
  assert.match(rep.notes[0], /versão/);
});

test('camada de um mapa diferente (impressão digital) é descartada; as outras são restauradas', () => {
  const st = savedStorage(playedGame());
  const data = JSON.parse(st.getItem(layerKey('metal_m1')));
  data.fingerprint = 'deadbeef';
  st.setItem(layerKey('metal_m1'), JSON.stringify(data));
  const h = new Game({ seed: 1 });
  const rep = loadGame(h, st);
  assert.deepEqual(rep.discarded, ['metal_m1']);
  assert.ok(rep.restored.includes('dissipador'));
  assert.equal(h.world.metal_m1.grid.rows.join(''), h.world.metal_m1.origin.join(''), 'camada descartada volta ao original');
});

test('camada com coordenada fora do mapa é descartada inteira', () => {
  const st = savedStorage(playedGame());
  const data = JSON.parse(st.getItem(layerKey('metal_m1')));
  data.repaired = [[999, 999]];
  st.setItem(layerKey('metal_m1'), JSON.stringify(data));
  const rep = loadGame(new Game({ seed: 1 }), st);
  assert.ok(rep.discarded.includes('metal_m1'));
});

test('reparo gravado numa célula que não é trilha é recusado', () => {
  const st = savedStorage(playedGame());
  const data = JSON.parse(st.getItem(layerKey('dissipador')));
  data.repaired = [[1, 1]]; // o S não é uma trilha rompida
  st.setItem(layerKey('dissipador'), JSON.stringify(data));
  const rep = loadGame(new Game({ seed: 1 }), st);
  assert.ok(rep.discarded.includes('dissipador'));
});

test('leitura que falha não trava: o jogo começa novo e avisa', () => {
  const st = { ...memoryStorage(true), getItem() { throw new Error('SecurityError'); } };
  const h = new Game({ seed: 1 });
  const rep = loadGame(h, st);
  assert.equal(rep.status, 'unavailable');
  assert.equal(h.player.layer, LAYER_ORDER[0]);
});

test('escrita que falha é reportada e tentada de novo na gravação seguinte', () => {
  const base = memoryStorage(true);
  let failing = true;
  const st = {
    ...base,
    setItem(k, v) {
      if (failing && k === layerKey('energia')) throw new Error('QuotaExceededError');
      base.setItem(k, v);
    },
  };
  const g = playedGame();
  const saver = createSaver(st);
  const first = saver.save(g);
  assert.equal(first.ok, false);
  assert.deepEqual(first.failed, [layerKey('energia')]);
  failing = false;
  const second = saver.save(g);
  assert.equal(second.ok, true);
  assert.deepEqual(second.written, [layerKey('energia')]);
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

test('localStorage que funciona é usado como persistente', () => {
  const map = new Map();
  const win = {
    localStorage: {
      setItem: (k, v) => map.set(k, String(v)),
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      removeItem: (k) => map.delete(k),
    },
  };
  assert.equal(browserStorage(win).persistent, true);
});

test('posição salva sobre parede é corrigida para uma célula livre', () => {
  const st = savedStorage(playedGame());
  const run = JSON.parse(st.getItem(RUN_KEY));
  run.player.c = 0;
  run.player.r = 0;
  st.setItem(RUN_KEY, JSON.stringify(run));
  const h = new Game({ seed: 1 });
  loadGame(h, st);
  assert.notEqual(h.grid.at(h.player.c, h.player.r), WALL);
});

test('vitória salva continua valendo depois de recarregar', () => {
  const g = playedGame();
  g.won = true;
  const h = new Game({ seed: 1 });
  loadGame(h, savedStorage(g));
  assert.equal(h.won, true);
});

test('novo jogo apaga todas as chaves salvas', () => {
  const st = savedStorage(playedGame());
  assert.equal(clearSave(st), true);
  for (const key of allKeys()) assert.equal(st.getItem(key), null, key);
  assert.equal(loadGame(new Game({ seed: 1 }), st).status, 'new');
});

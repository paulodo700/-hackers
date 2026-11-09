// Regras dos efeitos visuais (src/render/efeitos.js): vida e expiração das partículas e textos, limite da tela,
// tremor, flash, faixas de título, despacho de comandos e limpeza dos efeitos de batalha. Não usa canvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Efeitos, criarParticula, avancarParticula } from '../src/render/efeitos.js';

test('partícula avança com a velocidade e sai da lista quando passa da vida', () => {
  const p = criarParticula({ x: 0, y: 0, vida: 100, vx: 16, vy: 0 });
  assert.equal(avancarParticula(p, 50), true);
  assert.equal(p.x, 50);
  assert.equal(avancarParticula(p, 60), false);
});

test('emitir respeita o limite de partículas da tela', () => {
  const e = new Efeitos({ limite: 5 });
  for (let i = 0; i < 20; i++) e.emitir({ x: i, y: 0 });
  assert.equal(e.particulas.length, 5);
});

test('atualizar expira textos, ondas e faixas de título no tempo certo', () => {
  const e = new Efeitos();
  e.texto('-3', 0, 0, '#fff', 'dano');
  e.onda(0, 0, '#fff', 50, 500);
  e.banner('Camada', 'sub', '#fff', 500);
  e.atualizar(400);
  assert.equal(e.textos.length, 1);
  assert.equal(e.ondas.length, 1);
  assert.equal(e.banners.length, 1);
  e.atualizar(200);
  assert.equal(e.ondas.length, 0);
  assert.equal(e.banners.length, 0);
  assert.equal(e.textos.length, 1);
  e.atualizar(400);
  assert.equal(e.textos.length, 0);
});

test('tremor sobe com o evento, tem teto e decai até zero', () => {
  const e = new Efeitos();
  e.tremorAdd(6);
  assert.equal(e.tremor, 6);
  e.tremorAdd(99);
  assert.equal(e.tremor, 14);
  for (let i = 0; i < 100; i++) e.atualizar(16);
  assert.equal(e.tremor, 0);
});

test('flash dura a duração indicada e depois some', () => {
  const e = new Efeitos();
  e.flashAdd('#a3121b', 200);
  e.atualizar(150);
  assert.ok(e.flash);
  e.atualizar(60);
  assert.equal(e.flash, null);
});

test('executar despacha os comandos conhecidos e recusa os desconhecidos', () => {
  const e = new Efeitos();
  assert.equal(e.executar({ efeito: 'texto', s: '-4', x: 1, y: 2, cor: '#fff', tipo: 'dano' }), true);
  assert.equal(e.textos.length, 1);
  assert.equal(e.textos[0].s, '-4');
  assert.equal(e.executar({ efeito: 'flash', cor: '#000', duracao: 100 }), true);
  assert.ok(e.flash);
  assert.equal(e.executar({ efeito: 'inexistente' }), false);
});

test('reiniciar limpa todos os efeitos, inclusive os de tela', () => {
  const e = new Efeitos();
  e.texto('x', 0, 0, '#fff', 'info', true);
  e.flashAdd('#fff', 100);
  e.banner('título');
  e.reiniciar();
  assert.equal(e.textos.length + e.particulas.length + e.banners.length, 0);
  assert.equal(e.flash, null);
});

test('removerTela tira só os efeitos em coordenadas de tela (fim da batalha)', () => {
  const e = new Efeitos();
  e.texto('mundo', 0, 0, '#fff', 'info', false);
  e.texto('arena', 0, 0, '#fff', 'dano', true);
  e.removerTela();
  assert.deepEqual(e.textos.map((t) => t.s), ['mundo']);
});

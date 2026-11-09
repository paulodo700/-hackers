// Tradução de eventos do motor em efeitos visuais (src/render/eventos.js). Regras: número de dano, crítico,
// arena na batalha, cura, esquiva, XP, raridade de item, troca de camada, subida de nível e sons sem efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traduzirEvento } from '../src/render/eventos.js';
import { TILE, PONTO_ARENA } from '../src/render/layout.js';

const jogador = { c: 4, r: 5, nivel: 3 };
const catalogo = {
  itens: {
    fio_cobre: { nome: 'Fio de cobre', raridade: 'comum' },
    placa_base: { nome: 'Placa-base', raridade: 'raro' },
  },
};

test('dano no jogador vira número vermelho na célula, com faísca, flash e tremor', () => {
  const fx = traduzirEvento({ tipo: 'dano', alvo: 'jogador', valor: 7, c: 4, r: 5 }, { jogador, emBatalha: false });
  const texto = fx.find((f) => f.efeito === 'texto');
  assert.equal(texto.s, '-7');
  assert.equal(texto.tipo, 'dano');
  assert.equal(texto.x, 4 * TILE + TILE / 2);
  assert.equal(texto.tela, false);
  assert.ok(fx.some((f) => f.efeito === 'flash'));
  assert.equal(fx.find((f) => f.efeito === 'tremor').forca, 2);
});

test('acerto crítico usa tamanho crítico e tremor maior', () => {
  const fx = traduzirEvento({ tipo: 'dano', alvo: 'jogador', valor: 12, critico: true, c: 4, r: 5 }, { jogador });
  assert.equal(fx.find((f) => f.efeito === 'texto').tipo, 'critico');
  assert.equal(fx.find((f) => f.efeito === 'tremor').forca, 5);
});

test('na batalha, dano aos combatentes vai para os pontos fixos da arena', () => {
  const noJogador = traduzirEvento({ tipo: 'dano', alvo: 'jogador', valor: 3, c: 1, r: 1 }, { jogador, emBatalha: true });
  const textoJogador = noJogador.find((f) => f.efeito === 'texto');
  assert.equal(textoJogador.tela, true);
  assert.equal(textoJogador.x, PONTO_ARENA.jogador.x);
  const noInimigo = traduzirEvento({ tipo: 'dano', alvo: 'inimigo', valor: 9, critico: false, c: 1, r: 1 }, { jogador, emBatalha: true });
  const textoInimigo = noInimigo.find((f) => f.efeito === 'texto');
  assert.equal(textoInimigo.x, PONTO_ARENA.inimigo.x);
  assert.equal(textoInimigo.cor, '#f2ead8');
});

test('cura mostra +valor em verde e dispara o efeito de cura', () => {
  const fx = traduzirEvento({ tipo: 'cura', alvo: 'jogador', valor: 5 }, { jogador });
  assert.equal(fx[0].s, '+5');
  assert.equal(fx[0].cor, '#7dffb0');
  assert.ok(fx.some((f) => f.efeito === 'cura'));
});

test('esquiva usa o lado indicado pelo evento e ganho de XP vira destaque', () => {
  const esquiva = traduzirEvento({ tipo: 'texto', texto: 'Esquiva', alvo: 'jogador', c: 0, r: 0, cor: '#9ad0ff' }, { jogador, emBatalha: true });
  assert.equal(esquiva[0].x, PONTO_ARENA.jogador.x);
  const xp = traduzirEvento({ tipo: 'texto', texto: '+12 XP', c: 2, r: 2, cor: '#ffd166' }, { jogador });
  assert.equal(xp[0].tipo, 'destaque');
});

test('item raro ganha feixe de luz e o nome aparece na cor da raridade', () => {
  const fx = traduzirEvento({ tipo: 'pegou', id: 'placa_base', qtd: 1 }, { jogador, catalogo });
  const txt = fx.find((f) => f.efeito === 'texto');
  assert.equal(txt.s, '+1 Placa-base');
  assert.equal(txt.cor, '#6aa9ff');
  assert.ok(fx.some((f) => f.efeito === 'feixe'));
  const comum = traduzirEvento({ tipo: 'pegou', id: 'fio_cobre', qtd: 2 }, { jogador, catalogo });
  assert.equal(comum.length, 1);
  assert.equal(comum[0].s, '+2 Fio de cobre');
});

test('item sem cadastro aparece pelo próprio id', () => {
  const fx = traduzirEvento({ tipo: 'pegou', id: 'x_desconhecido' }, { jogador, catalogo });
  assert.equal(fx[0].s, '+1 x_desconhecido');
});

test('entrar numa camada mostra o nome e o número dela', () => {
  const fx = traduzirEvento({ tipo: 'camada', camada: 'metal_m1' }, { jogador });
  const faixa = fx.find((f) => f.efeito === 'banner');
  assert.equal(faixa.titulo, 'Metal M1');
  assert.equal(faixa.subtitulo, 'Camada 2 de 8');
});

test('subir de nível mostra o novo nível e as ondas de luz fora da batalha', () => {
  const fx = traduzirEvento({ tipo: 'sfx', id: 'subir_nivel' }, { jogador: { c: 1, r: 1, nivel: 4 } });
  assert.ok(fx.some((f) => f.efeito === 'nivel'));
  assert.equal(fx.find((f) => f.efeito === 'texto').s, 'Nível 4');
});

test('sons sem efeito visual e eventos desconhecidos não geram nada', () => {
  assert.deepEqual(traduzirEvento({ tipo: 'sfx', id: 'coleta' }, { jogador }), []);
  assert.deepEqual(traduzirEvento({ tipo: 'musica', id: 'batalha' }, { jogador }), []);
  assert.deepEqual(traduzirEvento({ tipo: 'evento_novo' }, { jogador }), []);
});

test('fx do mundo vira efeito na célula; fx desconhecido é ignorado', () => {
  const fx = traduzirEvento({ tipo: 'fx', fx: 'gelo', c: 3, r: 2 }, { jogador });
  assert.equal(fx[0].efeito, 'gelo');
  assert.equal(fx[0].x, 3 * TILE + TILE / 2);
  assert.deepEqual(traduzirEvento({ tipo: 'fx', fx: 'magia_nova', c: 0, r: 0 }, { jogador }), []);
});

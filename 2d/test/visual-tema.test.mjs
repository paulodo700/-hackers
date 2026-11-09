// Regras puras do visual (src/render/tema.js): orbes, barra fantasma, pulsos, grade de inventário, quebra de
// texto, cores de raridade e elemento. Não usa canvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMA, nivelOrbe, avancarFantasma, pulsar, posicaoNaGrade, quebrarTexto, corRaridade, corElemento, hexParaRgb,
} from '../src/render/tema.js';

test('nivelOrbe mantém a fração entre 0 e 1 e trata valores inválidos como vazio', () => {
  assert.equal(nivelOrbe(0.5), 0.5);
  assert.equal(nivelOrbe(-2), 0);
  assert.equal(nivelOrbe(9), 1);
  assert.equal(nivelOrbe(NaN), 0);
  assert.equal(nivelOrbe(undefined), 0);
});

test('barra fantasma sobe de imediato na cura e desce devagar no dano', () => {
  assert.equal(avancarFantasma(0.4, 0.9, 16), 0.9);
  const depois = avancarFantasma(1, 0.5, 350);
  assert.ok(Math.abs(depois - (0.5 + 0.5 * Math.exp(-1))) < 1e-9);
  let f = 1;
  for (let i = 0; i < 200; i++) f = avancarFantasma(f, 0.5, 16);
  assert.ok(Math.abs(f - 0.5) < 0.001, 'converge para a vida real');
});

test('pulsar oscila em torno da base com a amplitude dada', () => {
  assert.equal(pulsar(0, 100, 0.2, 0.5), 0.5);
  assert.ok(Math.abs(pulsar((Math.PI / 2) * 100, 100, 0.2, 0.5) - 0.7) < 1e-9);
});

test('posicaoNaGrade dispõe os itens em colunas e quebra a linha no fim da coluna', () => {
  assert.deepEqual(posicaoNaGrade(0, 4, 40, 6, 10, 20), { x: 10, y: 20 });
  assert.deepEqual(posicaoNaGrade(3, 4, 40, 6, 10, 20), { x: 10 + 3 * 46, y: 20 });
  assert.deepEqual(posicaoNaGrade(4, 4, 40, 6, 10, 20), { x: 10, y: 20 + 46 });
});

test('quebrarTexto respeita o limite de caracteres e não perde palavras', () => {
  const frase = 'um dois três quatro cinco seis sete oito nove dez';
  const linhas = quebrarTexto(frase, 12);
  assert.ok(linhas.every((l) => l.length <= 12));
  assert.equal(linhas.join(' '), frase);
  assert.deepEqual(quebrarTexto('', 10), []);
});

test('cores de raridade e de elemento caem em valor seguro quando desconhecidas', () => {
  assert.equal(corRaridade('epico'), '#ffb640');
  assert.equal(corRaridade('lendario'), corRaridade('comum'));
  assert.equal(corElemento('calor'), '#ff7a3d');
  assert.equal(corElemento(undefined), '#e9e0cc');
});

test('hexParaRgb converte cores de 3 e 6 dígitos para o formato das luzes', () => {
  assert.equal(hexParaRgb('#ff7a3d'), '255,122,61');
  assert.equal(hexParaRgb('#fff'), '255,255,255');
  assert.equal(hexParaRgb('#000000'), '0,0,0');
  assert.equal(hexParaRgb('cor-invalida'), '255,255,255');
});

test('a paleta define ouro e couro em hexadecimal (base das molduras)', () => {
  assert.match(TEMA.ouro, /^#[0-9a-f]{6}$/i);
  assert.match(TEMA.couro, /^#[0-9a-f]{6}$/i);
});

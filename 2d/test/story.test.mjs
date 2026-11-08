import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { progresso, estadoMissao } from '../src/systems/quests.js';
import { condicaoValida, iniciarConversa, escolherOpcao, avancarDialogo, aplicarEfeito } from '../src/systems/dialogue.js';
import { detalhesFalha, registrarScan } from '../src/systems/bestiario.js';

test('conversa com o técnico: escolher a opção inicia a missão, e falar de novo cumpre a primeira etapa', () => {
  const g = novoJogo(1);
  iniciarConversa(g, 'tecnico_1');
  assert.equal(g.dialog.opcoes.length, 2);
  escolherOpcao(g, 0);
  assert.equal(g.dialog.no, 'n1');
  assert.equal(estadoMissao(g, 'capitulo_dissipador').estado, 'ativa');
  avancarDialogo(g);
  avancarDialogo(g);
  assert.equal(g.dialog, null, 'a conversa acabou');
  iniciarConversa(g, 'tecnico_1');
  assert.equal(estadoMissao(g, 'capitulo_dissipador').etapa, 1, 'a etapa de falar foi cumprida');
  assert.equal(g.diario.length >= 1, true);
});

test('derrotar pulgas avança a etapa; o chefe conclui a missão e paga a recompensa', () => {
  const g = novoJogo(1);
  aplicarEfeito(g, { tipo: 'quest_iniciar', id: 'capitulo_dissipador' });
  estadoMissao(g, 'capitulo_dissipador').etapa = 1;
  progresso(g, { tipo: 'derrotou', foe: 'pulga_corrente' });
  progresso(g, { tipo: 'derrotou', foe: 'pulga_corrente' });
  assert.equal(estadoMissao(g, 'capitulo_dissipador').etapa, 2, 'duas pulgas cumprem a etapa');
  progresso(g, { tipo: 'chefe', id: 'bolha_termica' });
  const st = estadoMissao(g, 'capitulo_dissipador');
  assert.equal(st.estado, 'concluida');
  assert.equal(g.inv.pasta_termica, 1, 'recompensa de item');
  assert.equal(g.flags.dissipador_limpo, true, 'recompensa de flag');
  assert.ok(g.ciclos >= 10);
});

test('condições de diálogo: flag, missão, item, nível e chefe', () => {
  const g = novoJogo(1);
  assert.equal(condicaoValida(g, { tipo: 'flag', id: 'x' }), false);
  g.flags.x = true;
  assert.equal(condicaoValida(g, { tipo: 'flag', id: 'x' }), true);
  assert.equal(condicaoValida(g, { tipo: 'quest', id: 'capitulo_dissipador', estado: 'nao_iniciada' }), true);
  assert.equal(condicaoValida(g, { tipo: 'item', id: 'fio_cobre', qtd: 1 }), false);
  g.inv.fio_cobre = 2;
  assert.equal(condicaoValida(g, { tipo: 'item', id: 'fio_cobre', qtd: 2 }), true);
  assert.equal(condicaoValida(g, { tipo: 'nivel', min: 2 }), false);
  assert.equal(condicaoValida(g, { tipo: 'chefe', id: 'bolha_termica', estado: 'derrotado' }), false);
});

test('efeitos de diálogo: item, ciclos, anotação, cura, e loja que abre depois da conversa', () => {
  const g = novoJogo(1);
  aplicarEfeito(g, { tipo: 'item', id: 'fio_cobre', qtd: 3, acao: 'dar' });
  assert.equal(g.inv.fio_cobre, 3);
  aplicarEfeito(g, { tipo: 'item', id: 'fio_cobre', qtd: 1, acao: 'tirar' });
  assert.equal(g.inv.fio_cobre, 2);
  aplicarEfeito(g, { tipo: 'ciclos', valor: 7 });
  assert.equal(g.ciclos, 7);
  aplicarEfeito(g, { tipo: 'anotar', texto: 'Algo importante.' });
  assert.equal(g.diario.at(-1), 'Algo importante.');
  g.player.hp = 1;
  aplicarEfeito(g, { tipo: 'curar' });
  assert.equal(g.player.hp, g.estatisticas().maxHp);
  g.dialog = { npc: 'x', dialogo: null, no: null, fala: '', opcoes: [] };
  aplicarEfeito(g, { tipo: 'loja', id: 'loja_dissipador' });
  assert.equal(g.lojaPendente, 'loja_dissipador');
});

test('bestiário: ataques e fraquezas só aparecem depois de vencer ou escanear', () => {
  const g = novoJogo(1);
  assert.equal(detalhesFalha(g, 'pulga_corrente').conhecida, false);
  assert.equal(detalhesFalha(g, 'pulga_corrente').ataques, null);
  registrarScan(g, 'pulga_corrente');
  const d = detalhesFalha(g, 'pulga_corrente');
  assert.equal(d.conhecida, true);
  assert.deepEqual(d.ataques, ['Mordida']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { xpParaProximo, ganharXp, estatisticas } from '../src/systems/stats.js';
import { podeAprender, aprender, habilidadesAprendidas } from '../src/systems/skills.js';
import { equipar, desequipar, usarConsumivel, adicionar, contar } from '../src/systems/items.js';
import { podeCriar, criar } from '../src/systems/crafting.js';
import { comprar, vender, estoqueDaLoja } from '../src/systems/shops.js';
import { itensDoMenu, executarAcaoMenu } from '../src/menus.js';
import { iniciarBatalha } from '../src/systems/combat.js';
import { Grid } from '../src/grid.js';

test('XP para o próximo nível segue a fórmula 12 + 8n + n²', () => {
  assert.equal(xpParaProximo(1), 21);
  assert.equal(xpParaProximo(5), 77);
});

test('subir de nível dá vida, energia, ataque nos pares e um ponto de habilidade', () => {
  const g = novoJogo(1);
  const vida = g.player.maxHp;
  ganharXp(g, xpParaProximo(1));
  assert.equal(g.player.nivel, 2);
  assert.equal(g.player.pontos, 1);
  assert.equal(g.player.maxHp, vida + 5);
  assert.equal(g.player.atk, 5, 'ataque sobe no nível 2');
  assert.equal(g.player.xp, 0);
});

test('habilidade exige nível e pontos; aprender gasta os pontos', () => {
  const g = novoJogo(1);
  assert.equal(podeAprender(g, 'descarga').ok, false, 'sem ponto de habilidade');
  g.player.pontos = 1;
  assert.equal(podeAprender(g, 'descarga').ok, true);
  aprender(g, 'descarga');
  assert.deepEqual(habilidadesAprendidas(g).map((h) => h.id), ['descarga']);
  assert.equal(g.player.pontos, 0);
  assert.equal(podeAprender(g, 'congelar').ok, false, 'sem ponto de habilidade');
});

test('equipar muda o ataque e a defesa; trocar de peça devolve a antiga ao inventário', () => {
  const g = novoJogo(1);
  adicionar(g, 'dissipador_mk1', 1);
  adicionar(g, 'antena_mk1', 1);
  const def0 = estatisticas(g).def;
  equipar(g, 'dissipador_mk1');
  assert.equal(estatisticas(g).def, def0 + 2);
  assert.equal(estatisticas(g).maxHp, g.player.maxHp + 5);
  equipar(g, 'antena_mk1');
  assert.equal(estatisticas(g).atk, g.player.atk + 2);
  adicionar(g, 'dissipador_mk1', 1);
  equipar(g, 'dissipador_mk1');
  assert.equal(contar(g, 'dissipador_mk1'), 1, 'o equipamento antigo voltou ao inventário ao trocar');
  desequipar(g, 'antena');
  assert.equal(contar(g, 'antena_mk1'), 1, 'desequipar devolve ao inventário');
});

test('consumível: fora do combate cura e resfria; o de combate só vale em combate', () => {
  const g = novoJogo(1);
  g.player.hp = 5;
  g.player.calor = 60;
  adicionar(g, 'pasta_termica', 1);
  assert.equal(usarConsumivel(g, 'pasta_termica').ok, true);
  assert.equal(g.player.hp, 13);
  assert.equal(g.player.calor, 35);
  adicionar(g, 'pulso_combate', 1);
  assert.equal(usarConsumivel(g, 'pulso_combate').ok, false, 'só em combate');
});

test('criar gasta os materiais da receita; sem materiais não gasta nada', () => {
  const g = novoJogo(1);
  g.inv = { liga_ferrugem: 1, fio_cobre: 1 };
  assert.equal(podeCriar(g, 'reparo_trilha').ok, false);
  criar(g, 'reparo_trilha');
  assert.deepEqual(g.inv, { liga_ferrugem: 1, fio_cobre: 1 }, 'nada foi gasto');
  g.inv.liga_ferrugem = 2;
  criar(g, 'reparo_trilha');
  assert.equal(g.inv.reparo_trilha, 1);
  assert.equal(g.inv.liga_ferrugem, undefined);
});

test('loja: compra gasta ciclos e o estoque limitado acaba; venda paga metade do valor', () => {
  const g = novoJogo(1);
  g.ciclos = 50;
  assert.equal(comprar(g, 'loja_dissipador', 'pasta_termica').ok, true);
  assert.equal(g.ciclos, 50 - 24, 'preço é o dobro do valor');
  g.inv.fio_cobre = 1;
  assert.equal(vender(g, 'loja_dissipador', 'fio_cobre').ok, true);
  assert.equal(g.ciclos, 26 + 5, 'vende por metade do valor');
  g.ciclos += 100;
  assert.equal(comprar(g, 'loja_dissipador', 'pulso_combate').ok, true);
  assert.equal(comprar(g, 'loja_dissipador', 'pulso_combate').ok, false, 'estoque esgotado');
  assert.equal(estoqueDaLoja(g, 'loja_dissipador').find((o) => o.item === 'pulso_combate').estoque, 0);
});

test('menu principal lista as telas e abrir uma delas troca o menu aberto', () => {
  const g = novoJogo(1);
  g.abrirMenu('principal');
  const itens = itensDoMenu(g);
  assert.ok(itens.some((i) => i.label === 'Inventário'));
  g.navegarMenu(1);
  assert.equal(g.menu.cursor, 1);
  g.escolherMenuNumero(2);
  assert.equal(g.menu.tipo, 'inventario');
  g.voltarMenu();
  assert.equal(g.menu.tipo, 'principal');
});

test('pelo inventário, um equipamento é vestido com a ação do menu', () => {
  const g = novoJogo(1);
  adicionar(g, 'antena_mk1', 1);
  g.abrirMenu('inventario');
  const item = itensDoMenu(g).find((i) => i.acao.tipo === 'equipar');
  executarAcaoMenu(g, item.acao);
  assert.equal(g.player.equip.antena, 'antena_mk1');
});

test('habilidade no combate: escolher uma gasta EP e aplica o efeito', () => {
  const g = novoJogo(1);
  g.player.habilidades.push('descarga');
  const camada = g.player.camada;
  const ent = { id: 800, foe: 'ruido_termico', camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: false, ignorar: 0 };
  g.world[camada].grid = new Grid(['#####', '#S.##', '#####']);
  g.world[camada].entities = [ent];
  g.rng = () => 0.5;
  iniciarBatalha(g, ent);
  const ep = g.player.ep;
  g.abrirMenu('batalha_habilidade');
  g.escolherMenuNumero(1);
  assert.equal(g.player.ep, ep - 4 + 1, 'gasta 4 de EP e a rodada regenera 1');
  assert.ok(g.battle.hp < 12);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validarFalha, validarItem, validarHabilidade, validarMissao, validarDialogo, validarNpc,
  STATUS_IDS, TIPOS_ETAPA, CONDICOES_DIALOGO, EFEITOS_DIALOGO,
} from '../src/data/schema.js';
import { STATUS } from '../src/data/status.js';
import { LAYER_ORDER } from '../src/layers.js';
import { FOES as FOES_ANTIGAS } from '../src/content.js';
import { ITENS } from '../src/data/items.js';
import { FALHAS } from '../src/data/foes.js';
import { HABILIDADES, ATAQUES } from '../src/data/skills.js';
import { NPCS } from '../src/data/npcs.js';
import { DIALOGOS } from '../src/data/dialogues.js';
import { MISSOES } from '../src/data/quests.js';
import { LOOT } from '../src/data/loot.js';
import { LOJAS } from '../src/data/shops.js';

const regulares = Object.values(FALHAS).filter((f) => !f.chefe);
const chefes = Object.values(FALHAS).filter((f) => f.chefe);
const FOE_CHARS = {
  pulga_corrente: 'f', rasgo_trilha: 'F', ruido_termico: 'Q', vazamento_corrente: 'V', eletromigracao: 'E',
  pico_de_tensao: 'J', fantasma_de_cache: 'L', sobrecarga_termica: 'R', bit_corrompido: 'G', glitch_de_pipeline: 'T',
};
const CHEFES_IDS = ['bolha_termica', 'varredor_de_trilhas', 'guardiao_do_cache', 'nucleo_instavel',
  'fila_infinita', 'colapso_de_tensao', 'ponte_partida', 'anel_escuro'];
const ITENS_GDD = [
  'liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico', 'fragmento_escuro',
  'reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'chave_nucleo',
  'pasta_termica', 'refrigerante', 'pulso_reset', 'injecao_energia', 'patch_impulso', 'capacitor_reserva', 'kit_reparo',
  'dissipador_mk1', 'dissipador_mk2', 'dissipador_mk3', 'antena_mk1', 'antena_mk2', 'antena_mk3',
  'modulo_sinal', 'modulo_termico', 'modulo_foco', 'modulo_ressonante',
];
const HAB_IDS = {
  fusao: ['descarga', 'chama_termica', 'pulso_sinal', 'arco_voltaico', 'onda_de_choque'],
  reparo: ['pasta_de_reparo', 'ponte_de_reparo', 'limpeza', 'regeneracao', 'sincronia'],
  dissipacao: ['dissipador_ativo', 'congelar', 'resfriamento', 'contramedida', 'bloqueio_termico'],
};
const LOJAS_CAMADAS = ['dissipador', 'cache_l3', 'energia', 'substrato'];

function chavesBatemComIds(nome, obj) {
  for (const [k, v] of Object.entries(obj)) assert.equal(v.id, k, `${nome}: chave ${k} difere do id ${v.id}`);
}
const idValido = (id) => /^[a-z0-9_]+$/.test(id);

// Todos os efeitos de todos os nós de todos os diálogos.
function* efeitosDialogo() {
  for (const d of Object.values(DIALOGOS)) for (const no of Object.values(d.nos)) for (const ef of no.efeitos ?? []) yield [d, ef];
}
function* condicoesDialogo() {
  for (const d of Object.values(DIALOGOS)) {
    for (const c of d.condicoes ?? []) yield [d, c];
    for (const no of Object.values(d.nos)) for (const o of no.opcoes ?? []) for (const c of o.condicoes ?? []) yield [d, c];
  }
}

// ---------------------------------------------------------------- Validadores e ids
test('ids batem com as chaves e são snake_case ASCII', () => {
  const todos = { ITENS, FALHAS, HABILIDADES, ATAQUES, NPCS, DIALOGOS, MISSOES, LOJAS };
  for (const [nome, obj] of Object.entries(todos)) {
    chavesBatemComIds(nome, obj);
    for (const k of Object.keys(obj)) assert.ok(idValido(k), `${nome}: id inválido ${k}`);
  }
});

test('itens passam no validador e cobrem o GDD', () => {
  for (const i of Object.values(ITENS)) {
    assert.deepEqual(validarItem(i), [], i.id);
    assert.equal(i.sprite, i.id);
  }
  for (const id of ITENS_GDD) assert.ok(ITENS[id], `item ausente: ${id}`);
  const missao = Object.values(ITENS).filter((i) => i.id.startsWith('missao_'));
  assert.ok(missao.length >= 4);
  for (const i of missao) assert.equal(i.tipo, 'missao');
  for (const id of ['liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico', 'fragmento_escuro']) {
    assert.equal(ITENS[id].tipo, 'material');
  }
  assert.deepEqual(ITENS.reparo_trilha.alvo, ['x']);
  assert.deepEqual(ITENS.ajuste_energia.alvo, ['g']);
  assert.deepEqual(ITENS.reforco_nucleo.alvo, ['o']);
  assert.deepEqual(ITENS.chave_nucleo.alvo, ['D']);
});

test('equipamentos: nível 1–3 e evolução aponta para o próximo nível do mesmo slot', () => {
  for (const i of Object.values(ITENS).filter((x) => x.tipo === 'equipamento')) {
    assert.ok([1, 2, 3].includes(i.equipamento.nivel), i.id);
    const prox = i.equipamento.evolui_para;
    if (prox) {
      assert.ok(ITENS[prox], `${i.id}: evolui para item inexistente`);
      assert.equal(ITENS[prox].equipamento.slot, i.equipamento.slot);
      assert.equal(ITENS[prox].equipamento.nivel, i.equipamento.nivel + 1);
    }
  }
});

test('consumíveis: uso em combate/explorar/ambos e status de buff existem', () => {
  for (const i of Object.values(ITENS).filter((x) => x.tipo === 'consumivel')) {
    assert.ok(['combate', 'explorar', 'ambos'].includes(i.uso.em), i.id);
    for (const ef of i.uso.efeitos) if (ef.status) assert.ok(STATUS_IDS.includes(ef.status), i.id);
  }
});

test('falhas regulares: validador, glifos do mapa e faixas de atributos', () => {
  assert.equal(regulares.length, 10);
  const chars = new Set();
  for (const f of regulares) {
    assert.deepEqual(validarFalha(f), [], f.id);
    assert.equal(f.char, FOE_CHARS[f.id], `${f.id}: glifo`);
    assert.ok(!chars.has(f.char), `glifo repetido ${f.char}`);
    chars.add(f.char);
    assert.equal(f.sprite, f.id);
    assert.ok(f.hp >= 6 && f.hp <= 18 && f.atk >= 2 && f.atk <= 6, f.id);
    assert.ok(f.def >= 0 && f.def <= 3 && f.spd >= 3 && f.spd <= 9, f.id);
    assert.ok(f.nivel >= 1 && f.nivel <= 7, f.id);
  }
});

test('as quatro falhas antigas mantêm vida, ataque, defesa e quedas', () => {
  for (const [id, antiga] of Object.entries(FOES_ANTIGAS)) {
    const f = FALHAS[id];
    assert.ok(f, id);
    assert.equal(f.hp, antiga.hp);
    assert.equal(f.atk, antiga.atk);
    assert.equal(f.def, antiga.def);
    const drops = Object.fromEntries(f.drops.map((d) => [d.item, d.chance]));
    assert.deepEqual(drops, antiga.drop);
  }
});

test('chefes: validador, um por camada, três fases e faixas', () => {
  assert.deepEqual(chefes.map((c) => c.id).sort(), [...CHEFES_IDS].sort());
  for (const c of chefes) {
    assert.deepEqual(validarFalha(c, { chefe: true }), [], c.id);
    assert.equal(c.char, 'B');
    assert.ok(LAYER_ORDER.includes(c.camada), c.id);
    assert.equal(c.fases.length, 3);
    assert.deepEqual(c.fases.map((f) => f.ate), [0.66, 0.33, 0]);
    assert.ok(c.hp >= 60 && c.hp <= 120 && c.atk >= 6 && c.atk <= 12, c.id);
    assert.ok(c.def >= 2 && c.def <= 6 && c.spd >= 4 && c.spd <= 8 && c.nivel >= 2 && c.nivel <= 8, c.id);
    if (c.recompensa.item) assert.ok(ITENS[c.recompensa.item], `${c.id}: item de recompensa`);
  }
  assert.equal(new Set(chefes.map((c) => c.camada)).size, 8);
});

test('habilidades: 15 ids do GDD, validador e status conhecidos', () => {
  assert.equal(Object.keys(HABILIDADES).length, 15);
  for (const [ramo, ids] of Object.entries(HAB_IDS)) {
    for (const id of ids) {
      const h = HABILIDADES[id];
      assert.ok(h, id);
      assert.equal(h.ramo, ramo);
      assert.equal(h.sprite, `ramo_${ramo}`);
    }
  }
  for (const h of Object.values(HABILIDADES)) {
    assert.deepEqual(validarHabilidade(h), [], h.id);
    assert.ok(h.nivel >= 1 && h.nivel <= 8 && [1, 2].includes(h.pontos), h.id);
    for (const ef of h.efeitos) {
      if (ef.status) assert.ok(STATUS_IDS.includes(ef.status) && STATUS[ef.status], `${h.id}: ${ef.status}`);
      if (ef.tipo === 'dano') assert.ok(ef.fator >= 1 && ef.fator <= 2.5, h.id);
      if (ef.tipo === 'status') assert.ok(ef.chance >= 0 && ef.chance <= 1 && ['inimigo', 'proprio'].includes(ef.alvo), h.id);
    }
  }
});

test('ataques: efeitos válidos; telegrafo só em ataques de chefe', () => {
  const tipos = ['dano', 'cura', 'escudo', 'status', 'remover', 'buff', 'calor'];
  const deChefe = new Set(chefes.flatMap((c) => c.fases.flatMap((f) => f.ataques)));
  const deRegular = new Set(regulares.flatMap((f) => f.ataques));
  for (const a of Object.values(ATAQUES)) {
    assert.ok(a.nome && a.descricao && a.efeitos.length > 0, a.id);
    for (const ef of a.efeitos) {
      assert.ok(tipos.includes(ef.tipo), `${a.id}: ${ef.tipo}`);
      if (ef.status) assert.ok(STATUS_IDS.includes(ef.status), `${a.id}: ${ef.status}`);
    }
    if (a.telegrafo) assert.ok(deChefe.has(a.id) && !deRegular.has(a.id), `${a.id}: telegrafo fora de chefe`);
    assert.ok(deChefe.has(a.id) || deRegular.has(a.id), `${a.id}: ataque sem dono`);
  }
  for (const c of chefes) assert.ok(c.ataques.some((id) => ATAQUES[id].telegrafo), `${c.id}: sem ataque carregado`);
});

test('ataques das falhas e das fases existem', () => {
  for (const f of Object.values(FALHAS)) {
    for (const id of f.ataques) assert.ok(ATAQUES[id], `${f.id}: ataque ${id}`);
    for (const fase of f.fases ?? []) for (const id of fase.ataques) assert.ok(ATAQUES[id], `${f.id}: fase ${id}`);
    for (const d of f.drops) assert.ok(ITENS[d.item], `${f.id}: queda ${d.item}`);
  }
});

// ---------------------------------------------------------------- NPCs, diálogos, missões
test('npcs: validador, 2 a 3 por camada, técnico em todas, mercador nas lojas', () => {
  const sprites = ['tecnico_a', 'tecnico_b', 'mercador_a', 'guardiao_a', 'narrador_a'];
  for (const n of Object.values(NPCS)) {
    assert.deepEqual(validarNpc(n), [], n.id);
    assert.ok(LAYER_ORDER.includes(n.camada), n.id);
    assert.ok(sprites.includes(n.sprite), n.id);
    assert.ok(n.descricao, n.id);
  }
  for (const camada of LAYER_ORDER) {
    const daCamada = Object.values(NPCS).filter((n) => n.camada === camada);
    assert.ok(daCamada.length >= 2 && daCamada.length <= 3, camada);
    assert.ok(daCamada.some((n) => n.tipo === 'tecnico'), `${camada}: sem técnico`);
    const mercadores = daCamada.filter((n) => n.tipo === 'mercador');
    if (LOJAS_CAMADAS.includes(camada)) {
      assert.equal(mercadores.length, 1, `${camada}: mercador`);
      assert.equal(daCamada[0].tipo, 'mercador', `${camada}: mercador deve vir primeiro`);
    } else {
      assert.equal(mercadores.length, 0, `${camada}: mercador sem loja`);
    }
  }
  assert.ok(Object.values(NPCS).some((n) => n.camada === 'substrato' && n.tipo === 'narrador'));
});

test('diálogos: validador, npc existe, todo npc tem diálogo', () => {
  for (const d of Object.values(DIALOGOS)) {
    assert.deepEqual(validarDialogo(d), [], d.id);
    assert.ok(NPCS[d.npc], `${d.id}: npc ${d.npc}`);
  }
  for (const id of Object.keys(NPCS)) assert.ok(Object.values(DIALOGOS).some((d) => d.npc === id), `${id}: sem diálogo`);
});

test('diálogos: referências de condições e efeitos resolvem', () => {
  for (const [d, c] of condicoesDialogo()) {
    assert.ok(CONDICOES_DIALOGO.includes(c.tipo), d.id);
    if (c.tipo === 'quest') {
      assert.ok(MISSOES[c.id], `${d.id}: missão ${c.id}`);
      if (c.estado === 'etapa') assert.ok(MISSOES[c.id].etapas.some((e) => e.id === c.etapa), `${d.id}: etapa ${c.etapa}`);
    }
    if (c.tipo === 'item') assert.ok(ITENS[c.id], `${d.id}: item ${c.id}`);
    if (c.tipo === 'chefe') assert.ok(FALHAS[c.id]?.chefe, `${d.id}: chefe ${c.id}`);
  }
  for (const [d, ef] of efeitosDialogo()) {
    assert.ok(EFEITOS_DIALOGO.includes(ef.tipo), d.id);
    if (ef.tipo === 'quest_iniciar' || ef.tipo === 'quest_concluir') assert.ok(MISSOES[ef.id], `${d.id}: missão ${ef.id}`);
    if (ef.tipo === 'item') assert.ok(ITENS[ef.id] && ['dar', 'tirar'].includes(ef.acao), `${d.id}: item ${ef.id}`);
    if (ef.tipo === 'loja') {
      assert.ok(LOJAS[ef.id], `${d.id}: loja ${ef.id}`);
      assert.equal(LOJAS[ef.id].mercador, d.npc, `${d.id}: loja de outro mercador`);
    }
  }
});

test('cada capítulo é iniciado pelo técnico da camada; toda missão pode ser iniciada', () => {
  const iniciadas = new Map();
  for (const [d, ef] of efeitosDialogo()) {
    if (ef.tipo === 'quest_iniciar') iniciadas.set(ef.id, [...(iniciadas.get(ef.id) ?? []), d.npc]);
  }
  for (const camada of LAYER_ORDER) {
    const quem = iniciadas.get(`capitulo_${camada}`) ?? [];
    assert.ok(quem.some((n) => NPCS[n].tipo === 'tecnico' && NPCS[n].camada === camada), `capitulo_${camada}`);
  }
  for (const id of Object.keys(MISSOES)) assert.ok(iniciadas.has(id), `${id}: ninguém inicia`);
});

test('missões: validador, capítulos e secundárias por camada, referências resolvem', () => {
  const usados = new Set();
  for (const q of Object.values(MISSOES)) {
    assert.deepEqual(validarMissao(q), [], q.id);
    assert.ok(LAYER_ORDER.includes(q.camada), q.id);
    assert.ok(Number.isFinite(q.recompensa.xp) && Number.isFinite(q.recompensa.ciclos), q.id);
    for (const r of q.recompensa.itens ?? []) assert.ok(ITENS[r.item], `${q.id}: recompensa ${r.item}`);
    const idsEtapa = new Set();
    for (const e of q.etapas) {
      assert.ok(!idsEtapa.has(e.id), `${q.id}: etapa repetida ${e.id}`);
      idsEtapa.add(e.id);
      usados.add(e.tipo);
      if (['falar', 'entregar'].includes(e.tipo)) assert.ok(NPCS[e.npc], `${q.id}/${e.id}: npc ${e.npc}`);
      if (['coletar', 'entregar'].includes(e.tipo)) assert.ok(ITENS[e.item] && e.qtd >= 1, `${q.id}/${e.id}: item ${e.item}`);
      if (e.tipo === 'derrotar') assert.ok(FALHAS[e.foe] && !FALHAS[e.foe].chefe && e.qtd >= 1, `${q.id}/${e.id}: foe ${e.foe}`);
      if (e.tipo === 'escanear') assert.ok(FALHAS[e.foe], `${q.id}/${e.id}: foe ${e.foe}`);
      if (e.tipo === 'chefe') assert.equal(FALHAS[e.chefe]?.chefe, true, `${q.id}/${e.id}: chefe ${e.chefe}`);
      if (e.tipo === 'chegar') assert.ok(LAYER_ORDER.includes(e.camada), `${q.id}/${e.id}: camada ${e.camada}`);
      if (e.tipo === 'reparar') assert.ok(e.qtd >= 1 && LAYER_ORDER.includes(e.camada), `${q.id}/${e.id}`);
    }
  }
  assert.deepEqual([...usados].sort(), [...TIPOS_ETAPA].sort(), 'todo tipo de etapa usado');

  LAYER_ORDER.forEach((camada, i) => {
    const cap = MISSOES[`capitulo_${camada}`];
    assert.ok(cap, `capitulo_${camada}`);
    assert.equal(cap.tipo, 'principal');
    assert.equal(cap.camada, camada);
    const chefe = chefes.find((c) => c.camada === camada);
    assert.ok(cap.etapas.some((e) => e.tipo === 'chefe' && e.chefe === chefe.id), `capitulo_${camada}: chefe`);
    const ultima = cap.etapas.at(-1);
    if (i < LAYER_ORDER.length - 1) assert.deepEqual([ultima.tipo, ultima.camada], ['chegar', LAYER_ORDER[i + 1]]);
    else assert.equal(ultima.tipo, 'chefe');
    for (const n of [1, 2]) {
      const sec = MISSOES[`secundaria_${camada}_${n}`];
      assert.ok(sec, `secundaria_${camada}_${n}`);
      assert.equal(sec.tipo, 'secundaria');
      assert.equal(sec.camada, camada);
    }
  });
  assert.equal(Object.keys(MISSOES).length, 24);
});

test('itens de missão entregues têm uma origem (diálogo, queda ou recompensa de chefe)', () => {
  const origens = new Set();
  for (const [, ef] of efeitosDialogo()) if (ef.tipo === 'item' && ef.acao === 'dar') origens.add(ef.id);
  for (const f of Object.values(FALHAS)) {
    for (const d of f.drops) origens.add(d.item);
    if (f.recompensa?.item) origens.add(f.recompensa.item);
  }
  for (const id of Object.keys(ITENS).filter((x) => x.startsWith('missao_'))) assert.ok(origens.has(id), `${id}: sem origem`);
});

// ---------------------------------------------------------------- Baús e lojas
test('baús: todas as camadas com 2 a 3 perfis válidos', () => {
  assert.deepEqual(Object.keys(LOOT).sort(), [...LAYER_ORDER].sort());
  for (const [camada, perfis] of Object.entries(LOOT)) {
    assert.ok(perfis.length >= 2 && perfis.length <= 3, camada);
    for (const p of perfis) {
      const [min, max] = p.ciclos;
      assert.ok(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max, camada);
      assert.ok(p.itens.length > 0, camada);
      for (const it of p.itens) {
        assert.ok(ITENS[it.item], `${camada}: ${it.item}`);
        assert.ok(it.qtd >= 1 && it.peso > 0, `${camada}: ${it.item}`);
      }
    }
  }
});

test('lojas: exatamente quatro, mercador da camada, itens existem', () => {
  assert.deepEqual(Object.keys(LOJAS).sort(), LOJAS_CAMADAS.map((c) => `loja_${c}`).sort());
  for (const l of Object.values(LOJAS)) {
    assert.ok(l.nome, l.id);
    const m = NPCS[l.mercador];
    assert.ok(m && m.tipo === 'mercador' && m.camada === l.camada, `${l.id}: mercador`);
    assert.ok(l.estoque.length > 0);
    for (const e of l.estoque) {
      assert.ok(ITENS[e.item], `${l.id}: ${e.item}`);
      assert.ok(e.estoque === null || (Number.isInteger(e.estoque) && e.estoque > 0), `${l.id}: ${e.item}`);
      if (e.preco !== undefined) assert.ok(Number.isInteger(e.preco) && e.preco > 0);
    }
    for (const t of l.compra) assert.ok(['material', 'equipamento', 'consumivel'].includes(t), l.id);
  }
});

test('cada camada tem baús, técnico, chefe e capítulo', () => {
  for (const camada of LAYER_ORDER) {
    assert.ok(LOOT[camada], camada);
    assert.ok(Object.values(NPCS).some((n) => n.camada === camada && n.tipo === 'tecnico'), camada);
    assert.ok(chefes.some((c) => c.camada === camada), camada);
    assert.ok(MISSOES[`capitulo_${camada}`], camada);
  }
});

// ---------------------------------------------------------------- Texto
test('textos curtos: descrições até 140 e falas até 220 caracteres', () => {
  const comDescricao = [ITENS, FALHAS, HABILIDADES, ATAQUES, NPCS, MISSOES];
  for (const obj of comDescricao) {
    for (const v of Object.values(obj)) assert.ok(v.descricao.length <= 140, `${v.id}: descrição com ${v.descricao.length}`);
  }
  for (const d of Object.values(DIALOGOS)) {
    for (const [nome, no] of Object.entries(d.nos)) assert.ok(no.fala.length <= 220, `${d.id}/${nome}: ${no.fala.length}`);
  }
});

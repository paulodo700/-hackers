// Tabelas de saque dos baús e textos de requisitos das passagens.
import { ITEMS } from './data/content.js';

// Cada baú entrega uma lista de [itemId, quantidade]
export const CHEST_LOOT = {
  cache_c1: [['pasta_termica', 1], ['capacitor', 1]],
  cache_c2: [['capsula_energia', 2]],
  cache_c3: [['lamina_solda', 1]],
  cache_c4: [['kit_solda', 1], ['pasta_termica', 1]],
  regs_c1: [['capacitor', 2]],
  regs_c2: [['escudo_dissipador', 1]],
  alu_c1: [['capsula_energia', 2], ['kit_solda', 1]],
  alu_c2: [['pinca_ressonante', 1]],
  alu_key: [['chave_forja', 1]],
  pipe_c1: [['capacitor', 1], ['pasta_termica', 1]],
  pipe_c2: [['capsula_energia', 1], ['kit_solda', 1]],
  pipe_c3: [['escudo_dissipador', 1]],
  mem_c1: [['pasta_termica', 2]],
  mem_c2: [['capsula_energia', 2]],
  mem_c3: [['capacitor', 2], ['kit_solda', 1]],
  core_selo: [['selo_vigia', 1]],
  mem_frag1: [['fragmento_memoria', 1]],
  mem_frag2: [['fragmento_memoria', 1]],
  mem_frag3: [['fragmento_memoria', 1]],
  bus_c1: [['kit_solda', 2], ['pasta_termica', 2]],
  bus_c2: [['capacitor', 1], ['escudo_dissipador', 1]],
  bus_c3: [['capsula_energia', 3]],
  bus_c4: [['pasta_termica', 3]],
};

// Descreve por que uma passagem está trancada
export function requirementText(req) {
  if (!req) return '';
  if (typeof req === 'string') {
    const map = {
      boss_sobrecarga: 'A Sobrecarga bloqueia a Forja. Derrote-a primeiro.',
      boss_ferrugem_titan: 'O Titã da Ferrugem bloqueia o barramento. Derrote-o primeiro.',
    };
    return map[req] || 'Algo ainda bloqueia esta passagem.';
  }
  if (req.count === 'collect_fragmento_memoria') return 'Faltam Fragmentos de Memória para abrir esta passagem.';
  return 'Esta passagem ainda está fechada.';
}

export function itemName(id) {
  return ITEMS[id]?.name || id;
}

// Tabela de saque por zona para os baús extras (gerados no mapa)
export const ZONE_LOOT = {
  cache: ['pasta_termica', 'capsula_energia', 'kit_solda', 'capacitor', 'lamina_solda'],
  regs: ['capacitor', 'pinca_ressonante', 'capsula_energia', 'cristal_silicio'],
  alu: ['kit_solda', 'liga_ferrugem', 'escudo_dissipador', 'capsula_energia'],
  pipeline: ['pasta_termica', 'capsula_energia', 'kit_solda', 'escudo_dissipador'],
  memory: ['capacitor', 'liga_ferrugem', 'pasta_termica', 'fio_cobre'],
  bus: ['kit_solda', 'escudo_dissipador', 'capsula_energia', 'pinca_ressonante'],
};

function hashId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Saque de um baú pelo id. Baús fixos usam CHEST_LOOT; baús extras (cx_<zona>_<c>_<r>) sorteiam da tabela da zona.
export function lootFor(id) {
  if (CHEST_LOOT[id]) return CHEST_LOOT[id];
  if (!id.startsWith('cx_')) return [];
  const zone = id.split('_')[1];
  const table = ZONE_LOOT[zone] || ['pasta_termica'];
  const h = hashId(id);
  const first = table[h % table.length];
  const second = table[(h >>> 8) % table.length];
  const out = [[first, 1 + ((h >>> 16) % 2)]];
  if (second !== first) out.push([second, 1]);
  return out;
}

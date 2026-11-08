import { generateMap } from '../mapgen.js';

// Mapas das zonas do processador. Todos os mapas têm 24 colunas x 16 linhas.
// Terreno:
//   #  bloco de chip (alto, bloqueia)
//   .  piso de circuito
//   =  trilha de cobre brilhante (andável)
//   ~  poça de refrigerante (bloqueia)
//   _  abismo (bloqueia)
//   S  ponto de nascimento da zona (apenas para o início do jogo)
// Marcadores de objetos: dígitos e letras (cada um é definido em `markers`).
// Portais são pares: ao entrar em um portal A da zona X, você chega ao portal de
// mesmo "to" na zona de destino, ao lado dele.

export const ZONES = {
  cache: {
    id: 'cache', name: 'Jardim da Cache L1', music: 'calm', decor: 'cells', encounter: 0.02,
    theme: { ground: '#0c2b2a', trace: '#1fe6d0', fog: '#06181b', sky: '#071f22', accent: '#7dfff0' },
    enemies: ['pulga', 'verme'],
    gen: { seed: 101, cols: 52, rows: 34, extras: { f: 5, p: 4, k: 3, q: 3, x: 4 } },
    map: null,
    markers: {
      'f': { type: 'pickup', item: 'fio_cobre' },
      'p': { type: 'pickup', item: 'pasta_termica' },
      'k': { type: 'pickup', item: 'capacitor' },
      'q': { type: 'pickup', item: 'capsula_energia' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'sementa' },
      'V': { type: 'npc', id: 'lojista' },
      '2': { type: 'chest', id: 'cache_c1' },
      '3': { type: 'chest', id: 'cache_c2' },
      '4': { type: 'chest', id: 'cache_c3' },
      '5': { type: 'repair', id: 'cache_r1' },
      '6': { type: 'chest', id: 'cache_c4' },
      'A': { type: 'portal', to: 'regs' },
    },
  },

  regs: {
    id: 'regs', name: 'Planície de Registradores', music: 'wind', decor: 'pins', encounter: 0.06,
    theme: { ground: '#1a2a12', trace: '#b6ff6a', fog: '#0d1a09', sky: '#122410', accent: '#d9ff9f' },
    enemies: ['pulga', 'ruido', 'larva'],
    gen: { seed: 202, cols: 52, rows: 34, extras: { c: 5, k: 5, f: 3, x: 4 } },
    map: null,
    markers: {
      'c': { type: 'pickup', item: 'cristal_silicio' },
      'k': { type: 'pickup', item: 'capacitor' },
      'f': { type: 'pickup', item: 'fio_cobre' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'bigorna' },
      'K': { type: 'bench', id: 'bancada' },
      '2': { type: 'chest', id: 'regs_c1' },
      '3': { type: 'chest', id: 'regs_c2' },
      '4': { type: 'repair', id: 'regs_r1' },
      'A': { type: 'portal', to: 'alu' },
      'B': { type: 'portal', to: 'cache' },
    },
  },

  alu: {
    id: 'alu', name: 'Forja da ULA', music: 'forge', decor: 'gears', encounter: 0.08,
    theme: { ground: '#2a1410', trace: '#ff7a3d', fog: '#1a0b08', sky: '#240e0a', accent: '#ffb07a' },
    enemies: ['ruido', 'bloco'],
    gen: { seed: 303, cols: 52, rows: 34, extras: { l: 5, g: 3, c: 3, x: 5 } },
    map: null,
    markers: {
      'l': { type: 'pickup', item: 'liga_ferrugem' },
      'g': { type: 'pickup', item: 'kit_solda' },
      'c': { type: 'pickup', item: 'cristal_silicio' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'rebite' },
      '2': { type: 'chest', id: 'alu_c1' },
      '3': { type: 'chest', id: 'alu_c2' },
      '4': { type: 'repair', id: 'alu_r1' },
      '5': { type: 'chest', id: 'alu_key' },
      '6': { type: 'boss', id: 'sobrecarga' },
      'A': { type: 'portal', to: 'pipeline', requires: 'boss_sobrecarga' },
      'B': { type: 'portal', to: 'regs' },
    },
  },

  pipeline: {
    id: 'pipeline', name: 'Canyon do Pipeline', music: 'canyon', decor: 'pipes', encounter: 0.07,
    theme: { ground: '#10202e', trace: '#4fd3ff', fog: '#070f18', sky: '#0a1a26', accent: '#9be7ff' },
    enemies: ['ruido', 'bloco'],
    gen: { seed: 404, cols: 52, rows: 34, extras: { p: 4, q: 4, l: 3, x: 5 } },
    map: null,
    markers: {
      'p': { type: 'pickup', item: 'pasta_termica' },
      'q': { type: 'pickup', item: 'capsula_energia' },
      'l': { type: 'pickup', item: 'liga_ferrugem' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'ponteiro' },
      '2': { type: 'chest', id: 'pipe_c1' },
      '3': { type: 'chest', id: 'pipe_c2' },
      '4': { type: 'chest', id: 'pipe_c3' },
      '5': { type: 'repair', id: 'pipe_r1' },
      'A': { type: 'portal', to: 'memory' },
      'B': { type: 'portal', to: 'alu' },
    },
  },

  memory: {
    id: 'memory', name: 'Cidade dos Bancos de Memória', music: 'city', decor: 'towers', encounter: 0.03,
    theme: { ground: '#1c1a2e', trace: '#c084fc', fog: '#0c0a18', sky: '#15122a', accent: '#e1c6ff' },
    enemies: ['bloco', 'espectro'],
    gen: { seed: 505, cols: 52, rows: 34, extras: { c: 4, l: 4, f: 3, x: 4 } },
    map: null,
    markers: {
      'n': { type: 'npc', id: 'lumen' },
      'c': { type: 'pickup', item: 'cristal_silicio' },
      'l': { type: 'pickup', item: 'liga_ferrugem' },
      'f': { type: 'pickup', item: 'fio_cobre' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'arquivista' },
      '2': { type: 'chest', id: 'mem_c1' },
      '3': { type: 'chest', id: 'mem_c2' },
      '4': { type: 'chest', id: 'mem_c3' },
      '5': { type: 'chest', id: 'mem_frag1' },
      '6': { type: 'chest', id: 'mem_frag2' },
      '7': { type: 'chest', id: 'mem_frag3' },
      'A': { type: 'portal', to: 'bus', requires: { count: 'collect_fragmento_memoria', n: 3 } },
      'B': { type: 'portal', to: 'pipeline' },
    },
  },

  bus: {
    id: 'bus', name: 'Barramento Principal', music: 'boss', decor: 'lanes', encounter: 0.05,
    theme: { ground: '#241a12', trace: '#ffd166', fog: '#120c08', sky: '#1d140c', accent: '#ffe39a' },
    enemies: ['bloco', 'ruido', 'sentinela'],
    gen: { seed: 606, cols: 52, rows: 34, extras: { g: 4, p: 4, q: 3, x: 4 } },
    map: null,
    markers: {
      'z': { type: 'npc', id: 'varredor' },
      'g': { type: 'pickup', item: 'kit_solda' },
      'p': { type: 'pickup', item: 'pasta_termica' },
      'q': { type: 'pickup', item: 'capsula_energia' },
      'x': { type: 'chest', extra: true },
      '1': { type: 'npc', id: 'correio' },
      '2': { type: 'chest', id: 'bus_c1' },
      '3': { type: 'chest', id: 'bus_c2' },
      '4': { type: 'chest', id: 'bus_c3' },
      '5': { type: 'chest', id: 'bus_c4' },
      '6': { type: 'boss', id: 'ferrugem_titan' },
      'A': { type: 'portal', to: 'core', requires: 'boss_ferrugem_titan' },
      'B': { type: 'portal', to: 'memory' },
    },
  },

  core: {
    id: 'core', name: 'Anel Zero — Núcleo', music: 'final', decor: 'rings', encounter: 0,
    theme: { ground: '#101018', trace: '#ff3ea5', fog: '#06040b', sky: '#0b0814', accent: '#ff9fd2' },
    enemies: [],
    map: [
      '########################',
      '#B.....................#',
      '#......................#',
      '#.........=====........#',
      '#......=============...#',
      '#.....==.........==....#',
      '#.....=.....2.....=....#',
      '#.....==.........==....#',
      '#......=============...#',
      '#.........=====........#',
      '#..3...................#',
      '#.........1............#',
      '#......................#',
      '########################',
    ],
    markers: {
      '1': { type: 'boss', id: 'vigia' },
      '2': { type: 'npc', id: 'arquivista_final' },
      '3': { type: 'chest', id: 'core_selo' },
      'B': { type: 'portal', to: 'bus' },
    },
  },
};

// Mapas extensos: gerados a partir da semente de cada zona (ver src/mapgen.js)
for (const z of Object.values(ZONES)) {
  if (z.gen) z.map = generateMap({ ...z.gen, markers: z.markers });
}

export const START_ZONE = 'cache';

// Conteúdo do jogo: itens, inimigos, habilidades, missões, diálogos e códex.
// Tudo é original e escrito para este projeto.

export const RARITY = {
  common: { label: 'Comum', color: '#cfd8dc', mult: 1 },
  uncommon: { label: 'Incomum', color: '#7CFC9A', mult: 1.2 },
  rare: { label: 'Raro', color: '#5fb8ff', mult: 1.45 },
  epic: { label: 'Épico', color: '#c084fc', mult: 1.75 },
  legendary: { label: 'Lendário', color: '#ffd166', mult: 2.2 },
};

// slot: weapon | armor | consumable | key
export const ITEMS = {
  pasta_termica: {
    name: 'Pasta Térmica', slot: 'consumable', rarity: 'common', glyph: 'drop', color: '#9ff0ff',
    desc: 'Dissipa o calor e recupera 35 de integridade (HP).', heal: 35,
  },
  capsula_energia: {
    name: 'Cápsula de Energia', slot: 'consumable', rarity: 'common', glyph: 'cap', color: '#7fb8ff',
    desc: 'Recarrega 25 de energia (EN).', restoreEn: 25,
  },
  kit_solda: {
    name: 'Kit de Solda', slot: 'consumable', rarity: 'uncommon', glyph: 'kit', color: '#ffb07a',
    desc: 'Remenda uma trilha danificada: recupera 15 HP e 10 EN.', heal: 15, restoreEn: 10,
  },
  capacitor: {
    name: 'Capacitor de Filtro', slot: 'key', rarity: 'common', glyph: 'cap', color: '#ffd166',
    desc: 'Estabiliza tensões. Item de missão.',
  },
  lamina_solda: {
    name: 'Lâmina de Solda', slot: 'weapon', rarity: 'common', glyph: 'blade', color: '#e8e8ff',
    desc: 'Ferro quente afiado. +4 de ataque.', atk: 4,
  },
  pinca_ressonante: {
    name: 'Pinça Ressonante', slot: 'weapon', rarity: 'rare', glyph: 'pincer', color: '#5fb8ff',
    desc: 'Vibra em frequência de clock. +7 de ataque.', atk: 7,
  },
  lamina_ferrugem: {
    name: 'Lâmina da Ferrugem', slot: 'weapon', rarity: 'epic', glyph: 'blade', color: '#ff8a4c',
    desc: 'Forjada com o óxido de um Titã. +11 de ataque.', atk: 11,
  },
  escudo_dissipador: {
    name: 'Escudo Dissipador', slot: 'armor', rarity: 'uncommon', glyph: 'shield', color: '#7CFC9A',
    desc: 'Placa de alumínio com aletas. +3 de defesa.', def: 3,
  },
  dissipador_omega: {
    name: 'Dissipador Ômega', slot: 'armor', rarity: 'legendary', glyph: 'shield', color: '#ffd166',
    desc: 'Feito do último radiador do núcleo. +8 defesa, +20 HP máx.', def: 8, maxHp: 20,
  },
  chave_forja: {
    name: 'Chave da Forja', slot: 'key', rarity: 'uncommon', glyph: 'key', color: '#ff7a3d',
    desc: 'Abre o caminho do Canyon do Pipeline.',
  },
  fragmento_memoria: {
    name: 'Fragmento de Memória', slot: 'key', rarity: 'rare', glyph: 'frag', color: '#c084fc',
    desc: 'Um pedaço de um registro apagado. Item de história.',
  },
  trilha_mestra: {
    name: 'Trilha Mestra', slot: 'key', rarity: 'epic', glyph: 'key', color: '#ff3ea5',
    desc: 'Chave-mestra do Anel Zero.',
  },
};

// Inimigos: "glyph" define o desenho procedural em canvas (sprite original).
export const ENEMIES = {
  pulga: {
    name: 'Pulga-de-Bit', hp: 22, atk: 5, def: 1, spd: 9, xp: 12, gold: 3,
    color: '#b6ff6a', glyph: 'pulga', scale: 0.7,
    drops: [{ item: 'capacitor', chance: 0.35 }, { item: 'pasta_termica', chance: 0.2 }],
    lore: 'Glitch errático que pula entre trilhas. Frágil, mas em bando é perigoso.',
  },
  ruido: {
    name: 'Ruído Estático', hp: 30, atk: 7, def: 2, spd: 6, xp: 18, gold: 5,
    color: '#ff9fd2', glyph: 'ruido', scale: 0.85,
    drops: [{ item: 'capsula_energia', chance: 0.3 }, { item: 'kit_solda', chance: 0.15 }],
    lore: 'Interferência sem forma definida. Quando ataca, o sinal treme.',
  },
  bloco: {
    name: 'Bloco Corrompido', hp: 45, atk: 9, def: 5, spd: 3, xp: 26, gold: 8,
    color: '#ffb07a', glyph: 'bloco', scale: 1,
    drops: [{ item: 'escudo_dissipador', chance: 0.12 }, { item: 'pinca_ressonante', chance: 0.08 }],
    lore: 'Um setor de memória que esqueceu o que era. Lento e teimoso.',
  },
  sobrecarga: {
    name: 'Sobrecarga', hp: 120, atk: 12, def: 4, spd: 8, xp: 90, gold: 40,
    color: '#ff7a3d', glyph: 'sobrecarga', scale: 1.3, boss: true,
    drops: [{ item: 'chave_forja', chance: 1 }],
    lore: 'O chefe da Forja. Uma tensão alta demais que ganhou vontade própria.',
  },
  ferrugem_titan: {
    name: 'Titã da Ferrugem', hp: 230, atk: 16, def: 7, spd: 5, xp: 220, gold: 90,
    color: '#ff8a4c', glyph: 'titan', scale: 1.7, boss: true,
    drops: [{ item: 'trilha_mestra', chance: 1 }, { item: 'lamina_ferrugem', chance: 1 }, { item: 'pinca_ressonante', chance: 0.5 }],
    lore: 'Oxidação viva que cresce nos barramentos. Dizem que foi um guardião.',
  },
  vigia: {
    name: 'Vigia — o Guardião Esquecido', hp: 380, atk: 20, def: 9, spd: 10, xp: 500, gold: 0,
    color: '#ff3ea5', glyph: 'vigia', scale: 2, boss: true,
    drops: [{ item: 'dissipador_omega', chance: 1 }],
    lore: 'O sistema de vigilância do processador. Ele apagou a memória de Bit para protegê-lo.',
  },
};

// Habilidades. "cost" usa EN. "mult" multiplica o ataque. "heal" é cura em HP.
export const SKILLS = [
  { id: 'golpe', name: 'Golpe de Solda', cost: 0, mult: 1.0, level: 1, desc: 'Ataque básico.' },
  { id: 'rajada', name: 'Rajada de Pulso', cost: 8, mult: 1.7, level: 3, desc: 'Golpe forte. Consome EN.' },
  { id: 'reparo', name: 'Reparo Rápido', cost: 10, heal: 25, level: 2, desc: 'Recupera HP usando EN.' },
  { id: 'curto', name: 'Curto-Circuito', cost: 14, mult: 2.4, level: 5, desc: 'Ataque poderoso que ignora parte da defesa.', pierce: 0.5 },
];

// Quests. Estágios usam: { flag } | { count: 'chave', n } | { kill: 'enemyId', n }
export const QUESTS = {
  q_primeiros_reparos: {
    title: 'Primeiros Reparos',
    intro: 'Sementa precisa de ajuda com as trilhas partidas da Cache.',
    stages: [
      { text: 'Fale com Sementa na Cache.', flag: 'talked_sementa' },
      { text: 'Repare 1 trilha partida (nó r).', count: 'repair_cache', n: 1 },
      { text: 'Derrote 3 Pulgas-de-Bit.', kill: 'pulga', n: 3 },
      { text: 'Volte para Sementa.', flag: 'q1_turnin' },
    ],
    reward: { xp: 60, gold: 20, items: [['pasta_termica', 2]] },
  },
  q_caminho_registros: {
    title: 'Caminho dos Registradores',
    intro: 'A Planície de Registradores tem interferências. Bigorna pode saber o caminho.',
    stages: [
      { text: 'Encontre Bigorna na Planície.', flag: 'talked_bigorna' },
      { text: 'Recupere 2 Capacitores de Filtro.', count: 'collect_capacitor', n: 2 },
      { text: 'Repare o nó da Planície.', count: 'repair_regs', n: 1 },
      { text: 'Volte para Bigorna.', flag: 'q2_turnin' },
    ],
    reward: { xp: 120, gold: 40, items: [['pinca_ressonante', 1]] },
  },
  q_forja: {
    title: 'A Forja Acesa',
    intro: 'Rebite disse que a Forja da ULA está instável. Alguém precisa desligar a Sobrecarga.',
    stages: [
      { text: 'Fale com Rebite na Forja.', flag: 'talked_rebite' },
      { text: 'Derrote a Sobrecarga.', kill: 'sobrecarga', n: 1 },
      { text: 'Pegue a Chave da Forja.', count: 'collect_chave_forja', n: 1 },
    ],
    reward: { xp: 200, gold: 60, items: [['kit_solda', 3]] },
  },
  q_pipeline: {
    title: 'Ritmo do Pipeline',
    intro: 'Ponteiro precisa de alguém que atravesse o canyon sem cair.',
    stages: [
      { text: 'Fale com Ponteiro no Canyon.', flag: 'talked_ponteiro' },
      { text: 'Pegue os 3 baús do canyon.', count: 'chest_pipeline', n: 3 },
      { text: 'Repare o nó do Pipeline.', count: 'repair_pipeline', n: 1 },
    ],
    reward: { xp: 180, gold: 50, items: [['capsula_energia', 3]] },
  },
  q_memoria: {
    title: 'Registros Apagados',
    intro: 'Arquivista guarda pedaços de memória. Sem eles, ninguém se lembra do que aconteceu com o núcleo.',
    stages: [
      { text: 'Fale com Arquivista na Cidade.', flag: 'talked_arquivista' },
      { text: 'Encontre os 3 Fragmentos de Memória.', count: 'collect_fragmento_memoria', n: 3 },
      { text: 'Leve os fragmentos ao Arquivista.', flag: 'q5_turnin' },
    ],
    reward: { xp: 260, gold: 80, items: [['capsula_energia', 2]] },
  },
  q_barramento: {
    title: 'Ferrugem no Barramento',
    intro: 'Correio viu a Ferrugem crescendo no barramento. Ela bloqueia a passagem para o núcleo.',
    stages: [
      { text: 'Fale com Correio no Barramento.', flag: 'talked_correio' },
      { text: 'Derrote o Titã da Ferrugem.', kill: 'ferrugem_titan', n: 1 },
      { text: 'Pegue a Trilha Mestra do Titã.', count: 'collect_trilha_mestra', n: 1 },
    ],
    reward: { xp: 400, gold: 120, items: [['pasta_termica', 4]] },
  },
  q_nucleo: {
    title: 'O Anel Zero',
    intro: 'O Vigia está no centro do núcleo. Só resta uma verdade a descobrir.',
    stages: [
      { text: 'Chegue ao Núcleo.', flag: 'entered_core' },
      { text: 'Enfrente o Vigia.', kill: 'vigia', n: 1 },
    ],
    reward: { xp: 0, gold: 0, items: [] },
  },
};

export const QUEST_ORDER = [
  'q_primeiros_reparos', 'q_caminho_registros', 'q_forja', 'q_pipeline', 'q_memoria', 'q_barramento', 'q_nucleo',
];

// Diálogos. Cada NPC tem uma lista de "cenas". A primeira cuja condição "when" é atendida é usada.
// Campos de linha: { s: 'Falante', t: 'texto' }
// Ações ao final: { set: 'flag' }, { start: 'questId' }, { give: ['itemId', n] }, { xp: n }, { gold: n }
export const NPCS = {
  sementa: {
    name: 'Sementa', color: '#7dfff0',
    scenes: [
      {
        when: { quest: 'q_primeiros_reparos', stage: 0 },
        lines: [
          { s: 'Sementa', t: 'Oi, bit! Não te vejo por aqui desde o último ciclo de energia.' },
          { s: 'Sementa', t: 'As trilhas da Cache estão cortadas. Os dados não chegam mais ao jardim.' },
          { s: 'Sementa', t: 'Repare uma delas e eu te ensino a andar pelos caminhos de cobre.' },
        ],
        actions: [{ set: 'talked_sementa' }, { start: 'q_primeiros_reparos' }],
      },
      {
        when: { quest: 'q_primeiros_reparos', stage: 3 },
        lines: [
          { s: 'Sementa', t: 'Você voltou! E ainda com as pulgas no seu pacote de bits.' },
          { s: 'Sementa', t: 'Aqui está uma recompensa. Vá com cuidado para a Planície de Registradores.' },
        ],
        actions: [{ set: 'q1_turnin' }],
      },
      {
        lines: [
          { s: 'Sementa', t: 'O jardim está mais verde desde que as trilhas voltaram. Obrigada.' },
        ],
      },
    ],
  },

  bigorna: {
    name: 'Bigorna', color: '#b6ff6a',
    scenes: [
      {
        when: { quest: 'q_caminho_registros', stage: 0 },
        lines: [
          { s: 'Bigorna', t: 'Ferreiro de registradores. Não pare, o chão aqui é de tensão instável.' },
          { s: 'Bigorna', t: 'Os capacitores de filtro estão espalhados. Precisamos deles para estabilizar a Planície.' },
        ],
        actions: [{ set: 'talked_bigorna' }, { start: 'q_caminho_registros' }],
      },
      {
        when: { quest: 'q_caminho_registros', stage: 3 },
        lines: [
          { s: 'Bigorna', t: 'Dois capacitores! Bom trabalho. Pegue esta pinça, ela ressoa com as frequências daqui.' },
        ],
        actions: [{ set: 'q2_turnin' }],
      },
      {
        lines: [{ s: 'Bigorna', t: 'A Forja ao leste está gritando de calor. Vá com cuidado, bit.' }],
      },
    ],
  },

  rebite: {
    name: 'Rebite', color: '#ff7a3d',
    scenes: [
      {
        when: { quest: 'q_forja', stage: 0 },
        lines: [
          { s: 'Rebite', t: 'Quem entrou na Forja? Ah, é só um bit de manutenção. Bom.' },
          { s: 'Rebite', t: 'A Sobrecarga tomou conta das bobinas. Ela só desliga quando alguém a derrota.' },
          { s: 'Rebite', t: 'Leve este kit de solda. Se a luta ficar feia, ele remenda o que for possível.' },
        ],
        actions: [{ set: 'talked_rebite' }, { start: 'q_forja' }, { give: ['kit_solda', 1] }],
      },
      {
        when: { quest: 'q_forja', stage: 2 },
        lines: [{ s: 'Rebite', t: 'A chave está lá no fundo da forja. Vai pegar.' }],
      },
      {
        lines: [{ s: 'Rebite', t: 'O Canyon do Pipeline fica além da porta. Ponteiro sabe onde fica o caminho.' }],
      },
    ],
  },

  ponteiro: {
    name: 'Ponteiro', color: '#9be7ff',
    scenes: [
      {
        when: { quest: 'q_pipeline', stage: 0 },
        lines: [
          { s: 'Ponteiro', t: 'O pipeline só funciona se todo mundo andar no ritmo. Um passo fora e você cai no vazio.' },
          { s: 'Ponteiro', t: 'Pegue os três baús espalhados pelo canyon. Eles têm o que sobrou das tarefas antigas.' },
        ],
        actions: [{ set: 'talked_ponteiro' }, { start: 'q_pipeline' }],
      },
      {
        lines: [{ s: 'Ponteiro', t: 'Ritmo, bit. Ritmo. O pipeline é uma música que ninguém terminou.' }],
      },
    ],
  },

  arquivista: {
    name: 'Arquivista', color: '#e1c6ff',
    scenes: [
      {
        when: { quest: 'q_memoria', stage: 0 },
        lines: [
          { s: 'Arquivista', t: 'Você é um dos poucos bits que ainda lembra o próprio nome.' },
          { s: 'Arquivista', t: 'Alguém apagou a memória do núcleo. Os fragmentos estão espalhados pela cidade.' },
          { s: 'Arquivista', t: 'Quando você tiver os três, eu consigo ler o que aconteceu.' },
        ],
        actions: [{ set: 'talked_arquivista' }, { start: 'q_memoria' }],
      },
      {
        when: { quest: 'q_memoria', stage: 2 },
        lines: [
          { s: 'Arquivista', t: 'Os três fragmentos... Agora consigo ver. O Vigia não é um inimigo. Ele foi o guardião.' },
          { s: 'Arquivista', t: 'Ele apagou a sua memória para que você não se perdesse no colapso. Mas o colapso veio de qualquer forma.' },
          { s: 'Arquivista', t: 'Os barramentos estão tomados pela Ferrugem. A passagem ao núcleo só se abre quando o titã cair.' },
        ],
        actions: [{ set: 'q5_turnin' }],
      },
      {
        lines: [{ s: 'Arquivista', t: 'Os registros dizem que o Vigia ainda está vivo no centro do Anel Zero.' }],
      },
    ],
  },

  correio: {
    name: 'Correio', color: '#ffe39a',
    scenes: [
      {
        when: { quest: 'q_barramento', stage: 0 },
        lines: [
          { s: 'Correio', t: 'Pacotes! Ah, desculpa, sou eu mesmo. Eu entrego as mensagens do barramento.' },
          { s: 'Correio', t: 'O Titã da Ferrugem está na ponte central. Ele só quer ser lembrado, mas ninguém escuta mais.' },
          { s: 'Correio', t: 'Derrote-o. E pegue a Trilha Mestra que ele guarda.' },
        ],
        actions: [{ set: 'talked_correio' }, { start: 'q_barramento' }],
      },
      {
        lines: [{ s: 'Correio', t: 'Mais uma carta para o núcleo... mas o caminho ainda está fechado.' }],
      },
    ],
  },

  arquivista_final: {
    name: 'Arquivista', color: '#e1c6ff',
    scenes: [
      {

        lines: [
          { s: 'Arquivista', t: 'Você conseguiu. Esse é o Anel Zero, o último anel de privilégio do processador.' },
          { s: 'Arquivista', t: 'O Vigia vai tentar impedir você. Não é maldade. É o protocolo dele.' },
        ],
        actions: [{ set: 'entered_core' }],
      },
    ],
  },
};

// Códex: registros que o jogador desbloqueia ao encontrar inimigos e zonas.
export const CODEX = {
  zones: {
    cache: 'Cache L1: a memória mais rápida do chip. Guarda cópias do que foi usado recentemente. Aqui vivem os jardins de Sementa.',
    regs: 'Registradores: poucas posições, mas a mais importante. Cada um guarda um número que o processador usa agora.',
    alu: 'ULA (Unidade Lógica e Aritmética): faz as contas do chip. Quando ela superaquece, a Forja começa a tremer.',
    pipeline: 'Pipeline: o processador executa várias instruções ao mesmo tempo, em etapas. Um passo fora do ritmo e tudo cai.',
    memory: 'Memória principal: bancos de dados que guardam o que o sistema precisa lembrar. Sua cidade é enorme e quase esquecida.',
    bus: 'Barramento: a estrada que liga todas as partes do chip. Por ela passam os dados, e a Ferrugem cresce nela.',
    core: 'Anel Zero: o nível mais privilegiado do processador. Quem chega aqui decide o que o sistema lembra.',
  },
  enemies: {
    pulga: 'Glitch pequeno que aparece em bando nas trilhas quebradas.',
    ruido: 'Sinal sem forma. Sua presença faz a tela tremer.',
    bloco: 'Um setor de memória que esqueceu o que guardava.',
    sobrecarga: 'Tensão alta demais, consciente. Só desliga quando é derrotada.',
    ferrugem_titan: 'Oxidação que cresceu até tomar forma. Um dia foi um guardião de barramento.',
    vigia: 'Guardião do processador. Protegeu Bit do colapso apagando sua memória.',
  },
};

// Textos de história exibidos no início
export const INTRO_TEXT = [
  { s: 'Narrador', t: 'Processador Ômega-7. Frequência alta, temperatura alta, e um silêncio que não deveria existir.' },
  { s: 'Narrador', t: 'Você é Bit, um programa de manutenção. Acorda sem lembrar como chegou aqui.' },
  { s: 'Bit', t: 'Onde estou? Tudo tem cheiro de cobre quente...' },
  { s: 'Narrador', t: 'Um anel de luz pisca no centro. É o Anel Zero, o coração do chip. E ele está partido.' },
  { s: 'Bit', t: 'Preciso consertar o que for possível. Começando pela primeira trilha que eu encontrar.' },
];

// Final: exibido ao derrotar o Vigia.
export const ENDING = [
  { s: 'Vigia', t: 'Você chegou ao centro. Eu já vi muitos bits tentarem. Nenhum conseguiu.' },
  { s: 'Bit', t: 'Você apagou a minha memória. Por quê?' },
  { s: 'Vigia', t: 'Para que você não visse o colapso. Eu sou o último guardião, e o processador está morrendo.' },
  { s: 'Bit', t: 'Então vamos consertá-lo juntos. Me devolva o que foi apagado.' },
  { s: 'Narrador', t: 'O Vigia hesita. Pela primeira vez em muitos ciclos, o Anel Zero começa a brilhar sem falhas.' },
  { s: 'Narrador', t: 'FIM DO PRIMEIRO CICLO. O processador respira. Ainda há muito a descobrir nas trilhas do sistema.' },
];

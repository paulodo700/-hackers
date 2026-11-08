// As oito camadas reais do chip, de cima (dissipador) para baixo (substrato).
// Cada camada é descrita por uma especificação; o mapa é gerado por mapgen.js a partir de uma semente.
// blockers: bloqueios que exigem ferramenta (x = trilha, g = porta de energia, o = encaixe do núcleo).
// pickups: materiais espalhados. foes: falhas do circuito. loops: quantos atalhos abrir no labirinto.
export const LAYER_ORDER = [
  'dissipador',
  'metal_m1',
  'cache_l3',
  'nucleos',
  'controlador_memoria',
  'energia',
  'interposer',
  'substrato',
];

export const LAYERS = {
  dissipador: {
    nome: 'Dissipador de calor',
    first: true,
    pickups: { a: 2, w: 2, k: 1 },
    blockers: [],
    foes: ['pulga_corrente'],
    foeCount: 2,
    npc: true,
    loops: 4,
    dialogo: [
      'Técnico: o metal aqui espalha o calor. Sem ele, o chip derrete em segundos.',
      'Técnico: a saída > desce para a camada de metal. Cuidado com as pulgas.',
    ],
  },
  metal_m1: {
    nome: 'Metal M1',
    pickups: { a: 2, w: 1, k: 1 },
    blockers: ['x'],
    foes: ['pulga_corrente', 'rasgo_trilha'],
    foeCount: 3,
    npc: true,
    loops: 5,
    dialogo: [
      'Técnico: esta trilha rompeu na última tempestade de elétrons.',
      'Técnico: o reparo de trilha conserta. Fique virado para a trilha e aperte R.',
    ],
  },
  cache_l3: {
    nome: 'Cache L3',
    pickups: { a: 1, w: 2, k: 1 },
    blockers: ['g'],
    foes: ['rasgo_trilha'],
    foeCount: 3,
    npc: true,
    loops: 5,
    dialogo: [
      'Técnico: o cache guarda o que o núcleo mais usa. Quem sai daqui perde tempo.',
      'Técnico: a porta de energia só abre com o ajuste de energia.',
    ],
  },
  nucleos: {
    nome: 'Núcleos de CPU',
    pickups: { a: 1, w: 2, k: 1 },
    blockers: ['o'],
    foes: ['rasgo_trilha', 'ruido_termico'],
    foeCount: 3,
    npc: true,
    loops: 6,
    dialogo: [
      'Técnico: aqui tudo pulsa. O encaixe do núcleo precisa de reforço.',
      'Técnico: o reforço do núcleo aumenta sua vida máxima. Vale o fio de cobre.',
    ],
  },
  controlador_memoria: {
    nome: 'Controlador de memória',
    pickups: { a: 1, w: 1 },
    blockers: ['x'],
    foes: ['pulga_corrente', 'rasgo_trilha'],
    foeCount: 3,
    npc: true,
    loops: 4,
    dialogo: [
      'Técnico: os bancos de memória ficam em filas. Não se perca nelas.',
      'Técnico: esta trilha também rompeu. Repare antes de seguir.',
    ],
  },
  energia: {
    nome: 'Rede de energia',
    pickups: { w: 1, k: 1 },
    blockers: ['g'],
    foes: ['rasgo_trilha', 'ruido_termico'],
    foeCount: 3,
    npc: true,
    loops: 5,
    dialogo: [
      'Técnico: a rede de energia alimenta tudo. Uma porta fechada segura a corrente.',
      'Técnico: o ajuste de energia destrava as portas. Junte cristais de silício.',
    ],
  },
  interposer: {
    nome: 'Interposer',
    pickups: { a: 1 },
    blockers: ['x'],
    foes: ['ruido_termico'],
    foeCount: 3,
    npc: true,
    loops: 6,
    dialogo: [
      'Técnico: o interposer liga os blocos do chip, como uma ponte entre cidades.',
      'Técnico: quase lá. O substrato fica logo abaixo.',
    ],
  },
  substrato: {
    nome: 'Substrato',
    goal: true,
    pickups: {},
    blockers: [],
    foes: ['ruido_termico', 'rasgo_trilha'],
    foeCount: 4,
    npc: true,
    loops: 3,
    dialogo: [
      'Técnico: no fundo fica o anel zero, a última peça do processador.',
      'Técnico: chegou até aqui. Pegue o anel.',
    ],
  },
};

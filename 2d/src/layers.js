// Configuração das oito camadas. Cada uma vira um mapa gerado por semente (mapgen.js).
// pickups: materiais por caractere; blockers: ferramentas que bloqueiam; enemies: [falha, quantidade];
// baus: baús; quentes/frias: zonas de calor; chave: se há uma chave do núcleo no mapa.
// Os técnicos e mercadores vêm do catálogo de dados (NPCS), porque a quantidade depende deles.
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
    nome: 'Dissipador de calor', first: true, pickups: { a: 2, w: 2, k: 1 }, blockers: [],
    enemies: [['pulga_corrente', 2], ['ruido_termico', 1]], loops: 4, baus: 2, quentes: 3, frias: 2, chave: true,
    tema: { fundo: '#07090d', chao: '#101b24', parede: '#1d2a36', destaque: '#f29b4a' },
  },
  metal_m1: {
    nome: 'Metal M1', pickups: { a: 2, w: 1, k: 1 }, blockers: ['x'],
    enemies: [['pulga_corrente', 2], ['rasgo_trilha', 2]], loops: 5, baus: 1, quentes: 2, frias: 1, chave: true,
    tema: { fundo: '#070b0a', chao: '#0f1c1a', parede: '#1c3a35', destaque: '#c9854a' },
  },
  cache_l3: {
    nome: 'Cache L3', pickups: { a: 1, w: 2, k: 1 }, blockers: ['g'],
    enemies: [['rasgo_trilha', 2], ['fantasma_de_cache', 2]], loops: 5, baus: 2, quentes: 0, frias: 2, chave: true,
    tema: { fundo: '#080a12', chao: '#131a2a', parede: '#26324d', destaque: '#7dd3fc' },
  },
  nucleos: {
    nome: 'Núcleos de CPU', pickups: { a: 1, w: 2, k: 1, p: 1 }, blockers: ['o'],
    enemies: [['ruido_termico', 2], ['sobrecarga_termica', 2]], loops: 6, baus: 1, quentes: 3, frias: 1, chave: true,
    tema: { fundo: '#0c0708', chao: '#1f1416', parede: '#3b2226', destaque: '#ff6b5a' },
  },
  controlador_memoria: {
    nome: 'Controlador de memória', pickups: { a: 1, w: 1, m: 1 }, blockers: ['x'],
    enemies: [['fantasma_de_cache', 2], ['glitch_de_pipeline', 2]], loops: 4, baus: 1, quentes: 0, frias: 2, chave: true,
    tema: { fundo: '#080a0d', chao: '#14181f', parede: '#2b3340', destaque: '#a3e635' },
  },
  energia: {
    nome: 'Rede de energia', pickups: { w: 1, k: 1, p: 1 }, blockers: ['g'],
    enemies: [['vazamento_corrente', 2], ['pico_de_tensao', 2]], loops: 5, baus: 2, quentes: 2, frias: 1, chave: true,
    tema: { fundo: '#0a0a05', chao: '#1d1c0f', parede: '#3d3a17', destaque: '#ffd166' },
  },
  interposer: {
    nome: 'Interposer', pickups: { a: 1, m: 1 }, blockers: ['x'],
    enemies: [['eletromigracao', 2], ['glitch_de_pipeline', 1], ['bit_corrompido', 1]], loops: 6, baus: 1, quentes: 0, frias: 2, chave: true,
    tema: { fundo: '#070910', chao: '#101626', parede: '#1f2a44', destaque: '#8ea8ff' },
  },
  substrato: {
    nome: 'Substrato', goal: true, pickups: { p: 1, m: 1 }, blockers: [],
    enemies: [['bit_corrompido', 2], ['sobrecarga_termica', 2]], loops: 3, baus: 2, quentes: 2, frias: 2, chave: true,
    tema: { fundo: '#040406', chao: '#0b0b10', parede: '#1a1a24', destaque: '#c084fc' },
  },
};

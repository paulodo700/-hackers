// Geometria da tela (960 x 720) num só lugar: área do mapa, painel lateral, barra inferior com as orbes e a
// arena de combate. Só constantes; nenhum desenho acontece aqui.
export const W = 960;
export const H = 720;
export const TILE = 32;

export const VISAO = { x: 0, y: 40, w: 800, h: 448 };
export const PAINEL = { x: 800, y: 40, w: 160, h: 448 };
export const BARRA = { x: 0, y: 488, w: 960, h: 232 };
export const ORBE_VIDA = { x: 116, y: 606, r: 62 };
export const ORBE_ENERGIA = { x: 844, y: 606, r: 62 };
export const CENTRO = { x: 200, y: 500, w: 560, h: 212 };

// Arena de combate, desenhada por cima da área do mapa.
export const ARENA = { x: VISAO.x + 40, y: VISAO.y + 16, w: VISAO.w - 80, h: 344 };

// Onde nascem os números e faíscas da batalha: acima da cabeça de cada combatente.
export const PONTO_ARENA = {
  jogador: { x: ARENA.x + 170, y: ARENA.y + 150 },
  inimigo: { x: ARENA.x + ARENA.w - 170, y: ARENA.y + 120 },
};

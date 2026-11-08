// Legenda das células do mapa. Sem DOM: a lógica e o gerador usam estas constantes.
export const WALL = '#';        // parede: bloqueia
export const FLOOR = '.';
export const TRACE = '=';       // trilha de metal: passável
export const DAMAGED = 'x';     // trilha rompida: bloqueia até o reparo de trilha (R)
export const GATE = 'g';        // porta de energia: bloqueia até o ajuste de energia (R)
export const SOCKET = 'o';      // encaixe vazio: bloqueia até o reforço do núcleo (R)
export const DOOR = 'D';        // porta da sala do chefe: bloqueia até a chave do núcleo (R)
export const SPAWN = 'S';       // ponto de nascimento (e de renascimento após derrota)
export const UP = '<';          // saída para a camada anterior
export const DOWN = '>';        // saída para a próxima camada
export const NPC = 'N';         // técnico: bloqueia, fala com E
export const MERCHANT = 'M';    // mercador: bloqueia, fala e abre a loja com E
export const CHEST = 'b';       // baú: bloqueia, abre com E
export const HOT = 'h';         // trilha quente: passável, esquenta o chip
export const COOL = '~';        // zona fria: passável, resfria o chip
export const GOAL = 'A';        // o anel: vitória
export const KEY = 'K';         // chave do núcleo (pegar com o passo)
export const BOSS = 'B';        // posição de partida do chefe (vira entidade)

// Materiais espalhados no mapa.
export const PICKUP_ITEMS = {
  a: 'liga_ferrugem',
  w: 'fio_cobre',
  k: 'cristal_silicio',
  p: 'placa_base',
  m: 'polimero_termico',
};
// Falhas que andam pelo mapa (cada caractere vira uma entidade ao carregar a camada).
export const FOE_CHARS = {
  f: 'pulga_corrente',
  F: 'rasgo_trilha',
  Q: 'ruido_termico',
  V: 'vazamento_corrente',
  E: 'eletromigracao',
  J: 'pico_de_tensao',
  L: 'fantasma_de_cache',
  R: 'sobrecarga_termica',
  G: 'bit_corrompido',
  T: 'glitch_de_pipeline',
};
export const FOE_CHAR_BY_ID = Object.fromEntries(Object.entries(FOE_CHARS).map(([ch, id]) => [id, ch]));
// Ferramenta que abre cada célula bloqueada (usada com R na célula da frente).
export const TOOL_CELLS = { x: 'reparo_trilha', g: 'ajuste_energia', o: 'reforco_nucleo', D: 'chave_nucleo' };
// Como fica a célula depois de aberta.
export const OPENED = { x: TRACE, g: TRACE, o: FLOOR, D: FLOOR };
// Células que o jogador não atravessa. Falhas não bloqueiam: encostar nelas inicia o combate.
export const BLOCKING = new Set([WALL, DAMAGED, GATE, SOCKET, DOOR, NPC, MERCHANT, CHEST]);

// Chave de uma célula, usada nos conjuntos de visitadas e no salvamento.
export const cellKey = (c, r) => `${c},${r}`;

export class Grid {
  constructor(rows) {
    this.rows = rows.slice();
    this.h = this.rows.length;
    this.w = Math.max(...this.rows.map((r) => r.length));
  }
  inside(c, r) {
    return r >= 0 && r < this.h && c >= 0 && c < this.rows[r].length;
  }
  at(c, r) {
    return this.inside(c, r) ? this.rows[r][c] : WALL;
  }
  set(c, r, ch) {
    const row = this.rows[r];
    this.rows[r] = row.slice(0, c) + ch + row.slice(c + 1);
  }
  find(ch) {
    const out = [];
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.rows[r].length; c++) {
        if (this.rows[r][c] === ch) out.push([c, r]);
      }
    }
    return out;
  }
  count(ch) {
    return this.find(ch).length;
  }
}

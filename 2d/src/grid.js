// Grade de uma camada: texto puro, sem DOM. Cada caractere é uma célula.
export const WALL = '#';        // parede: bloqueia
export const FLOOR = '.';
export const TRACE = '=';       // trilha de metal: passável
export const DAMAGED = 'x';     // trilha rompida: bloqueia até o reparo de trilha
export const GATE = 'g';        // porta de energia: bloqueia até o ajuste de energia
export const SOCKET = 'o';      // encaixe vazio: bloqueia até o reforço do núcleo
export const SPAWN = 'S';       // ponto de nascimento (e de renascimento após derrota)
export const UP = '<';          // saída para a camada anterior
export const DOWN = '>';        // saída para a próxima camada
export const NPC = 'N';         // técnico: bloqueia, fala com E
export const GOAL = 'A';        // o anel: vitória
export const PICKUP_ITEMS = { a: 'liga_ferrugem', w: 'fio_cobre', k: 'cristal_silicio' };
export const FOE_CHARS = { f: 'pulga_corrente', F: 'rasgo_trilha', Q: 'ruido_termico' };
export const TOOL_CELLS = { x: 'reparo_trilha', g: 'ajuste_energia', o: 'reforco_nucleo' };
export const OPENED = { x: TRACE, g: TRACE, o: FLOOR };
export const BLOCKING = new Set([WALL, DAMAGED, GATE, SOCKET, NPC]);

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

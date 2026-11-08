import { Game } from '../src/game.js';
import { Grid } from '../src/grid.js';

// Monta um cenário pequeno na camada atual: rows é o mapa e (c, r) é a posição inicial do jogador.
export function scene(rows, c, r, { seed = 1 } = {}) {
  const game = new Game({ seed });
  const id = game.player.layer;
  game.world[id].grid = new Grid(rows);
  game.world[id].visited.clear();
  Object.assign(game.player, { c, r, fc: 1, fr: 0 });
  game.reveal();
  return game;
}

// Rng que sempre devolve o mesmo valor: 0 faz rolagens dar -1 e fugas darem certo; 0.99 faz o contrário.
export function fixedRng(value) {
  return () => value;
}

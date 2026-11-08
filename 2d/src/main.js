// Ligação com o navegador: teclado, laço de tela e o canvas. Toda a regra fica em game.js.
import { Game } from './game.js';
import { draw } from './render.js';
import { RECIPES } from './content.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game({ seed: Number(new URLSearchParams(location.search).get('seed')) || 7 });
const toolKeys = Object.keys(RECIPES);

const MOVES = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};
const BATTLE = { 1: 'atacar', 2: 'defender', 3: 'fugir' };

function onKey(ev) {
  const k = ev.key;
  if (k === 'F3' || k === '`') {
    game.toggleDebug();
  } else if (MOVES[k]) {
    game.move(...MOVES[k]);
  } else if (k === 'e' || k === 'E') {
    game.interact();
  } else if (k === 'r' || k === 'R') {
    game.useTool();
  } else if (k === 'c' || k === 'C') {
    game.toggleCraft();
  } else if (BATTLE[k] && game.battle) {
    game.battleAction(BATTLE[k]);
  } else if (BATTLE[k] && game.craftOpen) {
    game.craft(toolKeys[Number(k) - 1]);
  } else {
    return;
  }
  ev.preventDefault();
  draw(ctx, game);
}

window.addEventListener('keydown', onKey);
draw(ctx, game);
window.__game = game; // para depuração no console do navegador

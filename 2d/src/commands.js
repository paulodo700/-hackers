// Comandos do jogador. Teclado e toque enviam os mesmos identificadores de comando, então qualquer ação
// tem o mesmo efeito nos dois. Este módulo não tem DOM: o main.js só traduz eventos em comandos.
import { RECIPES } from './content.js';

// Tecla -> comando. Números e Esc têm sentido diferente conforme a tela aberta (combate, criação, mapa).
export const KEY_COMMANDS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  e: 'interact', E: 'interact',
  r: 'use', R: 'use',
  c: 'craft', C: 'craft',
  m: 'map', M: 'map',
  F3: 'debug', '`': 'debug',
  Escape: 'close',
  n: 'newgame', N: 'newgame',
  1: 'pick1', 2: 'pick2', 3: 'pick3',
};

export const COMMAND_IDS = [...new Set(Object.values(KEY_COMMANDS))];
export const MOVE_COMMANDS = new Set(['up', 'down', 'left', 'right']);
const MOVE_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const BATTLE_ACTIONS = ['atacar', 'defender', 'fugir'];
const TOOL_ORDER = Object.keys(RECIPES);
const CONTEXT_LABELS = { battle: ['Atacar', 'Defender', 'Fugir'], craft: ['Reparo', 'Ajuste', 'Reforço'] };

// Tecla pressionada -> comando, ou null. Combinações com Ctrl, Alt ou Meta são deixadas para o navegador
// (Ctrl+R recarrega a página, por exemplo).
export function commandForKey(key, mods = {}) {
  if (mods.ctrlKey || mods.metaKey || mods.altKey) return null;
  return Object.hasOwn(KEY_COMMANDS, key) ? KEY_COMMANDS[key] : null;
}

// Primeira tecla que envia o comando (usada para conferir que toque e teclado batem).
export function keyFor(cmd) {
  return Object.keys(KEY_COMMANDS).find((k) => KEY_COMMANDS[k] === cmd) ?? null;
}

// Executa um comando no jogo. Devolve o resultado da regra, ou {type: 'ignored'} se não houver efeito.
export function runCommand(game, cmd) {
  if (Object.hasOwn(MOVE_VECTORS, cmd)) return game.move(...MOVE_VECTORS[cmd]);
  switch (cmd) {
    case 'interact': return game.interact();
    case 'use': return game.useTool();
    case 'craft': return game.toggleCraft();
    case 'map': return game.toggleMap();
    case 'debug': return game.toggleDebug();
    case 'close': return game.closeAll();
    case 'newgame': return { type: 'app', cmd }; // o app confirma e recomeça a partida
    case 'pick1': return pick(game, 0);
    case 'pick2': return pick(game, 1);
    case 'pick3': return pick(game, 2);
    default: return { type: 'ignored', cmd };
  }
}

// 1, 2 e 3 valem para o combate (ataque, defesa, fuga) ou para o menu de criação (ferramentas).
function pick(game, i) {
  if (game.battle) return i < BATTLE_ACTIONS.length ? game.battleAction(BATTLE_ACTIONS[i]) : { type: 'ignored' };
  if (game.craftOpen) return i < TOOL_ORDER.length ? game.craft(TOOL_ORDER[i]) : { type: 'ignored' };
  return { type: 'ignored', cmd: `pick${i + 1}` };
}

// Rótulos dos três botões de ação contextual no toque. Null quando não há ação a mostrar.
export function contextLabels(game) {
  if (game.battle) return CONTEXT_LABELS.battle;
  if (game.craftOpen) return CONTEXT_LABELS.craft;
  return null;
}

// Disposição dos botões de toque. Cada botão envia um comando que também existe no teclado.
export const TOUCH_LAYOUT = {
  move: [
    { cmd: 'up', label: '▲', area: 'up' },
    { cmd: 'left', label: '◀', area: 'left' },
    { cmd: 'right', label: '▶', area: 'right' },
    { cmd: 'down', label: '▼', area: 'down' },
  ],
  actions: [
    { cmd: 'interact', label: 'Falar' },
    { cmd: 'use', label: 'Usar' },
    { cmd: 'craft', label: 'Criar' },
    { cmd: 'map', label: 'Mapa' },
    { cmd: 'debug', label: 'Depurar' },
    { cmd: 'newgame', label: 'Novo' },
  ],
  context: [
    { cmd: 'pick1' },
    { cmd: 'pick2' },
    { cmd: 'pick3' },
  ],
};

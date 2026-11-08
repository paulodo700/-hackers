// Comandos do jogador. Teclado e toque enviam os mesmos comandos; o estado do jogo decide o efeito de cada um
// (andar, escolher no combate, escolher num menu, responder um diálogo). Sem DOM.

export const TECLAS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'confirm', ' ': 'confirm', e: 'confirm', E: 'confirm',
  Escape: 'back', Backspace: 'back',
  r: 'use', R: 'use',
  c: 'craft', C: 'craft',
  m: 'map', M: 'map',
  i: 'inv', I: 'inv',
  k: 'skills', K: 'skills',
  j: 'journal', J: 'journal',
  b: 'bestiary', B: 'bestiary',
  Tab: 'menu',
  z: 'wait', Z: 'wait',
  F3: 'debug', '`': 'debug',
  n: 'newgame', N: 'newgame',
  1: 'num1', 2: 'num2', 3: 'num3', 4: 'num4', 5: 'num5', 6: 'num6', 7: 'num7', 8: 'num8', 9: 'num9',
};

export const COMANDOS = [...new Set(Object.values(TECLAS))];

// Tecla -> comando. Combinações com Ctrl, Alt ou Meta são deixadas para o navegador (Ctrl+R recarrega).
export function comandoDaTecla(tecla, mods = {}) {
  if (mods.ctrlKey || mods.metaKey || mods.altKey) return null;
  return Object.hasOwn(TECLAS, tecla) ? TECLAS[tecla] : null;
}

// Primeira tecla que envia o comando (para conferir que toque e teclado batem).
export const teclaDo = (cmd) => Object.keys(TECLAS).find((k) => TECLAS[k] === cmd) ?? null;

const MOVIMENTO = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const COMANDOS_DE_MOVIMENTO = new Set(Object.keys(MOVIMENTO));

// Executa um comando. Devolve o resultado da regra; {type: 'ignored'} quando não há efeito.
export function executarComando(game, cmd) {
  if (/^num[1-9]$/.test(cmd)) return numero(game, Number(cmd.slice(3)));
  switch (cmd) {
    case 'up': case 'down': return direcaoVertical(game, cmd === 'up' ? -1 : 1);
    case 'left': case 'right': return direcaoHorizontal(game, cmd === 'left' ? -1 : 1);
    case 'confirm': return game.battle && !game.menu ? game.acao('atacar') : game.confirmar();
    case 'back': return voltar(game);
    case 'use': return game.battle ? { type: 'batalha' } : game.useTool();
    case 'craft': return abrirOuFechar(game, 'criar');
    case 'map': return game.toggleMap();
    case 'inv': return abrirExplorando(game, 'inventario');
    case 'skills': return abrirExplorando(game, 'habilidades');
    case 'journal': return abrirExplorando(game, 'diario');
    case 'bestiary': return abrirExplorando(game, 'bestiario');
    case 'menu': return abrirOuFechar(game, 'principal');
    case 'debug': return game.toggleDebug();
    case 'wait': return game.battle ? { type: 'batalha' } : game.esperar();
    case 'newgame': return { type: 'app', cmd: 'newgame' };
    default: return { type: 'ignored', cmd };
  }
}

function direcaoVertical(game, passo) {
  if (game.dialog?.opcoes?.length) return game.navegarDialogo(passo);
  if (game.menu) return game.navegarMenu(passo);
  if (game.battle || game.dialog || game.mapOpen) return { type: 'paused' };
  return game.move(...MOVIMENTO[passo < 0 ? 'up' : 'down']);
}

function direcaoHorizontal(game, passo) {
  if (game.menu || game.dialog || game.battle || game.mapOpen) return { type: 'paused' };
  return game.move(passo, 0);
}

// 1 a 9: escolhe um item do menu aberto; no combate, 1 ataca, 2 e 3 abrem habilidades e itens,
// 4 defende e 5 foge.
function numero(game, n) {
  if (game.dialog?.opcoes?.length) return game.escolherDialogoNumero(n);
  if (game.menu) return game.escolherMenuNumero(n);
  if (!game.battle) return { type: 'ignored', cmd: `num${n}` };
  switch (n) {
    case 1: return game.acao('atacar');
    case 2: return game.abrirMenu('batalha_habilidade');
    case 3: return game.abrirMenu('batalha_item');
    case 4: return game.acao('defender');
    case 5: return game.acao('fugir');
    default: return { type: 'ignored', cmd: `num${n}` };
  }
}

function voltar(game) {
  if (game.dialog) return game.sairDialogo();
  if (game.menu) return game.voltarMenu();
  if (game.mapOpen) return game.toggleMap();
  return { type: 'nada' };
}

// Menus de exploração não abrem durante o combate nem com diálogo ou mapa aberto.
function abrirExplorando(game, tipo) {
  if (game.battle || game.dialog || game.mapOpen) return { type: 'paused' };
  if (game.menu?.tipo === tipo) return game.fecharMenu();
  return game.abrirMenu(tipo);
}

function abrirOuFechar(game, tipo) {
  if (game.battle && tipo !== 'criar') return { type: 'paused' };
  if (game.battle && tipo === 'criar') return { type: 'paused' };
  return abrirExplorando(game, tipo);
}

// Botões de toque para o estado atual: cada botão envia um comando de COMANDOS.
// Rótulos e ordem mudam com a tela (exploração, combate, menu, diálogo, mapa).
export function botoesDeToque(game) {
  if (game.mapOpen) return [{ rotulo: 'Fechar mapa', cmd: 'back' }];
  if (game.dialog) {
    const opcoes = (game.dialog.opcoes ?? []).map((o, i) => ({ rotulo: `${i + 1}. ${o.texto}`, cmd: `num${i + 1}` }));
    return [...opcoes, { rotulo: opcoes.length ? 'Sair' : 'Continuar', cmd: opcoes.length ? 'back' : 'confirm' }];
  }
  if (game.battle && !game.menu) {
    return [
      { rotulo: 'Atacar', cmd: 'num1' },
      { rotulo: 'Habilidade', cmd: 'num2' },
      { rotulo: 'Item', cmd: 'num3' },
      { rotulo: 'Defender', cmd: 'num4' },
      { rotulo: 'Fugir', cmd: 'num5' },
    ];
  }
  if (game.menu) {
    return [
      { rotulo: 'Cima', cmd: 'up' },
      { rotulo: 'Baixo', cmd: 'down' },
      { rotulo: 'Escolher', cmd: 'confirm' },
      { rotulo: 'Voltar', cmd: 'back' },
    ];
  }
  return [
    { rotulo: 'Falar', cmd: 'confirm' },
    { rotulo: 'Usar', cmd: 'use' },
    { rotulo: 'Criar', cmd: 'craft' },
    { rotulo: 'Mapa', cmd: 'map' },
    { rotulo: 'Inventário', cmd: 'inv' },
    { rotulo: 'Esperar', cmd: 'wait' },
    { rotulo: 'Menu', cmd: 'menu' },
  ];
}

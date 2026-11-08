// Ligação com o navegador: teclado, toque, desenho e salvamento. Toda regra fica no núcleo (game.js, commands.js).
import { Game } from './game.js';
import { draw } from './render.js';
import { commandForKey, runCommand, contextLabels, TOUCH_LAYOUT, MOVE_COMMANDS } from './commands.js';
import { browserStorage, createSaver, loadGame, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const seed = Number(new URLSearchParams(location.search).get('seed')) || 7;
const storage = browserStorage();
const saver = createSaver(storage);
let game = new Game({ seed });
let lastSave = { ok: true };

function saveStatus() {
  if (!storage.persistent) return 'Sem armazenamento neste navegador: o progresso some ao fechar a página.';
  if (!lastSave.ok) return 'Não foi possível salvar agora (armazenamento cheio ou bloqueado).';
  return 'Progresso salvo automaticamente.';
}

function persist() {
  lastSave = saver.save(game);
}

function render() {
  window.__game = game; // para depuração no console do navegador
  draw(ctx, game, { saveStatus: saveStatus() });
  renderTouch();
}

// Ponto único de entrada: teclado e toque chegam aqui com o mesmo comando.
function dispatch(cmd) {
  if (cmd === 'newgame') return newGame();
  const res = runCommand(game, cmd);
  if (res.type === 'ignored') return;
  persist();
  render();
}

function newGame() {
  if (!window.confirm('Começar um novo jogo? O progresso salvo neste navegador será apagado.')) return;
  clearSave(storage);
  game = new Game({ seed });
  saver.forget();
  persist();
  game.say('Novo jogo.');
  render();
}

// ---------- Toque ----------

function buildTouch() {
  const add = (parent, cmd, label, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cmd = cmd;
    b.textContent = label;
    if (cls) b.className = cls;
    attachPress(b, cmd);
    parent.appendChild(b);
    return b;
  };
  const dpad = document.getElementById('dpad');
  TOUCH_LAYOUT.move.forEach(({ cmd, label, area }) => add(dpad, cmd, label, area));
  const acts = document.getElementById('acts');
  TOUCH_LAYOUT.actions.forEach(({ cmd, label }) => add(acts, cmd, label));
  const ctxRow = document.getElementById('ctx');
  TOUCH_LAYOUT.context.forEach(({ cmd }, i) => add(ctxRow, cmd, `${i + 1}`));
}

// Toque aciona o comando; segurar repete os passos enquanto o dedo estiver sobre o botão de andar.
function attachPress(btn, cmd) {
  let timer = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    dispatch(cmd);
    if (MOVE_COMMANDS.has(cmd)) timer = setInterval(() => dispatch(cmd), 170);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => btn.addEventListener(t, stop));
}

// Os três botões contextuais mostram a ação atual (combate, criação) ou ficam escondidos.
function renderTouch() {
  const labels = contextLabels(game);
  document.querySelectorAll('#ctx button').forEach((b, i) => {
    if (labels) {
      b.hidden = false;
      b.textContent = `${i + 1} · ${labels[i]}`;
    } else {
      b.hidden = true;
    }
  });
  document.querySelectorAll('[data-cmd="map"]').forEach((b) => b.classList.toggle('on', game.mapOpen));
  document.querySelectorAll('[data-cmd="craft"]').forEach((b) => b.classList.toggle('on', game.craftOpen));
}

// Mostra os controles de toque em celular e tablet (ou em janelas estreitas).
function touchLikely() {
  return matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
}

// ---------- Início ----------

const report = loadGame(game, storage);
if (report.status === 'restored') game.say('Progresso carregado.');
if (report.discarded.length || report.status === 'discarded') game.say('Parte do salvamento antigo foi descartada.');
persist();
buildTouch();
document.body.classList.toggle('touch', touchLikely());

window.addEventListener('keydown', (ev) => {
  const cmd = commandForKey(ev.key, ev);
  if (!cmd) return;
  if (ev.repeat && !MOVE_COMMANDS.has(cmd)) return; // segurar M não abre e fecha o mapa sem parar
  ev.preventDefault();
  dispatch(cmd);
});
// Ao sair da página, grava o que estiver pendente.
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

render();

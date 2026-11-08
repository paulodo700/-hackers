// Ligação com o navegador: teclado, toque, eventos do motor (som, números, tremor), salvamento e desenho.
// Toda regra fica no núcleo (game.js, commands.js, systems/). Este arquivo só traduz entradas e saídas.
import { Game } from './game.js';
import { CATALOGO } from './catalog.js';
import { draw, atualizarCamera } from './render.js';
import { comandoDaTecla, executarComando, botoesDeToque, COMANDOS_DE_MOVIMENTO } from './commands.js';
import { browserStorage, createSaver, loadGame, clearSave } from './save.js';
import { AudioEngine } from './audio/index.js';
import { itensDoMenu } from './menus.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const seed = Number(new URLSearchParams(location.search).get('seed')) || 7;
const storage = browserStorage();
const saver = createSaver(storage);
const audio = new AudioEngine();
let game = new Game({ seed, catalog: CATALOGO });
let lastSave = { ok: true };
let floats = [];
let tremor = 0;
let musicaAtual = null;
let batalhaAntes = false;

function statusSalvamento() {
  if (!storage.persistent) return 'Sem armazenamento neste navegador: o progresso some ao fechar a página.';
  if (!lastSave.ok) return 'Não foi possível salvar agora (armazenamento cheio ou bloqueado).';
  return 'Progresso salvo automaticamente.';
}

function persist() {
  lastSave = saver.save(game);
}

// Toca a trilha da camada, ou a de batalha/chefe quando há combate.
function trilha(id) {
  if (id === musicaAtual) return;
  musicaAtual = id;
  audio.playMusic(id);
}

// Consome os eventos do motor: sons, números flutuantes, tremor e trilhas. Depois limpa a fila.
function processarEventos() {
  for (const ev of game.events) {
    switch (ev.tipo) {
      case 'sfx': audio.playSfx(ev.id); break;
      case 'musica': trilha(ev.id); break;
      case 'dano': floats.push({ texto: `-${ev.valor}`, c: ev.c, r: ev.r, idade: 0, cor: ev.alvo === 'jogador' ? '#ff8a8a' : '#ffd166' }); break;
      case 'cura': floats.push({ texto: `+${ev.valor}`, c: game.player.c, r: game.player.r, idade: 0, cor: '#7dd3a0' }); break;
      case 'texto': floats.push({ texto: ev.texto, c: ev.c, r: ev.r, idade: 0, cor: ev.cor }); break;
      case 'tremor': tremor = Math.max(tremor, ev.forca); break;
      default: break;
    }
  }
  game.events.length = 0;
  // Trilha de batalha ao começar e voltar à trilha da camada ao terminar.
  const batalhaAgora = !!game.battle;
  if (batalhaAgora && !batalhaAntes) trilha(game.battle.boss ? 'chefe' : 'batalha');
  if (!batalhaAgora && batalhaAntes) { const id = musicaAtual; musicaAtual = null; trilha(game.player.camada); void id; }
  batalhaAntes = batalhaAgora;
}

function render() {
  window.__game = game;
  draw(ctx, game, { saveStatus: statusSalvamento(), floats, tremor, t: performance.now() });
  renderToque();
}

// Um comando do jogador (teclado ou toque). Novo jogo passa pela confirmação.
function despachar(cmd) {
  if (cmd === 'newgame') return novoJogo();
  const res = executarComando(game, cmd);
  if (res.type === 'ignored') return;
  processarEventos();
  persist();
  render();
}

function novoJogo() {
  if (!window.confirm('Começar um novo jogo? O progresso salvo neste navegador será apagado.')) return;
  clearSave(storage);
  game = new Game({ seed, catalog: CATALOGO });
  saver.forget();
  floats = [];
  musicaAtual = null;
  batalhaAntes = false;
  game.say('Novo jogo.');
  persist();
  trilha(game.player.camada);
  render();
}

// ---------- Toque ----------

const ROTULOS_DIRECIONAL = { up: '▲', left: '◀', right: '▶', down: '▼' };

function botaoDeToque(rotulo, cmd, classe = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.cmd = cmd;
  b.textContent = rotulo;
  if (classe) b.className = classe;
  ligarToque(b, cmd);
  return b;
}

// Repete o passo enquanto o dedo estiver no direcional; outros botões disparam uma vez.
function ligarToque(b, cmd) {
  let timer = null;
  const parar = () => { if (timer) clearInterval(timer); timer = null; };
  b.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    audio.unlock();
    despachar(cmd);
    if (COMANDOS_DE_MOVIMENTO.has(cmd)) timer = setInterval(() => despachar(cmd), 170);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, parar));
}

let chaveAcoes = '';
function renderToque() {
  let botoes = botoesDeToque(game);
  if (game.menu && !game.dialog) {
    const itens = itensDoMenu(game).slice(0, 9).map((it, i) => ({ rotulo: `${i + 1}. ${it.label.slice(0, 22)}`, cmd: `num${i + 1}` }));
    botoes = [...itens, ...botoes];
  }
  const chave = JSON.stringify(botoes);
  if (chave === chaveAcoes) return;
  chaveAcoes = chave;
  const acoes = document.getElementById('acoes');
  acoes.replaceChildren(...botoes.map((b) => botaoDeToque(b.rotulo, b.cmd)));
}

function montarDirecional() {
  const dpad = document.getElementById('dpad');
  for (const cmd of ['up', 'left', 'right', 'down']) {
    dpad.appendChild(botaoDeToque(ROTULOS_DIRECIONAL[cmd], cmd, cmd));
  }
}

// ---------- Inicialização ----------

const relatorio = loadGame(game, storage);
if (relatorio.status === 'restored') game.say('Progresso carregado.');
if (relatorio.discarded.length || relatorio.status === 'discarded') game.say('Parte do salvamento antigo foi descartada.');
persist();
montarDirecional();
document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600);

window.addEventListener('keydown', (ev) => {
  const cmd = comandoDaTecla(ev.key, ev);
  if (!cmd) return;
  if (ev.repeat && !COMANDOS_DE_MOVIMENTO.has(cmd)) return; // segurar M não abre e fecha o mapa
  ev.preventDefault();
  audio.unlock();
  despachar(cmd);
});
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

// Quadro a quadro: câmera, animações e números flutuantes. Desenha sempre (a visão de cima anima).
let anterior = performance.now();
function quadro(agora) {
  const dt = Math.min(64, agora - anterior);
  anterior = agora;
  for (const f of floats) f.idade += dt / 16;
  floats = floats.filter((f) => f.idade < 45);
  if (tremor > 0) tremor = Math.max(0, tremor - dt * 0.03);
  atualizarCamera(game, dt);
  draw(ctx, game, { saveStatus: statusSalvamento(), floats, tremor, t: agora });
  requestAnimationFrame(quadro);
}

trilha(game.player.camada);
render();
requestAnimationFrame(quadro);

// Fachada do jogo: estado, mundo e entrada de comandos. As regras ficam em src/systems/; este arquivo liga tudo.
// Sem DOM: a renderização lê este estado e os eventos (game.events) são consumidos pelo main.js.
import { mulberry32 } from './rng.js';
import {
  Grid, FLOOR, BLOCKING, UP, DOWN, GOAL, SPAWN, NPC, MERCHANT, BOSS, FOE_CHARS, cellKey,
} from './grid.js';
import { LAYER_ORDER, LAYERS } from './layers.js';
import { generateMap } from './mapgen.js';
import { estatisticas } from './systems/stats.js';
import {
  efeitosDoPasso, coletarNaCelula, moverFalhas, contatoComFalha, interagir, usarFerramenta, reaparecerFalhas,
} from './systems/world.js';
import { COOL, HOT } from './grid.js';
import { clamp } from './systems/util.js';
import { iniciarBatalha, acaoJogador, aplicarDanoJogador, derrota } from './systems/combat.js';
import { progresso } from './systems/quests.js';
import { avancarDialogo, escolherOpcao, encerrarDialogo } from './systems/dialogue.js';
import { executarAcaoMenu, itensDoMenu } from './menus.js';

const LOG_MAX = 6;

const novoJogador = () => ({
  nivel: 1, xp: 0, pontos: 0,
  hp: 24, maxHp: 24, ep: 10, maxEp: 10,
  atk: 4, def: 1, spd: 5, crit: 5,
  camada: LAYER_ORDER[0], c: 1, r: 1, fc: 1, fr: 0,
  habilidades: [],
  equip: { dissipador: null, antena: null, modulo: null },
  estados: [], escudo: 0, calor: 0, passos: 0,
});

export class Game {
  constructor({ seed = 7, catalog } = {}) {
    if (!catalog) throw new Error('o Game precisa de um catálogo de dados');
    this.catalog = catalog;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.nextEntityId = 1;
    this.player = novoJogador();
    this.inv = {};
    this.ciclos = 0;
    this.flags = {};
    this.missoes = {};
    this.bestiario = {};
    this.chefes = {};
    this.bausAbertos = {};
    this.lojas = {};
    this.diario = [];
    this.battle = null;
    this.dialog = null;
    this.lojaPendente = null;
    this.menu = null;
    this.menuStack = [];
    this.mapOpen = false;
    this.debug = false;
    this.won = false;
    this.events = [];
    this.log = [];
    this.world = {};
    LAYER_ORDER.forEach((id, ordem) => { this.world[id] = this.montarCamada(id, ordem); });
    this.placeAt(LAYER_ORDER[0], SPAWN);
    this.say('Bit acorda no dissipador de calor. Fale com os técnicos e siga para a saída.');
  }

  // ---------- Mundo ----------

  // Gera o mapa da camada e separa as falhas, o chefe e os técnicos (que viram entidades e posições).
  montarCamada(id, ordem) {
    const lista = Object.values(this.catalog.npcs ?? {}).filter((n) => n.camada === id);
    const mercadores = lista.filter((n) => n.tipo === 'mercador');
    const outros = lista.filter((n) => n.tipo !== 'mercador');
    const npcChars = [...outros.map(() => NPC), ...mercadores.map(() => MERCHANT)];
    const rows = generateMap({ ...LAYERS[id], npcs: npcChars, boss: true }, 1000 + ordem * 101);
    const grid = new Grid(rows);
    const chefe = Object.values(this.catalog.falhas).find((f) => f.chefe && f.camada === id) ?? null;
    const entidades = [];
    const npcs = [];
    const filaNpc = [...outros];
    const filaMercador = [...mercadores];
    for (let r = 0; r < grid.h; r++) {
      for (let c = 0; c < grid.rows[r].length; c++) {
        const ch = grid.at(c, r);
        if (FOE_CHARS[ch]) {
          entidades.push(this.novaEntidade(id, FOE_CHARS[ch], c, r, false));
          grid.set(c, r, FLOOR);
        } else if (ch === BOSS) {
          if (chefe) entidades.push(this.novaEntidade(id, chefe.id, c, r, true));
          grid.set(c, r, FLOOR);
        } else if (ch === NPC) {
          npcs.push({ id: filaNpc.shift()?.id ?? null, c, r });
        } else if (ch === MERCHANT) {
          npcs.push({ id: filaMercador.shift()?.id ?? null, c, r, mercador: true });
        }
      }
    }
    const totalFalhas = entidades.filter((e) => !e.boss).length;
    return {
      grid,
      origin: grid.rows.slice(),
      visited: new Set(),
      entities: entidades,
      npcs,
      boss: chefe?.id ?? null,
      totalFalhas,
    };
  }

  novaEntidade(camada, foe, c, r, boss) {
    const comp = boss ? 'estatico' : (this.catalog.falhas[foe]?.comportamento ?? 'estatico');
    return { id: this.nextEntityId++, foe, camada, c, r, origem: [c, r], comp, boss, ignorar: 0 };
  }

  get layer() { return this.world[this.player.camada]; }
  get grid() { return this.layer.grid; }
  layerState() { return this.world[this.player.camada]; }
  layerOrdem(camada) { return LAYER_ORDER.indexOf(camada); }
  estatisticas() { return estatisticas(this); }

  // Coloca Bit numa célula do tipo ch (S, < ou >) da camada; se faltar, cai para outras entradas.
  placeAt(camada, ch) {
    const grid = this.world[camada].grid;
    const found = grid.find(ch)[0] || grid.find(SPAWN)[0] || grid.find(UP)[0] || grid.find(DOWN)[0];
    Object.assign(this.player, { camada, c: found[0], r: found[1] });
    this.reveal();
  }

  // Névoa: marca a célula de Bit e as oito vizinhas como visitadas.
  reveal() {
    const { c, r } = this.player;
    const visitadas = this.layer.visited;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (this.grid.inside(c + dc, r + dr)) visitadas.add(cellKey(c + dc, r + dr));
      }
    }
  }

  frente() { return [this.player.c + this.player.fc, this.player.r + this.player.fr]; }

  // Remove uma entidade (falha vencida ou chefe derrotado) da camada atual.
  removerEntidade(id) {
    const camada = this.world[this.player.camada];
    camada.entities = camada.entities.filter((e) => e.id !== id);
  }

  // Após fugir, a falha ignora Bit por alguns passos (senão o combate começa de novo na hora).
  ignorarEntidade(id, passos) {
    const e = this.layerState().entities.find((x) => x.id === id);
    if (e) e.ignorar = this.player.passos + passos;
  }

  // ---------- Eventos e registro ----------

  say(text) {
    this.log.push(text);
    if (this.log.length > LOG_MAX) this.log.shift();
  }

  emit(evento) {
    this.events.push(evento);
  }

  // ---------- Movimento ----------

  // Um passo. Bloqueios, falhas, saídas, materiais, calor, inimigos e contato com inimigos, nessa ordem.
  move(dc, dr) {
    const p = this.player;
    p.fc = dc;
    p.fr = dr;
    if (this.won) return { type: 'won' };
    if (this.menu || this.dialog || this.mapOpen) return { type: 'paused' };
    if (this.battle) return { type: 'battle' };
    const nc = p.c + dc, nr = p.r + dr;
    const ch = this.grid.at(nc, nr);
    if (ch === UP) return this.trocarCamada(-1);
    if (ch === DOWN) return this.trocarCamada(1);
    if (BLOCKING.has(ch)) return { type: 'blocked', ch };
    if (ch === GOAL) {
      p.c = nc;
      p.r = nr;
      this.won = true;
      this.say('Você alcançou o anel zero!');
      this.emit({ tipo: 'sfx', id: 'vitoria' });
      return { type: 'won' };
    }
    p.c = nc;
    p.r = nr;
    this.reveal();
    const coletado = coletarNaCelula(this);
    if (efeitosDoPasso(this)) return { type: 'derrota' };
    reaparecerFalhas(this);
    moverFalhas(this);
    const contato = contatoComFalha(this);
    if (contato && !this.battle) iniciarBatalha(this, { ...contato, camada: p.camada });
    return { type: coletado ? 'pickup' : 'moved', item: coletado };
  }

  // Troca de camada: descer entra pela entrada '<' da próxima; subir entra pela saída '>' da anterior.
  trocarCamada(passo) {
    const i = LAYER_ORDER.indexOf(this.player.camada) + passo;
    if (i < 0 || i >= LAYER_ORDER.length) return { type: 'blocked', ch: passo < 0 ? UP : DOWN };
    const alvo = LAYER_ORDER[i];
    this.placeAt(alvo, passo > 0 ? UP : DOWN);
    this.say(`Camada: ${LAYERS[alvo].nome}`);
    this.emit({ tipo: 'camada', camada: alvo });
    this.emit({ tipo: 'musica', id: alvo });
    progresso(this, { tipo: 'chegou', camada: alvo });
    return { type: 'layer', layer: alvo };
  }

  // ---------- Ações na exploração ----------

  // E: fala, abre loja ou baú. Com diálogo ou menu aberto, confirma a escolha.
  confirmar() {
    if (this.dialog) return this.dialog.opcoes?.length ? escolherOpcao(this, this.dialog.cursor ?? 0) : avancarDialogo(this);
    if (this.menu) return this.selecionarMenu();
    return interagir(this);
  }

  interact() { return this.confirmar(); }

  useTool() {
    if (this.menu || this.dialog || this.mapOpen) return { type: 'paused' };
    return usarFerramenta(this);
  }

  // ---------- Diálogo ----------

  navegarDialogo(delta) {
    if (!this.dialog?.opcoes?.length) return { type: 'nada' };
    const n = this.dialog.opcoes.length;
    this.dialog.cursor = ((this.dialog.cursor ?? 0) + delta + n) % n;
    return { type: 'cursor', cursor: this.dialog.cursor };
  }

  escolherDialogoNumero(numero) {
    if (!this.dialog?.opcoes?.length) return { type: 'nada' };
    return escolherOpcao(this, numero - 1);
  }

  // Esc durante o diálogo: encerra a conversa.
  sairDialogo() { return encerrarDialogo(this); }

  // ---------- Combate ----------

  acao(tipo, arg) {
    if (this.mapOpen) return { type: 'paused' };
    return acaoJogador(this, tipo, arg);
  }

  // ---------- Menus e telas ----------

  abrirMenu(tipo, dados = {}) {
    if (this.menu) this.menuStack.push(this.menu);
    this.menu = { tipo, cursor: 0, dados };
    return { type: 'menu', tipo };
  }

  // Voltar: sobe um nível de menu ou fecha o último.
  voltarMenu() {
    if (!this.menu) return { type: 'nada' };
    this.menu = this.menuStack.pop() ?? null;
    return { type: 'voltou' };
  }

  fecharMenu() {
    this.menu = null;
    this.menuStack = [];
    return { type: 'fechado' };
  }

  navegarMenu(delta) {
    if (!this.menu) return { type: 'nada' };
    const itens = itensDoMenu(this);
    if (!itens.length) return { type: 'nada' };
    const n = itens.length;
    this.menu.cursor = (this.menu.cursor + delta + n) % n;
    return { type: 'cursor', cursor: this.menu.cursor };
  }

  // Número escolhe o item de mesma posição (1 = primeiro).
  escolherMenuNumero(numero) {
    if (!this.menu) return { type: 'nada' };
    const itens = itensDoMenu(this);
    const item = itens[numero - 1];
    if (!item) return { type: 'nada' };
    this.menu.cursor = numero - 1;
    return this.selecionarMenu();
  }

  selecionarMenu() {
    if (!this.menu) return { type: 'nada' };
    const item = itensDoMenu(this)[this.menu.cursor];
    if (!item || item.acao?.tipo === 'nada') return { type: 'nada' };
    return executarAcaoMenu(this, item.acao);
  }

  // Esperar (descansar): o tempo passa sem andar. A vida volta aos poucos; na zona fria o chip esfria mais;
// as falhas se movem; contato inicia combate.
  esperar() {
    if (this.menu || this.dialog || this.mapOpen || this.battle) return { type: 'paused' };
    const p = this.player;
    const ch = this.grid.at(p.c, p.r);
    // Descansar: a vida volta aos poucos fora do combate.
    p.hp = Math.min(this.estatisticas().maxHp, p.hp + 2);
    if (ch === COOL) {
      p.calor = clamp(p.calor - 8, 0, 100);
      this.emit({ tipo: 'fx', fx: 'gelo', c: p.c, r: p.r });
      this.say('O chip esfria.');
    } else {
      p.calor = clamp(p.calor - 2, 0, 100); // esperar em terreno comum também resfria, devagar
      this.say('Você espera. O chip esfria um pouco.');
    }
    if (p.calor >= 85 && ch !== COOL) {
      this.emit({ tipo: 'sfx', id: 'sobreaquecer' });
      if (aplicarDanoJogador(this, p.calor >= 100 ? 3 : 1)) { derrota(this); return { type: 'derrota' }; }
    }
    moverFalhas(this);
    const contato = contatoComFalha(this);
    if (contato && !this.battle) iniciarBatalha(this, { ...contato, camada: p.camada });
    return { type: 'espera' };
  }

  toggleMap() {
    this.mapOpen = !this.mapOpen;
    return { type: 'map', open: this.mapOpen };
  }

  toggleDebug() {
    this.debug = !this.debug;
    return { type: 'debug', on: this.debug };
  }

  // Esc: fecha mapa, menu, diálogo. Em combate não fecha nada (não há como fugir por Esc).
  closeAll() {
    const algo = !!(this.mapOpen || this.menu || this.dialog);
    this.mapOpen = false;
    this.fecharMenu();
    if (this.dialog) encerrarDialogo(this);
    return { type: 'closed', algo };
  }

  // Visão de depuração: a grade com névoa (células não visitadas viram '?') e a posição de Bit.
  debugView() {
    const g = this.grid, p = this.player, visitadas = this.layer.visited;
    const lines = [];
    let caminhaveis = 0;
    for (let r = 0; r < g.h; r++) {
      let s = '';
      for (let c = 0; c < g.rows[r].length; c++) {
        const ch = g.rows[r][c];
        if (!BLOCKING.has(ch) && ch !== '#') caminhaveis++;
        if (c === p.c && r === p.r) s += '@';
        else s += visitadas.has(cellKey(c, r)) ? ch : '?';
      }
      lines.push(s);
    }
    return { lines, visitedCount: visitadas.size, walkableCount: caminhaveis, player: { c: p.c, r: p.r } };
  }
}

// Regras do jogo, sem DOM: movimento e colisão, troca de camada, combate, reparo, criação, mapa e depuração.
// A renderização (render.js) só lê este estado. O salvamento (save.js) lê e restaura o mesmo estado.
import { mulberry32 } from './rng.js';
import {
  Grid, FLOOR, BLOCKING, DOWN, UP, GOAL, SPAWN, NPC, PICKUP_ITEMS, FOE_CHARS, TOOL_CELLS, OPENED, cellKey,
} from './grid.js';
import { LAYER_ORDER, LAYERS } from './layers.js';
import { generateMap } from './mapgen.js';
import {
  FOES, RECIPES, REINFORCE_HP, RESPAWN_RATIO, MATERIAL_NOMES, TOOL_NOMES,
} from './content.js';

const LOG_MAX = 6;

export class Game {
  constructor({ seed = 7 } = {}) {
    this.rng = mulberry32(seed);
    this.player = { hp: 20, maxHp: 20, atk: 4, def: 1, layer: LAYER_ORDER[0], c: 0, r: 0, fc: 1, fr: 0 };
    this.materials = { liga_ferrugem: 0, fio_cobre: 0, cristal_silicio: 0 };
    this.tools = { reparo_trilha: 0, ajuste_energia: 0, reforco_nucleo: 0 };
    this.world = {};
    LAYER_ORDER.forEach((id, i) => {
      const rows = generateMap(LAYERS[id], 1000 + i * 101);
      // origin é o mapa como foi gerado. Comparar com ele mostra o que o jogador mudou (reparos, vitórias, coletas).
      this.world[id] = { grid: new Grid(rows), origin: rows.slice(), visited: new Set(), npc: 0 };
    });
    this.battle = null;
    this.dialog = null;
    this.craftOpen = false;
    this.mapOpen = false;
    this.debug = false;
    this.won = false;
    this.log = [];
    this.placeAt(LAYER_ORDER[0], SPAWN);
  }

  get layer() { return this.world[this.player.layer]; }
  get grid() { return this.layer.grid; }
  front() { return [this.player.c + this.player.fc, this.player.r + this.player.fr]; }

  say(text) {
    this.log.push(text);
    if (this.log.length > LOG_MAX) this.log.shift();
  }

  // Coloca o jogador numa célula do tipo ch (S, < ou >) da camada; cai para outras entradas se faltar.
  placeAt(layerId, ch) {
    const grid = this.world[layerId].grid;
    const found = grid.find(ch)[0] || grid.find(SPAWN)[0] || grid.find(UP)[0] || grid.find(DOWN)[0];
    Object.assign(this.player, { layer: layerId, c: found[0], r: found[1] });
    this.reveal();
  }

  // Névoa: marca a célula do jogador e as oito vizinhas como visitadas.
  reveal() {
    const { c, r } = this.player;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (this.grid.inside(c + dc, r + dr)) this.layer.visited.add(cellKey(c + dc, r + dr));
      }
    }
  }

  // Com o mapa do chip aberto o jogo fica parado: nada anda, fala, usa ou cria.
  paused() {
    return { type: 'paused' };
  }

  // Movimento de uma célula. Bater numa parede vira a direção; bater numa falha começa o combate.
  move(dc, dr) {
    const p = this.player;
    p.fc = dc;
    p.fr = dr;
    if (this.won) return { type: 'won' };
    if (this.mapOpen) return this.paused();
    if (this.battle) return { type: 'battle' };
    this.dialog = null;
    const nc = p.c + dc, nr = p.r + dr;
    const ch = this.grid.at(nc, nr);
    if (FOE_CHARS[ch]) return this.startBattle(nc, nr, ch);
    if (ch === UP) return this.changeLayer(-1);
    if (ch === DOWN) return this.changeLayer(1);
    if (BLOCKING.has(ch)) return { type: 'blocked', ch };
    if (ch === GOAL) {
      p.c = nc; p.r = nr;
      this.won = true;
      this.say('Você alcançou o anel zero!');
      return { type: 'won' };
    }
    const item = PICKUP_ITEMS[ch];
    if (item) {
      this.materials[item]++;
      this.grid.set(nc, nr, FLOOR);
      this.say(`+1 ${MATERIAL_NOMES[item]}`);
    }
    p.c = nc; p.r = nr;
    this.reveal();
    return { type: item ? 'pickup' : 'moved', item };
  }

  // Troca de camada: descer entra pelo '<' da próxima, subir entra pelo '>' da anterior.
  changeLayer(step) {
    const i = LAYER_ORDER.indexOf(this.player.layer) + step;
    if (i < 0 || i >= LAYER_ORDER.length) return { type: 'blocked', ch: step < 0 ? UP : DOWN };
    const target = LAYER_ORDER[i];
    this.placeAt(target, step > 0 ? UP : DOWN);
    this.say(`Camada: ${LAYERS[target].nome}`);
    return { type: 'layer', layer: target };
  }

  startBattle(c, r, ch) {
    const foe = FOE_CHARS[ch];
    this.battle = { c, r, foe, hp: FOES[foe].hp, defend: false };
    this.say(`${FOES[foe].nome} aparece!`);
    return { type: 'battle', foe };
  }

  roll() {
    return Math.floor(this.rng() * 3) - 1; // -1, 0 ou +1
  }

  // Ações: 'atacar', 'defender', 'fugir'. Cada ação que não vence dá o turno à falha.
  battleAction(action) {
    if (this.mapOpen) return this.paused();
    const b = this.battle;
    if (!b) return { type: 'none' };
    const p = this.player, foe = FOES[b.foe];
    if (action === 'fugir') {
      if (this.rng() < 0.5) {
        this.battle = null;
        this.say('Você fugiu.');
        return { type: 'fled' };
      }
      this.say('Não conseguiu fugir.');
    } else if (action === 'defender') {
      b.defend = true;
      this.say('Você se defende.');
    } else if (action === 'atacar') {
      const dmg = Math.max(1, p.atk - foe.def + this.roll());
      b.hp -= dmg;
      this.say(`Você causa ${dmg} de dano.`);
      if (b.hp <= 0) return this.win();
    } else {
      return { type: 'none' };
    }
    this.foeTurn();
    if (p.hp <= 0) return this.lose();
    return { type: 'turn' };
  }

  foeTurn() {
    const b = this.battle, foe = FOES[b.foe], p = this.player;
    let dmg = Math.max(1, foe.atk - p.def + this.roll());
    if (b.defend) dmg = Math.max(1, Math.floor(dmg / 2));
    b.defend = false;
    p.hp = Math.max(0, p.hp - dmg);
    this.say(`${foe.nome} causa ${dmg} de dano.`);
  }

  win() {
    const b = this.battle, foe = FOES[b.foe];
    this.grid.set(b.c, b.r, FLOOR);
    this.battle = null;
    this.say(`${foe.nome} foi derrotado.`);
    const drops = [];
    for (const [item, chance] of Object.entries(foe.drop)) {
      if (this.rng() < chance) {
        this.materials[item]++;
        drops.push(item);
        this.say(`+1 ${MATERIAL_NOMES[item]}`);
      }
    }
    return { type: 'won', foe: b.foe, drops };
  }

  lose() {
    const p = this.player;
    this.battle = null;
    p.hp = Math.max(1, Math.floor(p.maxHp * RESPAWN_RATIO));
    this.placeAt(p.layer, SPAWN);
    this.say('Você caiu. Renasceu no ponto inicial da camada.');
    return { type: 'defeated' };
  }

  // Fala com o técnico que está na frente do jogador.
  interact() {
    if (this.mapOpen) return this.paused();
    if (this.battle) return { type: 'battle' };
    const [c, r] = this.front();
    if (this.grid.at(c, r) !== NPC) return { type: 'none' };
    const lines = LAYERS[this.player.layer].dialogo;
    const text = lines[this.layer.npc % lines.length];
    this.layer.npc++;
    this.dialog = { speaker: LAYERS[this.player.layer].nome, text };
    return { type: 'dialog' };
  }

  // Usa a ferramenta certa na célula da frente: reparo (x), ajuste de energia (g) ou reforço (o).
  useTool() {
    if (this.mapOpen) return this.paused();
    if (this.battle) return { type: 'battle' };
    const [c, r] = this.front();
    const ch = this.grid.at(c, r);
    const tool = TOOL_CELLS[ch];
    if (!tool) return { type: 'none' };
    if (this.tools[tool] < 1) {
      this.say(`Falta: ${TOOL_NOMES[tool]}`);
      return { type: 'missing', tool };
    }
    this.tools[tool]--;
    this.grid.set(c, r, OPENED[ch]);
    if (tool === 'reforco_nucleo') {
      this.player.maxHp += REINFORCE_HP;
      this.player.hp += REINFORCE_HP;
    }
    this.say(`${TOOL_NOMES[tool]} aplicado.`);
    return { type: 'used', tool, c, r };
  }

  // Cria uma ferramenta com os materiais. Nada é gasto se faltar algum material.
  craft(tool) {
    if (this.mapOpen) return this.paused();
    if (this.battle) return { type: 'battle' };
    const recipe = RECIPES[tool];
    if (!recipe) return { type: 'none' };
    const missing = Object.entries(recipe).filter(([m, n]) => this.materials[m] < n).map(([m]) => m);
    if (missing.length) {
      this.say('Materiais insuficientes.');
      return { type: 'missing_materials', missing };
    }
    for (const [m, n] of Object.entries(recipe)) this.materials[m] -= n;
    this.tools[tool]++;
    this.say(`Criado: ${TOOL_NOMES[tool]}`);
    return { type: 'crafted', tool };
  }

  toggleCraft() {
    if (this.mapOpen) return this.paused();
    this.craftOpen = !this.craftOpen;
    return { type: 'craft', open: this.craftOpen };
  }

  toggleDebug() {
    this.debug = !this.debug;
    return { type: 'debug', on: this.debug };
  }

  // Abre ou fecha o mapa do chip. Abrir não gasta tempo nem muda o jogo.
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    return { type: 'map', open: this.mapOpen };
  }

  // Esc: fecha o mapa, o menu de criação e o diálogo.
  closeAll() {
    this.mapOpen = false;
    this.craftOpen = false;
    this.dialog = null;
    return { type: 'closed' };
  }

  // Visão de depuração: a grade com névoa (células não visitadas viram '?') e a posição do jogador.
  debugView() {
    const g = this.grid, p = this.player, visited = this.layer.visited;
    const lines = [];
    let walkable = 0;
    for (let r = 0; r < g.h; r++) {
      let s = '';
      for (let c = 0; c < g.rows[r].length; c++) {
        const ch = g.rows[r][c];
        if (!BLOCKING.has(ch) && ch !== '#') walkable++;
        if (c === p.c && r === p.r) s += '@';
        else s += visited.has(cellKey(c, r)) ? ch : '?';
      }
      lines.push(s);
    }
    return { lines, visitedCount: visited.size, walkableCount: walkable, player: { c: p.c, r: p.r } };
  }
}

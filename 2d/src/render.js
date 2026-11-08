// Renderização em canvas 2D com as sprites de src/art. Só lê o estado do jogo; não altera regras.
import { drawSprite, wallVariant } from './art/index.js';
import { LAYERS, LAYER_ORDER } from './layers.js';
import {
  WALL, FLOOR, TRACE, DAMAGED, GATE, SOCKET, DOOR, NPC, MERCHANT, CHEST, HOT, COOL, KEY, BOSS, UP, DOWN, GOAL,
  PICKUP_ITEMS, FOE_CHARS, TOOL_CELLS, cellKey,
} from './grid.js';
import { chipOverview, overallPercent } from './progress.js';
import { itensDoMenu } from './menus.js';
import { estatisticas } from './systems/stats.js';
import { contar } from './systems/items.js';
import { habilidadesAprendidas } from './systems/skills.js';
import { botoesDeToque } from './commands.js';

export const TILE = 32;
export const MAP_X = 56;
export const MAP_Y = 44;
const W = 720, H = 640;
const COR = {
  texto: '#dfe9f3', dim: '#7b8a99', ok: '#7dd3a0', ouro: '#ffd166', ruim: '#e05d5d',
  painel: 'rgba(8, 12, 18, 0.94)', borda: '#34495e', destaque: '#78dcff', calor: '#ff7a3d',
};

const ENTRADA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const parede = (grid, c, r) => grid.at(c, r) === WALL;
const hash = (c, r) => ((c * 73856093) ^ (r * 19349663)) >>> 0;
const chaoId = (c, r) => ['chao_a', 'chao_b', 'chao_c'][hash(c, r) % 3];

// Sprite de cada célula do terreno (paredes escolhem a variante pelos vizinhos).
function terrenoSprite(grid, c, r, ch) {
  if (ch === WALL) {
    const mask = (parede(grid, c, r - 1) ? 1 : 0) | (parede(grid, c + 1, r) ? 2 : 0) | (parede(grid, c, r + 1) ? 4 : 0) | (parede(grid, c - 1, r) ? 8 : 0);
    return wallVariant(mask);
  }
  const mapa = {
    [TRACE]: 'trilha', [DAMAGED]: 'trilha_rompida', [GATE]: 'porta_energia', [SOCKET]: 'encaixe', [DOOR]: 'porta_chefe',
    [CHEST]: 'bau_fechado', [HOT]: 'zona_quente', [COOL]: 'zona_fria', [DOWN]: 'saida', [UP]: 'saida', [GOAL]: 'anel',
  };
  return mapa[ch] ?? chaoId(c, r);
}

// Ícone de cada ponto especial do mapa (materiais, chave, técnicos).
const ITEM_DO_MAPA = { ...PICKUP_ITEMS, [KEY]: 'chave_nucleo' };

function texto(ctx, s, x, y, cor = COR.texto, tamanho = 13, alinhar = 'left') {
  ctx.fillStyle = cor;
  ctx.font = `${tamanho}px monospace`;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
}

function painel(ctx, x, y, w, h, borda = COR.borda) {
  ctx.fillStyle = COR.painel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borda;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function barra(ctx, x, y, w, h, valor, max, cor) {
  ctx.fillStyle = '#1a222c';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, Math.max(0, Math.min(w, (w * valor) / (max || 1))), h);
}

// Desenha a tela inteira. ui: {saveStatus, floats (textos flutuantes), tremor (intensidade)}.
export function draw(ctx, game, ui = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, W, H);
  if (game.mapOpen) {
    desenharMapaDoChip(ctx, game);
    return;
  }
  const t = ui.tremor ?? 0;
  if (t > 0) ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * t, (Math.random() - 0.5) * t);
  desenharMundo(ctx, game, ui);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  desenharHud(ctx, game, ui);
  if (game.dialog) desenharDialogo(ctx, game);
  if (game.battle) desenharCombate(ctx, game);
  if (game.menu && !game.battle) desenharMenu(ctx, game);
  if (game.menu && game.battle) desenharSubmenuCombate(ctx, game);
  if (game.won) desenharFim(ctx);
}

function desenharMundo(ctx, game, ui) {
  const camada = game.layerState();
  const grid = camada.grid;
  const p = game.player;
  const tema = LAYERS[p.camada].tema;
  ctx.fillStyle = tema.fundo;
  ctx.fillRect(MAP_X - 4, MAP_Y - 4, grid.w * TILE + 8, grid.h * TILE + 8);
  for (let r = 0; r < grid.h; r++) {
    for (let c = 0; c < grid.rows[r].length; c++) {
      const x = MAP_X + c * TILE, y = MAP_Y + r * TILE;
      const ch = grid.rows[r][c];
      drawSprite(ctx, terrenoSprite(grid, c, r, ch), x, y, { scale: 2 });
      if (ITEM_DO_MAPA[ch]) drawSprite(ctx, ITEM_DO_MAPA[ch] === 'chave_nucleo' ? 'chave_nucleo' : ITEM_DO_MAPA[ch], x + 8, y + 8, { scale: 1 });
      if (game.debug) {
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
      if (!game.debug && !camada.visited.has(cellKey(c, r))) {
        ctx.fillStyle = 'rgba(3, 5, 8, 0.85)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // Técnicos e mercadores
  for (const n of camada.npcs) {
    const info = game.catalog.npcs[n.id];
    const x = MAP_X + n.c * TILE, y = MAP_Y + n.r * TILE;
    if (camada.visited.has(cellKey(n.c, n.r)) || game.debug) drawSprite(ctx, info?.sprite ?? 'tecnico_a', x, y, { scale: 2 });
  }
  // Falhas e chefe
  for (const e of camada.entities) {
    if (!camada.visited.has(cellKey(e.c, e.r)) && !game.debug) continue;
    const x = MAP_X + e.c * TILE, y = MAP_Y + e.r * TILE;
    if (e.boss) drawSprite(ctx, e.foe, x - 8, y - 8, { scale: 2 });
    else drawSprite(ctx, e.foe, x, y, { scale: 2 });
  }
  // Bit
  const quadro = (game.player.passos % 2);
  const dir = p.fr === 1 ? 0 : p.fr === -1 ? 2 : p.fc === -1 ? 4 : 6;
  drawSprite(ctx, 'bit', MAP_X + p.c * TILE, MAP_Y + p.r * TILE, { scale: 2, frame: dir + quadro });
  // Calor: véu avermelhado conforme a temperatura do chip
  if (p.calor > 40) {
    ctx.fillStyle = `rgba(255, 90, 40, ${Math.min(0.35, (p.calor - 40) / 200)})`;
    ctx.fillRect(MAP_X, MAP_Y, grid.w * TILE, grid.h * TILE);
  }
  // Textos flutuantes
  for (const f of ui.floats ?? []) {
    texto(ctx, f.texto, MAP_X + f.c * TILE + TILE / 2, MAP_Y + f.r * TILE - f.idade * 0.8, f.cor ?? COR.ouro, 12, 'center');
  }
  void tema;
}

function desenharHud(ctx, game, ui) {
  const p = game.player;
  const st = estatisticas(game);
  const y0 = MAP_Y + game.layerState().grid.h * TILE + 14;
  texto(ctx, LAYERS[p.camada].nome, MAP_X, y0, COR.texto, 16);
  texto(ctx, `camada ${LAYER_ORDER.indexOf(p.camada) + 1} de ${LAYER_ORDER.length}`, MAP_X + 608, y0 + 2, COR.dim, 12, 'right');
  texto(ctx, `Vida ${p.hp}/${st.maxHp}`, MAP_X, y0 + 26);
  barra(ctx, MAP_X + 130, y0 + 29, 170, 9, p.hp, st.maxHp, COR.ruim);
  texto(ctx, `Energia ${p.ep}/${st.maxEp}`, MAP_X + 320, y0 + 26);
  barra(ctx, MAP_X + 450, y0 + 29, 120, 9, p.ep, st.maxEp, '#4fd1c5');
  texto(ctx, `Calor ${Math.round(p.calor)}`, MAP_X, y0 + 46, p.calor >= 60 ? COR.calor : COR.dim);
  barra(ctx, MAP_X + 130, y0 + 49, 170, 9, p.calor, 100, COR.calor);
  texto(ctx, `Ciclos ${game.ciclos}   Nível ${p.nivel}   Pontos ${p.pontos}`, MAP_X + 320, y0 + 46, COR.ouro);
  const mats = ['liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico']
    .map((id) => `${game.catalog.itens[id]?.nome ?? id} ${contar(game, id)}`).join('   ');
  texto(ctx, mats, MAP_X, y0 + 68, COR.dim, 11);
  const ferr = ['reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'chave_nucleo']
    .map((id) => `${game.catalog.itens[id]?.nome ?? id} ${contar(game, id)}`).join('   ');
  texto(ctx, ferr, MAP_X, y0 + 84, COR.dim, 11);
  const log = game.log.slice(-4);
  log.forEach((linha, i) => texto(ctx, `· ${linha}`, MAP_X, y0 + 108 + i * 17, COR.texto, 12));
  texto(ctx, 'Setas/WASD andar · E falar/abrir · R usar · C criar · I inventário · Tab menu · M mapa · F3 depurar', MAP_X, H - 40, '#55657a', 11);
  texto(ctx, ui.saveStatus ?? '', MAP_X, H - 22, '#55657a', 11);
  if (game.debug) {
    const v = game.debugView();
    texto(ctx, `DEBUG visitadas ${v.visitedCount}  caminháveis ${v.walkableCount}  Bit ${v.player.c},${v.player.r}`, MAP_X, y0 + 40 + 60, COR.destaque, 11);
  }
}

function desenharDialogo(ctx, game) {
  const d = game.dialog;
  const npc = game.catalog.npcs[d.npc];
  const x = MAP_X, y = MAP_Y + 6, w = 608, h = 40 + 17 * Math.max(1, d.opcoes?.length ?? 0) + 52;
  painel(ctx, x, y, w, h, COR.destaque);
  texto(ctx, npc?.nome ?? 'Técnico', x + 12, y + 8, COR.ouro, 13);
  // Fala quebrada em linhas de 80 caracteres
  const linhas = quebrar(d.fala ?? '', 78);
  linhas.slice(0, 3).forEach((l, i) => texto(ctx, l, x + 12, y + 28 + i * 15, COR.texto, 12));
  const ops = d.opcoes ?? [];
  ops.forEach((o, i) => {
    const cor = i === (d.cursor ?? 0) ? COR.destaque : COR.texto;
    texto(ctx, `${i + 1}. ${o.texto}`, x + 18, y + 80 + i * 17, cor, 12);
  });
  texto(ctx, ops.length ? 'Enter escolhe · Esc sai' : 'Enter continua', x + 12, y + h - 18, COR.dim, 11);
}

function quebrar(s, n) {
  const palavras = s.split(' ');
  const linhas = [];
  let atual = '';
  for (const w of palavras) {
    if ((atual + ' ' + w).trim().length > n) { linhas.push(atual.trim()); atual = w; } else atual += ' ' + w;
  }
  if (atual.trim()) linhas.push(atual.trim());
  return linhas;
}

function desenharCombate(ctx, game) {
  const b = game.battle;
  const foe = game.catalog.falhas[b.foeId];
  const x = 430, y = MAP_Y + 6, w = 260, h = 232;
  painel(ctx, x, y, w, h, b.boss ? COR.ruim : COR.borda);
  texto(ctx, `${foe.nome}${b.boss ? ` · fase ${b.fase + 1}` : ''}`, x + 10, y + 8, b.boss ? COR.ruim : COR.texto, 13);
  barra(ctx, x + 10, y + 30, w - 20, 9, Math.max(0, b.hp), b.maxHp, COR.ruim);
  texto(ctx, `Falha ${Math.max(0, b.hp)}/${b.maxHp}`, x + 10, y + 42, COR.dim, 11);
  const st = estatisticas(game);
  texto(ctx, `Você ${game.player.hp}/${st.maxHp}  EP ${game.player.ep}`, x + 10, y + 58, COR.texto, 11);
  const estados = [...game.player.estados.map((e) => game.catalog.status[e.id]?.nome ?? e.id), ...b.estados.map((e) => `${game.catalog.status[e.id]?.nome ?? e.id} (falha)`)];
  texto(ctx, estados.join(', ') || 'sem efeitos', x + 10, y + 74, COR.dim, 11);
  if (b.telegrafo) texto(ctx, `⚠ ${game.catalog.ataques[b.telegrafo]?.telegrafo ?? 'algo se prepara'}`, x + 10, y + 92, COR.ouro, 11);
  const acoes = ['1 Atacar', '2 Habilidade', '3 Item', '4 Defender', `5 ${b.fugaPermitida ? 'Fugir' : '(sem fuga)'}`];
  acoes.forEach((a, i) => texto(ctx, a, x + 10, y + 116 + i * 18, COR.texto, 12));
  texto(ctx, game.log.at(-1) ?? '', x + 10, y + h - 18, COR.dim, 11);
}

// Lista de um menu (ou do submenu de combate). cursor destacado; detalhe na base.
function desenharMenu(ctx, game, noCombate = false) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const x = 96, y = MAP_Y + 6, w = 528, h = 320;
  painel(ctx, x, y, w, h, COR.destaque);
  const titulos = { principal: 'Menu', status: 'Status', inventario: 'Inventário', habilidades: 'Habilidades', equipamento: 'Equipamento', criar: 'Criar', loja: 'Loja', diario: 'Diário', bestiario: 'Bestiário', batalha_habilidade: 'Habilidade', batalha_item: 'Item' };
  texto(ctx, titulos[m.tipo] ?? m.tipo, x + 12, y + 10, COR.ouro, 14);
  const max = 12;
  const inicio = Math.max(0, Math.min(m.cursor - 6, itens.length - max));
  itens.slice(inicio, inicio + max).forEach((it, i) => {
    const idx = inicio + i;
    const sel = idx === m.cursor;
    const cor = sel ? COR.destaque : it.ativo === false ? COR.dim : COR.texto;
    texto(ctx, `${idx + 1}. ${it.label}`, x + 14, y + 40 + i * 20, cor, 12);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrar(det, 84).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 12, y + h - 40 + i * 15, COR.dim, 11));
  texto(ctx, noCombate ? 'Números escolhem · Esc volta' : 'Setas navegam · Enter escolhe · Esc volta', x + 12, y + h - 16, COR.dim, 10);
}

// Submenu de habilidades ou itens dentro do combate: ocupa o painel de combate.
function desenharSubmenuCombate(ctx, game) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const x = 430, y = MAP_Y + 6, w = 260, h = 232;
  painel(ctx, x, y, w, h, COR.destaque);
  texto(ctx, m.tipo === 'batalha_item' ? 'Usar item' : 'Habilidade', x + 10, y + 8, COR.ouro, 13);
  itens.slice(0, 8).forEach((it, i) => {
    const cor = i === m.cursor ? COR.destaque : it.ativo === false ? COR.dim : COR.texto;
    texto(ctx, `${i + 1}. ${it.label}`, x + 10, y + 32 + i * 18, cor, 11);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrar(det, 40).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 10, y + h - 40 + i * 14, COR.dim, 10));
  texto(ctx, 'Números escolhem · Esc volta', x + 10, y + h - 14, COR.dim, 10);
}

function desenharFim(ctx) {
  painel(ctx, 120, 240, 480, 120, COR.ouro);
  texto(ctx, 'Anel zero encontrado', W / 2, 262, COR.ouro, 20, 'center');
  texto(ctx, 'O processador está funcionando de novo.', W / 2, 300, COR.texto, 13, 'center');
}

// Mapa do chip: oito camadas em duas colunas, com exploração, reparos, falhas, materiais, baús e o chefe.
export function desenharMapaDoChip(ctx, game) {
  texto(ctx, 'Mapa do chip', 20, 14, COR.texto, 18);
  const ov = chipOverview(game);
  texto(ctx, `exploração total ${overallPercent(ov)}%   ·   M ou Esc fecha`, 20, 40, COR.dim, 12);
  const gap = 14, cw = (W - 40 - gap) / 2, ch = 128;
  ov.forEach((p, i) => {
    const x = 20 + (i % 2) * (cw + gap), y = 66 + Math.floor(i / 2) * (ch + 10);
    painel(ctx, x, y, cw, ch, p.current ? COR.ouro : COR.borda);
    texto(ctx, `${p.index}`, x + 10, y + 9, COR.dim, 12);
    texto(ctx, p.nome, x + 26, y + 8, p.current ? COR.ouro : COR.texto, 14);
    const cor = { 'você está aqui': COR.ouro, 'concluída': COR.ok, 'não visitada': COR.dim }[p.status] ?? COR.texto;
    texto(ctx, p.status, x + 26, y + 26, cor, 11);
    const L = game.world[p.id];
    const s = 5, mx = x + 10, my = y + 46;
    for (let r = 0; r < L.origin.length; r++) {
      for (let c = 0; c < L.origin[r].length; c++) {
        ctx.fillStyle = !L.visited.has(cellKey(c, r)) ? '#0a0d12' : (L.grid.at(c, r) === WALL ? '#1d2a36' : '#0f1c24');
        ctx.fillRect(mx + c * s, my + r * s, s, s);
      }
    }
    if (p.current) {
      ctx.fillStyle = COR.texto;
      ctx.fillRect(mx + game.player.c * s + 1, my + game.player.r * s + 1, s - 2, s - 2);
    }
    const bx = x + 130, bw = cw - 130 - 12;
    const linhas = [
      ['exploração', `${p.percent}%`, p.visited, p.walkable],
      ['reparos', p.blockers ? `${p.repaired}/${p.blockers}` : '—', p.repaired, p.blockers],
      ['falhas vencidas', `${p.defeated}/${p.foes}`, p.defeated, p.foes],
      ['materiais', p.pickups ? `${p.collected}/${p.pickups}` : '—', p.collected, p.pickups],
      ['chefe', p.boss === 'derrotado' ? 'derrotado' : 'vivo', p.boss === 'derrotado' ? 1 : 0, 1],
    ];
    linhas.forEach(([rot, val, feito, total], k) => {
      const ty = y + 42 + k * 16;
      texto(ctx, rot, bx, ty, COR.dim, 10);
      texto(ctx, String(val), bx + bw, ty, COR.texto, 10, 'right');
      barra(ctx, bx, ty + 12, bw, 3, total ? feito : 0, total || 1, COR.ok);
    });
  });
}

// Tela de depuração do mapa do chip (apenas para o botão de depuração).
export function linhasDoMenuDeToque(game) {
  return botoesDeToque(game);
}

export { habilidadesAprendidas, ENTRADA };

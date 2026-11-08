// Renderização em canvas 2D: visão de cima com câmera que segue Bit, painel lateral, faixa inferior, menus,
// combate e diálogo com as sprites de src/art. Só lê o estado do jogo; não altera regras.
import { drawSprite, wallVariant } from './art/index.js';
import { LAYERS, LAYER_ORDER } from './layers.js';
import {
  WALL, FLOOR, TRACE, DAMAGED, GATE, SOCKET, DOOR, NPC, MERCHANT, CHEST, HOT, COOL, KEY, BOSS, UP, DOWN, GOAL,
  PICKUP_ITEMS, cellKey,
} from './grid.js';
import { chipOverview, overallPercent } from './progress.js';
import { itensDoMenu } from './menus.js';
import { estatisticas } from './systems/stats.js';
import { xpParaProximo } from './systems/stats.js';
import { contar } from './systems/items.js';
import { botoesDeToque } from './commands.js';

export const W = 960, H = 720;
export const TILE = 32;
// Área do mapa na tela (câmera): 25 x 14 células.
export const VISAO = { x: 0, y: 40, w: 800, h: 448 };
const PAINEL = { x: 800, y: 40, w: 160, h: 448 };
const FAIXA = { x: 0, y: 488, w: 960, h: 232 };
const COR = {
  texto: '#dfe9f3', dim: '#7b8a99', ok: '#7dd3a0', ouro: '#ffd166', ruim: '#e05d5d', vida: '#e05d5d', energia: '#4fd1c5',
  calor: '#ff7a3d', ciclo: '#ffd166', painel: 'rgba(8, 12, 18, 0.94)', borda: '#34495e', destaque: '#78dcff',
};
const DIRS_TECLA = { up: 0, down: 2, left: 4, right: 6 };

// Câmera: segue Bit com suavização; reinicia ao trocar de camada.
const camera = { x: 0, y: 0, camada: null };
export function atualizarCamera(game, dt = 16) {
  const L = game.layerState();
  const maxX = Math.max(0, L.grid.w * TILE - VISAO.w);
  const maxY = Math.max(0, L.grid.h * TILE - VISAO.h);
  const alvoX = Math.min(maxX, Math.max(0, game.player.c * TILE + TILE / 2 - VISAO.w / 2));
  const alvoY = Math.min(maxY, Math.max(0, game.player.r * TILE + TILE / 2 - VISAO.h / 2));
  if (camera.camada !== game.player.camada) {
    camera.camada = game.player.camada;
    camera.x = alvoX;
    camera.y = alvoY;
    return;
  }
  const f = Math.min(1, dt / 90);
  camera.x += (alvoX - camera.x) * f;
  camera.y += (alvoY - camera.y) * f;
}

// Sprite de cada célula do terreno (paredes escolhem a variante pelos vizinhos).
const parede = (g, c, r) => g.at(c, r) === WALL;
const hash = (c, r) => ((c * 73856093) ^ (r * 19349663)) >>> 0;
function terrenoSprite(g, c, r, ch) {
  if (ch === WALL) {
    const mask = (parede(g, c, r - 1) ? 1 : 0) | (parede(g, c + 1, r) ? 2 : 0) | (parede(g, c, r + 1) ? 4 : 0) | (parede(g, c - 1, r) ? 8 : 0);
    return wallVariant(mask);
  }
  const mapa = {
    [TRACE]: 'trilha', [DAMAGED]: 'trilha_rompida', [GATE]: 'porta_energia', [SOCKET]: 'encaixe', [DOOR]: 'porta_chefe',
    [CHEST]: 'bau_fechado', [HOT]: 'zona_quente', [COOL]: 'zona_fria', [DOWN]: 'saida', [UP]: 'saida', [GOAL]: 'anel',
  };
  return mapa[ch] ?? ['chao_a', 'chao_b', 'chao_c'][hash(c, r) % 3];
}
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
  ctx.strokeStyle = '#2a3642';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function quebrar(s, n) {
  const linhas = [];
  let atual = '';
  for (const p of s.split(' ')) {
    if ((atual + ' ' + p).trim().length > n) { linhas.push(atual.trim()); atual = p; } else atual += ' ' + p;
  }
  if (atual.trim()) linhas.push(atual.trim());
  return linhas;
}
const sx = (c) => VISAO.x + c * TILE - camera.x;
const sy = (r) => VISAO.y + r * TILE - camera.y;

// Desenha a tela inteira.
export function draw(ctx, game, ui = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, W, H);
  if (game.mapOpen) { desenharMapaDoChip(ctx, game); return; }
  const t = ui.tremor ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  ctx.clip();
  if (t > 0) ctx.translate((Math.random() - 0.5) * t, (Math.random() - 0.5) * t);
  desenharMundo(ctx, game, ui);
  ctx.restore();
  desenharTopo(ctx, game, ui);
  desenharPainel(ctx, game, ui);
  desenharFaixa(ctx, game, ui);
  if (game.dialog) desenharDialogo(ctx, game, ui);
  if (game.battle) desenharCombate(ctx, game, ui);
  if (game.menu && !game.battle) desenharMenu(ctx, game);
  if (game.menu && game.battle) desenharSubmenuCombate(ctx, game);
  if (game.won) desenharFim(ctx);
}

function desenharMundo(ctx, game, ui) {
  const L = game.layerState();
  const g = L.grid;
  const p = game.player;
  const tema = LAYERS[p.camada].tema;
  ctx.fillStyle = tema.fundo;
  ctx.fillRect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  const c0 = Math.max(0, Math.floor(camera.x / TILE) - 1), c1 = Math.min(g.w - 1, Math.ceil((camera.x + VISAO.w) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(camera.y / TILE) - 1), r1 = Math.min(g.h - 1, Math.ceil((camera.y + VISAO.h) / TILE) + 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = sx(c), y = sy(r);
      const ch = g.rows[r][c] ?? WALL;
      drawSprite(ctx, terrenoSprite(g, c, r, ch), x, y, { scale: 2 });
      if (ITEM_DO_MAPA[ch]) drawSprite(ctx, ITEM_DO_MAPA[ch], x + 8, y + 8, { scale: 1 });
      if (game.debug) {
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
      if (!game.debug && !L.visited.has(cellKey(c, r))) {
        ctx.fillStyle = 'rgba(3, 5, 8, 0.85)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // Técnicos e mercadores: nome aparece quando Bit está perto.
  for (const n of L.npcs) {
    if (n.c < c0 || n.c > c1 || n.r < r0 || n.r > r1) continue;
    if (!L.visited.has(cellKey(n.c, n.r)) && !game.debug) continue;
    const info = game.catalog.npcs[n.id];
    const x = sx(n.c), y = sy(n.r);
    drawSprite(ctx, info?.sprite ?? 'tecnico_a', x, y, { scale: 2 });
    if (Math.abs(n.c - p.c) + Math.abs(n.r - p.r) <= 2 && info) {
      texto(ctx, info.nome, x + TILE / 2, y - 14, COR.ouro, 11, 'center');
    }
  }
  // Falhas e chefe: balançam levemente.
  const balanco = Math.sin((ui.t ?? 0) / 260) * 1.5;
  for (const e of L.entities) {
    if (e.c < c0 || e.c > c1 || e.r < r0 || e.r > r1) continue;
    if (!L.visited.has(cellKey(e.c, e.r)) && !game.debug) continue;
    const x = sx(e.c), y = sy(e.r) + balanco;
    if (e.boss) drawSprite(ctx, e.foe, x - 8, y - 8, { scale: 2 });
    else drawSprite(ctx, e.foe, x, y, { scale: 2 });
  }
  // Bit: anda com quadros alternados; a direção vem do último passo.
  const quadro = p.passos % 2;
  const dir = p.fr === 1 ? DIRS_TECLA.down : p.fr === -1 ? DIRS_TECLA.up : p.fc === -1 ? DIRS_TECLA.left : DIRS_TECLA.right;
  const sobe = Math.sin((ui.t ?? 0) / 220) * 1.2;
  drawSprite(ctx, 'bit', sx(p.c), sy(p.r) + sobe, { scale: 2, frame: dir + quadro });
  // Calor: véu avermelhado conforme a temperatura do chip
  if (p.calor > 40) {
    ctx.fillStyle = `rgba(255, 90, 40, ${Math.min(0.35, (p.calor - 40) / 200)})`;
    ctx.fillRect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  }
  for (const f of ui.floats ?? []) {
    texto(ctx, f.texto, sx(f.c) + TILE / 2, sy(f.r) - f.idade * 0.8, f.cor ?? COR.ouro, 13, 'center');
  }
}

// Topo: camada, posição e a missão principal em andamento.
function desenharTopo(ctx, game, ui) {
  ctx.fillStyle = COR.painel;
  ctx.fillRect(0, 0, W, 40);
  ctx.strokeStyle = COR.borda;
  ctx.strokeRect(0.5, 0.5, W - 1, 39);
  const camada = game.player.camada;
  texto(ctx, `${LAYER_ORDER.indexOf(camada) + 1}/8  ${LAYERS[camada].nome}`, 12, 12, COR.texto, 15);
  const missao = missaoAtual(game);
  if (missao) {
    texto(ctx, `◆ ${missao.nome}`, 300, 6, COR.ouro, 12);
    texto(ctx, missao.etapa, 300, 22, COR.dim, 11);
  } else {
    texto(ctx, 'Sem missão principal ativa', 300, 14, COR.dim, 12);
  }
  texto(ctx, ui.saveStatus ?? '', W - 12, 14, COR.dim, 11, 'right');
}

// Missão principal da camada, ou a primeira missão ativa.
function missaoAtual(game) {
  const ativas = Object.keys(game.missoes).filter((id) => game.missoes[id].estado === 'ativa');
  const id = ativas.find((x) => x === `capitulo_${game.player.camada}`) ?? ativas.find((x) => game.catalog.missoes[x]?.tipo === 'principal') ?? ativas[0];
  if (!id) return null;
  const def = game.catalog.missoes[id];
  const etapa = def.etapas[game.missoes[id].etapa]?.texto ?? 'concluída';
  return { nome: def.nome, etapa };
}

// Painel lateral: retrato, vida, energia, calor, nível, ciclos, estados e minimapa.
function desenharPainel(ctx, game, ui) {
  const p = game.player;
  const st = estatisticas(game);
  painel(ctx, PAINEL.x, PAINEL.y, PAINEL.w, PAINEL.h);
  // retrato
  ctx.fillStyle = '#0c1620';
  ctx.fillRect(PAINEL.x + 10, PAINEL.y + 8, 64, 64);
  ctx.strokeStyle = COR.destaque;
  ctx.strokeRect(PAINEL.x + 10.5, PAINEL.y + 8.5, 63, 63);
  drawSprite(ctx, 'bit', PAINEL.x + 14, PAINEL.y + 12, { scale: 3, frame: 0 });
  texto(ctx, 'Bit', PAINEL.x + 82, PAINEL.y + 10, COR.texto, 13);
  texto(ctx, `Nível ${p.nivel}`, PAINEL.x + 82, PAINEL.y + 28, COR.ouro, 11);
  const xpMax = xpParaProximo(p.nivel);
  barra(ctx, PAINEL.x + 82, PAINEL.y + 46, 70, 6, p.xp, xpMax, '#a78bfa');
  let y = PAINEL.y + 84;
  const linha = (rot, valor, max, cor, icone) => {
    drawSprite(ctx, icone, PAINEL.x + 8, y - 2, { scale: 2 });
    texto(ctx, rot, PAINEL.x + 30, y, COR.dim, 10);
    texto(ctx, valor, PAINEL.x + 152, y, COR.texto, 10, 'right');
    barra(ctx, PAINEL.x + 30, y + 13, 122, 5, max.v, max.m, cor);
    y += 30;
  };
  linha('Vida', `${p.hp}/${st.maxHp}`, { v: p.hp, m: st.maxHp }, COR.vida, 'icone_coracao');
  linha('Energia', `${p.ep}/${st.maxEp}`, { v: p.ep, m: st.maxEp }, COR.energia, 'icone_energia');
  linha('Calor', `${Math.round(p.calor)}`, { v: p.calor, m: 100 }, p.calor >= 70 ? COR.ruim : COR.calor, 'icone_calor');
  texto(ctx, `◉ ${game.ciclos} ciclos`, PAINEL.x + 10, y + 2, COR.ciclo, 11);
  texto(ctx, `+ ${p.pontos} pontos`, PAINEL.x + 10, y + 16, COR.dim, 10);
  y += 36;
  // estados (combate ou vindos de itens)
  let xs = PAINEL.x + 10;
  for (const e of p.estados.slice(0, 6)) {
    drawSprite(ctx, `status_${e.id}`, xs, y, { scale: 2 });
    xs += 18;
  }
  // minimapa
  minimapa(ctx, game, PAINEL.x + 8, PAINEL.y + PAINEL.h - 110);
}

// Minimapa: cada célula visitada aparece; Bit é um ponto branco e as falhas, pontos vermelhos.
function minimapa(ctx, game, x, y) {
  const L = game.layerState();
  const g = L.grid;
  const s = Math.min(144 / g.w, 96 / g.h);
  ctx.fillStyle = '#05080c';
  ctx.fillRect(x - 2, y - 2, g.w * s + 4, g.h * s + 4);
  for (let r = 0; r < g.h; r++) {
    for (let c = 0; c < g.w; c++) {
      if (!L.visited.has(cellKey(c, r))) continue;
      const ch = g.rows[r][c];
      ctx.fillStyle = ch === WALL ? '#1d2a36' : ch === DOWN || ch === GOAL ? COR.ouro : ch === COOL ? '#7dd3fc' : ch === HOT ? COR.calor : '#14202b';
      ctx.fillRect(x + c * s, y + r * s, Math.max(1, s), Math.max(1, s));
    }
  }
  for (const e of L.entities) {
    if (!L.visited.has(cellKey(e.c, e.r))) continue;
    ctx.fillStyle = e.boss ? COR.ruim : '#ff6b6b';
    ctx.fillRect(x + e.c * s, y + e.r * s, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + game.player.c * s - 1, y + game.player.r * s - 1, 3, 3);
  ctx.strokeStyle = COR.borda;
  ctx.strokeRect(x - 2.5, y - 2.5, g.w * s + 5, g.h * s + 5);
}

// Faixa inferior: registro, inventário com ícones e dicas.
function desenharFaixa(ctx, game, ui) {
  painel(ctx, FAIXA.x, FAIXA.y, FAIXA.w, FAIXA.h - 4);
  const log = game.log.slice(-6);
  log.forEach((linha, i) => texto(ctx, `· ${linha}`, 12, FAIXA.y + 10 + i * 17, i === log.length - 1 ? COR.texto : COR.dim, 12));
  // Inventário: materiais e ferramentas com ícones.
  const ids = ['liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico', 'reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'chave_nucleo', 'pasta_termica', 'kit_reparo'];
  ids.forEach((id, i) => {
    const x = 12 + (i % 11) * 79, y = FAIXA.y + 96;
    painel(ctx, x, y, 74, 44, contar(game, id) ? COR.borda : '#1c2630');
    drawSprite(ctx, id, x + 4, y + 12, { scale: 1 });
    texto(ctx, String(contar(game, id)), x + 70, y + 26, contar(game, id) ? COR.texto : COR.dim, 12, 'right');
  });
  // Ações e atalhos
  texto(ctx, 'Setas/WASD andar · E falar/abrir · R usar · C criar · I inventário · Z esperar · Tab menu · M mapa', 12, FAIXA.y + 152, COR.dim, 11);
  texto(ctx, 'K habilidades · J diário · B bestiário · F3 depurar · N novo jogo', 12, FAIXA.y + 168, COR.dim, 11);
  if (game.debug) {
    const v = game.debugView();
    texto(ctx, `DEBUG visitadas ${v.visitedCount}  caminháveis ${v.walkableCount}  Bit ${v.player.c},${v.player.r}`, 12, FAIXA.y + 136, COR.destaque, 11);
  }
  void ui;
}

function desenharDialogo(ctx, game) {
  const d = game.dialog;
  const npc = game.catalog.npcs[d.npc];
  const x = VISAO.x + 12, y = VISAO.y + VISAO.h - 200, w = VISAO.w - 24;
  const ops = d.opcoes ?? [];
  const h = 110 + 18 * Math.max(0, ops.length - 1);
  painel(ctx, x, y, w, h, COR.destaque);
  drawSprite(ctx, npc?.sprite ?? 'tecnico_a', x + 12, y + 12, { scale: 3 });
  texto(ctx, npc?.nome ?? 'Técnico', x + 90, y + 10, COR.ouro, 14);
  quebrar(d.fala ?? '', 84).slice(0, 3).forEach((l, i) => texto(ctx, l, x + 90, y + 30 + i * 16, COR.texto, 12));
  ops.forEach((o, i) => {
    const cor = i === (d.cursor ?? 0) ? COR.destaque : COR.texto;
    texto(ctx, `${i + 1}. ${o.texto}`, x + 90, y + 84 + i * 18, cor, 12);
  });
  texto(ctx, ops.length ? 'Enter escolhe · Esc sai' : 'Enter continua', x + w - 12, y + h - 18, COR.dim, 11, 'right');
}

// Combate: a falha grande, Bit de frente, barras e a lista de ações.
function desenharCombate(ctx, game, ui) {
  const b = game.battle;
  const foe = game.catalog.falhas[b.foeId];
  const x = VISAO.x + 60, y = VISAO.y + 24, w = VISAO.w - 120, h = 300;
  painel(ctx, x, y, w, h, b.boss ? COR.ruim : COR.borda);
  texto(ctx, `${foe.nome}${b.boss ? `  ·  fase ${b.fase + 1}` : ''}`, x + 16, y + 12, b.boss ? COR.ruim : COR.texto, 15);
  // Palco: Bit à esquerda, falha à direita.
  const balanco = Math.sin((ui.t ?? 0) / 240) * 4;
  drawSprite(ctx, 'bit', x + 90, y + 90 + balanco, { scale: 4, frame: 6 + (game.player.passos % 2) });
  drawSprite(ctx, b.boss ? b.foeId : b.foeId, x + w - 230, y + 70 - balanco, { scale: b.boss ? 4 : 5 });
  barra(ctx, x + 16, y + 52, 260, 10, Math.max(0, b.hp), b.maxHp, COR.ruim);
  texto(ctx, `Falha ${Math.max(0, b.hp)}/${b.maxHp}`, x + 16, y + 66, COR.dim, 11);
  const st = estatisticas(game);
  barra(ctx, x + 16, y + 200, 260, 10, game.player.hp, st.maxHp, COR.vida);
  texto(ctx, `Você ${game.player.hp}/${st.maxHp}   EP ${game.player.ep}`, x + 16, y + 214, COR.texto, 11);
  const estados = [...game.player.estados.map((e) => game.catalog.status[e.id]?.nome ?? e.id), ...b.estados.map((e) => `${game.catalog.status[e.id]?.nome ?? e.id} (falha)`)];
  texto(ctx, estados.join(', ') || 'sem efeitos', x + 16, y + 230, COR.dim, 11);
  if (b.telegrafo) texto(ctx, `⚠ ${game.catalog.ataques[b.telegrafo]?.telegrafo ?? 'algo se prepara'}`, x + 16, y + 250, COR.ouro, 12);
  const acoes = ['1 Atacar', '2 Habilidade', '3 Item', '4 Defender', `5 ${b.fugaPermitida ? 'Fugir' : '(sem fuga)'}`];
  acoes.forEach((a, i) => texto(ctx, a, x + w - 170, y + 180 + i * 20, COR.texto, 12));
  texto(ctx, game.log.at(-1) ?? '', x + 16, y + h - 20, COR.dim, 11);
}

// Submenu de habilidades ou itens dentro do combate.
function desenharSubmenuCombate(ctx, game) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const x = VISAO.x + 60, y = VISAO.y + 24, w = VISAO.w - 120, h = 300;
  painel(ctx, x, y, w, h, COR.destaque);
  texto(ctx, m.tipo === 'batalha_item' ? 'Usar item' : 'Habilidade', x + 16, y + 12, COR.ouro, 14);
  itens.slice(0, 10).forEach((it, i) => {
    const cor = i === m.cursor ? COR.destaque : it.ativo === false ? COR.dim : COR.texto;
    texto(ctx, `${i + 1}. ${it.label}`, x + 16, y + 42 + i * 22, cor, 12);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrar(det, 90).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 16, y + h - 44 + i * 15, COR.dim, 11));
  texto(ctx, 'Números escolhem · Esc volta', x + 16, y + h - 16, COR.dim, 10);
}

// Menu de lista (inventário, habilidades, criação, diário, bestiário, loja ...).
function desenharMenu(ctx, game) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const x = 150, y = VISAO.y + 24, w = 660, h = 400;
  painel(ctx, x, y, w, h, COR.destaque);
  const titulos = { principal: 'Menu', status: 'Status', inventario: 'Inventário', habilidades: 'Habilidades', equipamento: 'Equipamento', criar: 'Criar', loja: 'Loja', diario: 'Diário', bestiario: 'Bestiário' };
  texto(ctx, titulos[m.tipo] ?? m.tipo, x + 16, y + 12, COR.ouro, 15);
  const max = 13;
  const inicio = Math.max(0, Math.min(m.cursor - 6, itens.length - max));
  itens.slice(inicio, inicio + max).forEach((it, i) => {
    const idx = inicio + i;
    const sel = idx === m.cursor;
    if (sel) {
      ctx.fillStyle = 'rgba(120, 220, 255, 0.10)';
      ctx.fillRect(x + 8, y + 40 + i * 22 - 2, w - 16, 20);
    }
    if (it.icone) drawSprite(ctx, it.icone, x + 14, y + 40 + i * 22 - 2, { scale: 1 });
    const cor = sel ? COR.destaque : it.ativo === false ? COR.dim : COR.texto;
    texto(ctx, `${idx + 1}. ${it.label}`, x + (it.icone ? 38 : 16), y + 40 + i * 22, cor, 12);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrar(det, 110).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 16, y + h - 46 + i * 15, COR.dim, 11));
  texto(ctx, 'Setas navegam · Enter escolhe · Esc volta', x + 16, y + h - 16, COR.dim, 10);
}

function desenharFim(ctx) {
  painel(ctx, 280, 240, 400, 120, COR.ouro);
  texto(ctx, 'Anel zero encontrado', W / 2, 262, COR.ouro, 20, 'center');
  texto(ctx, 'O processador está funcionando de novo.', W / 2, 300, COR.texto, 13, 'center');
}

// Mapa do chip: oito camadas em duas colunas.
export function desenharMapaDoChip(ctx, game) {
  texto(ctx, 'Mapa do chip', 20, 14, COR.texto, 18);
  const ov = chipOverview(game);
  texto(ctx, `exploração total ${overallPercent(ov)}%   ·   M ou Esc fecha`, 20, 42, COR.dim, 12);
  const gap = 14, cw = (W - 40 - gap) / 2, ch = 132;
  ov.forEach((p, i) => {
    const x = 20 + (i % 2) * (cw + gap), y = 70 + Math.floor(i / 2) * (ch + 8);
    painel(ctx, x, y, cw, ch, p.current ? COR.ouro : COR.borda);
    texto(ctx, `${p.index}`, x + 10, y + 9, COR.dim, 12);
    texto(ctx, p.nome, x + 26, y + 8, p.current ? COR.ouro : COR.texto, 14);
    const cor = { 'você está aqui': COR.ouro, 'concluída': COR.ok, 'não visitada': COR.dim }[p.status] ?? COR.texto;
    texto(ctx, p.status, x + 26, y + 26, cor, 11);
    const L = game.world[p.id];
    const s = 4, mx = x + 10, my = y + 46;
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
    const bx = x + 150, bw = cw - 150 - 12;
    const linhas = [
      ['exploração', `${p.percent}%`, p.visited, p.walkable],
      ['reparos', p.blockers ? `${p.repaired}/${p.blockers}` : '—', p.repaired, p.blockers],
      ['falhas vencidas', `${p.defeated}/${p.foes}`, p.defeated, p.foes],
      ['materiais', p.pickups ? `${p.collected}/${p.pickups}` : '—', p.collected, p.pickups],
      ['chefe', p.boss === 'derrotado' ? 'derrotado' : 'vivo', p.boss === 'derrotado' ? 1 : 0, 1],
    ];
    linhas.forEach(([rot, val, feito, total], k) => {
      const ty = y + 42 + k * 17;
      texto(ctx, rot, bx, ty, COR.dim, 10);
      texto(ctx, String(val), bx + bw, ty, COR.texto, 10, 'right');
      barra(ctx, bx, ty + 12, bw, 3, total ? feito : 0, total || 1, COR.ok);
    });
  });
}

export function linhasDoMenuDeToque(game) {
  return botoesDeToque(game);
}

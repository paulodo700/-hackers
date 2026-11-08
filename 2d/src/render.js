// Renderização em canvas 2D. Só lê o estado (game.js) e o progresso (progress.js); não altera regras.
import { LAYERS } from './layers.js';
import { FOES, RECIPES, MATERIAL_NOMES, TOOL_NOMES } from './content.js';
import {
  DOWN, UP, GOAL, NPC, SOCKET, GATE, DAMAGED, TRACE, FLOOR, WALL, PICKUP_ITEMS, FOE_CHARS, cellKey,
} from './grid.js';
import { chipOverview, overallPercent } from './progress.js';

export const TILE = 34;
export const MAP_X = 20;
export const MAP_Y = 44;
const PICK_COLOR = { a: '#e3a54a', w: '#ff9f5a', k: '#7dd3fc' };
const FOE_COLOR = { f: '#ff6b6b', F: '#ffb020', Q: '#d66bff', V: '#7ef0c9' };

const COLOR = {
  bg: '#07090d',
  wall: '#1d2a36',
  wallEdge: '#2b3d4d',
  floor: '#0f141b',
  trace: '#8a5a2b',
  damaged: '#7a1d1d',
  gate: '#7a6a14',
  socket: '#0f4f57',
  up: '#4fd1c5',
  goal: '#ffd166',
  npc: '#f5e6a8',
  player: '#e8f1ff',
  fog: 'rgba(3, 5, 8, 0.82)',
  text: '#dfe9f3',
  dim: '#7b8a99',
  ok: '#7dd3a0',
  debug: '#78dcff',
};

function drawTile(ctx, ch, x, y) {
  ctx.fillStyle = ch === '#' ? COLOR.wall : COLOR.floor;
  ctx.fillRect(x, y, TILE, TILE);
  if (ch === '#') {
    ctx.strokeStyle = COLOR.wallEdge;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    return;
  }
  if (ch === TRACE) {
    ctx.fillStyle = COLOR.trace;
    ctx.fillRect(x + 4, y + TILE / 2 - 3, TILE - 8, 6);
  } else if (ch === DAMAGED) {
    ctx.fillStyle = COLOR.damaged;
    ctx.fillRect(x + 4, y + TILE / 2 - 3, TILE - 8, 6);
    ctx.strokeStyle = '#ff5a5a';
    ctx.beginPath(); ctx.moveTo(x + TILE / 2 - 4, y + 4); ctx.lineTo(x + TILE / 2 + 2, y + TILE - 4); ctx.stroke();
  } else if (ch === GATE) {
    ctx.fillStyle = COLOR.gate;
    ctx.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
  } else if (ch === SOCKET) {
    ctx.strokeStyle = COLOR.socket;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.lineWidth = 1;
  } else if (ch === UP || ch === DOWN || ch === GOAL) {
    ctx.fillStyle = ch === GOAL ? COLOR.goal : COLOR.up;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch === GOAL ? '◎' : ch, x + TILE / 2, y + TILE / 2 + 1);
  } else if (PICKUP_ITEMS[ch]) {
    ctx.fillStyle = PICK_COLOR[ch];
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2); ctx.fill();
  } else if (FOE_CHARS[ch]) {
    ctx.fillStyle = FOE_COLOR[ch] || '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, y + 5);
    ctx.lineTo(x + TILE - 5, y + TILE - 6);
    ctx.lineTo(x + 5, y + TILE - 6);
    ctx.closePath();
    ctx.fill();
  } else if (ch === NPC) {
    ctx.fillStyle = COLOR.npc;
    ctx.fillRect(x + 9, y + 7, TILE - 18, TILE - 14);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 13, y + 12, 3, 3);
    ctx.fillRect(x + TILE - 16, y + 12, 3, 3);
  }
}

function drawPlayer(ctx, p, x, y) {
  ctx.fillStyle = COLOR.player;
  ctx.beginPath();
  ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b6cb0';
  const cx = x + TILE / 2 + p.fc * TILE * 0.18, cy = y + TILE / 2 + p.fr * TILE * 0.18;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
}

function bar(ctx, x, y, w, h, value, max, color) {
  ctx.fillStyle = '#1a222c';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(w, (w * value) / (max || 1))), h);
}

function panel(ctx, x, y, w, h, border = '#34495e') {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function text(ctx, s, x, y, color = COLOR.text, size = 13, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
}

// Tela de jogo normal, ou o mapa do chip quando ele está aberto.
export function draw(ctx, game, ui = {}) {
  if (game.mapOpen) {
    drawChipMap(ctx, game);
    return;
  }
  const { width } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, width, ctx.canvas.height);
  const grid = game.grid;
  const p = game.player;
  const order = Object.keys(game.world);

  text(ctx, LAYERS[p.layer].nome, MAP_X, 12, COLOR.text, 16);
  text(ctx, `camada ${order.indexOf(p.layer) + 1} de ${order.length}`, width - 20, 14, COLOR.dim, 12, 'right');

  for (let r = 0; r < grid.h; r++) {
    for (let c = 0; c < grid.rows[r].length; c++) {
      const x = MAP_X + c * TILE, y = MAP_Y + r * TILE;
      drawTile(ctx, grid.rows[r][c], x, y);
      if (!game.debug && !game.layer.visited.has(cellKey(c, r))) {
        ctx.fillStyle = COLOR.fog;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  drawPlayer(ctx, p, MAP_X + p.c * TILE, MAP_Y + p.r * TILE);

  if (game.debug) {
    const view = game.debugView();
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
    for (let r = 0; r < grid.h; r++) {
      for (let c = 0; c < grid.rows[r].length; c++) {
        const x = MAP_X + c * TILE, y = MAP_Y + r * TILE;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (game.layer.visited.has(cellKey(c, r))) {
          ctx.fillStyle = 'rgba(80, 200, 120, 0.12)';
          ctx.fillRect(x, y, TILE, TILE);
        }
        ctx.fillStyle = 'rgba(160, 200, 255, 0.7)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${c},${r}`, x + 2, y + 2);
      }
    }
    text(ctx, `DEBUG  visitadas ${view.visitedCount}  caminháveis ${view.walkableCount}  jogador ${view.player.c},${view.player.r}`, MAP_X, MAP_Y + grid.h * TILE + 6, COLOR.debug, 12);
  }

  const hy = MAP_Y + grid.h * TILE + 28;
  text(ctx, `Vida ${p.hp}/${p.maxHp}`, MAP_X, hy);
  bar(ctx, MAP_X + 120, hy + 3, 180, 10, p.hp, p.maxHp, '#e05d5d');
  const mats = Object.entries(game.materials).map(([m, n]) => `${MATERIAL_NOMES[m]} ${n}`).join('   ');
  text(ctx, mats, MAP_X, hy + 20, COLOR.dim, 12);
  const tools = Object.entries(game.tools).map(([t, n]) => `${TOOL_NOMES[t]} ${n}`).join('   ');
  text(ctx, `Ferramentas: ${tools}`, MAP_X, hy + 38, COLOR.dim, 12);
  text(ctx, 'Setas/WASD mover · E falar · R usar · C criar · M mapa · F3 depurar', MAP_X, hy + 58, '#55657a', 11);
  text(ctx, ui.saveStatus || '', MAP_X, hy + 74, '#55657a', 11);

  const logY = hy + 96;
  game.log.slice(-4).forEach((line, i) => text(ctx, `· ${line}`, MAP_X, logY + i * 16, COLOR.text, 12));

  if (game.dialog) {
    panel(ctx, MAP_X, MAP_Y + 4, grid.w * TILE, 56);
    text(ctx, game.dialog.speaker, MAP_X + 10, MAP_Y + 10, COLOR.npc, 13);
    text(ctx, game.dialog.text, MAP_X + 10, MAP_Y + 30, COLOR.text, 13);
  }

  if (game.battle) {
    const b = game.battle, foe = FOES[b.foe];
    const pw = 300, px = (width - pw) / 2, py = MAP_Y + 70;
    panel(ctx, px, py, pw, 150);
    text(ctx, `Combate: ${foe.nome}`, px + 12, py + 10, COLOR.text, 15);
    bar(ctx, px + 12, py + 36, pw - 24, 10, Math.max(0, b.hp), foe.hp, '#ff6b6b');
    text(ctx, `Falha ${Math.max(0, b.hp)}/${foe.hp}   Você ${p.hp}/${p.maxHp}`, px + 12, py + 52, COLOR.dim, 12);
    text(ctx, '1 atacar   2 defender   3 fugir', px + 12, py + 90, COLOR.npc, 13);
    text(ctx, game.log[game.log.length - 1] || '', px + 12, py + 116, COLOR.text, 12);
  }

  if (game.craftOpen && !game.battle) {
    const pw = 320, px = (width - pw) / 2, py = MAP_Y + 70;
    panel(ctx, px, py, pw, 150);
    text(ctx, 'Criar ferramenta (1, 2 ou 3)', px + 12, py + 10, COLOR.text, 14);
    Object.entries(RECIPES).forEach(([tool, recipe], i) => {
      const need = Object.entries(recipe).map(([m, n]) => `${n} ${MATERIAL_NOMES[m].split(' ')[0]}`).join(', ');
      text(ctx, `${i + 1}. ${TOOL_NOMES[tool]} (${need})`, px + 12, py + 36 + i * 24, COLOR.text, 12);
    });
    text(ctx, 'C ou Esc fecha', px + 12, py + 124, COLOR.dim, 12);
  }

  if (game.won) {
    panel(ctx, MAP_X + 60, MAP_Y + 120, grid.w * TILE - 120, 90);
    text(ctx, 'Anel zero encontrado', MAP_X + 80, MAP_Y + 138, COLOR.goal, 18);
    text(ctx, 'O processador está funcionando de novo.', MAP_X + 80, MAP_Y + 168, COLOR.text, 13);
  }
}

// Cor de cada célula no mini-mapa do mapa do chip. Null = piso comum.
function miniColor(ch) {
  if (ch === WALL) return COLOR.wall;
  if (ch === TRACE) return '#5a3a1d';
  if (ch === DAMAGED) return COLOR.damaged;
  if (ch === GATE) return COLOR.gate;
  if (ch === SOCKET) return COLOR.socket;
  if (ch === UP || ch === DOWN) return COLOR.up;
  if (ch === GOAL) return COLOR.goal;
  if (ch === NPC) return COLOR.npc;
  if (PICKUP_ITEMS[ch]) return PICK_COLOR[ch];
  if (FOE_CHARS[ch]) return FOE_COLOR[ch] || '#ff6b6b';
  return null;
}

// Mapa do chip: oito camadas em duas colunas, da primeira (dissipador) à última (substrato).
export function drawChipMap(ctx, game) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);
  const overview = chipOverview(game);
  text(ctx, 'Mapa do chip', 20, 14, COLOR.text, 18);
  text(ctx, `exploração total ${overallPercent(overview)}%   ·   M ou Esc fecha`, 20, 40, COLOR.dim, 12);
  const gap = 14, cols = 2, top = 66, ch = 128;
  const cw = (W - 40 - gap) / cols;
  overview.forEach((p, i) => {
    const x = 20 + (i % cols) * (cw + gap);
    const y = top + Math.floor(i / cols) * (ch + 10);
    drawLayerCard(ctx, game, p, x, y, cw, ch);
  });
}

function drawLayerCard(ctx, game, p, x, y, w, h) {
  const layer = game.world[p.id];
  panel(ctx, x, y, w, h, p.current ? COLOR.goal : '#34495e');
  text(ctx, `${p.index}`, x + 10, y + 9, COLOR.dim, 12);
  text(ctx, p.nome, x + 26, y + 8, p.current ? COLOR.goal : COLOR.text, 14);
  const statusColor = { 'você está aqui': COLOR.goal, 'concluída': COLOR.ok, 'não visitada': COLOR.dim }[p.status] || COLOR.text;
  text(ctx, p.status, x + 26, y + 26, statusColor, 11);

  // Mini-mapa: só o que foi visitado aparece; o resto segue em névoa.
  const s = 5, mx = x + 10, my = y + 46;
  for (let r = 0; r < layer.origin.length; r++) {
    for (let c = 0; c < layer.origin[r].length; c++) {
      const px = mx + c * s, py = my + r * s;
      if (!layer.visited.has(cellKey(c, r))) {
        ctx.fillStyle = '#0a0d12';
        ctx.fillRect(px, py, s, s);
        continue;
      }
      const ch = layer.grid.at(c, r);
      ctx.fillStyle = miniColor(ch) || COLOR.floor;
      ctx.fillRect(px, py, s, s);
    }
  }
  ctx.strokeStyle = '#2a3642';
  ctx.strokeRect(mx - 0.5, my - 0.5, layer.origin[0].length * s + 1, layer.origin.length * s + 1);
  if (p.current) {
    const px = mx + game.player.c * s, py = my + game.player.r * s;
    ctx.fillStyle = COLOR.player;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
  }

  // Barras de progresso à direita do mini-mapa.
  const bx = x + 130, bw = w - 130 - 12;
  const rows = [
    ['exploração', `${p.percent}%`, p.visited, p.walkable],
    ['reparos', countText(p.repaired, p.blockers), p.repaired, p.blockers],
    ['falhas vencidas', countText(p.defeated, p.foes), p.defeated, p.foes],
    ['materiais', countText(p.collected, p.pickups), p.collected, p.pickups],
  ];
  rows.forEach(([label, value, done, total], i) => {
    const ty = y + 44 + i * 20;
    text(ctx, label, bx, ty, COLOR.dim, 11);
    text(ctx, value, bx + bw, ty, COLOR.text, 11, 'right');
    const fill = total === 0 ? 1 : done / total;
    bar(ctx, bx, ty + 13, bw, 5, fill, 1, COLOR.ok);
  });
}

function countText(done, total) {
  return total === 0 ? '—' : `${done}/${total}`;
}

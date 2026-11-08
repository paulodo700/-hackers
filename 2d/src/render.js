// Renderização em canvas 2D. Só lê o estado do jogo (game.js) e não altera regras.
import { LAYERS } from './layers.js';
import { FOES, RECIPES, MATERIAL_NOMES, TOOL_NOMES } from './content.js';
import { DOWN, UP, GOAL, NPC, SOCKET, GATE, DAMAGED, TRACE, FLOOR, WALL, PICKUP_ITEMS, FOE_CHARS } from './grid.js';

export const TILE = 34;
export const MAP_X = 20;
export const MAP_Y = 44;
const PICK_COLOR = { a: '#e3a54a', w: '#ff9f5a', k: '#7dd3fc' };
const FOE_COLOR = { f: '#ff6b6b', F: '#ffb020', Q: '#d66bff' };

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
  down: '#4fd1c5',
  goal: '#ffd166',
  npc: '#f5e6a8',
  player: '#e8f1ff',
  fog: 'rgba(3, 5, 8, 0.82)',
  text: '#dfe9f3',
  dim: '#7b8a99',
};

function drawTile(ctx, ch, x, y) {
  let fill = COLOR.floor;
  if (ch === '#') fill = COLOR.wall;
  else if (ch === '=') fill = COLOR.floor;
  ctx.fillStyle = fill;
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
    const color = ch === GOAL ? COLOR.goal : COLOR.up;
    ctx.fillStyle = color;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch === GOAL ? '◎' : ch, x + TILE / 2, y + TILE / 2 + 1);
  } else if (PICKUP_ITEMS[ch]) {
    ctx.fillStyle = PICK_COLOR[ch];
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2); ctx.fill();
  } else if (FOE_CHARS[ch]) {
    ctx.fillStyle = FOE_COLOR[ch];
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
  ctx.fillRect(x, y, Math.max(0, (w * value) / max), h);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#34495e';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function text(ctx, s, x, y, color = COLOR.text, size = 13) {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
}

export function draw(ctx, game) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, width, height);
  const layer = game.layer;
  const grid = game.grid;
  const p = game.player;

  // Cabeçalho
  text(ctx, `${LAYERS[p.layer].nome}`, MAP_X, 12, COLOR.text, 16);
  text(ctx, `camada ${game.world && (Object.keys(game.world).indexOf(p.layer) + 1)} de ${Object.keys(game.world).length}`, width - 150, 14, COLOR.dim, 12);

  // Mapa
  for (let r = 0; r < grid.h; r++) {
    for (let c = 0; c < grid.rows[r].length; c++) {
      const x = MAP_X + c * TILE, y = MAP_Y + r * TILE;
      drawTile(ctx, grid.rows[r][c], x, y);
      if (!game.debug && !layer.visited.has(`${c},${r}`)) {
        ctx.fillStyle = COLOR.fog;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  drawPlayer(ctx, p, MAP_X + p.c * TILE, MAP_Y + p.r * TILE);

  // Depuração: grade, coordenadas e células visitadas
  if (game.debug) {
    const view = game.debugView();
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
    for (let r = 0; r < grid.h; r++) {
      for (let c = 0; c < grid.rows[r].length; c++) {
        const x = MAP_X + c * TILE, y = MAP_Y + r * TILE;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (layer.visited.has(`${c},${r}`)) {
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
    text(ctx, `DEBUG  visitadas ${view.visitedCount}  caminháveis ${view.walkableCount}  jogador ${view.player.c},${view.player.r}`, MAP_X, MAP_Y + grid.h * TILE + 6, '#78dcff', 12);
  }

  // Barra de estado
  const hy = MAP_Y + grid.h * TILE + 28;
  text(ctx, `Vida ${p.hp}/${p.maxHp}`, MAP_X, hy);
  bar(ctx, MAP_X + 120, hy + 3, 180, 10, p.hp, p.maxHp, '#e05d5d');
  const mats = Object.entries(game.materials).map(([m, n]) => `${MATERIAL_NOMES[m]} ${n}`).join('   ');
  text(ctx, mats, MAP_X, hy + 20, COLOR.dim, 12);
  const tools = Object.entries(game.tools).map(([t, n]) => `${TOOL_NOMES[t]} ${n}`).join('   ');
  text(ctx, `Ferramentas: ${tools}`, MAP_X, hy + 38, COLOR.dim, 12);
  text(ctx, 'Setas/WASD mover · E falar · R usar · C criar · F3 depurar', MAP_X, hy + 58, '#55657a', 11);

  // Registro de mensagens
  const logY = hy + 76;
  game.log.slice(-4).forEach((line, i) => text(ctx, `· ${line}`, MAP_X, logY + i * 16, COLOR.text, 12));

  // Diálogo
  if (game.dialog) {
    panel(ctx, MAP_X, MAP_Y + 4, grid.w * TILE, 56);
    text(ctx, game.dialog.speaker, MAP_X + 10, MAP_Y + 10, COLOR.npc, 13);
    text(ctx, game.dialog.text, MAP_X + 10, MAP_Y + 30, COLOR.text, 13);
  }

  // Combate
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

  // Criação de ferramentas
  if (game.craftOpen && !game.battle) {
    const pw = 320, px = (width - pw) / 2, py = MAP_Y + 70;
    panel(ctx, px, py, pw, 150);
    text(ctx, 'Criar ferramenta (1, 2 ou 3)', px + 12, py + 10, COLOR.text, 14);
    Object.entries(RECIPES).forEach(([tool, recipe], i) => {
      const need = Object.entries(recipe).map(([m, n]) => `${n} ${MATERIAL_NOMES[m].split(' ')[0]}`).join(', ');
      text(ctx, `${i + 1}. ${TOOL_NOMES[tool]} (${need})`, px + 12, py + 36 + i * 24, COLOR.text, 12);
    });
    text(ctx, 'C fecha', px + 12, py + 124, COLOR.dim, 12);
  }

  // Fim
  if (game.won) {
    panel(ctx, MAP_X + 60, MAP_Y + 120, grid.w * TILE - 120, 90);
    text(ctx, 'Anel zero encontrado', MAP_X + 80, MAP_Y + 138, COLOR.goal, 18);
    text(ctx, 'O processador está funcionando de novo.', MAP_X + 80, MAP_Y + 168, COLOR.text, 13);
  }
}

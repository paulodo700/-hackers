// Renderização no estilo de ARPG sombrio: visão de cima com luz e sombra, orbes de vida e energia, barra de
// ações, molduras de pedra e ouro, números de dano e efeitos. O gênero é a inspiração; não há marca, fonte
// proprietária nem arte de terceiros. Só lê o estado do jogo; não altera regras.
import { drawSprite, spriteInfo, wallVariant } from './art/index.js';
import { LAYERS, LAYER_ORDER } from './layers.js';
import {
  WALL, TRACE, DAMAGED, GATE, SOCKET, DOOR, CHEST, HOT, COOL, KEY, UP, DOWN, GOAL, PICKUP_ITEMS, cellKey,
} from './grid.js';
import { chipOverview, overallPercent } from './progress.js';
import { itensDoMenu } from './menus.js';
import { estatisticas, xpParaProximo } from './systems/stats.js';
import { contar } from './systems/items.js';
import { TEMA, corRaridade, corElemento, hexParaRgb, avancarFantasma, pulsar, posicaoNaGrade, quebrarTexto } from './render/tema.js';
import { texto, textoComContorno, quadro, moldura, divisor, brilho, sombra, orbe, barra, botao } from './render/desenho.js';
import { Luz } from './render/luz.js';
import { Efeitos } from './render/efeitos.js';
import { W, H, TILE, VISAO, PAINEL, BARRA, CENTRO, ORBE_VIDA, ORBE_ENERGIA, ARENA } from './render/layout.js';

export { W, H, TILE, VISAO };

const DIRS_TECLA = { up: 0, down: 2, left: 4, right: 6 };
const ITEM_DO_MAPA = { ...PICKUP_ITEMS, [KEY]: 'chave_nucleo' };
const LUZ_RARIDADE = { raro: '#6aa9ff', epico: '#ffb640' };
const INVENTARIO = [
  'liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico', 'fragmento_escuro',
  'reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'chave_nucleo', 'pasta_termica', 'kit_reparo',
];
const ACOES = [['E', 'Falar'], ['R', 'Usar'], ['C', 'Criar'], ['I', 'Inv.'], ['Z', 'Esperar'], ['K', 'Habil.'], ['J', 'Diário'], ['M', 'Mapa']];
const ESCURIDAO = 0.4;
const VIDA = { cor: '#e0352b', escura: '#3d0707' };
const ENERGIA = { cor: '#3d8bff', escura: '#07183d' };

// Estado só de apresentação (efeitos, luz e barras fantasma). Fica fora do jogo: não é salvo nem muda regras.
export const visual = { efeitos: new Efeitos(), luz: new Luz(), fantasmaHp: null, fantasmaEp: null };

export function reiniciarVisual() {
  visual.efeitos.reiniciar();
  visual.fantasmaHp = null;
  visual.fantasmaEp = null;
}

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

// Tempo visual: barras fantasma, efeitos e poeira no ar. Chamado a cada quadro, antes de desenhar.
export function atualizarVisual(game, dt = 16) {
  const p = game.player;
  visual.fantasmaHp = avancarFantasma(visual.fantasmaHp ?? p.hp, p.hp, dt);
  visual.fantasmaEp = avancarFantasma(visual.fantasmaEp ?? p.ep, p.ep, dt);
  visual.efeitos.atualizar(dt);
  if (Math.random() < dt / 110) visual.efeitos.poeira(camera.x + Math.random() * VISAO.w, camera.y + Math.random() * VISAO.h);
  if (p.calor >= 40 && Math.random() < dt / 240) visual.efeitos.brasa(camera.x + Math.random() * VISAO.w, camera.y + VISAO.h - 24);
}

const sx = (c) => VISAO.x + c * TILE - camera.x;
const sy = (r) => VISAO.y + r * TILE - camera.y;

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

// Desenha a tela inteira.
export function draw(ctx, game, ui = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050407';
  ctx.fillRect(0, 0, W, H);
  if (game.mapOpen) { desenharMapaDoChip(ctx, game); return; }
  const t = ui.t ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  ctx.clip();
  const tremor = visual.efeitos.tremor;
  if (tremor > 0) ctx.translate((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor);
  desenharMundo(ctx, game, t);
  ctx.restore();
  desenharMolduraDaVisao(ctx);
  desenharTopo(ctx, game, ui);
  desenharPainel(ctx, game);
  desenharBarraInferior(ctx, game, t);
  if (game.dialog) desenharDialogo(ctx, game);
  if (game.battle) desenharCombate(ctx, game, t);
  if (game.menu && !game.battle) desenharMenu(ctx, game);
  if (game.menu && game.battle) desenharSubmenuCombate(ctx, game);
  // Por cima de tudo, na área do mapa: números e faíscas da batalha, véu de flash e faixas de título.
  visual.efeitos.desenharParticulas(ctx, 0, 0, 0, 0, { tela: true });
  visual.efeitos.desenharTextos(ctx, 0, 0, 0, 0, { tela: true });
  visual.efeitos.desenharFlash(ctx, VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  visual.efeitos.desenharBanners(ctx, VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  if (game.debug) desenharDepuracao(ctx, game);
  if (game.won) desenharFim(ctx, t);
}

// Mundo: terreno com névoa, itens, técnicos, falhas e Bit. Depois, luz e sombra, efeitos e números.
function desenharMundo(ctx, game, t) {
  const L = game.layerState();
  const g = L.grid;
  const p = game.player;
  const tema = LAYERS[p.camada].tema;
  ctx.fillStyle = tema.fundo;
  ctx.fillRect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  const c0 = Math.max(0, Math.floor(camera.x / TILE) - 1), c1 = Math.min(g.w - 1, Math.ceil((camera.x + VISAO.w) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(camera.y / TILE) - 1), r1 = Math.min(g.h - 1, Math.ceil((camera.y + VISAO.h) / TILE) + 1);
  const visto = (c, r) => game.debug || L.visited.has(cellKey(c, r));
  const luzes = [];
  // Luz em coordenadas do buffer (relativas à área do mapa). cor em hex; sem cor, só abre um buraco na escuridão.
  const luzEm = (c, r, raio, cor, forca) => luzes.push({
    x: sx(c) + TILE / 2 - VISAO.x, y: sy(r) + TILE / 2 - VISAO.y, raio, cor: cor ? hexParaRgb(cor) : null, forca,
  });

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = sx(c), y = sy(r);
      const ch = g.rows[r][c] ?? WALL;
      const ok = visto(c, r);
      drawSprite(ctx, terrenoSprite(g, c, r, ch), x, y, { scale: 2 });
      const item = ITEM_DO_MAPA[ch];
      if (item) {
        drawSprite(ctx, item, x + 8, y + 8, { scale: 1 });
        if (ok) {
          const raridade = game.catalog.itens[item]?.raridade;
          luzEm(c, r, raridade && raridade !== 'comum' ? 40 : 26, LUZ_RARIDADE[raridade], 0.7);
        }
      }
      if (ok) {
        if (ch === HOT) luzEm(c, r, 38, '#ff6a2a', 0.55);
        else if (ch === COOL) luzEm(c, r, 38, '#5ac8ff', 0.5);
        else if (ch === CHEST) luzEm(c, r, 40, '#ffc766', 0.6);
        else if (ch === DOWN || ch === UP || ch === GOAL) luzEm(c, r, 72, '#ffd98a', 0.8);
      }
      if (game.debug) {
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
      if (!ok) {
        ctx.fillStyle = 'rgba(3, 5, 8, 0.9)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

  // Técnicos e mercadores: nome aparece quando Bit está perto.
  for (const n of L.npcs) {
    if (n.c < c0 || n.c > c1 || n.r < r0 || n.r > r1 || !visto(n.c, n.r)) continue;
    const info = game.catalog.npcs[n.id];
    const x = sx(n.c), y = sy(n.r);
    sombra(ctx, x + TILE / 2, y + TILE - 3, 10, 3.5, 0.45);
    drawSprite(ctx, info?.sprite ?? 'tecnico_a', x, y, { scale: 2 });
    luzEm(n.c, n.r, 60, '#ffdca0', 0.6);
    if (Math.abs(n.c - p.c) + Math.abs(n.r - p.r) <= 2 && info) {
      textoComContorno(ctx, info.nome, x + TILE / 2, y - 9, TEMA.ouroClaro, 12, 'center', 'titulo');
    }
  }

  // Falhas e chefe: balançam, têm sombra no chão e luz da cor do elemento (o chefe, vermelha e maior).
  for (const e of L.entities) {
    if (e.c < c0 || e.c > c1 || e.r < r0 || e.r > r1 || !visto(e.c, e.r)) continue;
    const info = spriteInfo(e.foe);
    const w = info.w * 2, h = info.h * 2;
    const x = sx(e.c) + (TILE - w) / 2;
    const base = sy(e.r) + TILE - h + Math.sin(t / 260 + e.c * 0.7) * 1.5;
    sombra(ctx, x + w / 2, sy(e.r) + TILE - 2, w * 0.36, 4, 0.5);
    drawSprite(ctx, e.foe, x, base, { scale: 2 });
    if (e.boss) luzes.push({ x: x + w / 2 - VISAO.x, y: base + h / 2 - VISAO.y, raio: 100, cor: hexParaRgb('#ff4a3a'), forca: 0.85 });
    else luzEm(e.c, e.r, 46, corElemento(game.catalog.falhas[e.foe]?.elemento), 0.55);
  }

  // Bit: anda com quadros alternados; a direção vem do último passo. A luz é mais quente com calor alto.
  const passo = p.passos % 2;
  const dir = p.fr === 1 ? DIRS_TECLA.down : p.fr === -1 ? DIRS_TECLA.up : p.fc === -1 ? DIRS_TECLA.left : DIRS_TECLA.right;
  const bx = sx(p.c), by = sy(p.r) + Math.sin(t / 220) * 1.2;
  sombra(ctx, bx + TILE / 2, sy(p.r) + TILE - 2, 11, 3.5, 0.55);
  drawSprite(ctx, 'bit', bx, by, { scale: 2, frame: dir + passo });
  luzes.push({
    x: bx + TILE / 2 - VISAO.x, y: by + TILE / 2 - VISAO.y,
    raio: 178 + Math.sin(t / 180) * 8, cor: hexParaRgb(p.calor >= 70 ? '#ff6e32' : '#ffb35c'), forca: 1,
  });

  // Luz e sombra: fora dos círculos de luz, a área escurece; as luzes coloridas se somam por cima.
  visual.luz.aplicar(ctx, VISAO.x, VISAO.y, VISAO.w, VISAO.h, luzes, ESCURIDAO);
  if (p.calor > 40) {
    ctx.fillStyle = `rgba(255, 90, 40, ${Math.min(0.35, (p.calor - 40) / 200)})`;
    ctx.fillRect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  }
  visual.luz.vinheta(ctx, VISAO.x, VISAO.y, VISAO.w, VISAO.h, 0.42);
  visual.luz.granulado(ctx, VISAO.x, VISAO.y, VISAO.w, VISAO.h, 0.04);
  visual.efeitos.desenharParticulas(ctx, VISAO.x, VISAO.y, camera.x, camera.y);
  visual.efeitos.desenharTextos(ctx, VISAO.x, VISAO.y, camera.x, camera.y);
}

function desenharMolduraDaVisao(ctx) {
  ctx.strokeStyle = TEMA.ouroEscuro;
  ctx.lineWidth = 2;
  ctx.strokeRect(VISAO.x + 1, VISAO.y + 1, VISAO.w - 2, VISAO.h - 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.strokeRect(VISAO.x + 3.5, VISAO.y + 3.5, VISAO.w - 7, VISAO.h - 7);
}

// Topo: camada, missão principal em andamento e estado do salvamento.
function desenharTopo(ctx, game, ui) {
  const fundo = ctx.createLinearGradient(0, 0, 0, 40);
  fundo.addColorStop(0, '#2b2015');
  fundo.addColorStop(1, '#0b0805');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, W, 40);
  divisor(ctx, 0, 39, W, TEMA.ouro);
  const camada = game.player.camada;
  texto(ctx, `CAMADA ${LAYER_ORDER.indexOf(camada) + 1} DE ${LAYER_ORDER.length}`, 16, 5, TEMA.textoDim, 10);
  texto(ctx, LAYERS[camada].nome, 16, 18, TEMA.ouroClaro, 16, 'left', 'titulo');
  const missao = missaoAtual(game);
  if (missao) {
    texto(ctx, `◆ ${missao.nome}`, 330, 6, TEMA.ouro, 14, 'left', 'titulo');
    texto(ctx, missao.etapa, 330, 24, TEMA.textoDim, 11);
  } else {
    texto(ctx, 'Sem missão principal ativa', 330, 14, TEMA.textoDim, 12);
  }
  texto(ctx, ui.saveStatus ?? '', W - 14, 14, TEMA.textoDim, 11, 'right');
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

// Painel lateral: retrato de Bit, vida, energia, calor, experiência, estados e minimapa.
function desenharPainel(ctx, game) {
  const p = game.player;
  const st = estatisticas(game);
  const maxHp = Math.max(1, st.maxHp), maxEp = Math.max(1, st.maxEp);
  moldura(ctx, PAINEL.x, PAINEL.y, PAINEL.w, PAINEL.h, { borda: TEMA.ouro, opacidade: 0.96 });
  const cx = PAINEL.x + PAINEL.w / 2;
  textoComContorno(ctx, 'BIT', cx, PAINEL.y + 18, TEMA.ouroClaro, 16, 'center', 'titulo');
  texto(ctx, `Nível ${p.nivel}`, cx, PAINEL.y + 32, TEMA.textoDim, 11, 'center');
  // retrato: quadro escuro com brilho azulado atrás de Bit
  const px = PAINEL.x + 24, py = PAINEL.y + 50, pw = 112;
  quadro(ctx, px, py, pw, pw, TEMA.ouro, '#06080d');
  brilho(ctx, px + pw / 2, py + pw / 2, 56, 'rgba(60, 120, 255, 1)', 0.22);
  drawSprite(ctx, 'bit', px + 16, py + 16, { scale: 5, frame: 0 });
  const xpMax = Math.max(1, xpParaProximo(p.nivel));
  barra(ctx, PAINEL.x + 14, py + pw + 10, PAINEL.w - 28, 6, p.xp / xpMax, TEMA.ouro);
  // linhas de atributo: ícone, nome, valor e barra
  const linha = (y, rotulo, valor, frac, cor, icone, fant = null) => {
    drawSprite(ctx, icone, PAINEL.x + 14, y, { scale: 2 });
    texto(ctx, rotulo, PAINEL.x + 36, y - 1, TEMA.textoDim, 10);
    texto(ctx, valor, PAINEL.x + PAINEL.w - 14, y - 1, TEMA.texto, 10, 'right');
    barra(ctx, PAINEL.x + 36, y + 14, PAINEL.w - 50, 6, frac, cor, fant);
  };
  const y0 = py + pw + 26;
  linha(y0, 'Vida', `${p.hp}/${st.maxHp}`, p.hp / maxHp, VIDA.cor, 'icone_coracao', visual.fantasmaHp / maxHp);
  linha(y0 + 32, 'Energia', `${p.ep}/${st.maxEp}`, p.ep / maxEp, ENERGIA.cor, 'icone_energia', visual.fantasmaEp / maxEp);
  linha(y0 + 64, 'Calor', `${Math.round(p.calor)}`, p.calor / 100, p.calor >= 70 ? '#ff3b2f' : '#ff7a3d', 'icone_calor');
  // estados ativos (combate ou efeitos de itens)
  let xs = PAINEL.x + 14;
  for (const e of p.estados.slice(0, 6)) {
    drawSprite(ctx, `status_${e.id}`, xs, y0 + 96, { scale: 2 });
    xs += 18;
  }
  texto(ctx, `◉ ${game.ciclos} ciclos`, PAINEL.x + 14, y0 + 122, TEMA.ouroClaro, 11);
  texto(ctx, `+ ${p.pontos} pontos de habilidade`, PAINEL.x + 14, y0 + 138, TEMA.textoDim, 10);
  minimapa(ctx, game, PAINEL.x + 8, PAINEL.y + PAINEL.h - 104);
}

// Minimapa: cada célula visitada aparece; Bit é um ponto branco e as falhas, pontos vermelhos.
function minimapa(ctx, game, x, y) {
  const L = game.layerState();
  const g = L.grid;
  const s = Math.min(144 / g.w, 96 / g.h);
  ctx.fillStyle = '#040305';
  ctx.fillRect(x - 2, y - 2, g.w * s + 4, g.h * s + 4);
  for (let r = 0; r < g.h; r++) {
    for (let c = 0; c < g.w; c++) {
      if (!L.visited.has(cellKey(c, r))) continue;
      const ch = g.rows[r][c];
      ctx.fillStyle = ch === WALL ? '#2b2620' : ch === DOWN || ch === GOAL ? TEMA.ouroClaro : ch === COOL ? '#7dd3fc' : ch === HOT ? '#ff7a3d' : '#15110d';
      ctx.fillRect(x + c * s, y + r * s, Math.max(1, s), Math.max(1, s));
    }
  }
  for (const e of L.entities) {
    if (!L.visited.has(cellKey(e.c, e.r))) continue;
    ctx.fillStyle = e.boss ? '#ff3b2f' : '#c0392b';
    ctx.fillRect(x + e.c * s, y + e.r * s, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + game.player.c * s - 1, y + game.player.r * s - 1, 3, 3);
  ctx.strokeStyle = TEMA.ouro;
  ctx.strokeRect(x - 2.5, y - 2.5, g.w * s + 5, g.h * s + 5);
}

// Barra inferior: orbes de vida e energia nas laterais; no centro, registro, barra de ações e inventário.
function desenharBarraInferior(ctx, game, t) {
  const p = game.player;
  const st = estatisticas(game);
  const fundo = ctx.createLinearGradient(0, BARRA.y, 0, BARRA.y + BARRA.h);
  fundo.addColorStop(0, '#221810');
  fundo.addColorStop(0.35, '#0d0908');
  fundo.addColorStop(1, '#030203');
  ctx.fillStyle = fundo;
  ctx.fillRect(BARRA.x, BARRA.y, BARRA.w, BARRA.h);
  divisor(ctx, 0, BARRA.y, W, TEMA.ouro);

  orbeComNumeros(ctx, ORBE_VIDA, p.hp, st.maxHp, VIDA, visual.fantasmaHp, t);
  orbeComNumeros(ctx, ORBE_ENERGIA, p.ep, st.maxEp, ENERGIA, visual.fantasmaEp, t);

  quadro(ctx, CENTRO.x, CENTRO.y, CENTRO.w, CENTRO.h, TEMA.ouroEscuro, 'rgba(12, 9, 7, 0.94)');
  // registro: as três últimas mensagens; a mais nova é a mais clara
  const log = game.log.slice(-3);
  log.forEach((linha, i) => {
    const s = linha.length > 84 ? `${linha.slice(0, 83)}…` : linha;
    texto(ctx, `· ${s}`, CENTRO.x + 14, CENTRO.y + 10 + i * 16, i === log.length - 1 ? TEMA.texto : TEMA.textoDim, 12);
  });
  // barra de ações: as teclas do jogo, em slots de pedra e ouro
  const larg = 56, espaco = 8, ay = CENTRO.y + 60;
  const ax0 = CENTRO.x + (CENTRO.w - (ACOES.length * larg + (ACOES.length - 1) * espaco)) / 2;
  ACOES.forEach(([tecla, rotulo], i) => botao(ctx, ax0 + i * (larg + espaco), ay, larg, 40, { tecla, rotulo }));
  // inventário: materiais e ferramentas com a cor da raridade na borda
  INVENTARIO.forEach((id, i) => {
    const pos = posicaoNaGrade(i, INVENTARIO.length, 40, 6, CENTRO.x + (CENTRO.w - (INVENTARIO.length * 40 + (INVENTARIO.length - 1) * 6)) / 2, CENTRO.y + 118);
    slotItem(ctx, game, id, pos.x, pos.y, 40);
  });
  texto(ctx, 'Tab menu · F3 depurar · N novo jogo', CENTRO.x + CENTRO.w / 2, CENTRO.y + 182, TEMA.textoDim, 10, 'center');
}

function orbeComNumeros(ctx, o, atual, max, cores, fant, t) {
  const m = Math.max(1, max);
  orbe(ctx, o.x, o.y, o.r, atual / m, cores.cor, cores.escura, t, fant / m);
  textoComContorno(ctx, `${atual}`, o.x, o.y - 7, '#fff4ea', 20, 'center', 'titulo');
  textoComContorno(ctx, `/ ${max}`, o.x, o.y + 14, TEMA.textoDim, 11, 'center', 'texto', 'rgba(0,0,0,0.95)', 3);
}

function slotItem(ctx, game, id, x, y, lado) {
  const qtd = contar(game, id);
  const raridade = game.catalog.itens[id]?.raridade;
  quadro(ctx, x, y, lado, lado, qtd ? corRaridade(raridade) : '#2b2218', qtd ? 'rgba(22, 16, 11, 0.96)' : 'rgba(9, 7, 5, 0.9)');
  const info = spriteInfo(id);
  drawSprite(ctx, id, x + (lado - info.w * 2) / 2, y + (lado - info.h * 2) / 2, { scale: 2, alpha: qtd ? 1 : 0.28 });
  if (qtd) textoComContorno(ctx, String(qtd), x + lado - 5, y + lado - 9, TEMA.texto, 11, 'right', 'texto', 'rgba(0,0,0,0.95)', 3);
}

// Caixa de diálogo com retrato de técnico, fala e opções.
function desenharDialogo(ctx, game) {
  const d = game.dialog;
  const npc = game.catalog.npcs[d.npc];
  const x = VISAO.x + 14, w = VISAO.w - 28;
  const ops = d.opcoes ?? [];
  const h = ops.length ? 128 + 20 * ops.length : 118;
  const y = VISAO.y + VISAO.h - h - 14;
  moldura(ctx, x, y, w, h, { borda: TEMA.arcanoClaro, opacidade: 0.96 });
  quadro(ctx, x + 14, y + 14, 64, 64, TEMA.arcanoClaro, '#070a12');
  drawSprite(ctx, npc?.sprite ?? 'tecnico_a', x + 22, y + 22, { scale: 3 });
  texto(ctx, npc?.nome ?? 'Técnico', x + 92, y + 16, TEMA.ouroClaro, 16, 'left', 'titulo');
  divisor(ctx, x + 92, y + 40, w - 120, TEMA.ouro);
  quebrarTexto(d.fala ?? '', 84).slice(0, 3).forEach((l, i) => texto(ctx, l, x + 92, y + 48 + i * 17, TEMA.texto, 13));
  ops.forEach((o, i) => {
    const sel = i === (d.cursor ?? 0);
    texto(ctx, `${sel ? '▸' : ' '} ${i + 1}. ${o.texto}`, x + 92, y + 104 + i * 20, sel ? TEMA.ouroClaro : TEMA.texto, 13);
  });
  texto(ctx, ops.length ? 'Enter escolhe · Esc sai' : 'Enter continua', x + w - 14, y + h - 18, TEMA.textoDim, 11, 'right');
}

// Combate: arena com a falha, Bit, barra de vida da falha, ações e o estado de Bit.
function desenharCombate(ctx, game, t) {
  const b = game.battle;
  const foe = game.catalog.falhas[b.foeId];
  const A = ARENA;
  const chao = A.y + 230;
  const balanco = Math.sin(t / 240) * 4;
  const st = estatisticas(game);
  ctx.fillStyle = 'rgba(3, 2, 6, 0.74)';
  ctx.fillRect(VISAO.x, VISAO.y, VISAO.w, VISAO.h);
  moldura(ctx, A.x, A.y, A.w, A.h, { borda: b.boss ? TEMA.sangueClaro : TEMA.ouro, opacidade: 0.97 });
  textoComContorno(ctx, foe.nome, A.x + A.w / 2, A.y + 22, b.boss ? '#ff9a88' : TEMA.ouroClaro, b.boss ? 22 : 18, 'center', 'titulo');
  if (b.boss) texto(ctx, `fase ${b.fase + 1}`, A.x + A.w / 2, A.y + 38, TEMA.textoDim, 11, 'center');
  barra(ctx, A.x + 90, A.y + 56, A.w - 180, 14, Math.max(0, b.hp) / Math.max(1, b.maxHp), b.boss ? '#c0281d' : '#8e3a2c');
  texto(ctx, `Falha ${Math.max(0, b.hp)}/${b.maxHp}`, A.x + A.w / 2, A.y + 74, TEMA.textoDim, 11, 'center');
  if (b.telegrafo) {
    ctx.save();
    ctx.globalAlpha = pulsar(t, 150, 0.25, 0.75);
    textoComContorno(ctx, `⚠ ${game.catalog.ataques[b.telegrafo]?.telegrafo ?? 'algo se prepara'}`, A.x + A.w / 2, A.y + 96, '#ffb640', 13, 'center', 'texto');
    ctx.restore();
  }
  // palco: luz e sombra sob cada combatente
  brilho(ctx, A.x + 170, chao - 30, 120, 'rgba(255, 214, 150, 1)', 0.2);
  sombra(ctx, A.x + 170, chao, 34, 8, 0.6);
  drawSprite(ctx, 'bit', A.x + 170 - 32, chao - 64 + balanco, { scale: 4, frame: 6 + (game.player.passos % 2) });
  const fs = b.boss ? 4 : 5;
  const info = spriteInfo(b.foeId);
  const fw = info.w * fs, fh = info.h * fs;
  const fx = A.x + A.w - 170;
  brilho(ctx, fx, chao - fh / 2, b.boss ? 150 : 110, b.boss ? 'rgba(255, 60, 45, 1)' : 'rgba(255, 200, 120, 1)', b.boss ? pulsar(t, 300, 0.08, 0.3) : 0.16);
  sombra(ctx, fx, chao, fw * 0.36, 9, 0.6);
  drawSprite(ctx, b.foeId, fx - fw / 2, chao - fh - balanco, { scale: fs });
  // ações (linha A)
  const acoes = [['1', 'Atacar'], ['2', 'Habilidade'], ['3', 'Item'], ['4', 'Defender'], ['5', b.fugaPermitida ? 'Fugir' : '(sem fuga)']];
  const largura = 104, espaco = 8;
  const ax0 = A.x + (A.w - (acoes.length * largura + (acoes.length - 1) * espaco)) / 2;
  acoes.forEach(([tecla, rotulo], i) => botao(ctx, ax0 + i * (largura + espaco), A.y + 256, largura, 28, {
    tecla, rotulo, linha: true, desativado: tecla === '5' && !b.fugaPermitida,
  }));
  // estado de Bit (linha B)
  const maxHp = Math.max(1, st.maxHp);
  orbe(ctx, A.x + 52, A.y + 313, 22, game.player.hp / maxHp, VIDA.cor, VIDA.escura, t, visual.fantasmaHp / maxHp);
  texto(ctx, `Você ${game.player.hp}/${st.maxHp}   EP ${game.player.ep}`, A.x + 86, A.y + 292, TEMA.texto, 12);
  const estados = [
    ...game.player.estados.map((e) => game.catalog.status[e.id]?.nome ?? e.id),
    ...b.estados.map((e) => `${game.catalog.status[e.id]?.nome ?? e.id} (falha)`),
  ];
  texto(ctx, estados.join(', ') || 'sem efeitos', A.x + 86, A.y + 310, TEMA.textoDim, 10);
  const ultima = game.log.at(-1) ?? '';
  texto(ctx, ultima.length > 66 ? `${ultima.slice(0, 65)}…` : ultima, A.x + 300, A.y + 302, TEMA.textoDim, 11);
}

// Submenu de habilidades ou itens dentro do combate.
function desenharSubmenuCombate(ctx, game) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const A = ARENA;
  const x = A.x + 40, y = A.y + 14, w = A.w - 80, h = A.h - 28;
  moldura(ctx, x, y, w, h, { borda: TEMA.arcanoClaro, opacidade: 0.98 });
  textoComContorno(ctx, m.tipo === 'batalha_item' ? 'Usar item' : 'Habilidade', x + 20, y + 22, TEMA.ouroClaro, 18, 'left', 'titulo');
  divisor(ctx, x + 18, y + 44, w - 36, TEMA.ouro);
  itens.slice(0, 9).forEach((it, i) => {
    const sel = i === m.cursor;
    const ly = y + 56 + i * 22;
    if (sel) {
      ctx.fillStyle = 'rgba(166, 211, 255, 0.12)';
      ctx.fillRect(x + 12, ly - 3, w - 24, 20);
    }
    texto(ctx, `${i + 1}. ${it.label}`, x + 24, ly, sel ? TEMA.ouroClaro : it.ativo === false ? TEMA.textoDim : TEMA.texto, 13);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrarTexto(det, 110).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 24, y + h - 50 + i * 15, TEMA.textoDim, 11));
  texto(ctx, 'Números escolhem · Esc volta', x + 24, y + h - 20, TEMA.textoDim, 10);
}

// Menu de lista (inventário, habilidades, criação, diário, bestiário, loja ...).
function desenharMenu(ctx, game) {
  const m = game.menu;
  const itens = itensDoMenu(game);
  const x = 150, y = VISAO.y + 24, w = 660, h = 400;
  moldura(ctx, x, y, w, h, { borda: TEMA.arcanoClaro, opacidade: 0.97 });
  const titulos = { principal: 'Menu', status: 'Status', inventario: 'Inventário', habilidades: 'Habilidades', equipamento: 'Equipamento', criar: 'Criar', loja: 'Loja', diario: 'Diário', bestiario: 'Bestiário' };
  textoComContorno(ctx, titulos[m.tipo] ?? m.tipo, x + 22, y + 22, TEMA.ouroClaro, 20, 'left', 'titulo');
  divisor(ctx, x + 18, y + 44, w - 36, TEMA.ouro);
  const max = 11;
  const inicio = Math.max(0, Math.min(m.cursor - 6, itens.length - max));
  itens.slice(inicio, inicio + max).forEach((it, i) => {
    const idx = inicio + i;
    const sel = idx === m.cursor;
    const ly = y + 56 + i * 24;
    if (sel) {
      ctx.fillStyle = 'rgba(166, 211, 255, 0.10)';
      ctx.fillRect(x + 10, ly - 3, w - 20, 22);
      ctx.fillStyle = TEMA.ouroClaro;
      ctx.fillRect(x + 10, ly - 3, 3, 22);
    }
    const item = it.icone ? game.catalog.itens[it.icone] : null;
    if (it.icone) {
      quadro(ctx, x + 20, ly - 3, 22, 22, item ? corRaridade(item.raridade) : TEMA.ouroEscuro, 'rgba(12, 9, 7, 0.95)');
      drawSprite(ctx, it.icone, x + 23, ly, { scale: 1 });
    }
    const cor = sel ? TEMA.ouroClaro : it.ativo === false ? TEMA.textoDim : item ? corRaridade(item.raridade) : TEMA.texto;
    texto(ctx, `${idx + 1}. ${it.label}`, x + (it.icone ? 52 : 22), ly + 2, cor, 13);
  });
  const det = itens[m.cursor]?.detalhe ?? '';
  quebrarTexto(det, 100).slice(0, 2).forEach((l, i) => texto(ctx, l, x + 22, y + h - 56 + i * 16, TEMA.textoDim, 12));
  texto(ctx, 'Setas navegam · Enter escolhe · Esc volta', x + 22, y + h - 20, TEMA.textoDim, 11);
}

function desenharDepuracao(ctx, game) {
  const v = game.debugView();
  texto(ctx, `DEBUG  visitadas ${v.visitedCount}  caminháveis ${v.walkableCount}  Bit ${v.player.c},${v.player.r}`, VISAO.x + 10, VISAO.y + 10, TEMA.arcanoClaro, 11);
}

function desenharFim(ctx, t) {
  brilho(ctx, W / 2, 300, 260, 'rgba(255, 200, 110, 1)', pulsar(t, 400, 0.08, 0.3));
  moldura(ctx, 260, 236, 440, 128, { borda: TEMA.ouroClaro, opacidade: 0.97 });
  textoComContorno(ctx, 'Anel zero encontrado', W / 2, 270, TEMA.ouroClaro, 26, 'center', 'titulo');
  divisor(ctx, 300, 300, 360, TEMA.ouro);
  texto(ctx, 'O processador está funcionando de novo.', W / 2, 316, TEMA.texto, 14, 'center');
}

// Mapa do chip: as oito camadas em duas colunas, com a planta de cada uma e o progresso.
export function desenharMapaDoChip(ctx, game) {
  const fundo = ctx.createLinearGradient(0, 0, 0, H);
  fundo.addColorStop(0, '#140e09');
  fundo.addColorStop(1, '#040305');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, W, H);
  textoComContorno(ctx, 'Mapa do chip', 20, 26, TEMA.ouroClaro, 24, 'left', 'titulo');
  const ov = chipOverview(game);
  texto(ctx, `exploração total ${overallPercent(ov)}%   ·   M ou Esc fecha`, 20, 52, TEMA.textoDim, 12);
  divisor(ctx, 20, 74, W - 40, TEMA.ouro);
  const gap = 14, cw = (W - 40 - gap) / 2, ch = 132;
  ov.forEach((p, i) => {
    const x = 20 + (i % 2) * (cw + gap), y = 86 + Math.floor(i / 2) * (ch + 8);
    moldura(ctx, x, y, cw, ch, { borda: p.current ? TEMA.ouroClaro : TEMA.ouroEscuro, opacidade: 0.95 });
    texto(ctx, `${p.index}`, x + 12, y + 10, TEMA.textoDim, 12);
    texto(ctx, p.nome, x + 28, y + 9, p.current ? TEMA.ouroClaro : TEMA.texto, 15, 'left', 'titulo');
    const cor = { 'você está aqui': TEMA.ouroClaro, 'concluída': '#7dd3a0', 'não visitada': TEMA.textoDim }[p.status] ?? TEMA.texto;
    texto(ctx, p.status, x + 28, y + 29, cor, 11);
    const L = game.world[p.id];
    const tema = LAYERS[p.id].tema;
    const s = 4, mx = x + 12, my = y + 46;
    for (let r = 0; r < L.origin.length; r++) {
      for (let c = 0; c < L.origin[r].length; c++) {
        const visto = L.visited.has(cellKey(c, r));
        ctx.fillStyle = !visto ? '#0a0908' : (L.grid.at(c, r) === WALL ? tema.parede : tema.chao);
        ctx.fillRect(mx + c * s, my + r * s, s, s);
      }
    }
    if (p.current) {
      ctx.fillStyle = '#ffffff';
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
      texto(ctx, rot, bx, ty, TEMA.textoDim, 10);
      texto(ctx, String(val), bx + bw, ty, TEMA.texto, 10, 'right');
      barra(ctx, bx, ty + 12, bw, 3, total ? feito / total : 0, TEMA.ouro);
    });
  });
}

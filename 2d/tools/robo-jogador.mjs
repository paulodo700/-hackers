// Robô de partidas: joga o jogo pela mesma API que a interface usa, para checar se dá para terminar.
// Não é o jogo: é um teste de sanidade (travamentos, bloqueios impossíveis, combates injustos).
// Uso: node tools/robo-jogador.mjs [semente ...] (padrão: 1 2 3)
import { Game } from '../src/game.js';
import { CATALOGO } from '../src/catalog.js';
import { LAYER_ORDER } from '../src/layers.js';
import { WALL, DOWN, GOAL, NPC, MERCHANT, CHEST, DOOR, DAMAGED, GATE, SOCKET, KEY, HOT, COOL, TOOL_CELLS, PICKUP_ITEMS, cellKey, UP, SPAWN } from '../src/grid.js';
import { podeCriar, criar } from '../src/systems/crafting.js';
import { equipar } from '../src/systems/items.js';
import { podeAprender, aprender } from '../src/systems/skills.js';
import { contar, usarConsumivel } from '../src/systems/items.js';
import { habilidadesAprendidas } from '../src/systems/skills.js';
import { avancarDialogo, escolherOpcao } from '../src/systems/dialogue.js';
import { RECEITAS } from '../src/data/recipes.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TRAVA_PARA_O_ROBO = new Set([WALL, NPC, MERCHANT, CHEST, DOOR, DAMAGED, GATE, SOCKET]);
const PRIORIDADE_CRIACAO = ['reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'pasta_termica', 'dissipador_mk1', 'antena_mk1', 'modulo_sinal', 'kit_reparo', 'refrigerante'];

// Caminho mais curto (BFS). Células de ferramenta contam como passáveis se o robô tem a ferramenta.
function caminho(game, alvos) {
  const g = game.grid;
  const inicio = [game.player.c, game.player.r];
  const alvoSet = new Set(alvos.map((a) => cellKey(...a)));
  const prev = new Map([[cellKey(...inicio), null]]);
  const fila = [inicio];
  let achado = null;
  while (fila.length) {
    const cur = fila.shift();
    if (alvoSet.has(cellKey(...cur)) && !(cur[0] === inicio[0] && cur[1] === inicio[1])) { achado = cur; break; }
    for (const [dc, dr] of DIRS) {
      const nc = cur[0] + dc, nr = cur[1] + dr;
      const ch = g.at(nc, nr);
      const k = cellKey(nc, nr);
      if (prev.has(k) || ch === WALL) continue;
      const ferramenta = TOOL_CELLS[ch];
      const bloqueado = TRAVA_PARA_O_ROBO.has(ch) && !(ferramenta && contar(game, ferramenta) > 0) && !alvoSet.has(k);
      if (bloqueado) continue;
      prev.set(k, cur);
      fila.push([nc, nr]);
    }
  }
  if (!achado) return null;
  const rota = [];
  for (let cur = achado; cur; cur = prev.get(cellKey(...cur))) rota.unshift(cur);
  return rota;
}

const adjacentes = (c, r) => DIRS.map(([dc, dr]) => [c + dc, r + dr]);
const adjacenteAInimigo = (game) => game.layerState().entities.some((e) => Math.abs(e.c - game.player.c) + Math.abs(e.r - game.player.r) <= 2);

// Vira para uma célula vizinha e interage (fala, abre baú, usa ferramenta).
function virarPara(game, [c, r]) {
  game.player.fc = c - game.player.c;
  game.player.fr = r - game.player.r;
}

function alvosDoObjetivo(game, tipo) {
  const g = game.grid;
  const out = [];
  for (let r = 0; r < g.h; r++) for (let c = 0; c < g.rows[r].length; c++) {
    const ch = g.rows[r][c];
    if (tipo === 'saida' && (ch === DOWN || ch === GOAL)) out.push([c, r]);
    if (tipo === 'chave' && ch === KEY) out.push([c, r]);
    if (tipo === 'material' && PICKUP_ITEMS[ch]) out.push([c, r]);
    if (tipo === 'bau' && ch === CHEST) out.push([c, r]);
    if (tipo === 'fresco' && (ch === COOL)) out.push([c, r]);
  }
  return out;
}

// Um tick do robô. Devolve false quando não há o que fazer.
export function tick(game, memoria) {
  if (game.won) return false;
  if (game.battle) return lutar(game);
  if (game.dialog) {
    const ops = game.dialog.opcoes ?? [];
    if (ops.length) {
      const i = Math.max(0, ops.findIndex((o) => o.ir !== null && o.ir !== undefined));
      escolherOpcao(game, i >= 0 ? i : 0);
    } else avancarDialogo(game);
    return true;
  }
  if (game.menu) { game.fecharMenu(); return true; }
  if (game.mapOpen) { game.toggleMap(); return true; }
  manutencao(game);
  // Vida baixa e sem inimigo por perto: descansa antes de seguir.
  if (game.player.hp < game.estatisticas().maxHp * 0.6 && !adjacenteAInimigo(game)) { game.esperar(); return true; }
  // Calor alto: pasta térmica se houver; senão vai à zona fria mais próxima e, se já estiver nela, espera.
  if (game.player.calor >= 60 && contar(game, 'pasta_termica') === 0) {
    if (game.grid.at(game.player.c, game.player.r) === COOL && game.player.calor >= 30) { game.esperar(); return true; }
    const frios = alvosDoObjetivo(game, 'fresco');
    if (frios.length && caminho(game, frios)) {
      memoria.alvo = { tipo: 'fresco', celulas: frios, chave: 'fresco' };
    } else if (!adjacenteAInimigo(game)) {
      game.esperar();
      return true;
    }
  }
  // Falhas andam: o alvo de falha é recalculado a cada tique, com as posições atuais.
  // Alvo mantido; as células que já deixaram de servir (coletadas, abertas) saem da lista.
  if (memoria.alvo && memoria.alvo.tipo !== 'npc' && memoria.alvo.tipo !== 'falha') {
    memoria.alvo.celulas = memoria.alvo.celulas.filter(([c, r]) => alvoAindaValido(game, memoria.alvo.tipo, game.grid.at(c, r)));
    if (!memoria.alvo.celulas.length) memoria.alvo = null;
  }
  if (memoria.alvo && !valido(game, memoria)) memoria.alvo = null;
  if (!memoria.alvo) memoria.alvo = escolherAlvo(game, memoria);
  if (!memoria.alvo) return vaguear(game);
  const ok = irPara(game, memoria.alvo.celulas, memoria, memoria.alvo.npc);
  if (!ok) {
    memoria.bloqueados.add(memoria.alvo.chave);
    memoria.alvo = null;
    return vaguear(game);
  }
  return true;
}

// Escolhe o próximo alvo pela prioridade: técnicos ainda não visitados, chave, materiais, baús,
// zona fria (se quente), saída. Ignora alvos que já falharam.
function escolherAlvo(game, memoria) {
  const alcance = (celulas) => celulas.filter((c) => !memoria.bloqueados.has(cellKey(...c)));
  // Abaixo do nível 3, o robô sobe primeiro: encontra as falhas comuns (dão XP) antes de tentar o chefe.
  const comuns = game.layerState().entities.filter((e) => !e.boss);
  // Nível esperado para a camada: 3 na primeira, +2 em cada camada seguinte.
  const nivelAlvo = 3 + 2 * LAYER_ORDER.indexOf(game.player.camada);
  if (comuns.length && game.player.nivel < nivelAlvo) {
    const cel = comuns.map((e) => [e.c, e.r]);
    if (cel.length && caminho(game, cel)) return { tipo: 'falha', celulas: cel, chave: 'falha' };
  }
  const npcs = game.layerState().npcs.filter((n) => n.id && (memoria.falas[n.id] ?? 0) < 2);
  for (const n of npcs) {
    const perto = alcance(adjacentes(n.c, n.r).filter(([c, r]) => !TRAVA_PARA_O_ROBO.has(game.grid.at(c, r))));
    if (perto.length && caminho(game, perto)) return { tipo: 'npc', celulas: perto, npc: n, chave: `npc:${n.id}` };
  }
  const grupos = [['chave', alvosDoObjetivo(game, 'chave')], ['material', alvosDoObjetivo(game, 'material')], ['bau', alvosDoObjetivo(game, 'bau')]];
  if (game.player.calor >= 50) grupos.push(['fresco', alvosDoObjetivo(game, 'fresco')]);
  grupos.push(['saida', alvosDoObjetivo(game, 'saida')]);
  for (const [tipo, celulas] of grupos) {
    const ok = alcance(celulas);
    if (ok.length && caminho(game, ok)) return { tipo, celulas: ok, chave: `${tipo}:${ok.map((c) => c.join(',')).join(';')}` };
  }
  return null;
}

// Uma célula ainda serve ao tipo de alvo?
function alvoAindaValido(game, tipo, ch) {
  if (tipo === 'chave') return ch === KEY;
  if (tipo === 'material') return !!PICKUP_ITEMS[ch];
  if (tipo === 'bau') return ch === CHEST;
  if (tipo === 'fresco') return ch === COOL;
  if (tipo === 'saida') return ch === DOWN || ch === GOAL;
  return true;
}

// O alvo continua valendo? (ainda existe, e o NPC ainda aceita conversa)
function valido(game, memoria) {
  const a = memoria.alvo;
  if (a.tipo === 'npc') return (memoria.falas[a.npc.id] ?? 0) < 2 && game.layerState().npcs.some((n) => n.id === a.npc.id);
  if (a.tipo === 'falha') return game.layerState().entities.some((e) => !e.boss);
  if (a.tipo === 'fresco' && game.player.calor < 40) return false;
  return a.celulas.some(([c, r]) => {
    const ch = game.grid.at(c, r);
    if (a.tipo === 'chave') return ch === KEY;
    if (a.tipo === 'material') return !!PICKUP_ITEMS[ch];
    if (a.tipo === 'bau') return ch === CHEST;
    if (a.tipo === 'fresco') return ch === COOL && game.player.calor >= 40;
    if (a.tipo === 'saida') return ch === DOWN || ch === GOAL;
    return false;
  });
}

// Anda até um dos alvos; se o alvo for um técnico, fala com ele quando chegar ao lado.
function irPara(game, alvos, memoria, npc = null) {
  // Já encostado no técnico: fala logo, sem andar até outra célula vizinha (isso faria o robô oscilar).
  if (npc && Math.abs(npc.c - game.player.c) + Math.abs(npc.r - game.player.r) === 1) {
    virarPara(game, [npc.c, npc.r]);
    memoria.falas[npc.id] = (memoria.falas[npc.id] ?? 0) + 1;
    game.confirmar();
    return true;
  }
  const rota = caminho(game, alvos);
  if (!rota) return false;
  if (rota.length === 1) {
    if (npc) {
      virarPara(game, [npc.c, npc.r]);
      memoria.falas[npc.id] = (memoria.falas[npc.id] ?? 0) + 1;
      game.confirmar();
      return true;
    }
    const ch = game.grid.at(game.player.c, game.player.r);
    void ch;
    return false;
  }
  const [prox] = [rota[1]];
  const ch = game.grid.at(...prox);
  if (TOOL_CELLS[ch] && contar(game, TOOL_CELLS[ch]) > 0) {
    virarPara(game, prox);
    game.useTool();
    return true;
  }
  if (ch === CHEST || ch === NPC || ch === MERCHANT) {
    virarPara(game, prox);
    if (ch === CHEST) game.confirmar();
    return true;
  }
  const d = [prox[0] - game.player.c, prox[1] - game.player.r];
  game.move(...d);
  if (npc && game.player.c === npc.c) void 0;
  return true;
}

function vaguear(game) {
  const dirs = DIRS.filter(([dc, dr]) => game.grid.at(game.player.c + dc, game.player.r + dr) !== WALL);
  const d = dirs[Math.floor(game.rng() * dirs.length)] ?? [1, 0];
  game.move(...d);
  return true;
}

// Criação, equipamento, habilidades e cura fora do combate.
function manutencao(game) {
  for (const id of PRIORIDADE_CRIACAO) {
    if (RECEITAS[id] && podeCriar(game, id).ok) { criar(game, id); break; }
  }
  for (const h of Object.values(game.catalog.habilidades).sort((a, b) => a.nivel - b.nivel)) {
    if (podeAprender(game, h.id).ok) aprender(game, h.id);
  }
  for (const id of Object.keys(game.inv)) {
    const it = game.catalog.itens[id];
    if (it?.tipo === 'equipamento' && !game.player.equip[it.equipamento.slot]) equipar(game, id);
  }
  if (game.player.hp < game.estatisticas().maxHp * 0.5 && contar(game, 'pasta_termica') > 0) usarConsumivel(game, 'pasta_termica');
}

// Combate: defende de ataques telegrafados, cura quando baixa, usa a melhor habilidade, ou ataca.
function lutar(game) {
  const b = game.battle;
  const st = game.estatisticas();
  if (game.player.hp < st.maxHp * 0.35) {
    const cura = ['kit_reparo', 'pasta_termica', 'pulso_reset'].find((id) => contar(game, id) > 0);
    if (cura) return game.acao('item', cura).tipo !== 'semItem' || true;
  }
  if (b.telegrafo) return game.acao('defender') && true;
  const aprendidas = habilidadesAprendidas(game);
  const forte = aprendidas.find((h) => h.custo_ep <= game.player.ep && h.efeitos.some((e) => e.tipo === 'dano'));
  if (forte) game.acao('habilidade', forte.id);
  else game.acao('atacar');
  return true;
}

export function jogar(seed, { maxTicks = 20000 } = {}) {
  const game = new Game({ seed, catalog: CATALOGO });
  const memoria = { falas: {}, alvo: null, bloqueados: new Set() };
  const visitadas = new Set();
  let mortes = 0, ticks = 0, ultimaCamada = game.player.camada, travado = 0, passoAnterior = -1;
  const inicioCamada = { [game.player.camada]: 0 };
  while (!game.won && ticks < maxTicks) {
    const antes = game.player.passos;
    const ok = tick(game, memoria);
    ticks++;
    game.events.length = 0;
    if (game.player.camada !== ultimaCamada) {
      visitadas.add(game.player.camada);
      inicioCamada[game.player.camada] = ticks;
      ultimaCamada = game.player.camada;
    }
    if (game.log.at(-1)?.startsWith('Você caiu')) mortes++;
    if (game.player.camada !== ultimaCamada) memoria.alvo = null;
    if (!ok) break;
    if (game.player.passos === antes && !game.battle && !game.dialog) travado++;
    else travado = 0;
    if (travado > 400) break;
    passoAnterior = game.player.passos;
  }
  const chefes = Object.keys(game.chefes).length;
  return {
    seed,
    vitoria: game.won,
    ticks,
    camada: game.player.camada,
    camadasVisitadas: visitadas.size + 1,
    nivel: game.player.nivel,
    mortes,
    chefes,
    missoesConcluidas: Object.values(game.missoes).filter((m) => m.estado === 'concluida').length,
    ciclos: game.ciclos,
    travado: travado > 400,
    habilidades: game.player.habilidades.length,
    passos: game.player.passos,
    _passoAnterior: passoAnterior,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sementes = process.argv.slice(2).map(Number).filter(Boolean);
  for (const s of sementes.length ? sementes : [1, 2, 3]) {
    const r = jogar(s);
    console.log(JSON.stringify(r));
  }
}

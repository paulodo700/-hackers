// Mundo: calor, inimigos que se movem, contato com falhas, baús, ferramentas, coleta e interação. Sem DOM.
import {
  WALL, FLOOR, HOT, COOL, KEY, BLOCKING, PICKUP_ITEMS, TOOL_CELLS, OPENED, NPC, MERCHANT, CHEST,
} from '../grid.js';

export const REFORCO_VIDA = 8; // vida máxima ganha com cada reforço do núcleo
import { clamp, escolher, escolherPeso } from './util.js';
import { adicionar, remover, contar, nomeItem } from './items.js';
import { aplicarDanoJogador, derrota, iniciarBatalha } from './combat.js';
import { progresso } from './quests.js';
import { iniciarConversa } from './dialogue.js';
import { lojaDoMercador } from './shops.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

// Efeitos de cada passo: calor do chip e contagem de passos. Calor 85+ machuca; 100 machuca mais.
// Devolve true se o calor derrubou Bit.
export function efeitosDoPasso(game) {
  const p = game.player;
  const ch = game.grid.at(p.c, p.r);
  p.passos++;
  if (ch === HOT) {
    p.calor = clamp(p.calor + 4, 0, 100);
    game.emit({ tipo: 'fx', fx: 'fogo', c: p.c, r: p.r });
  } else if (ch === COOL) {
    p.calor = clamp(p.calor - 6, 0, 100);
    game.emit({ tipo: 'fx', fx: 'gelo', c: p.c, r: p.r });
  } else if (p.passos % 2 === 0) {
    p.calor = clamp(p.calor + 1, 0, 100); // terreno neutro esquenta devagar
  }
  if (p.calor >= 85) {
    game.emit({ tipo: 'sfx', id: 'sobreaquecer' });
    if (aplicarDanoJogador(game, p.calor >= 100 ? 3 : 1)) {
      derrota(game);
      return true; // Bit caiu: a posição foi reiniciada
    }
  }
  return false;
}

// Pegar materiais e a chave ao pisar na célula.
export function coletarNaCelula(game) {
  const p = game.player;
  const ch = game.grid.at(p.c, p.r);
  const item = PICKUP_ITEMS[ch] ?? (ch === KEY ? 'chave_nucleo' : null);
  if (!item) return null;
  adicionar(game, item, 1);
  game.grid.set(p.c, p.r, FLOOR);
  game.emit({ tipo: 'sfx', id: 'coleta' });
  game.say(`+1 ${nomeItem(game, item)}`);
  progresso(game, { tipo: 'coletou' });
  return item;
}

const livre = (game, o, ent, entidades) => {
  const ch = game.grid.at(o.c, o.r);
  if (ch === WALL || BLOCKING.has(ch)) return false;
  const p = game.player;
  if (o.c === p.c && o.r === p.r) return false;
  return !entidades.some((x) => x !== ent && x.c === o.c && x.r === o.r);
};

// Inimigos andam a cada passo do jogador. Patrulha fica num raio de 3 da origem; perseguidor ataca quem estiver
// a até 4 passos; estático não se move. Chefes não se movem.
export function moverFalhas(game) {
  const ent = game.layerState().entities;
  const p = game.player;
  for (const e of ent) {
    if (e.boss || e.comp === 'estatico') continue;
    const opcoes = DIRS.map(([dc, dr]) => ({ c: e.c + dc, r: e.r + dr })).filter((o) => livre(game, o, e, ent));
    let destino = null;
    if (e.comp === 'perseguidor' && manhattan(e, p) <= 4) {
      destino = opcoes.filter((o) => manhattan(o, p) < manhattan(e, p)).sort((x, y) => manhattan(x, p) - manhattan(y, p))[0] ?? null;
    } else if (e.comp === 'patrulha' && game.rng() < 0.6) {
      destino = escolher(game.rng, opcoes.filter((o) => manhattan(o, e.origem ? { c: e.origem[0], r: e.origem[1] } : e) <= 3));
    }
    if (destino) {
      e.c = destino.c;
      e.r = destino.r;
    }
  }
}

// Inimigo encostado no jogador (ou no mesmo passo) e que não está ignorando o jogador após uma fuga.
export function contatoComFalha(game) {
  const p = game.player;
  return game.layerState().entities.find((e) => (e.ignorar ?? 0) <= p.passos && manhattan(e, p) <= 1) ?? null;
}

// Interação com a célula da frente: técnico (diálogo), mercador (loja) ou baú.
export function interagir(game) {
  if (game.battle) return { tipo: 'batalha' };
  const [c, r] = game.frente();
  const ch = game.grid.at(c, r);
  if (ch === NPC || ch === MERCHANT) {
    const npc = game.layerState().npcs.find((n) => n.c === c && n.r === r);
    if (!npc) return { tipo: 'nada' };
    if (ch === MERCHANT) {
      const loja = lojaDoMercador(game, npc.id);
      if (!loja) return iniciarConversa(game, npc.id);
      game.abrirMenu('loja', { loja: loja.id });
      return { tipo: 'loja', loja: loja.id };
    }
    return iniciarConversa(game, npc.id);
  }
  if (ch === CHEST) return abrirBau(game, c, r);
  return { tipo: 'nada' };
}

// Baú: um perfil de conteúdo da camada (escolhido por peso), uma vez por baú.
export function abrirBau(game, c, r) {
  const camada = game.player.camada;
  const chave = `${camada}|${c},${r}`;
  if (game.bausAbertos[chave]) {
    game.say('O baú está vazio.');
    return { tipo: 'vazio' };
  }
  const perfil = escolher(game.rng, game.catalog.loot[camada] ?? []);
  if (!perfil) return { tipo: 'semLoot' };
  const [min, max] = perfil.ciclos;
  const ciclos = min + Math.floor(game.rng() * (max - min + 1));
  game.ciclos += ciclos;
  const item = escolherPeso(game.rng, perfil.itens);
  if (item) adicionar(game, item.item, item.qtd ?? 1);
  game.bausAbertos[chave] = true;
  game.grid.set(c, r, FLOOR);
  game.emit({ tipo: 'sfx', id: 'bau' });
  game.say(`Baú: +${ciclos} ciclos${item ? `, ${nomeItem(game, item.item)}` : ''}.`);
  progresso(game, { tipo: 'coletou' });
  return { tipo: 'bau', ciclos, item: item?.item ?? null };
}

// Ferramenta (R) na célula da frente: abre trilha, porta de energia, encaixe ou a porta da sala do chefe.
export function usarFerramenta(game) {
  if (game.battle) return { tipo: 'batalha' };
  const [c, r] = game.frente();
  const ch = game.grid.at(c, r);
  const ferramenta = TOOL_CELLS[ch];
  if (!ferramenta) return { tipo: 'nada' };
  if (contar(game, ferramenta) < 1) {
    game.say(`Falta: ${nomeItem(game, ferramenta)}`);
    game.emit({ tipo: 'sfx', id: 'erro' });
    return { tipo: 'falta', ferramenta };
  }
  remover(game, ferramenta, 1);
  game.grid.set(c, r, OPENED[ch]);
  if (ferramenta === 'reforco_nucleo') {
    game.player.maxHp += REFORCO_VIDA;
    game.player.hp += REFORCO_VIDA;
  }
  game.emit({ tipo: 'sfx', id: ch === 'D' ? 'porta' : 'reparo' });
  game.emit({ tipo: 'fx', fx: 'faisca', c, r });
  game.say(`${nomeItem(game, ferramenta)} aplicado.`);
  progresso(game, { tipo: 'reparou', celula: ch });
  return { tipo: 'usada', ferramenta, c, r };
}

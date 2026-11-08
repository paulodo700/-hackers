// Inventário, consumíveis e equipamento. Sem DOM.
import { clamp, addStatus } from './util.js';
import { estatisticas } from './stats.js';

export const contar = (game, id) => game.inv[id] ?? 0;
export const nomeItem = (game, id) => game.catalog.itens[id]?.nome ?? id;

export function adicionar(game, id, qtd = 1) {
  game.inv[id] = (game.inv[id] ?? 0) + qtd;
  game.emit({ tipo: 'pegou', id, qtd });
  return qtd;
}

export function remover(game, id, qtd = 1) {
  if (contar(game, id) < qtd) return false;
  game.inv[id] -= qtd;
  if (game.inv[id] === 0) delete game.inv[id];
  return true;
}

// Efeito de um consumível (em combate ou fora dele).
export function aplicarEfeitoUso(game, ef) {
  const p = game.player;
  const st = estatisticas(game);
  switch (ef.tipo) {
    case 'cura':
      p.hp = Math.min(st.maxHp, p.hp + ef.valor);
      game.emit({ tipo: 'cura', alvo: 'jogador', valor: ef.valor });
      break;
    case 'calor':
      p.calor = clamp(p.calor + ef.valor, 0, 100);
      break;
    case 'ep':
      p.ep = Math.min(st.maxEp, p.ep + ef.valor);
      break;
    case 'remover':
      p.estados = p.estados.filter((e) => game.catalog.status[e.id]?.classe !== (ef.classe ?? 'negativo'));
      break;
    case 'buff': {
      const dur = ef.duracao ?? game.catalog.status[ef.status]?.duracao ?? 3;
      addStatus(p.estados, ef.status, dur);
      break;
    }
    case 'escudo':
      p.escudo += ef.valor;
      break;
    default:
      break;
  }
}

// Usa um consumível. Respeita onde ele pode ser usado ('combate', 'explorar' ou 'ambos').
export function usarConsumivel(game, id) {
  const item = game.catalog.itens[id];
  if (!item || item.tipo !== 'consumivel') return { ok: false, motivo: 'não é consumível' };
  if (contar(game, id) < 1) return { ok: false, motivo: 'sem estoque' };
  const em = item.uso?.em ?? 'ambos';
  const emCombate = !!game.battle;
  if (em === 'combate' && !emCombate) return { ok: false, motivo: 'só em combate' };
  if (em === 'explorar' && emCombate) return { ok: false, motivo: 'só fora de combate' };
  remover(game, id, 1);
  for (const ef of item.uso.efeitos) aplicarEfeitoUso(game, ef);
  game.emit({ tipo: 'sfx', id: 'cura' });
  game.say(`Usou ${item.nome}.`);
  return { ok: true };
}

// Veste um equipamento. O que estava no slot volta para o inventário.
export function equipar(game, id) {
  const item = game.catalog.itens[id];
  if (!item || item.tipo !== 'equipamento') return { ok: false, motivo: 'não é equipamento' };
  if (contar(game, id) < 1) return { ok: false, motivo: 'sem estoque' };
  const slot = item.equipamento.slot;
  const anterior = game.player.equip[slot];
  remover(game, id, 1);
  if (anterior) adicionar(game, anterior, 1);
  game.player.equip[slot] = id;
  game.player.hp = Math.min(game.player.hp, estatisticas(game).maxHp);
  game.say(`Equipou ${item.nome}.`);
  return { ok: true, slot, anterior: anterior ?? null };
}

export function desequipar(game, slot) {
  const id = game.player.equip[slot];
  if (!id) return { ok: false, motivo: 'slot vazio' };
  game.player.equip[slot] = null;
  adicionar(game, id, 1);
  game.player.hp = Math.min(game.player.hp, estatisticas(game).maxHp);
  return { ok: true, id };
}

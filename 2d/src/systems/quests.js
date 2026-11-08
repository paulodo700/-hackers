// Missões: estado por missão (etapa atual e contagem), avanço por eventos do jogo e recompensas. Sem DOM.
import { contar, adicionar, remover } from './items.js';
import { ganharXp } from './stats.js';

// Eventos aceitos: {tipo:'falou', npc}, {tipo:'coletou'}, {tipo:'derrotou', foe}, {tipo:'chefe', id},
// {tipo:'reparou', celula}, {tipo:'chegou', camada}, {tipo:'escanear', foe}.
export const estadoMissao = (game, id) => game.missoes[id];

export function iniciarMissao(game, id) {
  const def = game.catalog.missoes[id];
  if (!def || game.missoes[id]) return false;
  game.missoes[id] = { estado: 'ativa', etapa: 0, contagem: 0 };
  game.diario.push(`Missão iniciada: ${def.nome}.`);
  game.say(`Nova missão: ${def.nome}`);
  game.emit({ tipo: 'sfx', id: 'missao' });
  avaliarAtual(game, id);
  return true;
}

// Atende um evento a todas as missões ativas cuja etapa atual pede aquilo.
export function progresso(game, evento) {
  for (const id of Object.keys(game.missoes)) {
    const st = game.missoes[id];
    if (st.estado !== 'ativa') continue;
    const etapa = game.catalog.missoes[id]?.etapas[st.etapa];
    if (!etapa) continue;
    if (casa(game, etapa, evento)) {
      st.contagem++;
      avaliarAtual(game, id);
    } else if (etapa.tipo === 'coletar' || etapa.tipo === 'entregar') {
      avaliarAtual(game, id);
    }
  }
}

// Confere a etapa atual; se já foi cumprida, avança (e repete para etapas que já valem).
function avaliarAtual(game, id) {
  for (let guarda = 0; guarda < 20; guarda++) {
    const st = game.missoes[id];
    const def = game.catalog.missoes[id];
    if (!st || st.estado !== 'ativa') return;
    const etapa = def.etapas[st.etapa];
    if (!etapa) return concluir(game, id);
    if (etapa.tipo === 'coletar' && contar(game, etapa.item) >= (etapa.qtd ?? 1)) { avancar(game, id, etapa); continue; }
    if (etapa.tipo === 'falar' && st.contagem >= 1) { avancar(game, id, etapa); continue; }
    if (etapa.tipo === 'chegar' && st.contagem >= 1) { avancar(game, id, etapa); continue; }
    if (['derrotar', 'reparar', 'escanear'].includes(etapa.tipo) && st.contagem >= (etapa.qtd ?? 1)) { avancar(game, id, etapa); continue; }
    if (['chefe'].includes(etapa.tipo) && st.contagem >= 1) { avancar(game, id, etapa); continue; }
    return;
  }
}

function casa(game, etapa, evento) {
  switch (etapa.tipo) {
    case 'falar': return evento.tipo === 'falou' && evento.npc === etapa.npc;
    case 'entregar': {
      if (evento.tipo !== 'falou' || evento.npc !== etapa.npc) return false;
      if (contar(game, etapa.item) < (etapa.qtd ?? 1)) return false;
      remover(game, etapa.item, etapa.qtd ?? 1);
      return true;
    }
    case 'coletar': return evento.tipo === 'coletou';
    case 'derrotar': return evento.tipo === 'derrotou' && evento.foe === etapa.foe;
    case 'chefe': return evento.tipo === 'chefe' && evento.id === etapa.chefe;
    case 'reparar': return evento.tipo === 'reparou';
    case 'chegar': return evento.tipo === 'chegou' && evento.camada === etapa.camada;
    case 'escanear': return evento.tipo === 'escanear' && evento.foe === etapa.foe;
    default: return false;
  }
}

function avancar(game, id, etapa) {
  const st = game.missoes[id];
  game.say(`Etapa concluída: ${etapa.texto}`);
  game.diario.push(`${game.catalog.missoes[id].nome}: ${etapa.texto} (feito).`);
  st.etapa++;
  st.contagem = 0;
  if (st.etapa >= game.catalog.missoes[id].etapas.length) concluir(game, id);
}

export function concluir(game, id) {
  const st = game.missoes[id];
  const def = game.catalog.missoes[id];
  if (!st || st.estado === 'concluida') return false;
  st.estado = 'concluida';
  const rec = def.recompensa ?? {};
  if (rec.xp) ganharXp(game, rec.xp);
  if (rec.ciclos) game.ciclos += rec.ciclos;
  for (const it of rec.itens ?? []) adicionar(game, it.item, it.qtd ?? 1);
  for (const f of rec.flags ?? []) game.flags[f] = true;
  game.diario.push(`Missão concluída: ${def.nome}.`);
  game.say(`Missão concluída: ${def.nome}!`);
  game.emit({ tipo: 'sfx', id: 'missao' });
  return true;
}

// Diálogos: escolha do diálogo pela condição, nós com opções, efeitos ao entrar em cada nó. Sem DOM.
import { adicionar, remover } from './items.js';
import { ganharXp } from './stats.js';
import { contar } from './items.js';
import { iniciarMissao, concluir, progresso, estadoMissao } from './quests.js';

export function condicaoValida(game, c) {
  switch (c.tipo) {
    case 'flag': return (game.flags[c.id] ?? false) === (c.valor ?? true);
    case 'quest': {
      const st = estadoMissao(game, c.id);
      if (c.estado === 'nao_iniciada') return !st;
      if (c.estado === 'ativa') return st?.estado === 'ativa';
      if (c.estado === 'concluida') return st?.estado === 'concluida';
      if (c.estado === 'etapa') return st?.estado === 'ativa' && game.catalog.missoes[c.id]?.etapas[st.etapa]?.id === c.etapa;
      return false;
    }
    case 'item': return contar(game, c.id) >= (c.qtd ?? 1);
    case 'nivel': return game.player.nivel >= c.min;
    case 'chefe': return (game.chefes[c.id] ?? false) === (c.estado !== 'nao_derrotado');
    case 'ciclos': return game.ciclos >= c.min;
    default: return false;
  }
}

// Primeiro diálogo do técnico cujas condições valem (ordem de declaração).
export function escolherDialogo(game, npcId) {
  return Object.values(game.catalog.dialogos).find((d) => d.npc === npcId
    && (d.condicoes ?? []).every((c) => condicaoValida(game, c))) ?? null;
}

export function iniciarConversa(game, npcId) {
  const d = escolherDialogo(game, npcId);
  progresso(game, { tipo: 'falou', npc: npcId });
  if (!d) {
    game.dialog = { npc: npcId, dialogo: null, no: null, fala: '...', opcoes: [] };
    return { tipo: 'dialogo', semFala: true };
  }
  game.dialog = { npc: npcId, dialogo: d.id, no: null, fala: '', opcoes: [] };
  entrarNo(game, d.inicio);
  return { tipo: 'dialogo', dialogo: d.id };
}

// Entra num nó: aplica efeitos, mostra a fala e calcula as opções visíveis.
function entrarNo(game, nome) {
  const d = game.catalog.dialogos[game.dialog.dialogo];
  const no = d.nos[nome];
  game.dialog.no = nome;
  game.dialog.fala = no.fala;
  for (const ef of no.efeitos ?? []) aplicarEfeito(game, ef);
  game.dialog.opcoes = (no.opcoes ?? [])
    .map((o, i) => ({ ...o, indice: i }))
    .filter((o) => (o.condicoes ?? []).every((c) => condicaoValida(game, c)));
}

// Confirma a fala sem opções: segue para 'ir' ou encerra.
export function avancarDialogo(game) {
  if (!game.dialog || !game.dialog.dialogo) return encerrarDialogo(game);
  const no = game.catalog.dialogos[game.dialog.dialogo].nos[game.dialog.no];
  if (game.dialog.opcoes.length) return { tipo: 'escolha' };
  if (no.ir) {
    entrarNo(game, no.ir);
    return { tipo: 'dialogo' };
  }
  return encerrarDialogo(game);
}

// Escolhe uma das opções visíveis (por índice visível).
export function escolherOpcao(game, indice) {
  const op = game.dialog?.opcoes?.[indice];
  if (!op) return { tipo: 'nada' };
  if (op.ir === null || op.ir === undefined) return encerrarDialogo(game);
  entrarNo(game, op.ir);
  return { tipo: 'dialogo' };
}

export function encerrarDialogo(game) {
  const pendente = game.lojaPendente;
  game.dialog = null;
  game.lojaPendente = null;
  if (pendente) game.abrirMenu('loja', { loja: pendente });
  return { tipo: 'encerrado' };
}

export function aplicarEfeito(game, ef) {
  const p = game.player;
  switch (ef.tipo) {
    case 'flag': game.flags[ef.id] = ef.valor ?? true; break;
    case 'item':
      if (ef.acao === 'tirar') remover(game, ef.id, ef.qtd ?? 1);
      else adicionar(game, ef.id, ef.qtd ?? 1);
      break;
    case 'ciclos': game.ciclos += ef.valor; break;
    case 'xp': ganharXp(game, ef.valor); break;
    case 'quest_iniciar': iniciarMissao(game, ef.id); break;
    case 'quest_concluir': concluir(game, ef.id); break;
    case 'curar': p.hp = game.estatisticas().maxHp; break;
    case 'loja': game.lojaPendente = ef.id; break;
    case 'anotar': game.diario.push(ef.texto); break;
    default: break;
  }
}

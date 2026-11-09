// Combate por turnos: ações do jogador, resposta da falha, estados, fases do chefe, vitória e derrota.
// Sem DOM. Os eventos (sons, números, tremores) são empilhados em game.events.
import { VANTAGEM } from '../data/schema.js';
import { clamp, escolher, addStatus, temStatus, semStatus } from './util.js';
import { estatisticas, ganharXp } from './stats.js';
import { contar, adicionar, remover, usarConsumivel } from './items.js';
import { registrarVista, registrarVitoria } from './bestiario.js';
import { progresso } from './quests.js';

export const ESCALA_POR_CAMADA = (ordem) => 1 + 0.2 * ordem;
// Falhas comuns dão o dobro do XP do conteúdo: o personagem precisa crescer a tempo do primeiro chefe.
export const XP_FATOR_COMUM = 2;

// Multiplicador de elemento: 1,5 se o atacante tem vantagem; 0,75 se o alvo tem vantagem; 1 caso contrário.
export function fatorElemento(atacante, alvo) {
  if (!atacante || !alvo || atacante === 'neutro' || alvo === 'neutro') return 1;
  if (VANTAGEM[atacante] === alvo) return 1.5;
  if (VANTAGEM[alvo] === atacante) return 0.75;
  return 1;
}

// Dano = max(1, poder − defesa·0,5) × elemento × variação (0,9 a 1,1) × crítico (1,5).
export function calcDano({ poder, defesa, elemento = 'neutro', alvoElemento = 'neutro', critico = false, rng }) {
  const base = Math.max(1, poder - defesa * 0.5);
  const variacao = 0.9 + 0.2 * rng();
  return Math.max(1, Math.round(base * fatorElemento(elemento, alvoElemento) * variacao * (critico ? 1.5 : 1)));
}

// Fração de esquiva de um alvo mais rápido que o atacante (até 25%).
export const esquiva = (spdAlvo, spdAtacante) => clamp((spdAlvo - spdAtacante) * 0.02, 0, 0.25);

const efeitoDefesaFalha = (game, b) => b.estados.reduce((acc, e) => acc * (1 + (game.catalog.status[e.id]?.defPct ?? 0)), 1);
const atkFalha = (game, b) => b.atk * b.estados.reduce((acc, e) => acc * (1 + (game.catalog.status[e.id]?.atkPct ?? 0)), 1);
const spdFalha = (game, b) => b.spd + b.estados.reduce((acc, e) => acc + (game.catalog.status[e.id]?.spd ?? 0), 0);
const defFalha = (game, b) => Math.max(0, Math.round(b.def * efeitoDefesaFalha(game, b)));

// Inicia um combate contra a entidade (falha ou chefe) que tocou o jogador.
export function iniciarBatalha(game, ent) {
  const foe = game.catalog.falhas[ent.foe];
  const ordem = game.layerOrdem(ent.camada);
  const esc = ESCALA_POR_CAMADA(ordem);
  const boss = !!foe.chefe;
  const hp = Math.round(foe.hp * esc);
  game.battle = {
    entId: ent.id,
    foeId: foe.id,
    boss,
    camada: ent.camada,
    c: ent.c,
    r: ent.r,
    hp,
    maxHp: hp,
    atk: Math.round(foe.atk * (1 + 0.1 * ordem) * (boss ? 1.1 : 1)),
    def: Math.round(foe.def * (1 + 0.1 * ordem)),
    spd: foe.spd,
    elemento: foe.elemento,
    ataques: [...(foe.ataques ?? [])],
    fases: boss ? foe.fases : null,
    fase: 0,
    estados: [],
    escudo: 0,
    telegrafo: null,
    defendendo: false,
    fugaPermitida: !boss,
    rodada: 1,
  };
  game.player.escudo = 0;
  registrarVista(game, foe.id);
  if (boss) {
    game.emit({ tipo: 'sfx', id: 'chefe_surge' });
    game.emit({ tipo: 'tremor', forca: 6 });
    game.say(`${foe.nome} bloqueia a passagem!`);
  } else {
    game.emit({ tipo: 'sfx', id: 'selecionar' });
    game.say(`${foe.nome} apareceu!`);
  }
  // Falha mais rápida do que o jogador ataca primeiro.
  if (spdFalha(game, game.battle) > estatisticas(game).spd + 2) turnoFalha(game);
  return game.battle;
}

// Fase do chefe pela fração de vida: quantas faixas de 'ate' a vida ainda está abaixo.
export function faseDoChefe(b) {
  const frac = b.hp / b.maxHp;
  const fases = b.fases ?? [];
  if (!fases.length) return 0;
  const abaixo = fases.filter((f) => frac < f.ate).length;
  return clamp(abaixo, 0, fases.length - 1);
}

function aplicarDanoFalha(game, valor, critico = false) {
  const b = game.battle;
  const absorvido = Math.min(b.escudo, valor);
  b.escudo -= absorvido;
  b.hp -= valor - absorvido;
  game.emit({ tipo: 'dano', alvo: 'inimigo', valor, critico, c: b.c, r: b.r });
  if (b.hp <= 0) {
    b.hp = 0;
    vitoria(game);
    return true;
  }
  if (b.boss) {
    const nova = faseDoChefe(b);
    if (nova > b.fase) {
      b.fase = nova;
      game.say(`${game.catalog.falhas[b.foeId].nome} entra na fase ${nova + 1}!`);
      game.emit({ tipo: 'sfx', id: 'chefe_surge' });
      game.emit({ tipo: 'tremor', forca: 8 });
    }
  }
  return false;
}

export function aplicarDanoJogador(game, valor, critico = false) {
  const p = game.player;
  const absorvido = Math.min(p.escudo, valor);
  p.escudo -= absorvido;
  p.hp -= valor - absorvido;
  game.emit({ tipo: 'dano', alvo: 'jogador', valor, critico, c: p.c, r: p.r });
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}

// Ação do jogador. Devolve um resultado; ações sem efeito (sem energia, sem fuga) não passam o turno.
export function acaoJogador(game, tipo, arg) {
  const b = game.battle;
  if (!b) return { tipo: 'nenhuma' };
  const p = game.player;
  const st = estatisticas(game);
  let passaTurno = true;
  let resultado = { tipo };

  if (tipo === 'atacar') {
    if (game.rng() < esquiva(spdFalha(game, b), st.spd)) {
      game.say('A falha esquivou!');
      game.emit({ tipo: 'texto', texto: 'Esquiva', c: b.c, r: b.r, cor: '#9ad0ff', alvo: 'inimigo' });
      resultado.esquivou = true;
    } else {
      const critico = game.rng() < (st.crit + (temStatus(p.estados, 'foco') ? 20 : 0)) / 100;
      const dano = calcDano({ poder: st.atk, defesa: defFalha(game, b), elemento: 'neutro', alvoElemento: b.elemento, critico, rng: game.rng });
      game.say(`Você causa ${dano} de dano.`);
      resultado.dano = dano;
      if (aplicarDanoFalha(game, dano, critico)) return { ...resultado, venceu: true };
    }
  } else if (tipo === 'habilidade') {
    const h = game.catalog.habilidades[arg];
    if (!h || !p.habilidades.includes(arg)) return { tipo: 'indisponivel' };
    if (p.ep < h.custo_ep) {
      game.say('Energia insuficiente.');
      return { tipo: 'semEP' };
    }
    p.ep -= h.custo_ep;
    resultado.habilidade = h.id;
    for (const ef of h.efeitos) {
      if (efeitoHabilidade(game, ef, h, st) === 'venceu') return { ...resultado, venceu: true };
    }
  } else if (tipo === 'item') {
    const r = usarConsumivel(game, arg);
    if (!r.ok) {
      game.say(`Não dá para usar: ${r.motivo}.`);
      return { tipo: 'semItem', motivo: r.motivo };
    }
    resultado.item = arg;
  } else if (tipo === 'defender') {
    b.defendendo = true;
    game.say('Você se prepara para defender.');
  } else if (tipo === 'fugir') {
    if (!b.fugaPermitida) {
      game.say('Não há como fugir deste chefe.');
      return { tipo: 'semFuga' };
    }
    if (game.rng() < 0.5) {
      encerrarBatalha(game);
      game.say('Você fugiu.');
      game.emit({ tipo: 'sfx', id: 'fuga' });
      return { tipo: 'fugiu' };
    }
    game.say('Não conseguiu fugir.');
    resultado.falhou = true;
  } else {
    return { tipo: 'desconhecida' };
  }

  if (passaTurno && game.battle) {
    turnoFalha(game);
    if (p.hp <= 0) {
      derrota(game);
      return { ...resultado, derrota: true };
    }
    if (game.battle) fimDeRodada(game);
    if (p.hp <= 0 && game.battle) derrota(game);
  }
  return resultado;
}

// Um efeito de habilidade do jogador. Devolve 'venceu' se a falha caiu.
function efeitoHabilidade(game, ef, h, st) {
  const b = game.battle, p = game.player;
  switch (ef.tipo) {
    case 'dano': {
      const critico = game.rng() < (st.crit + (temStatus(p.estados, 'foco') ? 20 : 0)) / 100;
      const dano = calcDano({ poder: st.atk * ef.fator, defesa: defFalha(game, b), elemento: h.elemento ?? 'neutro', alvoElemento: b.elemento, critico, rng: game.rng });
      game.say(`${h.nome}: ${dano} de dano.`);
      return aplicarDanoFalha(game, dano, critico) ? 'venceu' : null;
    }
    case 'status': {
      if (game.rng() >= (ef.chance ?? 1)) return null;
      const dur = ef.duracao ?? game.catalog.status[ef.status]?.duracao ?? 2;
      if (ef.alvo === 'proprio') addStatus(p.estados, ef.status, dur);
      else addStatus(b.estados, ef.status, dur);
      game.say(`${game.catalog.status[ef.status]?.nome ?? ef.status} aplicado.`);
      return null;
    }
    case 'cura':
      p.hp = Math.min(st.maxHp, p.hp + ef.valor);
      game.emit({ tipo: 'cura', alvo: 'jogador', valor: ef.valor });
      return null;
    case 'escudo':
      p.escudo += ef.valor;
      return null;
    case 'remover':
      p.estados = p.estados.filter((e) => game.catalog.status[e.id]?.classe !== (ef.classe ?? 'negativo'));
      return null;
    case 'buff':
      addStatus(p.estados, ef.status, ef.duracao ?? game.catalog.status[ef.status]?.duracao ?? 3);
      return null;
    case 'calor':
      p.calor = clamp(p.calor + ef.valor, 0, 100);
      return null;
    default:
      return null;
  }
}

// A falha age: pula o turno se estiver atordoada; senão usa um ataque (com telegrafo para chefes).
export function turnoFalha(game) {
  const b = game.battle;
  if (!b) return;
  const foe = game.catalog.falhas[b.foeId];
  if (temStatus(b.estados, 'curto')) {
    b.estados = semStatus(b.estados, 'curto');
    game.say(`${foe.nome} está atordoada.`);
    return;
  }
  let ataqueId;
  if (b.telegrafo) {
    ataqueId = b.telegrafo;
    b.telegrafo = null;
  } else if (b.boss && b.fases) {
    const lista = b.fases[faseDoChefe(b)].ataques;
    const escolhido = escolher(game.rng, lista);
    const ataque = game.catalog.ataques[escolhido];
    if (ataque?.telegrafo && game.rng() < 0.5) {
      b.telegrafo = escolhido;
      game.say(ataque.telegrafo);
      game.emit({ tipo: 'sfx', id: 'chefe_surge' });
      return;
    }
    ataqueId = escolhido;
  } else {
    ataqueId = escolher(game.rng, b.ataques);
  }
  resolverAtaqueFalha(game, ataqueId);
}

function resolverAtaqueFalha(game, ataqueId) {
  const b = game.battle, p = game.player;
  const ataque = game.catalog.ataques[ataqueId];
  if (!ataque) return;
  const st = estatisticas(game);
  const esquivou = game.rng() < esquiva(st.spd, spdFalha(game, b));
  const calor = p.calor >= 60 ? 1.15 : 1;
  game.say(`${game.catalog.falhas[b.foeId].nome}: ${ataque.nome}.`);
  for (const ef of ataque.efeitos) {
    if (ef.tipo === 'dano') {
      if (esquivou) {
        game.say('Você esquivou!');
        game.emit({ tipo: 'texto', texto: 'Esquiva', c: p.c, r: p.r, cor: '#9ad0ff', alvo: 'jogador' });
        continue;
      }
      let dano = calcDano({ poder: atkFalha(game, b) * ef.fator * calor, defesa: st.def, elemento: ataque.elemento ?? b.elemento, alvoElemento: 'neutro', critico: game.rng() < 0.05, rng: game.rng });
      if (b.defendendo) dano = Math.max(1, Math.floor(dano / 2));
      if (temStatus(p.estados, 'bloqueio')) dano = Math.max(1, Math.floor(dano * 0.5));
      aplicarDanoJogador(game, dano);
    } else if (ef.tipo === 'status') {
      if (game.rng() >= (ef.chance ?? 1)) continue;
      const dur = ef.duracao ?? game.catalog.status[ef.status]?.duracao ?? 2;
      if (ef.alvo === 'proprio') addStatus(b.estados, ef.status, dur);
      else addStatus(p.estados, ef.status, dur);
      game.say(`${game.catalog.status[ef.status]?.nome ?? ef.status} em ${ef.alvo === 'proprio' ? 'a falha' : 'você'}.`);
    } else if (ef.tipo === 'cura') {
      b.hp = Math.min(b.maxHp, b.hp + ef.valor);
    } else if (ef.tipo === 'escudo') {
      b.escudo += ef.valor;
    } else if (ef.tipo === 'calor') {
      p.calor = clamp(p.calor + ef.valor, 0, 100);
    }
  }
  b.defendendo = false;
}

// Fim de rodada: efeitos de estado da falha e do jogador, regeneração de energia, contagem de turnos.
export function fimDeRodada(game) {
  const b = game.battle, p = game.player;
  if (!b) return;
  const ordem = game.layerOrdem(b.camada);
  for (const e of [...b.estados]) {
    const st = game.catalog.status[e.id];
    if (e.id === 'queimadura') aplicarDanoFalha(game, (st.dano ?? 2) + Math.floor(ordem / 2));
    if (!game.battle) return;
    if (e.id === 'regeneracao') b.hp = Math.min(b.maxHp, b.hp + (st.cura ?? 3));
    e.turnos--;
  }
  b.estados = b.estados.filter((e) => e.turnos > 0);
  for (const e of [...p.estados]) {
    const st = game.catalog.status[e.id];
    if (e.id === 'queimadura') aplicarDanoJogador(game, (st.dano ?? 2) + Math.floor(ordem / 2));
    if (p.hp <= 0) return derrota(game);
    if (e.id === 'regeneracao') p.hp = Math.min(estatisticas(game).maxHp, p.hp + (st.cura ?? 3));
    e.turnos--;
  }
  p.estados = p.estados.filter((e) => e.turnos > 0);
  p.ep = Math.min(estatisticas(game).maxEp, p.ep + 1);
  b.rodada++;
}

function encerrarBatalha(game) {
  const b = game.battle;
  game.battle = null;
  game.player.estados = [];
  game.player.escudo = 0;
  if (b) game.ignorarEntidade?.(b.entId, 3);
}

// Vitória: XP, ciclos, quedas, bestiário, missões. O chefe fica derrotado para sempre.
export function vitoria(game) {
  const b = game.battle;
  const foe = game.catalog.falhas[b.foeId];
  const ordem = game.layerOrdem(b.camada);
  game.battle = null;
  game.player.estados = [];
  game.player.escudo = 0;
  const xp = foe.chefe ? foe.recompensa.xp : foe.xp * XP_FATOR_COMUM;
  const ciclos = foe.chefe ? foe.recompensa.ciclos : Math.floor(game.rng() * (3 + ordem));
  game.ciclos += ciclos;
  const quedas = [];
  for (const d of foe.drops ?? []) {
    if (game.rng() < d.chance) {
      adicionar(game, d.item, d.qtd ?? 1);
      quedas.push(d.item);
    }
  }
  if (foe.chefe && foe.recompensa.item) adicionar(game, foe.recompensa.item, 1);
  registrarVitoria(game, foe.id);
  game.say(`${foe.nome} caiu! +${xp} XP, +${ciclos} ciclos.`);
  game.emit({ tipo: 'sfx', id: 'vitoria' });
  game.emit({ tipo: 'texto', texto: `+${xp} XP`, c: b.c, r: b.r, cor: '#ffd166', alvo: 'inimigo' });
  game.removerEntidade?.(b.entId);
  ganharXp(game, xp);
  progresso(game, { tipo: 'derrotou', foe: foe.id });
  if (foe.chefe) {
    game.chefes[foe.id] = true;
    game.emit({ tipo: 'tremor', forca: 10 });
    game.say(`${foe.nome} foi derrotado. O caminho se abriu.`);
    progresso(game, { tipo: 'chefe', id: foe.id });
  }
  game.player.ep = Math.min(estatisticas(game).maxEp, game.player.ep + 2);
  return { quedas, xp, ciclos };
}

// Derrota de Bit: renasce no ponto inicial da camada com metade da vida. A falha continua no lugar.
export function derrota(game) {
  const p = game.player;
  game.battle = null;
  p.estados = [];
  p.escudo = 0;
  p.hp = Math.max(1, Math.floor(estatisticas(game).maxHp * 0.5));
  p.calor = Math.min(p.calor, 30); // o chip esfria ao reiniciar
  game.placeAt(p.camada, 'S');
  game.say('Você caiu. Renasceu no início da camada.');
  game.emit({ tipo: 'sfx', id: 'derrota' });
  return { derrota: true };
}

export { contar, remover };

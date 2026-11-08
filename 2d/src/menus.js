// Telas com lista (menus): o que cada tela mostra e o que cada item faz. Sem DOM.
// Cada item: {label, detalhe, ativo, acao}. Ações com tipo 'nada' não fazem nada (são só informação).
import { estatisticas } from './systems/stats.js';
import { contar, usarConsumivel, equipar, desequipar, nomeItem } from './systems/items.js';
import { podeAprender, aprender, habilidadesAprendidas } from './systems/skills.js';
import { podeCriar, criar, receitas } from './systems/crafting.js';
import { comprar, vender, estoqueDaLoja } from './systems/shops.js';
import { detalhesFalha } from './systems/bestiario.js';
import { acaoJogador } from './systems/combat.js';

const SLOTS = { dissipador: 'Dissipador', antena: 'Antena', modulo: 'Módulo' };
const NADA = { tipo: 'nada' };
const info = (label, detalhe = '') => ({ label, detalhe, ativo: false, acao: NADA });

export function itensDoMenu(game) {
  const m = game.menu;
  if (!m) return [];
  switch (m.tipo) {
    case 'principal': return menuPrincipal();
    case 'status': return menuStatus(game);
    case 'inventario': return menuInventario(game);
    case 'habilidades': return menuHabilidades(game);
    case 'equipamento': return menuEquipamento(game);
    case 'criar': return menuCriar(game);
    case 'loja': return menuLoja(game, m.dados.loja);
    case 'diario': return menuDiario(game);
    case 'bestiario': return menuBestiario(game);
    case 'batalha_habilidade': return menuBatalhaHabilidade(game);
    case 'batalha_item': return menuBatalhaItem(game);
    default: return [];
  }
}

// Executa a ação de um item de menu. O menu continua aberto, salvo quando a ação muda de tela.
export function executarAcaoMenu(game, acao) {
  switch (acao.tipo) {
    case 'abrir': return game.abrirMenu(acao.menu);
    case 'mapa': return game.toggleMap();
    case 'fechar': return game.closeAll();
    case 'app': return { type: 'app', cmd: acao.cmd };
    case 'usar': return usarConsumivel(game, acao.id);
    case 'equipar': return equipar(game, acao.id);
    case 'desequipar': return desequipar(game, acao.slot);
    case 'aprender': return aprender(game, acao.id);
    case 'criar': return criar(game, acao.id);
    case 'comprar': return comprar(game, acao.loja, acao.id);
    case 'vender': return vender(game, acao.loja, acao.id);
    case 'batalha': {
      if (!game.battle) return { type: 'nada' };
      const resultado = acaoJogador(game, acao.acao, acao.arg);
      game.fecharMenu();
      return resultado;
    }
    default: return { type: 'nada' };
  }
}

function menuPrincipal() {
  return [
    { label: 'Status', detalhe: 'Atributos e nível', ativo: true, acao: { tipo: 'abrir', menu: 'status' } },
    { label: 'Inventário', detalhe: 'Consumíveis, materiais e equipamentos', ativo: true, acao: { tipo: 'abrir', menu: 'inventario' } },
    { label: 'Habilidades', detalhe: 'Aprender com pontos de habilidade', ativo: true, acao: { tipo: 'abrir', menu: 'habilidades' } },
    { label: 'Equipamento', detalhe: 'Três slots: dissipador, antena, módulo', ativo: true, acao: { tipo: 'abrir', menu: 'equipamento' } },
    { label: 'Criar', detalhe: 'Ferramentas, consumíveis e melhorias', ativo: true, acao: { tipo: 'abrir', menu: 'criar' } },
    { label: 'Diário', detalhe: 'Missões e anotações', ativo: true, acao: { tipo: 'abrir', menu: 'diario' } },
    { label: 'Bestiário', detalhe: 'Falhas vistas e vencidas', ativo: true, acao: { tipo: 'abrir', menu: 'bestiario' } },
    { label: 'Mapa do chip', detalhe: 'Progresso das oito camadas', ativo: true, acao: { tipo: 'mapa' } },
    { label: 'Novo jogo', detalhe: 'Apaga o progresso salvo (pede confirmação)', ativo: true, acao: { tipo: 'app', cmd: 'newgame' } },
    { label: 'Fechar', detalhe: '', ativo: true, acao: { tipo: 'fechar' } },
  ];
}

function menuStatus(game) {
  const p = game.player;
  const st = estatisticas(game);
  return [
    info(`Nível ${p.nivel}  ·  XP ${p.xp}`, `pontos de habilidade: ${p.pontos}`),
    info(`Vida ${p.hp}/${st.maxHp}  ·  Energia ${p.ep}/${st.maxEp}`),
    info(`Ataque ${st.atk}  ·  Defesa ${st.def}  ·  Velocidade ${st.spd}`),
    info(`Crítico ${st.crit}%`),
    info(`Ciclos ${game.ciclos}`, `calor do chip: ${Math.round(p.calor)}/100`),
    info(`Passos ${p.passos}`),
  ];
}

function menuInventario(game) {
  const ids = Object.keys(game.inv).sort();
  if (!ids.length) return [info('(vazio)')];
  return ids.map((id) => {
    const item = game.catalog.itens[id];
    const qtd = contar(game, id);
    const label = `${nomeItem(game, id)} x${qtd}`;
    if (item?.tipo === 'consumivel') {
      const usavel = (item.uso?.em ?? 'ambos') !== 'combate';
      return { label, detalhe: item.descricao, ativo: usavel, acao: usavel ? { tipo: 'usar', id } : NADA, icone: id };
    }
    if (item?.tipo === 'equipamento') {
      return { label, detalhe: `Equipar no slot ${SLOTS[item.equipamento.slot]}`, ativo: true, acao: { tipo: 'equipar', id }, icone: id };
    }
    return { ...info(label, item?.descricao ?? ''), icone: id };
  });
}

function menuHabilidades(game) {
  return Object.values(game.catalog.habilidades)
    .sort((a, b) => a.ramo.localeCompare(b.ramo) || a.nivel - b.nivel)
    .map((h) => {
      const aprendida = game.player.habilidades.includes(h.id);
      const pode = podeAprender(game, h.id);
      const detalhe = aprendida ? 'aprendida' : pode.ok ? `pode aprender: ${h.descricao}` : `${pode.motivo}: ${h.descricao}`;
      return {
        label: `${h.nome} · ${h.ramo} · nível ${h.nivel} · ${h.pontos} pt`,
        detalhe,
        ativo: !aprendida && pode.ok,
        acao: !aprendida && pode.ok ? { tipo: 'aprender', id: h.id } : NADA,
        icone: h.sprite,
      };
    });
}

function menuEquipamento(game) {
  return Object.entries(SLOTS).map(([slot, nome]) => {
    const id = game.player.equip[slot];
    const item = id ? game.catalog.itens[id] : null;
    const mods = item?.equipamento?.mods ? Object.entries(item.equipamento.mods).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') : '';
    return {
      label: `${nome}: ${item ? item.nome : 'vazio'}`,
      detalhe: item ? mods : 'Equipe um item do inventário',
      ativo: !!item,
      acao: item ? { tipo: 'desequipar', slot } : NADA,
    };
  });
}

function menuCriar(game) {
  return receitas().map((r) => {
    const check = podeCriar(game, r.id ?? r.produz);
    const custo = Object.entries(r.custo).map(([item, n]) => `${n} ${nomeItem(game, item)}`).join(', ');
    const ciclos = r.ciclos ? ` · ${r.ciclos} ciclos` : '';
    return {
      label: r.nome,
      detalhe: `${custo}${ciclos}${check.ok ? '' : ` (${check.motivo})`}`,
      ativo: check.ok,
      acao: check.ok ? { tipo: 'criar', id: r.id ?? r.produz } : NADA,
      icone: r.produz,
    };
  });
}

function menuLoja(game, lojaId) {
  const compra = estoqueDaLoja(game, lojaId).map((o) => ({
    label: `Comprar ${nomeItem(game, o.item)} · ${o.preco} ciclos`,
    detalhe: o.estoque === null ? 'estoque ilimitado' : `restam ${o.estoque}`,
    ativo: game.ciclos >= o.preco && (o.estoque === null || o.estoque > 0),
    acao: { tipo: 'comprar', loja: lojaId, id: o.item },
    icone: o.item,
  }));
  const loja = game.catalog.lojas[lojaId];
  const venda = Object.keys(game.inv).filter((id) => {
    const it = game.catalog.itens[id];
    return it && loja?.compra.includes(it.tipo === 'consumivel' ? 'consumivel' : it.tipo === 'equipamento' ? 'equipamento' : 'material');
  }).map((id) => ({
    label: `Vender ${nomeItem(game, id)} x${contar(game, id)} · +${Math.floor((game.catalog.itens[id]?.valor ?? 0) / 2)}`,
    detalhe: `ciclos: ${game.ciclos}`,
    ativo: true,
    acao: { tipo: 'vender', loja: lojaId, id },
    icone: id,
  }));
  return [...compra, ...venda, info(`Ciclos: ${game.ciclos}`)];
}

function menuDiario(game) {
  const missoes = Object.keys(game.missoes).map((id) => {
    const def = game.catalog.missoes[id];
    const st = game.missoes[id];
    const etapa = st.estado === 'ativa' ? def.etapas[st.etapa]?.texto : 'concluída';
    return info(`${def.nome} (${st.estado})`, etapa ?? '');
  });
  const notas = game.diario.slice(-8).map((t) => info(t));
  return [...missoes, ...(missoes.length && notas.length ? [info('— anotações —')] : []), ...notas].length
    ? [...missoes, ...notas] : [info('Nenhuma missão ainda.')];
}

function menuBestiario(game) {
  return Object.keys(game.catalog.falhas).map((id) => {
    const d = detalhesFalha(game, id);
    const detalhe = d.conhecida
      ? `${d.descricao} Elemento: ${d.elemento}. Fraquezas: ${(d.fraquezas ?? []).join(', ') || 'nenhuma'}.`
      : `vistas ${d.vistas}, vencidas ${d.vencidas}. Vença uma vez para ver os detalhes.`;
    return info(`${d.nome}  ·  vistas ${d.vistas}  ·  vencidas ${d.vencidas}`, detalhe);
  });
}

function menuBatalhaHabilidade(game) {
  const p = game.player;
  const lista = habilidadesAprendidas(game);
  if (!lista.length) return [info('(nenhuma habilidade aprendida)')];
  return lista.map((h) => ({
    label: `${h.nome} (${h.custo_ep} EP)`,
    detalhe: h.descricao,
    ativo: p.ep >= h.custo_ep,
    acao: { tipo: 'batalha', acao: 'habilidade', arg: h.id },
  }));
}

function menuBatalhaItem(game) {
  const lista = Object.keys(game.inv).filter((id) => {
    const it = game.catalog.itens[id];
    return it?.tipo === 'consumivel' && (it.uso?.em ?? 'ambos') !== 'explorar';
  }).map((id) => ({
    label: `${nomeItem(game, id)} x${contar(game, id)}`,
    detalhe: game.catalog.itens[id].descricao,
    ativo: true,
    acao: { tipo: 'batalha', acao: 'item', arg: id },
    icone: id,
  }));
  return lista.length ? lista : [info('(nenhum item de combate)')];
}

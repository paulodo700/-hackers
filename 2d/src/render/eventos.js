// Tradução pura de eventos do motor em comandos de efeito para Efeitos.executar. Não toca em áudio nem no
// estado do jogo. Fora da batalha, os efeitos ficam na célula do mapa; na batalha, ficam nos pontos da arena.
import { LAYERS, LAYER_ORDER } from '../layers.js';
import { TILE, PONTO_ARENA } from './layout.js';
import { corRaridade } from './tema.js';

const FX_NO_MUNDO = { fogo: 'fogo', gelo: 'gelo', faisca: 'faisca' };

const naCelula = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, tela: false });
const naArena = (p) => ({ x: p.x, y: p.y, tela: true });

// Ponto de um combatente: na batalha, o ponto fixo da arena; fora dela, a célula do evento (ou de Bit).
function pontoDoJogador(ctx, c, r) {
  return ctx.emBatalha ? naArena(PONTO_ARENA.jogador) : naCelula(c ?? ctx.jogador.c, r ?? ctx.jogador.r);
}
function pontoDoInimigo(ctx, c, r) {
  return ctx.emBatalha ? naArena(PONTO_ARENA.inimigo) : naCelula(c ?? ctx.jogador.c, r ?? ctx.jogador.r);
}

// Converte um evento em uma lista de comandos de efeito. Evento sem efeito visual devolve [].
export function traduzirEvento(ev, ctx = {}) {
  const contexto = { jogador: ctx.jogador ?? { c: 0, r: 0, nivel: 1 }, emBatalha: !!ctx.emBatalha };
  const itens = ctx.catalogo?.itens ?? {};
  switch (ev?.tipo) {
    case 'dano': return traduzirDano(ev, contexto);
    case 'cura': {
      const p = pontoDoJogador(contexto);
      return [
        { efeito: 'texto', s: `+${ev.valor}`, cor: '#7dffb0', tipo: 'info', ...p },
        { efeito: 'cura', ...p },
      ];
    }
    case 'texto': {
      const p = ctx.emBatalha
        ? naArena(ev.alvo === 'jogador' ? PONTO_ARENA.jogador : PONTO_ARENA.inimigo)
        : naCelula(ev.c ?? contexto.jogador.c, ev.r ?? contexto.jogador.r);
      const tipo = /XP/.test(String(ev.texto ?? '')) ? 'destaque' : 'info';
      return [{ efeito: 'texto', s: String(ev.texto ?? ''), cor: ev.cor ?? '#f2ead8', tipo, ...p }];
    }
    case 'tremor': return [{ efeito: 'tremor', forca: ev.forca ?? 0 }];
    case 'fx': {
      const nome = FX_NO_MUNDO[ev.fx];
      if (!nome) return [];
      const p = naCelula(ev.c ?? contexto.jogador.c, ev.r ?? contexto.jogador.r);
      return [{ efeito: nome, x: p.x, y: p.y }];
    }
    case 'pegou': {
      const item = itens[ev.id];
      const cor = corRaridade(item?.raridade);
      const p = naCelula(contexto.jogador.c, contexto.jogador.r);
      const comandos = [{ efeito: 'texto', s: `+${ev.qtd ?? 1} ${item?.nome ?? ev.id}`, cor, tipo: 'destaque', x: p.x, y: p.y - 14, tela: false }];
      if (item?.raridade === 'raro' || item?.raridade === 'epico') comandos.push({ efeito: 'feixe', x: p.x, y: p.y, cor });
      return comandos;
    }
    case 'camada': {
      const L = LAYERS[ev.camada];
      if (!L) return [];
      const n = LAYER_ORDER.indexOf(ev.camada) + 1;
      return [
        { efeito: 'banner', titulo: L.nome, subtitulo: `Camada ${n} de ${LAYER_ORDER.length}`, cor: L.tema.destaque },
        { efeito: 'flash', cor: L.tema.destaque, duracao: 320 },
      ];
    }
    case 'sfx': return traduzirSom(ev.id, contexto);
    default: return [];
  }
}

function traduzirDano(ev, ctx) {
  const critico = !!ev.critico;
  if (ev.alvo === 'jogador') {
    const p = pontoDoJogador(ctx, ev.c, ev.r);
    return [
      { efeito: 'texto', s: `-${ev.valor}`, cor: '#ff6b5e', tipo: critico ? 'critico' : 'dano', ...p },
      { efeito: 'faisca', cor: '#ff5a4a', ...p },
      { efeito: 'flash', cor: '#a3121b', duracao: 240 },
      { efeito: 'tremor', forca: critico ? 5 : 2 },
    ];
  }
  const p = pontoDoInimigo(ctx, ev.c, ev.r);
  return [
    { efeito: 'texto', s: `-${ev.valor}`, cor: critico ? '#ffd166' : '#f2ead8', tipo: critico ? 'critico' : 'dano', ...p },
    { efeito: 'faisca', cor: critico ? '#ffd166' : '#ffffff', ...p },
  ];
}

// Sons que pedem um efeito visual além do áudio.
function traduzirSom(id, ctx) {
  const { jogador } = ctx;
  switch (id) {
    case 'subir_nivel': {
      const texto = { efeito: 'texto', s: `Nível ${jogador.nivel}`, cor: '#ffd166', tipo: 'critico' };
      if (ctx.emBatalha) return [{ ...texto, ...naArena(PONTO_ARENA.jogador) }];
      const p = naCelula(jogador.c, jogador.r);
      return [{ efeito: 'nivel', x: p.x, y: p.y, tela: false }, { ...texto, x: p.x, y: p.y - 22, tela: false }];
    }
    case 'chefe_surge': return [{ efeito: 'flash', cor: '#7a0b0b', duracao: 360 }];
    case 'sobreaquecer': return [{ efeito: 'flash', cor: '#ff5a20', duracao: 240 }];
    case 'derrota': return [{ efeito: 'flash', cor: '#000000', duracao: 700 }];
    default: return [];
  }
}

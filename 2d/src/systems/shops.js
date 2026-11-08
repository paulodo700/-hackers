// Lojas dos mercadores: compra e venda. Sem DOM.
import { adicionar, remover, contar } from './items.js';

export const lojaDoMercador = (game, npcId) => Object.values(game.catalog.lojas).find((l) => l.mercador === npcId) ?? null;

export function estoqueDaLoja(game, lojaId) {
  const loja = game.catalog.lojas[lojaId];
  if (!loja) return [];
  return loja.estoque.map((e) => {
    const base = game.catalog.itens[e.item]?.valor ?? 0;
    const restante = game.lojas[lojaId]?.[e.item] ?? e.estoque;
    return { item: e.item, preco: e.preco ?? base * 2, estoque: restante ?? null };
  });
}

export function comprar(game, lojaId, itemId) {
  const oferta = estoqueDaLoja(game, lojaId).find((o) => o.item === itemId);
  if (!oferta) return { ok: false, motivo: 'não vendido aqui' };
  if (oferta.estoque !== null && oferta.estoque < 1) return { ok: false, motivo: 'esgotado' };
  if (game.ciclos < oferta.preco) return { ok: false, motivo: 'ciclos insuficientes' };
  game.ciclos -= oferta.preco;
  adicionar(game, itemId, 1);
  if (oferta.estoque !== null) {
    game.lojas[lojaId] ??= {};
    game.lojas[lojaId][itemId] = oferta.estoque - 1;
  }
  game.say(`Comprou ${game.catalog.itens[itemId].nome} por ${oferta.preco} ciclos.`);
  game.emit({ tipo: 'sfx', id: 'compra' });
  return { ok: true, preco: oferta.preco };
}

// Venda: metade do valor, só de categorias que a loja aceita.
export function vender(game, lojaId, itemId) {
  const loja = game.catalog.lojas[lojaId];
  const item = game.catalog.itens[itemId];
  if (!loja || !item) return { ok: false, motivo: 'desconhecido' };
  if (!loja.compra.includes(item.tipo === 'consumivel' ? 'consumivel' : item.tipo === 'equipamento' ? 'equipamento' : 'material')) {
    return { ok: false, motivo: 'a loja não compra isso' };
  }
  if (contar(game, itemId) < 1) return { ok: false, motivo: 'sem estoque' };
  const preco = Math.floor(item.valor / 2);
  remover(game, itemId, 1);
  game.ciclos += preco;
  game.say(`Vendeu ${item.nome} por ${preco} ciclos.`);
  game.emit({ tipo: 'sfx', id: 'venda' });
  return { ok: true, preco };
}

// Criação de ferramentas, consumíveis, equipamentos e melhorias. Sem DOM.
import { remover, adicionar, contar } from './items.js';
import { RECEITAS } from '../data/recipes.js';

export const receitas = () => Object.values(RECEITAS);

export function podeCriar(game, id) {
  const r = RECEITAS[id];
  if (!r) return { ok: false, motivo: 'receita desconhecida' };
  const faltando = Object.entries(r.custo).filter(([item, n]) => contar(game, item) < n).map(([item]) => item);
  if (faltando.length) return { ok: false, motivo: 'materiais insuficientes', faltando };
  if (game.ciclos < (r.ciclos ?? 0)) return { ok: false, motivo: 'ciclos insuficientes' };
  return { ok: true };
}

export function criar(game, id) {
  const check = podeCriar(game, id);
  if (!check.ok) {
    game.say(`Não dá para criar: ${check.motivo}.`);
    game.emit({ tipo: 'sfx', id: 'erro' });
    return check;
  }
  const r = RECEITAS[id];
  for (const [item, n] of Object.entries(r.custo)) remover(game, item, n);
  game.ciclos -= r.ciclos ?? 0;
  adicionar(game, r.produz, r.qtd ?? 1);
  game.say(`Criado: ${game.catalog.itens[r.produz]?.nome ?? r.produz}.`);
  game.emit({ tipo: 'sfx', id: 'reparo' });
  return { ok: true, produz: r.produz };
}

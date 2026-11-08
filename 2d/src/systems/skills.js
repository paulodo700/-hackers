// Habilidades de Bit: aprender com pontos e nível, e listar as aprendidas. Sem DOM.
export const habilidadesAprendidas = (game) => game.player.habilidades
  .map((id) => game.catalog.habilidades[id]).filter(Boolean);

export function podeAprender(game, id) {
  const h = game.catalog.habilidades[id];
  if (!h) return { ok: false, motivo: 'habilidade desconhecida' };
  if (game.player.habilidades.includes(id)) return { ok: false, motivo: 'já aprendida' };
  if (game.player.nivel < h.nivel) return { ok: false, motivo: `requer nível ${h.nivel}` };
  if (game.player.pontos < h.pontos) return { ok: false, motivo: `precisa de ${h.pontos} ponto(s)` };
  return { ok: true };
}

export function aprender(game, id) {
  const r = podeAprender(game, id);
  if (!r.ok) return r;
  const h = game.catalog.habilidades[id];
  game.player.pontos -= h.pontos;
  game.player.habilidades.push(id);
  game.say(`Aprendeu ${h.nome}.`);
  return { ok: true };
}

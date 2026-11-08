// Atributos de Bit: crescimento por nível, equipamento e efeitos de estado. Sem DOM.
export const NIVEL_MAX = 15;

// XP necessária para subir do nível n para o n+1.
export const xpParaProximo = (n) => 12 + 8 * n + n * n;

// Soma dos bônus dos três slots de equipamento.
export function equipMods(game) {
  const mods = { atk: 0, def: 0, spd: 0, hp: 0, ep: 0, crit: 0 };
  for (const id of Object.values(game.player.equip)) {
    if (!id) continue;
    for (const [k, v] of Object.entries(game.catalog.itens[id]?.equipamento?.mods ?? {})) {
      mods[k] = (mods[k] ?? 0) + v;
    }
  }
  return mods;
}

// Atributos efetivos: base + equipamento + estados ativos (impulso, foco, lentidão, corrosão, fraqueza).
export function estatisticas(game) {
  const p = game.player;
  const m = equipMods(game);
  let atk = p.atk + m.atk;
  let def = p.def + m.def;
  let spd = p.spd + m.spd;
  let crit = p.crit + m.crit;
  for (const e of p.estados) {
    const st = game.catalog.status[e.id];
    if (!st) continue;
    atk += st.atk ?? 0;
    spd += st.spd ?? 0;
    crit += st.crit ?? 0;
    if (st.atkPct) atk *= 1 + st.atkPct;
    if (st.defPct) def *= 1 + st.defPct;
  }
  return {
    atk: Math.max(0, Math.round(atk)),
    def: Math.max(0, Math.round(def)),
    spd: Math.max(0, Math.round(spd)),
    crit: Math.max(0, crit),
    maxHp: p.maxHp + m.hp,
    maxEp: p.maxEp + m.ep,
  };
}

// Ganha XP e sobe de nível quantas vezes for preciso. Cada nível: vida +5, EP +1, um ponto de habilidade,
// ataque +1 nos níveis pares, defesa +1 nos múltiplos de 3, velocidade +1 nos múltiplos de 4.
export function ganharXp(game, qtd) {
  const p = game.player;
  p.xp += qtd;
  let subiu = 0;
  while (p.nivel < NIVEL_MAX && p.xp >= xpParaProximo(p.nivel)) {
    p.xp -= xpParaProximo(p.nivel);
    p.nivel++;
    subiu++;
    p.maxHp += 5;
    p.hp += 5;
    p.maxEp += 1;
    p.ep += 1;
    if (p.nivel % 2 === 0) p.atk++;
    if (p.nivel % 3 === 0) p.def++;
    if (p.nivel % 4 === 0) p.spd++;
    p.pontos += 1;
  }
  if (subiu) {
    game.emit({ tipo: 'sfx', id: 'subir_nivel' });
    game.say(`Nível ${p.nivel}! Você ganhou um ponto de habilidade.`);
  }
  return subiu;
}

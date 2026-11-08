// Regras de combate puras (sem DOM), usadas pela batalha e pelo simulador de balanceamento.

// Intenções do inimigo: multiplicador do golpe e texto mostrado ao jogador.
export const INTENTS = {
  normal: { text: 'Vai atacar.', mult: 1 },
  pesado: { text: '⚠ Prepara um golpe pesado!', mult: 1.8 },
  reparar: { text: 'Vai se reparar (+15 HP).', mult: 0 },
};

export const PHASE2_ATK = 1.15;

// Dano base: ataque * multiplicador - defesa * 0.6, com variação de ±10%.
export function dmgFrom(attack, defense, mult = 1, rng = Math.random) {
  const base = attack * mult - defense * 0.6;
  return Math.max(1, Math.round(base * (0.9 + rng() * 0.2)));
}

// Escolhe a próxima intenção do inimigo.
export function pickIntent({ boss, eHp, maxHp, phase2 }, rng = Math.random) {
  if (phase2 && rng() < 0.4) return 'pesado';
  if (boss && eHp < maxHp * 0.3 && rng() < 0.35) return 'reparar';
  return rng() < 0.22 ? 'pesado' : 'normal';
}

// Quantidade de dano do inimigo para a intenção escolhida (0 se for reparo).
export function enemyHit(enemyAtk, playerDef, intent, phase2, rng = Math.random) {
  const mult = INTENTS[intent].mult * (phase2 ? PHASE2_ATK : 1);
  return dmgFrom(enemyAtk, playerDef, mult, rng);
}

export function shouldEnterPhase2(boss, eHp, maxHp, alreadyPhase2) {
  return !!boss && !alreadyPhase2 && eHp <= maxHp * 0.5;
}

// Gerador determinístico (mulberry32) para testes e simulações reprodutíveis.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

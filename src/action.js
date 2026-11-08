// Luta em tempo real: regras puras do golpe do Bit e do contato dos bytes.
// Sem DOM e sem Three.js, para poder testar em Node.

export const SWING = {
  range: 1.9,       // alcance do golpe, em unidades do mundo
  arc: Math.PI * 0.7, // abertura do golpe em frente ao Bit
  cooldown: 0.42,   // segundos entre golpes
  knockback: 0.7,   // quanto o byte é empurrado para trás
};

export const CONTACT = {
  cooldown: 1.2,    // segundos entre ataques de cada byte encostado
  iframes: 0.25,    // tempo sem levar dano depois de cada golpe recebido
};

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Verdadeiro se o alvo está no alcance e dentro da abertura do golpe.
// `facing` segue a convenção do personagem: direção = (sin, cos).
export function inSwingArc(px, pz, facing, tx, tz, range = SWING.range, arc = SWING.arc) {
  const dx = tx - px, dz = tz - pz;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 0.6) return true; // colado no personagem sempre conta
  const target = Math.atan2(dx, dz);
  return Math.abs(angleDiff(target, facing)) <= arc / 2;
}

// Dano do golpe do Bit: ataque com um pouco de variação, descontando a defesa do byte.
export function swingDamage(attack, enemyDef, rng = Math.random) {
  const base = attack * 1.0 - enemyDef * 0.5;
  return Math.max(1, Math.round(base * (0.9 + rng() * 0.2)));
}

// Dano de contato: o byte bate com menos força do que um golpe de batalha.
export function contactDamage(enemyAtk, playerDef, rng = Math.random) {
  const base = enemyAtk * 0.6 - playerDef * 0.4;
  return Math.max(1, Math.round(base * (0.9 + rng() * 0.2)));
}

// Lista os bytes atingidos por um golpe. `roamers` é a lista de bytes vivos da zona.
export function swingTargets(player, roamers, facing) {
  return roamers.filter((rm) => rm.alive && inSwingArc(player.x, player.z, facing, rm.x, rm.z));
}

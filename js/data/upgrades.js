// Cartas de upgrade (dentro da run) e melhorias permanentes (Altar, entre runs).
(() => {
  const V = (window.V = window.V || {});
  V.Data = V.Data || {};

  // apply(p) altera o objeto de estatísticas do jogador "p".
  V.Data.cards = [
    {
      id: 'dmg', name: 'Afiação', icon: 'sword', rarity: 'common', max: 6,
      desc: 'Dano das flechas +25%.',
      apply: (p) => { p.dmg *= 1.25; },
    },
    {
      id: 'rate', name: 'Corda Rápida', icon: 'speed', rarity: 'common', max: 5,
      desc: 'Cadência de tiro +20%.',
      apply: (p) => { p.fireRate *= 1.2; },
    },
    {
      id: 'hp', name: 'Vitalidade', icon: 'heart', rarity: 'common', max: 6,
      desc: 'HP máximo +25 e cura imediata de 25.',
      apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
    },
    {
      id: 'move', name: 'Passos Leves', icon: 'cloak', rarity: 'common', max: 4,
      desc: 'Velocidade de movimento +12%.',
      apply: (p) => { p.moveSpeed *= 1.12; },
    },
    {
      id: 'crit', name: 'Olho de Águia', icon: 'crit', rarity: 'common', max: 5,
      desc: 'Chance de acerto crítico +12%.',
      apply: (p) => { p.critChance += 0.12; },
    },
    {
      id: 'critdmg', name: 'Golpe Certeiro', icon: 'fire', rarity: 'rare', max: 4,
      desc: 'Multiplicador de crítico +0,5.',
      apply: (p) => { p.critMult += 0.5; },
    },
    {
      id: 'multi', name: 'Leque de Flechas', icon: 'multi', rarity: 'rare', max: 2,
      desc: '+1 flecha por disparo, em leque.',
      apply: (p) => { p.multishot += 1; },
    },
    {
      id: 'pierce', name: 'Ponta Perfurante', icon: 'pierce', rarity: 'rare', max: 3,
      desc: 'Cada flecha atravessa +1 inimigo.',
      apply: (p) => { p.pierce += 1; },
    },
    {
      id: 'bounce', name: 'Ricochete', icon: 'bounce', rarity: 'rare', max: 3,
      desc: 'Flechas quicam +1 vez nas paredes.',
      apply: (p) => { p.bounces += 1; },
    },
    {
      id: 'homing', name: 'Flechas Buscadoras', icon: 'moon', rarity: 'rare', max: 3,
      desc: 'Flechas se curvam levemente para o alvo.',
      apply: (p) => { p.homing += 0.35; },
    },
    {
      id: 'burst', name: 'Flecha Incendiária', icon: 'fire', rarity: 'rare', max: 3,
      desc: 'Ao acertar, a flecha explode e causa 35% de dano em área.',
      apply: (p) => { p.explode += 0.35; },
    },
    {
      id: 'vamp', name: 'Sede Lunar', icon: 'vamp', rarity: 'rare', max: 4,
      desc: 'Recupera 2 HP a cada inimigo derrotado.',
      apply: (p) => { p.lifesteal += 2; },
    },
    {
      id: 'armor', name: 'Manto Reforçado', icon: 'shield', rarity: 'rare', max: 4,
      desc: 'Dano recebido -8%.',
      apply: (p) => { p.armor = Math.min(0.5, p.armor + 0.08); },
    },
    {
      id: 'dodge', name: 'Passo Fantasma', icon: 'leaf', rarity: 'epic', max: 3,
      desc: '+8% de chance de esquivar qualquer ataque.',
      apply: (p) => { p.dodge = Math.min(0.5, p.dodge + 0.08); },
    },
    {
      id: 'gold', name: 'Olhos de Ladrão', icon: 'gold', rarity: 'epic', max: 3,
      desc: 'Ouro e XP ganhos +30%.',
      apply: (p) => { p.goldMult *= 1.3; p.xpMult *= 1.3; },
    },
    {
      id: 'relicsight', name: 'Visão Lunar', icon: 'relic', rarity: 'epic', max: 1,
      desc: 'Chefes deixam +2 Relíquias ao cair.',
      apply: (p) => { p.relicBonus += 2; },
    },
    {
      id: 'frost', name: 'Flecha Gélida', icon: 'frost', rarity: 'rare', max: 3,
      desc: 'Flechas congelam o alvo, que fica mais lento por um tempo.',
      apply: (p) => { p.frost += 1; },
    },
  ];

  // Melhorias permanentes: cada nível custa Relíquias crescentes.
  V.Data.metaUpgrades = [
    { id: 'maxhp', name: 'Corpo Forte', icon: 'heart', max: 5, base: 3, desc: () => '+10 HP máximo inicial por nível.' },
    { id: 'dmg', name: 'Ponta de Prata', icon: 'sword', max: 5, base: 3, desc: () => '+5% de dano inicial por nível.' },
    { id: 'move', name: 'Pés de Vento', icon: 'cloak', max: 3, base: 4, desc: () => '+4% de velocidade inicial por nível.' },
    { id: 'gold', name: 'Bolsa Farta', icon: 'gold', max: 4, base: 3, desc: () => '+15% de ouro ganho por nível.' },
    { id: 'start', name: 'Bênção Inicial', icon: 'moon', max: 2, base: 6, desc: () => 'Começa com 1 carta comum extra por nível.' },
  ];

  V.Data.metaCost = (def, level) => def.base + level * 3;
  V.Data.rarityColor = { common: '#9fd3ff', rare: '#c79bff', epic: '#ffb347' };
  V.Data.rarityName = { common: 'Comum', rare: 'Rara', epic: 'Épica' };
})();

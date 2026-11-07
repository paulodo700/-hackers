// Definições de monstros comuns e chefes. Comportamentos ficam em js/game/ai.js.
(() => {
  const V = (window.V = window.V || {});
  V.Data = V.Data || {};

  // ai: nome do comportamento. radius: raio de colisão. size: tamanho do sprite.
  V.Data.monsters = {
    slime: {
      name: 'Gelatinoso', sprite: 'slime_g', hp: 22, speed: 40, dmg: 10, size: 34, radius: 12,
      ai: 'hop', xp: 2, gold: 2, split: true,
    },
    slime_p: {
      name: 'Gelatinoso Violeta', sprite: 'slime_p', hp: 30, speed: 46, dmg: 12, size: 36, radius: 12,
      ai: 'hop', xp: 3, gold: 3, split: true,
    },
    bat: {
      name: 'Morcego-brasa', sprite: 'bat', hp: 12, speed: 92, dmg: 8, size: 32, radius: 10,
      ai: 'flutter', xp: 1, gold: 1,
    },
    skel: {
      name: 'Esqueleto Arqueiro', sprite: 'skel', hp: 26, speed: 46, dmg: 8, size: 38, radius: 12,
      ai: 'kite', shootCd: 2.3, projectile: 'arrow_e', projSpeed: 210, projDmg: 9, xp: 3, gold: 3,
    },
    wolf: {
      name: 'Lobo Sombrio', sprite: 'wolf', hp: 38, speed: 54, dmg: 14, size: 44, radius: 15,
      ai: 'charge', xp: 4, gold: 3,
    },
    shaman: {
      name: 'Xamã Goblin', sprite: 'shaman', hp: 30, speed: 30, dmg: 9, size: 38, radius: 12,
      ai: 'support', shootCd: 2.6, projectile: 'orb_g', projSpeed: 150, projDmg: 10, xp: 4, gold: 4,
    },
    golem: {
      name: 'Golem de Pedra', sprite: 'golem', hp: 120, speed: 24, dmg: 18, size: 52, radius: 18,
      ai: 'slam', shootCd: 3.2, projectile: 'boulder', projSpeed: 120, projDmg: 16, xp: 9, gold: 8,
    },
    spider: {
      name: 'Aranha Cinzenta', sprite: 'spider', hp: 20, speed: 70, dmg: 10, size: 36, radius: 12,
      ai: 'web', shootCd: 2.4, projectile: 'web', projSpeed: 170, projDmg: 6, xp: 3, gold: 2,
    },
    wraith: {
      name: 'Espectro', sprite: 'wraith', hp: 40, speed: 50, dmg: 16, size: 40, radius: 13,
      ai: 'blink', blinkCd: 3.2, xp: 5, gold: 4,
    },
    mage: {
      name: 'Mago Culto', sprite: 'mage', hp: 32, speed: 30, dmg: 12, size: 40, radius: 12,
      ai: 'caster', shootCd: 2.0, projectile: 'orb_p', projSpeed: 140, projDmg: 12, homing: true, xp: 4, gold: 4,
    },
  };

  // Chefes: fases em porcentagem de HP; cada fase altera padrões em ai.js.
  V.Data.bosses = {
    boss_treant: {
      name: 'Ancião Raiz', sprite: 'boss_treant', hp: 620, dmg: 14, size: 160, radius: 40, xp: 30, gold: 40, ai: 'treant',
    },
    boss_king: {
      name: 'Rei Obsidiana', sprite: 'boss_king', hp: 820, dmg: 18, size: 168, radius: 42, xp: 40, gold: 60, ai: 'king',
    },
    boss_eclipse: {
      name: 'Senhor do Eclipse', sprite: 'boss_eclipse', hp: 1050, dmg: 14, size: 170, radius: 40, xp: 60, gold: 90, ai: 'eclipse',
    },
  };
})();

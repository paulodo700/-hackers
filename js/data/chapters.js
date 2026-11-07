// Capítulos: cenário, trilha sonora, pool de monstros e chefe. Cada capítulo tem 7 passos de mapa + chefe.
(() => {
  const V = (window.V = window.V || {});
  V.Data = V.Data || {};

  V.Data.STEPS_PER_CHAPTER = 7;

  V.Data.chapters = [
    {
      id: 1,
      name: 'Bosque Sussurrante',
      subtitle: 'Onde a primeira sombra cresceu',
      theme: 'forest',
      music: 'forest',
      obstacles: ['bush', 'rock', 'bush'],
      pool: [
        { w: 5, id: 'slime' },
        { w: 4, id: 'bat' },
        { w: 3, id: 'skel' },
        { w: 2, id: 'wolf' },
        { w: 1, id: 'slime_p' },
      ],
      boss: 'boss_treant',
      bg: ['#14301a', '#0b1a0e'],
      icon: 'leaf',
    },
    {
      id: 2,
      name: 'Minas de Cinza',
      subtitle: 'Onde a terra ganhou raiva',
      theme: 'mines',
      music: 'mines',
      obstacles: ['rock', 'crystal', 'pillar'],
      pool: [
        { w: 3, id: 'golem' },
        { w: 4, id: 'spider' },
        { w: 3, id: 'shaman' },
        { w: 3, id: 'skel' },
        { w: 2, id: 'wolf' },
        { w: 2, id: 'bat' },
      ],
      boss: 'boss_king',
      bg: ['#2a2430', '#110e16'],
      icon: 'fire',
    },
    {
      id: 3,
      name: 'Torre do Crepúsculo',
      subtitle: 'Onde a lua foi aprisionada',
      theme: 'tower',
      music: 'tower',
      obstacles: ['pillar', 'crystal', 'pillar'],
      pool: [
        { w: 4, id: 'wraith' },
        { w: 4, id: 'mage' },
        { w: 3, id: 'spider' },
        { w: 3, id: 'golem' },
        { w: 2, id: 'skel' },
        { w: 2, id: 'bat' },
      ],
      boss: 'boss_eclipse',
      bg: ['#1c1838', '#07050f'],
      icon: 'moon',
    },
  ];
})();

// Inicialização: carrega progresso, registra as cenas e inicia o loop.
(() => {
  const V = window.V;

  V.Meta.load();
  V.Audio.enabled = V.Util.store.get('sound', true);

  const scenes = V.Scenes;
  const names = ['title', 'story', 'map', 'gameplay', 'event', 'altar', 'gameover', 'credits'];
  for (const n of names) V.Game.register(n, scenes[n]);

  // Evita que o navegador role a página em dispositivos de toque.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  V.Game.start('title');
})();

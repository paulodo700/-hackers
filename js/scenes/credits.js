// Créditos: rolagem simples com a equipe e informações do projeto.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Audio } = V;

  const LINES = [
    ['VAELMOR', 'title'],
    ['O Arqueiro do Eclipse', 'sub'],
    ['', 'gap'],
    ['Tudo original', 'h'],
    ['Roteiro, personagens, monstros, chefes,', 'p'],
    ['sprites e músicas foram criados do zero.', 'p'],
    ['', 'gap'],
    ['Tecnologia', 'h'],
    ['HTML5 Canvas 2D e JavaScript puro.', 'p'],
    ['Sprites desenhados por código.', 'p'],
    ['Música e efeitos com Web Audio.', 'p'],
    ['', 'gap'],
    ['Controles', 'h'],
    ['Arraste para mover (celular e mouse)', 'p'],
    ['WASD ou setas para mover (teclado)', 'p'],
    ['P ou Esc para pausar', 'p'],
    ['', 'gap'],
    ['Obrigado por jogar!', 'sub'],
  ];

  const Credits = {
    t: 0,
    back: { x: 90, y: 590, w: 180, h: 40 },

    enter() {
      this.t = 0;
      Audio.playTrack('title');
    },

    update(dt) {
      this.t += dt;
    },

    draw(g) {
      UI.backdrop(g, 360, 640, '#1a1038', '#05030c');
      UI.stars(g, 360, 640, this.t, 60, 77);
      let y = 640 - this.t * 36;
      for (const [text, kind] of LINES) {
        if (kind === 'title') UI.title(g, text, 180, y, { align: 'center', size: 34 });
        else if (kind === 'sub') UI.text(g, text, 180, y, { align: 'center', size: 17, color: '#ffe9b0', font: 'Georgia, serif' });
        else if (kind === 'h') UI.text(g, text, 180, y, { align: 'center', size: 16, weight: 'bold', color: '#c9b6ff' });
        else if (kind === 'p') UI.text(g, text, 180, y, { align: 'center', size: 13, color: '#e8e2f5' });
        y += kind === 'gap' ? 34 : kind === 'title' ? 56 : 26;
      }
      g.fillStyle = 'rgba(5,3,12,0.85)';
      g.fillRect(0, 0, 360, 36);
      g.fillRect(0, 604, 360, 36);
      UI.button(g, { ...this.back, label: 'Voltar', color: '#4a4558' });
    },

    onPointer(type, x, y) {
      if (type === 'down' && UI.hit(this.back, x, y)) V.Game.go('title');
    },

    onKey(code, down) {
      if (down && (code === 'Escape' || code === 'Enter')) V.Game.go('title');
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.credits = Credits;
})();

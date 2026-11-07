// Cena de história: retratos, falas com efeito de digitação e narração.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Sprites, Audio } = V;

  const CPS = 42; // caracteres por segundo

  const Story = {
    data: null,
    i: 0,
    shown: 0,
    lineCache: null,
    t: 0,
    blink: 0,

    enter(data) {
      this.data = data;
      this.i = 0;
      this.t = 0;
      this.blink = 0;
      this.prepare();
      Audio.playTrack(this.trackFor(data));
    },

    trackFor(data) {
      if (data.music) return data.music;
      return 'title';
    },

    line() {
      return this.data.lines[this.i];
    },

    prepare() {
      const line = this.line();
      this.total = line ? line.text.length : 0;
      this.shown = 0;
    },

    finishLine() {
      this.shown = this.total;
    },

    next() {
      if (this.shown < this.total) {
        this.finishLine();
        return;
      }
      this.i++;
      if (this.i >= this.data.lines.length) {
        this.done();
        return;
      }
      this.prepare();
    },

    done() {
      const n = this.data.next || { name: 'map' };
      V.Game.go(n.name, n.data || {});
    },

    update(dt) {
      this.t += dt;
      this.blink += dt;
      if (this.shown < this.total) {
        const before = Math.floor(this.shown);
        this.shown = Math.min(this.total, this.shown + CPS * dt);
        if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 3 === 0) Audio.sfx('type');
      }
    },

    draw(g) {
      const line = this.line();
      if (!line) return;
      const t = this.t;
      UI.backdrop(g, 360, 640, '#1a1038', '#06040f');
      UI.stars(g, 360, 640, t, 40, 11);

      // Título do bloco (capítulo ou prólogo)
      UI.text(g, (this.data.title || '').toUpperCase(), 180, 28, {
        align: 'center', size: 13, weight: 'bold', color: '#c9b6ff', shadow: false,
      });
      // Progresso
      const n = this.data.lines.length;
      for (let k = 0; k < n; k++) {
        const x = 180 - ((n - 1) * 10) / 2 + k * 10;
        g.beginPath();
        g.arc(x, 48, 3, 0, Math.PI * 2);
        g.fillStyle = k <= this.i ? '#ffd77a' : 'rgba(255,255,255,0.2)';
        g.fill();
      }

      if (!line.who) {
        // Narração centralizada
        UI.panel(g, 22, 170, 316, 240, { fill: 'rgba(12,8,22,0.55)', stroke: 'rgba(201,182,255,0.35)' });
        const txt = line.text.slice(0, Math.floor(this.shown));
        UI.text(g, txt, 46, 200, {
          size: 19, color: '#eae3ff', maxW: 268, lineH: 28, font: 'Georgia, serif', shadow: false,
        });
      } else {
        const face = line.face || 'ysa';
        g.save();
        // Retrato com leve movimento
        const bob = Math.sin(t * 1.8) * 2;
        g.drawImage(Sprites.bust(face), 180 - 110, 70 + bob, 220, 220);
        g.restore();
        // Placa de nome
        UI.panel(g, 96, 286, 168, 34, { r: 10, fill: 'rgba(40,24,64,0.95)', stroke: '#ffd77a' });
        UI.text(g, line.who, 180, 295, { align: 'center', size: 17, weight: 'bold', color: '#ffe9b0', shadow: false });
        // Caixa de diálogo
        UI.panel(g, 18, 332, 324, 210, { fill: 'rgba(12,8,22,0.9)' });
        const txt = line.text.slice(0, Math.floor(this.shown));
        UI.text(g, txt, 36, 352, { size: 17, color: '#f4eefc', maxW: 288, lineH: 25, shadow: false });
      }

      // Pular e dica
      UI.button(g, { x: 268, y: 8, w: 80, h: 28, label: 'Pular', color: '#4a4558', size: 13 });
      if (Math.floor(this.blink * 2) % 2 === 0 && this.shown >= this.total) {
        UI.text(g, 'toque para continuar ▸', 180, 580, { align: 'center', size: 13, color: '#ffd77a', shadow: true });
      }
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (UI.hit({ x: 268, y: 8, w: 80, h: 28 }, x, y)) {
        this.done();
        return;
      }
      this.next();
    },

    onKey(code, down) {
      if (!down) return;
      if (code === 'Enter' || code === 'Space' || code === 'KeyZ') this.next();
      if (code === 'Escape') this.done();
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.story = Story;
})();

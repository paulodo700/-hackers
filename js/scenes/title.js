// Menu principal: nova jornada, continuar, Altar, som e créditos.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Sprites, Audio, Util } = { UI: V.UI, Sprites: V.Sprites, Audio: V.Audio, Util: V.Util };

  const Title = {
    t: 0,
    buttons: [],

    enter() {
      this.t = 0;
      Audio.playTrack('title');
      this.build();
    },

    build() {
      const hasSave = V.Game.hasSavedRun();
      const items = [{ id: 'new', label: 'Nova Jornada', color: '#7a4fd6' }];
      if (hasSave) items.push({ id: 'continue', label: 'Continuar', color: '#2f9e8a' });
      items.push({ id: 'altar', label: 'Altar das Relíquias', color: '#b5673a' });
      items.push({ id: 'sound', label: this.soundLabel(), color: '#4a6fb8' });
      items.push({ id: 'credits', label: 'Créditos', color: '#5b5470' });
      let y = 352;
      this.buttons = items.map((it) => {
        const b = { x: 60, y, w: 240, h: 46, label: it.label, color: it.color, id: it.id };
        y += 56;
        return b;
      });
    },

    soundLabel() {
      return 'Som: ' + (Audio.enabled ? 'Ligado' : 'Desligado');
    },

    update(dt) {
      this.t += dt;
    },

    draw(g) {
      const t = this.t;
      UI.backdrop(g, 360, 640, '#1c1244', '#05030c');
      UI.stars(g, 360, 640, t, 70, 3);

      // Lua do eclipse
      const mx = 180;
      const my = 110;
      const glow = g.createRadialGradient(mx, my, 60, mx, my, 150);
      glow.addColorStop(0, 'rgba(255,207,90,0.35)');
      glow.addColorStop(1, 'rgba(255,207,90,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 360, 300);
      g.beginPath();
      g.arc(mx, my, 50, 0, Math.PI * 2);
      g.fillStyle = '#0a0614';
      g.fill();
      g.beginPath();
      g.arc(mx, my, 52, t * 0.5, t * 0.5 + Math.PI * 1.6);
      g.strokeStyle = '#ffcf5a';
      g.lineWidth = 3;
      g.stroke();

      // Títulos
      UI.title(g, 'VAELMOR', 180, 186, { align: 'center', size: 44, strokeW: 8 });
      UI.text(g, 'O Arqueiro do Eclipse', 180, 236, {
        align: 'center', size: 18, color: '#e6dcff', font: 'Georgia, serif', weight: 'italic',
      });

      // Arqueira
      const bob = Math.sin(t * 2.2) * 4;
      Sprites.draw(g, 'player', 180, 300 + bob, 66, { frame: Math.floor(t * 2) % 2 });
      // Botões
      for (const b of this.buttons) {
        const label = b.id === 'sound' ? this.soundLabel() : b.label;
        UI.button(g, { ...b, label });
      }

      // Rodapé
      const best = V.Meta.best;
      UI.text(g, `Relíquias: ${V.Meta.relics}`, 180, 606, { align: 'center', size: 15, weight: 'bold', color: '#c9a0ff' });
      if (best.runs > 0) {
        UI.text(g, `Recorde: capítulo ${best.chapter} · ${best.kills} inimigos`, 180, 626, {
          align: 'center', size: 12, color: '#b7aed0',
        });
      }
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      for (const b of this.buttons) {
        if (!UI.hit(b, x, y)) continue;
        Audio.sfx('click');
        this.act(b.id);
        return;
      }
    },

    act(id) {
      if (id === 'new') {
        V.Run.start();
        V.Game.clearRun();
        V.Meta.best.runs = (V.Meta.best.runs || 0) + 1;
        V.Meta.save();
        const ch = V.Data.chapters[0];
        V.Game.go('story', {
          title: 'Prólogo',
          lines: V.Data.story.prologue.concat([{ who: null, text: '— ' + ch.name + ' —' }], ch.intro),
          next: { name: 'map' },
        });
      } else if (id === 'continue') {
        const saved = V.Util.store.get('run', null);
        if (V.Run.restore(saved)) V.Game.go('map', {});
      } else if (id === 'altar') {
        V.Game.go('altar', {});
      } else if (id === 'sound') {
        Audio.setEnabled(!Audio.enabled);
        this.build();
      } else if (id === 'credits') {
        V.Game.go('credits', {});
      }
    },

    onKey(code, down) {
      if (!down) return;
      if (code === 'Enter' || code === 'Space') this.act('new');
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.title = Title;
})();

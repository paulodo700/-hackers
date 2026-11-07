// Fim de jornada (derrota ou vitória): resumo, Relíquias ganhas e recomeço.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Audio, Run, Meta } = V;

  const GameOver = {
    t: 0,
    victory: false,
    summary: null,
    quote: '',
    btns: [],

    enter(data) {
      this.t = 0;
      this.victory = !!data.victory;
      if (Run.active) {
        const relics = Run.relicsOnEnd(this.victory);
        const chapterReached = this.victory ? V.Data.chapters.length : Run.chapter + 1;
        this.summary = {
          chapter: chapterReached,
          kills: Run.kills,
          gold: Run.gold,
          level: Run.level,
          relics,
          rooms: Run.roomsCleared,
        };
        Meta.addRelics(relics);
        Meta.best.chapter = Math.max(Meta.best.chapter || 0, chapterReached);
        Meta.best.kills = Math.max(Meta.best.kills || 0, Run.kills);
        if (this.victory) Meta.best.wins = (Meta.best.wins || 0) + 1;
        Meta.save();
        Run.active = false;
        V.Game.clearRun();
      } else {
        this.summary = this.summary || { chapter: 1, kills: 0, gold: 0, level: 1, relics: 0, rooms: 0 };
      }
      const q = V.Data.story.defeat;
      this.quote = this.victory ? '' : V.Util.makeRng((Date.now() / 1000) | 0).pick(q);
      Audio.playTrack(this.victory ? 'shop' : 'title');
      Audio.sfx(this.victory ? 'victory' : 'defeat');
      this.btns = [
        { id: 'new', x: 60, y: 486, w: 240, h: 50, label: 'Nova Jornada', color: '#7a4fd6' },
        { id: 'menu', x: 60, y: 548, w: 240, h: 46, label: 'Menu Principal', color: '#4a4558' },
      ];
    },

    update(dt) {
      this.t += dt;
    },

    draw(g) {
      const s = this.summary;
      const top = this.victory ? '#2a2a10' : '#2a0c18';
      UI.backdrop(g, 360, 640, top, '#06040a');
      UI.stars(g, 360, 640, this.t, 50, 57);
      const title = this.victory ? 'A Lua Retorna' : 'A Escuridão Venceu… Por Ora';
      UI.title(g, title, 180, 70, { align: 'center', size: this.victory ? 24 : 22, color: this.victory ? '#ffe9a8' : '#ffb3c1' });
      if (this.quote) {
        UI.text(g, this.quote, 180, 112, { align: 'center', size: 14, maxW: 290, lineH: 20, color: '#d8cff0', font: 'Georgia, serif' });
      }
      if (this.victory) {
        UI.text(g, 'Vaelmor respira outra vez. Obrigado por jogar.', 180, 112, { align: 'center', size: 14, maxW: 290, lineH: 20, color: '#ffe9a8', font: 'Georgia, serif' });
      }

      if (s) {
        UI.panel(g, 30, 160, 300, 262, { fill: 'rgba(14,9,26,0.92)', stroke: 'rgba(255,215,122,0.45)', r: 16 });
        const rows = [
          ['Capítulo alcançado', `${s.chapter} de ${V.Data.chapters.length}`],
          ['Inimigos derrotados', String(s.kills)],
          ['Salas concluídas', String(s.rooms)],
          ['Nível da arqueira', String(s.level)],
          ['Ouro acumulado', String(s.gold)],
        ];
        rows.forEach((r, i) => {
          const y = 184 + i * 40;
          UI.text(g, r[0], 50, y, { size: 15, color: '#c9b6ff', shadow: false });
          UI.text(g, r[1], 310, y, { size: 16, weight: 'bold', align: 'right', color: '#fff7e0', shadow: false });
        });
        UI.icon(g, 'relic', 70, 386, 22);
        UI.text(g, `+${s.relics} Relíquias`, 92, 376, { size: 19, weight: 'bold', color: '#d7b8ff' });
        UI.text(g, `Total guardado: ${Meta.relics}`, 50, 406, { size: 13, color: '#b7aed0', shadow: false });
      }

      for (const b of this.btns) UI.button(g, b);
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      for (const b of this.btns) {
        if (!UI.hit(b, x, y)) continue;
        Audio.sfx('click');
        if (b.id === 'new') {
          V.Run.start();
          V.Game.clearRun();
          const ch = V.Data.chapters[0];
          V.Game.go('story', {
            title: 'Prólogo',
            lines: V.Data.story.prologue.concat([{ who: null, text: '— ' + ch.name + ' —' }], ch.intro),
            next: { name: 'map' },
          });
        } else {
          V.Game.go('title');
        }
        return;
      }
    },

    onKey(code, down) {
      if (down && (code === 'Enter' || code === 'Space')) this.onPointer('down', 180, 500);
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.gameover = GameOver;
})();

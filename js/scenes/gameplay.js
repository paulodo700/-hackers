// Cena de combate: arena, HUD, subida de nível, pausa e transições ao fim da sala.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Audio, Run, Input } = V;

  const PAUSE_BTN = { x: 268, y: 62, w: 80, h: 26 };

  const Gameplay = {
    kind: 'combat',
    world: null,
    paused: false,
    overlay: null, // null | 'levelup' | 'pause'
    choices: [],
    hintT: 7,
    fx: 0,
    pauseBtns: [],
    finished: false,

    enter(data) {
      this.kind = data.kind || 'combat';
      this.world = new V.World(this.kind);
      this.paused = false;
      this.overlay = null;
      this.choices = [];
      this.hintT = 7;
      this.finished = false;
      this.fx = 0;
      Audio.playTrack(this.kind === 'boss' ? 'boss' : Run.chapterDef().music);
      V.Game.saveRun();
    },

    exit() {
      Input.reset();
    },

    update(dt) {
      this.fx += dt;
      if (this.overlay || this.paused || this.finished) return;
      const w = this.world;
      w.update(dt);
      if (this.hintT > 0) this.hintT -= dt;

      if (w.state !== 'lost' && w.pendingLevelUps > 0) {
        this.openLevelUp();
        return;
      }
      if (w.state !== 'play' && w.endT <= 0 && (w.pickups.length === 0 || w.endT <= -1.5)) this.finish();
    },

    // ---------- Subida de nível ----------

    openLevelUp() {
      const w = this.world;
      const pick = Run.randomCards(3);
      if (!pick.length) {
        // Todas as cartas no máximo: converte o nível em cura.
        w.pendingLevelUps--;
        Run.stats.hp = Math.min(Run.stats.maxHp, Run.stats.hp + 15);
        w.floatText(w.player.x, w.player.y - 40, 'Nível! +15 HP', '#7dff9a', 14);
        return;
      }
      this.choices = pick;
      this.overlay = 'levelup';
      Audio.sfx('levelup');
    },

    chooseCard(card) {
      Run.pickCard(card);
      this.world.pendingLevelUps--;
      this.world.floatText(this.world.player.x, this.world.player.y - 40, 'Nível ' + Run.level + '!', '#ffe9a8', 16);
      this.overlay = null;
      this.choices = [];
    },

    levelCardRects() {
      return this.choices.map((c, i) => ({ x: 28, y: 198 + i * 108, w: 304, h: 96, card: c }));
    },

    // ---------- Fim de sala ----------

    finish() {
      if (this.finished) return;
      this.finished = true;
      const w = this.world;
      if (w.state === 'lost') {
        V.Game.go('gameover', { victory: false });
        return;
      }
      // Vitória de sala
      if (this.kind === 'boss') {
        const ch = Run.chapterDef();
        const idx = Run.chapter;
        const story = V.Data.story;
        Run.advance();
        Run.stats.hp = Math.min(Run.stats.maxHp, Run.stats.hp + Math.round(Run.stats.maxHp * 0.25));
        if (Run.isFinalChapterDone()) {
          V.Game.clearRun();
          V.Game.go('story', {
            title: ch.name + ' · Fim',
            music: 'shop',
            lines: story.chapters[idx].outro,
            next: {
              name: 'story',
              data: {
                title: 'Epílogo',
                music: 'title',
                lines: story.ending,
                next: { name: 'gameover', data: { victory: true } },
              },
            },
          });
          return;
        }
        const nextCh = V.Data.chapters[Run.chapter];
        V.Game.saveRun();
        V.Game.go('story', {
          title: ch.name + ' · Fim',
          music: 'shop',
          lines: story.chapters[idx].outro,
          next: {
            name: 'story',
            data: {
              title: nextCh.name,
              music: nextCh.music,
              lines: story.chapters[Run.chapter].intro,
              next: { name: 'map', data: { banner: 'Capítulo concluído!' } },
            },
          },
        });
        return;
      }
      Run.roomsCleared++;
      Run.advance();
      V.Game.saveRun();
      const banner = this.kind === 'elite' ? 'Campeão derrotado!' : 'Sala limpa!';
      V.Game.go('map', { banner });
    },

    pauseGame() {
      if (this.finished || this.overlay) return;
      this.overlay = 'pause';
      this.paused = true;
      Audio.sfx('click');
    },

    resumeGame() {
      this.overlay = null;
      this.paused = false;
    },

    giveUp() {
      this.world.state = 'lost';
      this.world.endT = 0;
      this.overlay = null;
      this.paused = false;
      this.finish();
    },

    // ---------- Desenho ----------

    draw(g) {
      const w = this.world;
      w.draw(g);
      // Joystick virtual
      if (Input.stick.active) {
        g.save();
        g.globalAlpha = 0.35;
        g.beginPath();
        g.arc(Input.stick.ox, Input.stick.oy, 46, 0, Math.PI * 2);
        g.strokeStyle = '#ffe9b0';
        g.lineWidth = 2;
        g.stroke();
        g.globalAlpha = 0.55;
        g.beginPath();
        g.arc(Input.stick.ox + Input.stick.x * 46, Input.stick.oy + Input.stick.y * 46, 16, 0, Math.PI * 2);
        g.fillStyle = '#ffe9b0';
        g.fill();
        g.restore();
      }

      // HUD
      const need = Run.xpNeeded(Run.level);
      V.HUD.draw(g, Run.stats, Run.level, Run.xp, need, Run.gold, Run.cardOrder, Run.cards);
      const roomLabel = this.kind === 'boss'
        ? 'Chefe · ' + Run.chapterDef().name
        : `Sala ${Run.step + 1} de ${V.Data.STEPS_PER_CHAPTER} · ${this.kind === 'elite' ? 'Campeão' : 'Combate'}`;
      UI.text(g, roomLabel, 18, 80, { size: 12, weight: 'bold', color: '#e6dcff', shadow: false });
      UI.button(g, { ...PAUSE_BTN, label: 'Pausa', color: '#4a4558', size: 13 });

      // Barra do chefe
      if (this.kind === 'boss' && w.bossRef && !w.bossRef.dead) {
        const b = w.bossRef;
        UI.text(g, b.name, 180, 104, { align: 'center', size: 13, weight: 'bold', color: '#ffd77a', stroke: '#2a1408', strokeW: 4 });
        UI.bar(g, 60, 122, 240, 9, b.hp / b.maxHp, '#ff7a2a', '#b3203a', 'rgba(0,0,0,0.6)');
      }

      // Dica de controles
      if (this.hintT > 0 && w.state === 'play' && !this.overlay) {
        g.globalAlpha = Math.min(1, this.hintT / 2);
        UI.text(g, 'Arraste para mover · a flecha mira sozinha', 180, 582, {
          align: 'center', size: 13, color: '#e9e2ff', shadow: true,
        });
        g.globalAlpha = 1;
      }

      // Banners de fim de sala
      if (w.state === 'won' && w.endT > 0) {
        const msg = this.kind === 'boss' ? 'Chefe derrotado!' : 'Sala limpa!';
        UI.panel(g, 50, 280, 260, 56, { fill: 'rgba(10,6,20,0.85)', stroke: '#ffd77a', r: 14 });
        UI.text(g, msg, 180, 296, { align: 'center', size: 22, weight: 'bold', color: '#ffe9b0', shadow: false });
      }
      if (w.state === 'lost') {
        g.fillStyle = 'rgba(40,0,10,0.35)';
        g.fillRect(0, 0, 360, 640);
      }

      if (this.overlay === 'levelup') this.drawLevelUp(g);
      if (this.overlay === 'pause') this.drawPause(g);
    },

    drawLevelUp(g) {
      g.fillStyle = 'rgba(4,2,10,0.7)';
      g.fillRect(0, 0, 360, 640);
      UI.panel(g, 14, 120, 332, 440, { fill: 'rgba(14,9,28,0.96)', stroke: '#ffd77a', lw: 2.5, r: 18 });
      UI.title(g, 'Nível ' + Run.level, 180, 138, { align: 'center', size: 26 });
      UI.text(g, 'Escolha um aprimoramento', 180, 172, { align: 'center', size: 13, color: '#c9b6ff', shadow: false });
      for (const r of this.levelCardRects()) {
        const c = r.card;
        const col = V.Data.rarityColor[c.rarity];
        UI.panel(g, r.x, r.y, r.w, r.h, { fill: 'rgba(24,16,44,0.95)', stroke: col, lw: 2.5, r: 14 });
        UI.icon(g, c.icon, r.x + 40, r.y + 44, 40);
        UI.text(g, c.name, r.x + 80, r.y + 14, { size: 18, weight: 'bold', color: '#fff7e0', shadow: false });
        UI.text(g, V.Data.rarityName[c.rarity], r.x + r.w - 14, r.y + 16, { size: 11, align: 'right', weight: 'bold', color: col, shadow: false });
        UI.text(g, c.desc, r.x + 80, r.y + 40, { size: 13, maxW: r.w - 96, lineH: 17, color: '#e8e2f5', shadow: false });
        const have = Run.cardCount(c.id);
        if (have) UI.text(g, `Atual: ×${have}`, r.x + 80, r.y + r.h - 20, { size: 11, color: '#b7aed0', shadow: false });
      }
    },

    drawPause(g) {
      g.fillStyle = 'rgba(4,2,10,0.72)';
      g.fillRect(0, 0, 360, 640);
      UI.panel(g, 60, 190, 240, 290, { fill: 'rgba(14,9,28,0.96)', stroke: '#ffd77a', lw: 2.5, r: 18 });
      UI.title(g, 'Pausa', 180, 212, { align: 'center', size: 28 });
      this.pauseBtns = [
        { id: 'resume', x: 90, y: 270, w: 180, h: 46, label: 'Continuar', color: '#2f9e8a' },
        { id: 'sound', x: 90, y: 330, w: 180, h: 46, label: 'Som: ' + (Audio.enabled ? 'Ligado' : 'Desligado'), color: '#4a6fb8' },
        { id: 'quit', x: 90, y: 390, w: 180, h: 46, label: 'Desistir da run', color: '#8a3a4a' },
      ];
      for (const b of this.pauseBtns) UI.button(g, b);
      UI.text(g, 'Desistir conta como derrota, mas as Relíquias são mantidas.', 180, 448, {
        align: 'center', size: 11, maxW: 210, lineH: 14, color: '#b7aed0', shadow: false,
      });
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (this.overlay === 'levelup') {
        for (const r of this.levelCardRects()) {
          if (UI.hit(r, x, y)) {
            Audio.sfx('select');
            this.chooseCard(r.card);
            return;
          }
        }
        return;
      }
      if (this.overlay === 'pause') {
        for (const b of this.pauseBtns) {
          if (!UI.hit(b, x, y)) continue;
          Audio.sfx('click');
          if (b.id === 'resume') this.resumeGame();
          else if (b.id === 'sound') {
            Audio.setEnabled(!Audio.enabled);
            this.overlay = 'pause';
          } else if (b.id === 'quit') this.giveUp();
          return;
        }
        return;
      }
      if (UI.hit(PAUSE_BTN, x, y)) this.pauseGame();
    },

    onKey(code, down) {
      if (!down) return;
      if (code === 'KeyP' || code === 'Escape') {
        if (this.overlay === 'pause') this.resumeGame();
        else this.pauseGame();
      }
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.gameplay = Gameplay;
})();

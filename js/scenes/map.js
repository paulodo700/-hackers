// Mapa do capítulo: trilha de nós, posição da arqueira e duas escolhas por passo.
(() => {
  const V = (window.V = window.V || {});
  const { UI, Sprites, Audio, Run } = V;

  const TYPES = {
    combat: { name: 'Combate', icon: 'sword', color: '#4fbf6a', desc: 'Ondas de monstros. XP e ouro comuns.' },
    elite: { name: 'Campeão', icon: 'fire', color: '#e0573f', desc: 'Campeões fortes. Recompensa maior.' },
    treasure: { name: 'Tesouro', icon: 'gold', color: '#e0b84a', desc: 'Escolha 1 de 3 cartas sem custo.' },
    rest: { name: 'Descanso', icon: 'heart', color: '#5fd3a0', desc: 'Recupera 35% da vida atual.' },
    shop: { name: 'Mercador', icon: 'relic', color: '#9a7bff', desc: 'Compre poções e cartas com ouro.' },
    boss: { name: 'Chefe', icon: 'moon', color: '#ffb347', desc: 'Enfrente o guardião do capítulo.' },
  };

  // Posições dos nós (passo 0 embaixo, chefe em cima).
  const NODE_POS = [
    { x: 180, y: 452 },
    { x: 252, y: 416 },
    { x: 118, y: 380 },
    { x: 246, y: 344 },
    { x: 116, y: 308 },
    { x: 240, y: 272 },
    { x: 150, y: 236 },
    { x: 180, y: 200 },
  ];

  const Map = {
    t: 0,
    banner: null,
    bannerT: 0,
    cards: [],
    menuBtn: { x: 262, y: 66, w: 84, h: 26 },

    enter(data) {
      this.t = 0;
      this.banner = data.banner || null;
      this.bannerT = 2.0;
      if (!Run.active) {
        V.Game.go('title');
        return;
      }
      const ch = Run.chapterDef();
      Audio.playTrack(ch.music);
      Run.currentChoices();
      V.Game.saveRun();
    },

    update(dt) {
      this.t += dt;
      if (this.bannerT > 0) this.bannerT -= dt;
    },

    layoutCards(choices) {
      if (choices.length === 1) return [{ x: 60, y: 486, w: 240, h: 130, type: choices[0] }];
      return choices.map((type, i) => ({ x: 14 + i * 172, y: 486, w: 166, h: 130, type }));
    },

    draw(g) {
      const ch = Run.chapterDef();
      const choices = Run.currentChoices();
      const [c0, c1] = ch.bg;
      UI.backdrop(g, 360, 640, c0, c1);
      UI.stars(g, 360, 640, this.t, 50, 23);

      // Cabeçalho
      UI.text(g, `CAPÍTULO ${ch.id} de ${V.Data.chapters.length}`, 18, 108, {
        size: 12, weight: 'bold', color: '#c9b6ff', shadow: false,
      });
      UI.title(g, ch.name, 18, 124, { size: 21, strokeW: 5 });
      UI.text(g, ch.subtitle, 18, 150, { size: 12, color: '#b7aed0', font: 'Georgia, serif' });

      // Trilha
      g.save();
      g.setLineDash([4, 6]);
      g.strokeStyle = 'rgba(255,215,122,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      NODE_POS.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.restore();

      const step = Run.step;
      const boss = Run.isBossNode();
      for (let i = 0; i < NODE_POS.length; i++) {
        const p = NODE_POS[i];
        const isBoss = i === 7;
        const done = i < step;
        const current = i === step;
        const r = isBoss ? 22 : 17;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (done) {
          g.fillStyle = '#2f8f5a';
        } else if (current) {
          g.fillStyle = isBoss ? '#ffb347' : '#ffd77a';
        } else {
          g.fillStyle = 'rgba(20,14,34,0.85)';
        }
        g.fill();
        g.lineWidth = current ? 3 : 2;
        g.strokeStyle = current ? '#fff3c4' : done ? '#9ff0c0' : 'rgba(255,255,255,0.25)';
        g.stroke();
        if (current) {
          const pulse = 1 + Math.sin(this.t * 5) * 0.12;
          g.beginPath();
          g.arc(p.x, p.y, (r + 7) * pulse, 0, Math.PI * 2);
          g.strokeStyle = 'rgba(255,215,122,0.5)';
          g.lineWidth = 2;
          g.stroke();
        }
        if (done) {
          g.beginPath();
          g.moveTo(p.x - 7, p.y);
          g.lineTo(p.x - 2, p.y + 5);
          g.lineTo(p.x + 7, p.y - 5);
          g.strokeStyle = '#fff';
          g.lineWidth = 3;
          g.stroke();
        } else if (isBoss) {
          UI.icon(g, 'moon', p.x, p.y, 22);
        } else if (current) {
          UI.text(g, '?', p.x, p.y - 12, { align: 'center', size: 20, weight: 'bold', color: '#2a1408', shadow: false });
        }
      }
      // Marcador da arqueira no passo atual
      const cur = NODE_POS[Math.min(step, 7)];
      Sprites.draw(g, 'player', cur.x + 26, cur.y - 22 + Math.sin(this.t * 3) * 2, 34, { frame: Math.floor(this.t * 2) % 2 });

      // Escolhas
      const cards = this.layoutCards(boss ? ['boss'] : choices);
      this.cards = cards;
      for (const c of cards) {
        const info = TYPES[c.type];
        UI.panel(g, c.x, c.y, c.w, c.h, { fill: 'rgba(14,9,26,0.92)', stroke: info.color, lw: 2.5, r: 16 });
        UI.icon(g, info.icon, c.x + 30, c.y + 30, 30);
        UI.text(g, info.name, c.x + 54, c.y + 18, { size: 17, weight: 'bold', color: info.color, shadow: false });
        UI.text(g, info.desc, c.x + 12, c.y + 56, { size: 12, maxW: c.w - 24, lineH: 15, color: '#e8e2f5', shadow: false });
        if (c.type === 'treasure' || c.type === 'shop' || c.type === 'rest') {
          UI.text(g, 'Evento', c.x + c.w - 12, c.y + c.h - 20, { size: 11, align: 'right', color: '#b7aed0', shadow: false });
        } else if (c.type === 'boss') {
          UI.text(g, 'Toque para enfrentar', c.x + c.w / 2, c.y + c.h - 24, { size: 13, align: 'center', weight: 'bold', color: '#ffd77a', shadow: false });
        } else {
          UI.text(g, 'Combate', c.x + c.w - 12, c.y + c.h - 20, { size: 11, align: 'right', color: '#b7aed0', shadow: false });
        }
      }

      // Cabeçalho: HUD e menu
      V.HUD.draw(g, Run.stats, Run.level, Run.xp, Run.xpNeeded(Run.level), Run.gold, Run.cardOrder, Run.cards);
      UI.button(g, { ...this.menuBtn, label: 'Menu', color: '#4a4558', size: 13 });

      // Faixa de aviso
      if (this.banner && this.bannerT > 0) {
        const a = Math.min(1, this.bannerT);
        g.globalAlpha = a;
        UI.panel(g, 40, 300, 280, 52, { fill: 'rgba(10,6,20,0.88)', stroke: '#ffd77a', r: 14 });
        UI.text(g, this.banner, 180, 316, { align: 'center', size: 20, weight: 'bold', color: '#ffe9b0', shadow: false });
        g.globalAlpha = 1;
      }
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (UI.hit(this.menuBtn, x, y)) {
        V.Game.saveRun();
        V.Game.go('title');
        return;
      }
      for (const c of this.cards) {
        if (!UI.hit(c, x, y)) continue;
        Audio.sfx('select');
        this.choose(c.type);
        return;
      }
    },

    choose(type) {
      const ch = Run.chapterDef();
      if (type === 'boss') {
        V.Game.go('story', {
          title: ch.name + ' · Chefe',
          music: 'boss',
          lines: V.Data.story.chapters[Run.chapter].bossIntro,
          next: { name: 'gameplay', data: { kind: 'boss' } },
        });
        return;
      }
      if (type === 'combat' || type === 'elite') {
        V.Game.go('gameplay', { kind: type });
        return;
      }
      V.Game.go('event', { type });
    },

    onKey(code, down) {
      if (!down) return;
      if (code === 'Escape') {
        V.Game.saveRun();
        V.Game.go('title');
      }
      if (code === 'Digit1' || code === 'KeyA') this.choose(this.cards[0] && this.cards[0].type);
      if ((code === 'Digit2' || code === 'KeyD') && this.cards[1]) this.choose(this.cards[1].type);
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.map = Map;
  V.Scenes.mapTypes = TYPES;
})();

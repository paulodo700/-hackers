// Salas de evento: Tesouro (escolher 1 de 3 cartas), Descanso (curar) e Mercador (comprar com ouro).
(() => {
  const V = (window.V = window.V || {});
  const { UI, Audio, Run } = V;

  const Event = {
    type: 'rest',
    t: 0,
    cards: [],
    offers: [],
    healed: false,
    done: false,
    leaveBtn: { x: 90, y: 548, w: 180, h: 46 },

    enter(data) {
      this.type = data.type || 'rest';
      this.t = 0;
      this.healed = false;
      this.done = false;
      this.cards = [];
      this.offers = [];
      if (!Run.active) {
        V.Game.go('title');
        return;
      }
      if (this.type === 'treasure') {
        this.cards = Run.randomCards(3);
        if (!this.cards.length) this.type = 'rest';
      }
      if (this.type === 'shop') this.buildShop();
      Audio.playTrack('shop');
      V.Game.saveRun();
    },

    buildShop() {
      const rare = Run.randomCards(1, 'rare')[0] || Run.randomCards(1)[0];
      this.offers = [
        { id: 'potion', label: 'Poção de Vida', desc: 'Recupera 40 HP imediatamente.', cost: 25, icon: 'hp', color: '#ff6b6b' },
        { id: 'card', label: rare ? rare.name : 'Carta Misteriosa', desc: rare ? rare.desc : 'Nenhuma carta disponível.', cost: 60, icon: rare ? rare.icon : 'relic', color: '#c79bff', card: rare },
        { id: 'maxhp', label: 'Coração Forte', desc: '+15 HP máximo e cura de 15.', cost: 40, icon: 'heart', color: '#ff8fa3' },
      ];
    },

    leave() {
      if (this.done) return;
      this.done = true;
      Run.advance();
      V.Game.saveRun();
      V.Game.go('map', {});
    },

    update(dt) {
      this.t += dt;
    },

    draw(g) {
      const ch = Run.chapterDef();
      UI.backdrop(g, 360, 640, ch.bg[0], ch.bg[1]);
      UI.stars(g, 360, 640, this.t, 45, 31);
      V.HUD.draw(g, Run.stats, Run.level, Run.xp, Run.xpNeeded(Run.level), Run.gold, Run.cardOrder, Run.cards);

      const info = {
        treasure: { title: 'Tesouro', text: 'Um baú antigo repousa sobre a pedra. Três bênçãos brilham dentro dele. Escolha uma.' },
        rest: { title: 'Descanso', text: 'Uma fogueira mansa crepita. Por um instante, o silêncio parece gentil.' },
        shop: { title: 'Mercador', text: 'Gorm, ou alguém parecido com ele, abre a capa e mostra o que tem a oferecer.' },
      }[this.type];

      UI.title(g, info.title, 180, 112, { align: 'center', size: 26 });
      UI.text(g, info.text, 180, 150, { align: 'center', size: 14, maxW: 296, lineH: 20, color: '#e8e2f5', font: 'Georgia, serif' });
      UI.text(g, `Ouro: ${Run.gold}`, 180, 204, { align: 'center', size: 14, weight: 'bold', color: '#ffd54a', shadow: false });

      if (this.type === 'treasure') {
        this.cardRects().forEach((r) => this.drawCard(g, r, r.card));
      } else if (this.type === 'rest') {
        this.drawRest(g);
      } else if (this.type === 'shop') {
        this.offerRects().forEach((r) => this.drawOffer(g, r));
      }

      if (this.type !== 'treasure') {
        const canLeave = this.type !== 'rest' || this.healed;
        if (canLeave) UI.button(g, { ...this.leaveBtn, label: 'Seguir caminho', color: '#2f9e8a' });
      }
    },

    cardRects() {
      return this.cards.map((c, i) => ({ x: 24, y: 236 + i * 118, w: 312, h: 104, card: c }));
    },

    drawCard(g, r, c) {
      const col = V.Data.rarityColor[c.rarity];
      UI.panel(g, r.x, r.y, r.w, r.h, { fill: 'rgba(24,16,44,0.95)', stroke: col, lw: 2.5, r: 14 });
      UI.icon(g, c.icon, r.x + 42, r.y + 50, 42);
      UI.text(g, c.name, r.x + 84, r.y + 16, { size: 18, weight: 'bold', color: '#fff7e0', shadow: false });
      UI.text(g, V.Data.rarityName[c.rarity], r.x + r.w - 14, r.y + 18, { size: 11, align: 'right', weight: 'bold', color: col, shadow: false });
      UI.text(g, c.desc, r.x + 84, r.y + 42, { size: 13, maxW: r.w - 100, lineH: 17, color: '#e8e2f5', shadow: false });
    },

    drawRest(g) {
      const pulse = 1 + Math.sin(this.t * 4) * 0.05;
      g.beginPath();
      g.arc(180, 300, 60 * pulse, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,160,70,0.25)';
      g.fill();
      UI.icon(g, 'fire', 180, 300, 90 * pulse);
      if (!this.healed) {
        UI.button(g, { x: 60, y: 400, w: 240, h: 50, label: 'Descansar (+35% HP)', color: '#c25a2a' });
      } else {
        UI.text(g, 'Você está mais forte. A jornada continua.', 180, 400, { align: 'center', size: 15, color: '#9ff0c0', maxW: 280, lineH: 20 });
      }
    },

    offerRects() {
      return this.offers.map((o, i) => ({ x: 18, y: 230 + i * 96, w: 324, h: 84, offer: o, index: i }));
    },

    drawOffer(g, r) {
      const o = r.offer;
      const sold = o.sold;
      const afford = Run.gold >= o.cost && !sold;
      UI.panel(g, r.x, r.y, r.w, r.h, {
        fill: sold ? 'rgba(20,20,24,0.9)' : 'rgba(24,16,44,0.95)',
        stroke: sold ? '#55506a' : o.color,
        lw: 2.5,
        r: 14,
      });
      UI.icon(g, o.icon, r.x + 40, r.y + 42, 36);
      UI.text(g, o.label, r.x + 74, r.y + 12, { size: 17, weight: 'bold', color: sold ? '#7a7490' : '#fff7e0', shadow: false });
      UI.text(g, o.desc, r.x + 74, r.y + 36, { size: 12, maxW: 180, lineH: 15, color: sold ? '#6a6480' : '#e8e2f5', shadow: false });
      const label = sold ? 'Vendido' : `${o.cost} ouro`;
      const bx = r.x + r.w - 100;
      UI.button(g, {
        x: bx, y: r.y + 24, w: 84, h: 38, label, color: sold ? '#3a3548' : afford ? '#b5833a' : '#4a4558', size: 14, disabled: !afford && !sold,
      });
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (this.type === 'treasure') {
        for (const r of this.cardRects()) {
          if (!UI.hit(r, x, y)) continue;
          Audio.sfx('select');
          Run.pickCard(r.card);
          this.leave();
          return;
        }
        return;
      }
      if (this.type === 'rest') {
        if (!this.healed && UI.hit({ x: 60, y: 400, w: 240, h: 50 }, x, y)) {
          const s = Run.stats;
          s.hp = Math.min(s.maxHp, s.hp + Math.round(s.maxHp * 0.35));
          this.healed = true;
          Audio.sfx('heal');
          return;
        }
      }
      if (this.type === 'shop') {
        for (const r of this.offerRects()) {
          if (!UI.hit({ x: r.x + r.w - 100, y: r.y + 24, w: 84, h: 38 }, x, y)) continue;
          this.buy(r.offer);
          return;
        }
      }
      if (this.type !== 'treasure' && (this.type !== 'rest' || this.healed) && UI.hit(this.leaveBtn, x, y)) {
        this.leave();
      }
    },

    buy(o) {
      if (o.sold || Run.gold < o.cost) {
        Audio.sfx('deny');
        return;
      }
      const s = Run.stats;
      Run.gold -= o.cost;
      if (o.id === 'potion') s.hp = Math.min(s.maxHp, s.hp + 40);
      else if (o.id === 'maxhp') {
        s.maxHp += 15;
        s.hp = Math.min(s.maxHp, s.hp + 15);
      } else if (o.id === 'card' && o.card) {
        Run.pickCard(o.card, true);
      }
      o.sold = true;
      Audio.sfx('buy');
    },

    onKey(code, down) {
      if (!down) return;
      if (code === 'Enter' || code === 'Space') {
        if (this.type === 'rest' && !this.healed) {
          this.onPointer('down', 180, 425);
          return;
        }
        this.leave();
      }
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.event = Event;
})();

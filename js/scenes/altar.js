// Altar das Relíquias: melhorias permanentes compradas com Relíquias (persistem entre runs).
(() => {
  const V = (window.V = window.V || {});
  const { UI, Audio, Meta } = V;

  const Altar = {
    t: 0,
    rows: [],
    back: { x: 90, y: 574, w: 180, h: 44 },

    enter() {
      this.t = 0;
      Audio.playTrack('title');
    },

    update(dt) {
      this.t += dt;
    },

    draw(g) {
      UI.backdrop(g, 360, 640, '#241640', '#06040f');
      UI.stars(g, 360, 640, this.t, 50, 41);
      UI.title(g, 'Altar das Relíquias', 180, 38, { align: 'center', size: 24 });
      UI.text(g, 'Relíquias guardadas: ' + Meta.relics, 180, 74, {
        align: 'center', size: 16, weight: 'bold', color: '#c9a0ff',
      });
      UI.text(g, 'Melhorias valem para todas as próximas jornadas.', 180, 96, {
        align: 'center', size: 12, color: '#b7aed0', shadow: false,
      });

      this.rows = V.Data.metaUpgrades.map((def, i) => ({ def, x: 16, y: 124 + i * 88, w: 328, h: 78 }));
      for (const r of this.rows) {
        const def = r.def;
        const lv = Meta.level(def.id);
        const maxed = lv >= def.max;
        const cost = maxed ? 0 : V.Data.metaCost(def, lv);
        const can = !maxed && Meta.relics >= cost;
        UI.panel(g, r.x, r.y, r.w, r.h, { fill: 'rgba(20,13,36,0.94)', stroke: can ? '#c79bff' : 'rgba(199,155,255,0.3)', lw: 2, r: 14 });
        UI.icon(g, def.icon, r.x + 32, r.y + 34, 32);
        UI.text(g, def.name, r.x + 60, r.y + 10, { size: 17, weight: 'bold', color: '#fff7e0', shadow: false });
        UI.text(g, def.desc(lv), r.x + 60, r.y + 32, { size: 12, color: '#d8cff0', maxW: 170, lineH: 15, shadow: false });
        // Pontos de nível
        for (let k = 0; k < def.max; k++) {
          g.beginPath();
          g.arc(r.x + 66 + k * 14, r.y + 62, 4.5, 0, Math.PI * 2);
          g.fillStyle = k < lv ? '#c79bff' : 'rgba(255,255,255,0.15)';
          g.fill();
        }
        const label = maxed ? 'Máximo' : `${cost} Rel.`;
        UI.button(g, {
          x: r.x + r.w - 96, y: r.y + 20, w: 82, h: 38, label, color: maxed ? '#3a3548' : can ? '#7a4fd6' : '#4a4558', size: 14, disabled: !can,
        });
      }
      UI.button(g, { ...this.back, label: 'Voltar', color: '#4a4558' });
    },

    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (UI.hit(this.back, x, y)) {
        Audio.sfx('click');
        V.Game.go('title');
        return;
      }
      for (const r of this.rows) {
        if (!UI.hit({ x: r.x + r.w - 96, y: r.y + 20, w: 82, h: 38 }, x, y)) continue;
        if (Meta.buy(r.def.id)) Audio.sfx('buy');
        else Audio.sfx('deny');
        return;
      }
    },

    onKey(code, down) {
      if (down && code === 'Escape') V.Game.go('title');
    },
  };

  V.Scenes = V.Scenes || {};
  V.Scenes.altar = Altar;
})();

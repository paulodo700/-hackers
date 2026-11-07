// HUD compartilhado: vida, ouro, nível e cartas adquiridas (topo da tela).
(() => {
  const V = (window.V = window.V || {});
  const { UI } = V;

  const HUD = {
    draw(g, s, level, xp, need, gold, cardOrder, cards) {
      // Painel de fundo
      g.fillStyle = 'rgba(8,5,16,0.72)';
      g.fillRect(0, 0, 360, 96);
      g.fillStyle = 'rgba(255,215,122,0.25)';
      g.fillRect(0, 95, 360, 1);

      // Vida
      const hpF = s.hp / s.maxHp;
      UI.bar(g, 16, 12, 186, 18, hpF, '#ff6b6b', '#c81d3a', 'rgba(0,0,0,0.55)');
      UI.text(g, `${Math.ceil(s.hp)} / ${s.maxHp}`, 109, 14, {
        size: 12, align: 'center', weight: 'bold', shadow: false, color: '#fff', stroke: 'rgba(0,0,0,0.6)', strokeW: 3,
      });

      // Ouro
      V.UI.icon(g, 'gold', 224, 21, 15);
      UI.text(g, String(gold), 236, 12, { size: 16, weight: 'bold', color: '#ffd54a' });

      // Nível e XP
      UI.text(g, `Nv ${level}`, 300, 10, { size: 13, weight: 'bold', color: '#c9b6ff' });
      UI.bar(g, 300, 30, 48, 6, need > 0 ? xp / need : 0, '#8ff0dc', '#2aa88f', 'rgba(0,0,0,0.5)');

      // Cartas adquiridas
      let x = 18;
      const shown = cardOrder.slice(0, 10);
      for (const id of shown) {
        const def = V.Data.cards.find((c) => c.id === id);
        if (!def) continue;
        const col = V.Data.rarityColor[def.rarity];
        g.beginPath();
        g.arc(x + 8, 62, 9, 0, Math.PI * 2);
        g.fillStyle = 'rgba(20,14,34,0.9)';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = col;
        g.stroke();
        UI.icon(g, def.icon, x + 8, 62, 11);
        const n = cards[id] || 0;
        if (n > 1) UI.text(g, '×' + n, x + 14, 52, { size: 9, weight: 'bold', color: '#fff', shadow: false, stroke: '#000', strokeW: 2 });
        x += 21;
      }
      if (cardOrder.length > shown.length) {
        UI.text(g, '+' + (cardOrder.length - shown.length), x + 4, 56, { size: 11, weight: 'bold', color: '#c9b6ff', shadow: false });
      }
    },
  };

  V.HUD = HUD;
})();

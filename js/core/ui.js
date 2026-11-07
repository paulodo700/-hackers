// Componentes de interface desenhados no canvas: botões, painéis, barras, texto e ícones.
(() => {
  const V = (window.V = window.V || {});
  const { FONT, FONT_TITLE, wrapText, TAU } = V.Util;

  const UI = {
    // Texto com sombra opcional. Retorna a altura total usada.
    text(g, str, x, y, o = {}) {
      const size = o.size || 16;
      g.font = `${o.weight || ''} ${size}px ${o.font || FONT}`.trim();
      g.textAlign = o.align || 'left';
      g.textBaseline = o.baseline || 'top';
      const lines = o.maxW ? wrapText(g, str, o.maxW) : String(str).split('\n');
      const lh = o.lineH || Math.round(size * 1.3);
      for (let i = 0; i < lines.length; i++) {
        const ly = y + i * lh;
        if (o.stroke) {
          g.lineWidth = o.strokeW || 4;
          g.strokeStyle = o.stroke;
          g.lineJoin = 'round';
          g.strokeText(lines[i], x, ly);
        }
        if (o.shadow !== false) {
          g.fillStyle = o.shadowColor || 'rgba(0,0,0,0.45)';
          g.fillText(lines[i], x, ly + Math.max(1, Math.round(size / 12)));
        }
        g.fillStyle = o.color || '#f4eefc';
        g.fillText(lines[i], x, ly);
      }
      return lines.length * lh;
    },

    title(g, str, x, y, o = {}) {
      return UI.text(g, str, x, y, { font: FONT_TITLE, weight: 'bold', size: 28, color: '#ffd77a', stroke: '#2a1408', strokeW: 6, ...o });
    },

    panel(g, x, y, w, h, o = {}) {
      const r = o.r == null ? 12 : o.r;
      roundRect(g, x, y, w, h, r);
      g.fillStyle = o.fill || 'rgba(18,12,30,0.86)';
      g.fill();
      g.lineWidth = o.lw || 2;
      g.strokeStyle = o.stroke || 'rgba(255,215,122,0.55)';
      g.stroke();
    },

    // Botão com estados normal/pressionado/desabilitado.
    button(g, b) {
      const { x, y, w, h, label } = b;
      const pressed = b.pressed;
      const dis = b.disabled;
      const base = b.color || '#7a4fd6';
      const top = dis ? '#4a4558' : shade(base, pressed ? -20 : 25);
      const bot = dis ? '#34303d' : shade(base, pressed ? -45 : -15);
      const oy = pressed ? 2 : 0;
      roundRect(g, x, y + 4, w, h, 14);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fill();
      roundRect(g, x, y + oy, w, h, 14);
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bot);
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = dis ? '#55506a' : '#ffe9b0';
      g.stroke();
      UI.text(g, label, x + w / 2, y + h / 2 + oy, {
        size: b.size || 20,
        align: 'center',
        baseline: 'middle',
        weight: 'bold',
        color: dis ? '#9a95a8' : '#fff9ec',
        stroke: 'rgba(20,10,30,0.6)',
        strokeW: 3,
        shadow: false,
      });
    },

    hit(r, x, y) {
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },

    // Barra horizontal com fundo, preenchimento e brilho.
    bar(g, x, y, w, h, frac, colA, colB, bg = 'rgba(0,0,0,0.5)') {
      roundRect(g, x, y, w, h, h / 2);
      g.fillStyle = bg;
      g.fill();
      const fw = Math.max(0, Math.min(1, frac)) * w;
      if (fw > 0.5) {
        roundRect(g, x, y, fw, h, h / 2);
        const grad = g.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, colA);
        grad.addColorStop(1, colB || colA);
        g.fillStyle = grad;
        g.fill();
      }
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      roundRect(g, x, y, w, h, h / 2);
      g.stroke();
    },

    backdrop(g, w, h, top, bottom) {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    },

    // Estrelas decorativas determinísticas (mesmo padrão a cada quadro).
    stars(g, w, h, t, count = 60, seed = 7) {
      const rng = V.Util.makeRng(seed);
      for (let i = 0; i < count; i++) {
        const x = rng.next() * w;
        const y = rng.next() * h;
        const s = 0.5 + rng.next() * 1.4;
        const a = 0.35 + 0.45 * Math.sin(t * (1 + rng.next() * 2) + i);
        g.globalAlpha = Math.max(0.05, a);
        g.fillStyle = '#fff3d6';
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    },

    // Ícones vetoriais simples para cartas e menus.
    icon(g, name, cx, cy, s) {
      g.save();
      g.translate(cx, cy);
      const k = s / 32;
      g.scale(k, k);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const stroke = (c, lw) => {
        g.strokeStyle = c;
        g.lineWidth = lw || 3;
        g.stroke();
      };
      const fillc = (c) => {
        g.fillStyle = c;
        g.fill();
      };
      switch (name) {
        case 'arrow':
          g.beginPath(); g.moveTo(-12, 0); g.lineTo(11, 0); stroke('#e8c48a', 3);
          g.beginPath(); g.moveTo(10, -5); g.lineTo(15, 0); g.lineTo(10, 5); g.closePath(); fillc('#dfe8f2');
          break;
        case 'multi':
          for (const a of [-0.35, 0, 0.35]) {
            g.save(); g.rotate(a); g.beginPath(); g.moveTo(-10, 0); g.lineTo(12, 0); stroke('#8fd6ff', 2.6); g.restore();
          }
          break;
        case 'heart':
          g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-16, 0, -12, -14, 0, -6); g.bezierCurveTo(12, -14, 16, 0, 0, 12); fillc('#ff4d6d');
          break;
        case 'speed':
          g.beginPath(); g.moveTo(-12, -6); g.lineTo(2, -6); g.lineTo(-2, 0); g.lineTo(10, 0); stroke('#9fffb0', 3);
          g.beginPath(); g.moveTo(-12, 6); g.lineTo(2, 6); g.lineTo(-2, 0); stroke('#9fffb0', 3);
          break;
        case 'crit':
          g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 15; const a = (i / 8) * TAU; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); fillc('#ffd166'); stroke('#7a4a00', 1.5);
          break;
        case 'pierce':
          g.beginPath(); g.moveTo(-14, -8); g.lineTo(12, 0); g.lineTo(-14, 8); g.closePath(); fillc('#c9b6ff'); stroke('#3d2a6b', 1.5);
          g.beginPath(); g.arc(9, 0, 2, 0, TAU); fillc('#ffffff');
          break;
        case 'bounce':
          g.beginPath(); g.moveTo(-14, 10); g.lineTo(-14, -12); stroke('#8c97ff', 3);
          g.beginPath(); g.moveTo(-14, 10); g.lineTo(0, -6); g.lineTo(14, 10); stroke('#8c97ff', 3);
          break;
        case 'fire':
          g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(14, -2, 8, 10); g.quadraticCurveTo(0, 16, -8, 10); g.quadraticCurveTo(-14, -2, 0, -15); fillc('#ff8a3d');
          g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(6, 4, 2, 9); g.quadraticCurveTo(-3, 11, -4, 6); fillc('#ffe066');
          break;
        case 'shield':
          g.beginPath(); g.moveTo(0, -14); g.lineTo(12, -9); g.lineTo(10, 3); g.quadraticCurveTo(6, 11, 0, 14); g.quadraticCurveTo(-6, 11, -10, 3); g.lineTo(-12, -9); g.closePath(); fillc('#58a6ff'); stroke('#12325e', 1.8);
          break;
        case 'leaf':
          g.beginPath(); g.moveTo(-12, 10); g.quadraticCurveTo(-14, -12, 12, -12); g.quadraticCurveTo(12, 8, -12, 10); fillc('#6bbf55'); stroke('#1d3a18', 1.6);
          g.beginPath(); g.moveTo(-10, 8); g.lineTo(6, -6); stroke('#1d3a18', 1.2);
          break;
        case 'vamp':
          g.beginPath(); g.arc(0, 2, 11, 0, TAU); fillc('#c2185b'); stroke('#3a0820', 1.6);
          g.beginPath(); g.arc(-4, -2, 3, 0, TAU); fillc('rgba(255,255,255,0.7)');
          break;
        case 'gold':
          g.beginPath(); g.arc(0, 0, 12, 0, TAU); fillc('#ffd54a'); stroke('#8a5a0b', 1.8);
          g.beginPath(); g.arc(0, 0, 6, 0, TAU); stroke('#b8860b', 1.4);
          break;
        case 'xp':
          g.beginPath(); g.arc(0, 0, 11, 0, TAU); fillc('rgba(120,255,230,0.5)');
          g.beginPath(); g.arc(0, 0, 6, 0, TAU); fillc('#9ffff0');
          break;
        case 'cloak':
          g.beginPath(); g.moveTo(-12, 10); g.lineTo(-6, -10); g.lineTo(6, -10); g.lineTo(12, 10); g.closePath(); fillc('#2f8f86'); stroke('#11302d', 1.6);
          break;
        case 'moon':
          g.beginPath(); g.arc(0, 0, 13, 0, TAU); fillc('#ffcf5a');
          g.beginPath(); g.arc(6, -3, 11, 0, TAU); fillc('#1b1430');
          break;
        case 'relic':
          g.beginPath(); g.moveTo(0, -14); g.lineTo(12, 0); g.lineTo(0, 14); g.lineTo(-12, 0); g.closePath(); fillc('#c9a0ff'); stroke('#3d1f6b', 1.8);
          g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 14); stroke('rgba(255,255,255,0.5)', 1.2);
          break;
        case 'frost':
          for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
            g.save(); g.rotate(a); g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); stroke('#bfe9ff', 2.4); g.restore();
          }
          g.beginPath(); g.arc(0, 0, 3, 0, TAU); fillc('#ffffff');
          break;
        case 'hp':
          g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-16, 0, -12, -14, 0, -6); g.bezierCurveTo(12, -14, 16, 0, 0, 12); fillc('#ff6b6b');
          break;
        case 'sword':
          g.beginPath(); g.moveTo(0, -14); g.lineTo(3, 6); g.lineTo(-3, 6); g.closePath(); fillc('#dfe8f2'); stroke('#3a4150', 1.4);
          g.beginPath(); g.moveTo(-6, 7); g.lineTo(6, 7); stroke('#c9a227', 2.4);
          break;
        default:
          g.beginPath(); g.arc(0, 0, 10, 0, TAU); fillc('#888');
      }
      g.restore();
    },
  };

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Escurece (negativo) ou clareia (positivo) uma cor hexadecimal #rrggbb.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let gg = (n >> 8) & 255;
    let b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, c + amt));
    r = f(r);
    gg = f(gg);
    b = f(b);
    return `rgb(${r},${gg},${b})`;
  }

  UI.roundRect = roundRect;
  UI.shade = shade;
  V.UI = UI;
})();

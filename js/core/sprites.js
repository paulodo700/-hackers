// Sprites procedurais originais: personagens, monstros, chefes, projéteis, coletáveis,
// retratos, pisos e obstáculos. Tudo é desenhado por código e guardado em cache.
(() => {
  const V = (window.V = window.V || {});
  const TAU = Math.PI * 2;
  const INK = '#1a0f1f';

  // Paletas de cenário (usadas por pisos e obstáculos).
  const THEMES = {
    forest: { a: '#3d7b3a', b: '#468a43', dots: '#2f6130', wall: '#4f3b26', wallTop: '#7d6240', accent: '#9be36f', glow: '#c7ff8a' },
    mines: { a: '#4a4552', b: '#524c5a', dots: '#34303b', wall: '#2b2630', wallTop: '#564e60', accent: '#ff8a3d', glow: '#ffb347' },
    tower: { a: '#2a3050', b: '#303759', dots: '#1d2238', wall: '#1a1830', wallTop: '#3d3766', accent: '#b48cff', glow: '#e0c6ff' },
  };

  const cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Cria um sprite com "unidades" de desenho escaladas para "px" pixels reais.
  function sprite(units, px, fn) {
    const c = makeCanvas(px, px);
    const g = c.getContext('2d');
    g.scale(px / units, px / units);
    fn(g);
    return c;
  }

  // Preenche (opcional) e contorna um caminho.
  function P(g, fill, path, lw = 2, stroke = INK) {
    g.beginPath();
    path(g);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (lw > 0) {
      g.lineWidth = lw;
      g.strokeStyle = stroke;
      g.lineJoin = 'round';
      g.stroke();
    }
  }

  function dot(g, x, y, r, fill) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = fill;
    g.fill();
  }

  function line(g, pts, color, lw, cap = 'round') {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = cap;
    g.lineJoin = 'round';
    g.stroke();
  }

  function shadow(g, x, y, rx, ry) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.26)';
    g.fill();
  }

  function radial(g, x, y, r0, r1, stops) {
    const grad = g.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    return grad;
  }

  // ---------- Personagens ----------

  function drawPlayer(g, f) {
    const bob = f ? -1 : 0;
    const legS = f ? 2 : -2;
    shadow(g, 32, 58, 15, 4.5);
    // aljava
    P(g, '#6b4226', (g) => g.rect(37, 21 + bob, 5, 20), 1.6);
    P(g, '#ff5b5b', (g) => {
      g.moveTo(38, 21 + bob);
      g.lineTo(39.5, 16 + bob);
      g.lineTo(41, 21 + bob);
    }, 1.2);
    // pernas e botas
    P(g, '#2b2233', (g) => g.ellipse(27 + legS * 0.5, 57, 3.6, 2.6, 0, 0, TAU), 1.4);
    P(g, '#2b2233', (g) => g.ellipse(37 - legS * 0.5, 57, 3.6, 2.6, 0, 0, TAU), 1.4);
    // manto
    P(g, '#2f8f86', (g) => {
      g.moveTo(22, 32 + bob);
      g.quadraticCurveTo(32, 27 + bob, 42, 32 + bob);
      g.lineTo(46, 55);
      g.quadraticCurveTo(32, 60, 18, 55);
      g.closePath();
    });
    g.globalAlpha = 0.35;
    P(g, '#c6fff7', (g) => {
      g.moveTo(26, 38 + bob);
      g.lineTo(23, 52);
      g.lineTo(27, 52);
      g.lineTo(29, 38 + bob);
      g.closePath();
    }, 0);
    g.globalAlpha = 1;
    // capuz
    P(g, '#24706b', (g) => g.arc(32, 24 + bob, 9.5, 0, TAU));
    P(g, '#1d5a56', (g) => g.ellipse(32, 22 + bob, 7, 6, 0, 0, TAU), 0);
    // rosto
    P(g, '#f3d1a7', (g) => g.ellipse(32, 26 + bob, 5.4, 4.4, 0, 0, TAU), 1.2);
    dot(g, 30, 26.5 + bob, 0.95, '#1b1020');
    dot(g, 34, 26.5 + bob, 0.95, '#1b1020');
    // lenço e emblema de lua
    P(g, '#d9463e', (g) => g.rect(26, 31 + bob, 12, 3.2), 1);
    dot(g, 32, 40 + bob, 3.2, '#ffd166');
    dot(g, 33.2, 39.2 + bob, 2.6, '#2f8f86');
    // arco
    g.beginPath();
    g.arc(38, 36 + bob, 13, -1.1, 1.1);
    g.strokeStyle = '#8b5a2b';
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.stroke();
    line(g, [[43.8, 24.4 + bob], [43.8, 47.6 + bob]], '#eee3c8', 0.9);
    dot(g, 44.2, 36 + bob, 2.1, '#f3d1a7');
  }

  function drawSlime(g, f, c) {
    const rx = f ? 20 : 22;
    const ry = f ? 18 : 15;
    const cy = f ? 40 : 42;
    shadow(g, 32, 56, 20, 5);
    const grad = radial(g, 26, cy - 8, 2, 26, [
      [0, c.hi],
      [1, c.base],
    ]);
    P(g, grad, (g) => g.ellipse(32, cy, rx, ry, 0, 0, TAU), 2.2);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(25, cy - 8, 4.5, 2.6, -0.5, 0, TAU);
    g.fill();
    for (const ex of [26, 38]) {
      dot(g, ex, cy + 1, 4.2, '#fff');
      dot(g, ex, cy + 2, 2, INK);
    }
  }

  function drawBat(g, f) {
    shadow(g, 32, 56, 12, 3.5);
    const tipY = f ? 16 : 34;
    const wing = (g) => {
      g.moveTo(32, 34);
      g.quadraticCurveTo(20, 18, 4, tipY);
      g.quadraticCurveTo(14, 34, 22, 44);
      g.quadraticCurveTo(27, 42, 32, 40);
      g.closePath();
    };
    P(g, '#4a3566', wing, 1.8);
    g.save();
    g.translate(64, 0);
    g.scale(-1, 1);
    P(g, '#4a3566', wing, 1.8);
    g.restore();
    P(g, '#3d2b52', (g) => g.ellipse(32, 36, 8, 9, 0, 0, TAU), 1.8);
    P(g, '#3d2b52', (g) => {
      g.moveTo(26, 30);
      g.lineTo(23, 20);
      g.lineTo(30, 27);
      g.closePath();
    }, 1.6);
    P(g, '#3d2b52', (g) => {
      g.moveTo(38, 30);
      g.lineTo(41, 20);
      g.lineTo(34, 27);
      g.closePath();
    }, 1.6);
    dot(g, 29, 34, 2, '#ff4d6d');
    dot(g, 35, 34, 2, '#ff4d6d');
    dot(g, 30, 40.5, 1, '#fff');
    dot(g, 34, 40.5, 1, '#fff');
  }

  function drawSkeleton(g, f) {
    const s = f ? 2 : -2;
    shadow(g, 32, 58, 12, 4);
    // bacia e pernas
    line(g, [[27, 44], [25 + s * 0.4, 58]], '#ece6d2', 3);
    line(g, [[37, 44], [39 - s * 0.4, 58]], '#ece6d2', 3);
    // costelas e coluna
    line(g, [[32, 28], [32, 46]], '#d8d0b8', 2.2);
    for (const y of [34, 38, 42]) line(g, [[25, y], [39, y]], '#d8d0b8', 1.8);
    // braços
    line(g, [[28, 30], [22, 40]], '#ece6d2', 2.4);
    line(g, [[36, 30], [40, 39]], '#ece6d2', 2.4);
    // arco
    g.beginPath();
    g.arc(14, 36, 14, -1.1, 1.1);
    g.strokeStyle = '#7a4b2a';
    g.lineWidth = 2.4;
    g.stroke();
    line(g, [[20.3, 24.4], [20.3, 47.6]], '#eee3c8', 0.8);
    // crânio
    P(g, '#ece6d2', (g) => g.arc(32, 22, 9, 0, TAU), 1.8);
    P(g, '#ece6d2', (g) => g.rect(27, 27, 10, 4.5), 1.4);
    dot(g, 28.5, 22, 2.7, INK);
    dot(g, 35.5, 22, 2.7, INK);
    dot(g, 28.5, 22, 1, '#ff5b5b');
    dot(g, 35.5, 22, 1, '#ff5b5b');
    P(g, INK, (g) => {
      g.moveTo(32, 24.5);
      g.lineTo(30.5, 27);
      g.lineTo(33.5, 27);
      g.closePath();
    }, 0);
    line(g, [[29, 30], [29, 31.5]], INK, 0.8);
    line(g, [[33, 30], [33, 31.5]], INK, 0.8);
  }

  function drawWolf(g, f) {
    shadow(g, 32, 56, 22, 4.5);
    // cauda
    line(g, [[14, 34], [4, 24], [10, 16]], '#6b7185', 4.5);
    // patas (diagonais alternadas)
    const a = f ? 3 : -3;
    const legs = [
      [22, a],
      [26, -a],
      [40, -a],
      [44, a],
    ];
    for (const [x, d] of legs) line(g, [[x, 43], [x + d, 56]], '#4c5163', 4.2);
    // corpo
    P(g, '#6b7185', (g) => g.ellipse(30, 38, 18, 10, 0, 0, TAU), 2);
    P(g, '#8b91a3', (g) => g.ellipse(30, 42, 13, 4.5, 0, 0, TAU), 0);
    // cabeça e focinho
    P(g, '#6b7185', (g) => {
      g.moveTo(45, 24);
      g.lineTo(44, 34);
      g.quadraticCurveTo(48, 39, 53, 37);
      g.lineTo(60, 32);
      g.quadraticCurveTo(58, 27, 54, 26);
      g.closePath();
    }, 1.8);
    P(g, '#6b7185', (g) => g.ellipse(48, 30, 9, 8, 0, 0, TAU), 1.8);
    P(g, '#6b7185', (g) => {
      g.moveTo(41, 25);
      g.lineTo(42, 17);
      g.lineTo(47, 23);
      g.closePath();
    }, 1.6);
    P(g, '#6b7185', (g) => {
      g.moveTo(49, 22);
      g.lineTo(53, 16);
      g.lineTo(54, 24);
      g.closePath();
    }, 1.6);
    dot(g, 50, 28, 1.9, '#ff3b3b');
    dot(g, 59.5, 32, 1.3, INK);
    dot(g, 47, 25, 0.7, '#ff3b3b');
  }

  function drawShaman(g, f) {
    const orbR = f ? 5.6 : 4.4;
    shadow(g, 32, 58, 14, 4.5);
    P(g, '#4e7d3a', (g) => {
      g.moveTo(21, 58);
      g.lineTo(24, 34);
      g.quadraticCurveTo(32, 28, 40, 34);
      g.lineTo(43, 58);
      g.closePath();
    }, 2);
    line(g, [[22, 52], [42, 52]], '#c9a227', 1.6);
    // staff
    line(g, [[46, 58], [48, 20]], '#7a5030', 2.4);
    // capuz e rosto
    P(g, '#6a3a8a', (g) => g.arc(32, 28, 9, 0, TAU), 2);
    P(g, '#8fcf6a', (g) => g.ellipse(32, 31, 6, 5.6, 0, 0, TAU), 1.4);
    P(g, '#8fcf6a', (g) => {
      g.moveTo(26, 30);
      g.lineTo(18, 26);
      g.lineTo(25, 34);
      g.closePath();
    }, 1.4);
    P(g, '#8fcf6a', (g) => {
      g.moveTo(38, 30);
      g.lineTo(46, 26);
      g.lineTo(39, 34);
      g.closePath();
    }, 1.4);
    dot(g, 29.5, 30.5, 1.6, '#ffe066');
    dot(g, 34.5, 30.5, 1.6, '#ffe066');
    line(g, [[29, 35.5], [35, 35.5]], INK, 1);
    dot(g, 46, 36, 2.4, '#8fcf6a');
    // orbe
    dot(g, 48, 15, orbR + 5, 'rgba(127,242,230,0.28)');
    P(g, radial(g, 47, 14, 1, orbR, [
      [0, '#f0fffd'],
      [1, '#2fb8a8'],
    ]), (g) => g.arc(48, 15, orbR, 0, TAU), 1.2);
  }

  function drawGolem(g, f) {
    const s = f ? 2 : -2;
    shadow(g, 32, 58, 24, 5.5);
    // braços
    P(g, '#4f4a57', (g) => g.rect(8, 26 + s, 10, 22), 2);
    P(g, '#4f4a57', (g) => g.rect(46, 26 - s, 10, 22), 2);
    // pés
    P(g, '#3a3540', (g) => g.rect(21, 50, 9, 9 - s * 0.5), 2);
    P(g, '#3a3540', (g) => g.rect(34, 50, 9, 9 + s * 0.5), 2);
    // corpo
    P(g, '#5a5560', (g) => g.rect(17, 22, 30, 30), 2.4);
    line(g, [[22, 40], [33, 48]], '#ff8a3d', 1.8);
    line(g, [[25, 26], [29, 33], [25, 40], [31, 48]], '#ff8a3d', 1.6);
    line(g, [[41, 28], [38, 35], [42, 44]], '#ff8a3d', 1.4);
    // cabeça
    P(g, '#4a4550', (g) => g.rect(25, 10, 14, 12), 2.2);
    dot(g, 29.5, 16, 1.7, '#ffb347');
    dot(g, 34.5, 16, 1.7, '#ffb347');
  }

  function drawSpider(g, f) {
    shadow(g, 32, 58, 16, 4);
    const legsFor = (side) => {
      for (let i = 0; i < 4; i++) {
        const th = -1.1 + i * 0.72 + (f ? 0.14 : -0.14);
        const kx = 32 + side * Math.cos(th) * 15;
        const ky = 40 + Math.sin(th) * 10;
        const fx = 32 + side * Math.cos(th + 0.45) * 27;
        const fy = 40 + Math.sin(th + 0.45) * 20 + 4;
        line(g, [[32 + side * 6, 38 + i * 0.5], [kx, ky], [fx, fy]], '#2c2238', 2.2);
      }
    };
    legsFor(-1);
    legsFor(1);
    P(g, '#2c2238', (g) => g.ellipse(32, 41, 10.5, 9, 0, 0, TAU), 2.2);
    P(g, '#b3203a', (g) => {
      g.moveTo(28, 36);
      g.lineTo(36, 36);
      g.lineTo(32, 41);
      g.closePath();
    }, 0);
    P(g, '#b3203a', (g) => {
      g.moveTo(32, 41);
      g.lineTo(28, 46);
      g.lineTo(36, 46);
      g.closePath();
    }, 0);
    P(g, '#3a2c4a', (g) => g.arc(32, 27, 6.8, 0, TAU), 1.8);
    dot(g, 28.6, 27.5, 1.7, '#ff3b5c');
    dot(g, 35.4, 27.5, 1.7, '#ff3b5c');
    dot(g, 30.6, 23.8, 1, '#ff3b5c');
    dot(g, 33.4, 23.8, 1, '#ff3b5c');
  }

  function drawWraith(g, f) {
    const w = f ? 2 : -2;
    shadow(g, 32, 58, 12, 3.5);
    const grad = radial(g, 32, 28, 4, 26, [
      [0, 'rgba(220,255,255,0.95)'],
      [0.6, 'rgba(127,214,255,0.85)'],
      [1, 'rgba(60,110,200,0.55)'],
    ]);
    P(g, grad, (g) => {
      g.moveTo(32, 9);
      g.bezierCurveTo(50, 9, 52, 30, 46, 40);
      g.quadraticCurveTo(51, 44, 45, 50 + w);
      g.quadraticCurveTo(42, 57, 38, 50);
      g.quadraticCurveTo(34, 58, 30, 50 - w);
      g.quadraticCurveTo(24, 57, 21, 50);
      g.quadraticCurveTo(14, 44, 19, 40);
      g.bezierCurveTo(13, 30, 14, 9, 32, 9);
      g.closePath();
    }, 1.4, 'rgba(20,50,90,0.9)');
    for (const ex of [27, 37]) {
      g.beginPath();
      g.ellipse(ex, 28, 3, 4.6, 0, 0, TAU);
      g.fillStyle = '#0b1020';
      g.fill();
      dot(g, ex, 26.8, 1, '#9ff3ff');
    }
    g.beginPath();
    g.ellipse(32, 37, 2.4, 3, 0, 0, TAU);
    g.fillStyle = '#0b1020';
    g.fill();
  }

  function drawMage(g, f) {
    const orbR = f ? 5.4 : 4.2;
    shadow(g, 32, 58, 14, 4.5);
    P(g, '#2f3c8f', (g) => {
      g.moveTo(20, 58 + (f ? -1 : 0));
      g.quadraticCurveTo(22, 36, 32, 34);
      g.quadraticCurveTo(42, 36, 44, 58 + (f ? 0 : -1));
      g.closePath();
    }, 2);
    line(g, [[21, 47], [43, 47]], '#e0b84a', 1.8);
    // rosto e chapéu
    P(g, '#f1d0b0', (g) => g.ellipse(32, 37, 5.2, 5, 0, 0, TAU), 1.2);
    dot(g, 30, 37, 0.9, INK);
    dot(g, 34, 37, 0.9, INK);
    P(g, '#2a2f75', (g) => {
      g.moveTo(32, 4);
      g.lineTo(19, 30);
      g.lineTo(45, 30);
      g.closePath();
    }, 2);
    P(g, '#2a2f75', (g) => g.ellipse(32, 31, 15, 3.4, 0, 0, TAU), 1.8);
    dot(g, 28, 20, 1.2, '#ffe066');
    dot(g, 36, 14, 1, '#ffe066');
    // cajado
    line(g, [[46, 58], [50, 22]], '#6a4a2e', 2.2);
    dot(g, 50, 18, orbR + 4.5, 'rgba(255,95,210,0.25)');
    P(g, radial(g, 49, 17, 1, orbR, [
      [0, '#ffe3f7'],
      [1, '#d63fa8'],
    ]), (g) => g.arc(50, 18, orbR, 0, TAU), 1.2);
  }

  // ---------- Chefes ----------

  function drawTreant(g, f) {
    const sw = f ? 2 : -2;
    shadow(g, 64, 122, 46, 8);
    // raízes
    const roots = [
      [[58, 116], [40, 122], [22, 118]],
      [[70, 116], [88, 122], [106, 118]],
      [[62, 118], [56, 126], [46, 126]],
      [[66, 118], [72, 126], [82, 126]],
    ];
    for (const r of roots) {
      line(g, [[r[0][0], r[0][1]], [r[1][0], r[1][1]], [r[2][0], r[2][1]]], '#4a3320', 7);
      line(g, [[r[0][0], r[0][1] - 1.5], [r[1][0], r[1][1] - 1.5], [r[2][0], r[2][1] - 1.5]], '#7a5530', 2);
    }
    // tronco
    P(g, radial(g, 60, 90, 4, 46, [
      [0, '#9a6b3a'],
      [1, '#4a3020'],
    ]), (g) => {
      g.moveTo(48, 62);
      g.lineTo(80, 62);
      g.quadraticCurveTo(90, 92, 88, 120);
      g.lineTo(40, 120);
      g.quadraticCurveTo(38, 92, 48, 62);
      g.closePath();
    }, 3);
    for (const x of [52, 62, 74]) line(g, [[x, 70], [x + sw * 0.6, 118]], 'rgba(50,30,15,0.45)', 2);
    // rosto
    for (const ex of [56, 72]) {
      g.beginPath();
      g.ellipse(ex, 82, 5.2, 4.2, 0, 0, TAU);
      g.fillStyle = '#ffd34a';
      g.fill();
      dot(g, ex + 0.6, 82.5, 2, INK);
    }
    P(g, '#2a1a0c', (g) => {
      g.moveTo(54, 96);
      g.lineTo(60, 102);
      g.lineTo(64, 96);
      g.lineTo(68, 102);
      g.lineTo(74, 96);
      g.lineTo(72, 106);
      g.lineTo(56, 106);
      g.closePath();
    }, 1.4);
    // copa
    const leaves = [
      [64, 38, 30, '#4a8a3a'],
      [36 + sw, 48, 22, '#5ea84a'],
      [92 - sw, 48, 22, '#5ea84a'],
      [48, 24, 18, '#6bbf55'],
      [80, 22, 18, '#6bbf55'],
    ];
    for (const [x, y, r, col] of leaves) P(g, col, (g) => g.arc(x, y, r, 0, TAU), 3, '#1d3a18');
    for (const [x, y] of [[54, 32], [78, 34], [40, 42], [88, 40], [64, 24]]) {
      dot(g, x, y, 2.6, 'rgba(255,230,140,0.8)');
    }
  }

  function drawKing(g, f) {
    const a = f ? 2 : 0;
    shadow(g, 64, 124, 52, 9);
    // pernas
    P(g, '#2b2630', (g) => g.rect(40, 94, 20, 28), 3);
    P(g, '#2b2630', (g) => g.rect(68, 94, 20, 28), 3);
    line(g, [[48, 100], [52, 112], [46, 120]], '#ff7a2a', 2);
    line(g, [[76, 104], [72, 114], [80, 120]], '#ff7a2a', 2);
    // braços
    P(g, '#332d3a', (g) => g.roundRect ? g.roundRect(10, 50 + a, 22, 50, 6) : g.rect(10, 50 + a, 22, 50), 3);
    P(g, '#332d3a', (g) => g.roundRect ? g.roundRect(96, 50 - a, 22, 50, 6) : g.rect(96, 50 - a, 22, 50), 3);
    line(g, [[16, 70 + a], [24, 84 + a]], '#ff7a2a', 2);
    line(g, [[110, 70 - a], [102, 86 - a]], '#ff7a2a', 2);
    // torso
    P(g, '#2b2630', (g) => {
      g.moveTo(30, 46);
      g.lineTo(98, 46);
      g.lineTo(106, 84);
      g.lineTo(90, 100);
      g.lineTo(38, 100);
      g.lineTo(22, 84);
      g.closePath();
    }, 3);
    line(g, [[46, 56], [56, 70], [48, 84], [60, 96]], '#ff7a2a', 2.4);
    line(g, [[82, 56], [72, 72], [84, 86]], '#ff7a2a', 2.2);
    // cabeça e coroa
    P(g, '#3a3442', (g) => {
      g.moveTo(48, 48);
      g.lineTo(80, 48);
      g.lineTo(86, 24);
      g.lineTo(42, 24);
      g.closePath();
    }, 3);
    for (const [x, h] of [[46, 20], [56, 30], [64, 36], [72, 30], [82, 20]]) {
      P(g, '#ffb347', (g) => {
        g.moveTo(x - 5, 26);
        g.lineTo(x, 26 - h);
        g.lineTo(x + 5, 26);
        g.closePath();
      }, 1.8);
    }
    line(g, [[54, 36], [61, 36]], '#ffb347', 3);
    line(g, [[67, 36], [74, 36]], '#ffb347', 3);
  }

  function drawEclipse(g, f) {
    const spin = f ? 0.2 : 0;
    // halo e corona de eclipse
    g.beginPath();
    g.arc(64, 48, 46, 0, TAU);
    g.fillStyle = radial(g, 64, 48, 36, 50, [
      [0, 'rgba(255,207,90,0.5)'],
      [1, 'rgba(255,207,90,0)'],
    ]);
    g.fill();
    g.beginPath();
    g.arc(64, 48, 36, 0, TAU);
    g.fillStyle = '#0d0a18';
    g.fill();
    g.beginPath();
    g.arc(64, 48, 37.5, spin, spin + TAU * 0.92);
    g.strokeStyle = '#ffcf5a';
    g.lineWidth = 3.4;
    g.stroke();
    // manto
    P(g, '#1d1333', (g) => {
      g.moveTo(30, 62);
      g.lineTo(98, 62);
      g.lineTo(120, 124);
      g.lineTo(8, 124);
      g.closePath();
    }, 3, '#0a0614');
    line(g, [[30, 62], [18, 118]], '#6b3fa8', 2);
    line(g, [[98, 62], [110, 118]], '#6b3fa8', 2);
    // capuz
    P(g, '#241a40', (g) => {
      g.moveTo(38, 60);
      g.quadraticCurveTo(64, 38, 90, 60);
      g.lineTo(86, 74);
      g.quadraticCurveTo(64, 66, 42, 74);
      g.closePath();
    }, 2.4, '#0a0614');
    for (const ex of [56, 72]) {
      g.beginPath();
      g.ellipse(ex, 66, 4.2, 2.2, 0, 0, TAU);
      g.fillStyle = '#ffcf5a';
      g.fill();
    }
    // orbe nas mãos
    P(g, radial(g, 62, 96, 1, 12, [
      [0, '#fff3c4'],
      [0.5, '#ffcf5a'],
      [1, '#6b3fa8'],
    ]), (g) => g.arc(64, 96, 10, 0, TAU), 1.6, '#0a0614');
    // fumaça de sombra
    for (let i = 0; i < 3; i++) {
      line(g, [[20 + i * 14, 120], [14 + i * 14, 102 + (f ? 4 : 0)], [24 + i * 14, 92]], 'rgba(160,110,230,0.45)', 2.2);
    }
  }

  // ---------- Projéteis e coletáveis (unidades 32) ----------

  function drawArrow(g, enemy) {
    const fletch = enemy ? '#ff6b6b' : '#7ad16b';
    const head = enemy ? '#2b2233' : '#cfd8e3';
    line(g, [[4, 16], [24, 16]], enemy ? '#7a2d3a' : '#c8a06a', 2.2);
    P(g, fletch, (g) => {
      g.moveTo(4, 16);
      g.lineTo(0, 10);
      g.lineTo(8, 16);
      g.closePath();
    }, 1);
    P(g, fletch, (g) => {
      g.moveTo(4, 16);
      g.lineTo(0, 22);
      g.lineTo(8, 16);
      g.closePath();
    }, 1);
    P(g, head, (g) => {
      g.moveTo(22, 11.5);
      g.lineTo(30, 16);
      g.lineTo(22, 20.5);
      g.closePath();
    }, 1.2);
  }

  function drawOrb(g, color, core) {
    const grad = radial(g, 16, 16, 1, 15, [
      [0, core],
      [0.35, color],
      [1, 'rgba(0,0,0,0)'],
    ]);
    g.beginPath();
    g.arc(16, 16, 15, 0, TAU);
    g.fillStyle = grad;
    g.fill();
  }

  function drawStarBurst(g, color) {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 8 : 14;
      const a = (i / 16) * TAU;
      g[i ? 'lineTo' : 'moveTo'](16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = INK;
    g.stroke();
  }

  function drawBoulder(g) {
    P(g, radial(g, 12, 10, 2, 16, [
      [0, '#9a939f'],
      [1, '#4f4955'],
    ]), (g) => g.arc(16, 16, 12, 0, TAU), 2);
    line(g, [[10, 12], [15, 17], [13, 22]], 'rgba(20,15,25,0.6)', 1.2);
    line(g, [[19, 9], [22, 14]], 'rgba(20,15,25,0.5)', 1.1);
  }

  function drawSeed(g) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      line(g, [[12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6], [12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10]], '#3f6b2a', 1.4);
    }
    P(g, '#8fd16c', (g) => g.ellipse(12, 12, 6.5, 5, 0, 0, TAU), 1.4);
    dot(g, 10, 10, 1.4, '#e9ffd6');
  }

  function drawBlade(g) {
    g.beginPath();
    g.arc(16, 16, 13, -1.25, 1.25);
    g.arc(20, 16, 10.5, 1.25, -1.25, true);
    g.closePath();
    g.fillStyle = '#2a1f3d';
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = '#ffcf5a';
    g.stroke();
  }

  function drawWeb(g) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      line(g, [[16, 16], [16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14]], 'rgba(240,240,255,0.85)', 1.4);
    }
    for (const r of [5, 10]) {
      g.beginPath();
      g.arc(16, 16, r, 0, TAU);
      g.strokeStyle = 'rgba(240,240,255,0.7)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  }

  function drawCoin(g) {
    dot(g, 16, 17, 12, '#8a5a0b');
    P(g, radial(g, 12, 10, 1, 14, [
      [0, '#fff1a6'],
      [1, '#e0a526'],
    ]), (g) => g.arc(16, 16, 12, 0, TAU), 1.8);
    P(g, null, (g) => g.arc(16, 16, 7.2, 0, TAU), 1.2, '#b8860b');
    dot(g, 13, 11, 2, 'rgba(255,255,255,0.7)');
  }

  function drawGem(g) {
    const pts = [[16, 3], [27, 12], [16, 29], [5, 12]];
    P(g, radial(g, 12, 8, 1, 22, [
      [0, '#e6fbff'],
      [0.5, '#4ac8ff'],
      [1, '#1b4aa8'],
    ]), (g) => {
      g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
    }, 1.6);
    line(g, [[5, 12], [27, 12]], 'rgba(255,255,255,0.6)', 1);
    line(g, [[16, 3], [11, 12], [16, 29]], 'rgba(255,255,255,0.35)', 1);
  }

  function drawHeart(g) {
    P(g, radial(g, 12, 10, 1, 16, [
      [0, '#ffb3c1'],
      [1, '#d7264a'],
    ]), (g) => {
      g.moveTo(16, 27);
      g.bezierCurveTo(2, 18, 1, 9, 8, 6);
      g.bezierCurveTo(12, 4, 15, 7, 16, 11);
      g.bezierCurveTo(17, 7, 20, 4, 24, 6);
      g.bezierCurveTo(31, 9, 30, 18, 16, 27);
      g.closePath();
    }, 1.8);
    dot(g, 10, 10, 1.6, 'rgba(255,255,255,0.7)');
  }

  function drawXp(g) {
    dot(g, 16, 16, 15, 'rgba(120,255,230,0.35)');
    P(g, radial(g, 14, 14, 0.5, 8, [
      [0, '#ffffff'],
      [0.4, '#9ffff0'],
      [1, '#20b8a0'],
    ]), (g) => g.arc(16, 16, 7, 0, TAU), 1);
  }

  function drawPotion(g) {
    P(g, '#8a5a2e', (g) => g.rect(12.5, 3, 7, 6), 1.4);
    P(g, radial(g, 12, 20, 1, 12, [
      [0, '#d9ffd0'],
      [1, '#2e9e4a'],
    ]), (g) => {
      g.moveTo(12.5, 9);
      g.lineTo(12.5, 12);
      g.quadraticCurveTo(4, 16, 6, 24);
      g.quadraticCurveTo(10, 30, 16, 30);
      g.quadraticCurveTo(22, 30, 26, 24);
      g.quadraticCurveTo(28, 16, 19.5, 12);
      g.lineTo(19.5, 9);
      g.closePath();
    }, 1.6);
    line(g, [[9, 22], [11, 26]], 'rgba(255,255,255,0.6)', 1.4);
  }

  // ---------- Retratos (bustos) ----------

  function drawBust(g, p) {
    const bg = g.createRadialGradient(64, 60, 10, 64, 64, 96);
    bg.addColorStop(0, p.halo || '#4a3a6a');
    bg.addColorStop(1, '#120e1c');
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    // ombros
    P(g, p.cloak, (g) => {
      g.moveTo(10, 128);
      g.quadraticCurveTo(14, 92, 64, 88);
      g.quadraticCurveTo(114, 92, 118, 128);
      g.closePath();
    }, 2.4);
    if (p.trim) line(g, [[24, 110], [64, 96], [104, 110]], p.trim, 2);
    // pescoço
    P(g, p.skinShade || '#d9b08a', (g) => g.rect(54, 72, 20, 20), 1.6);
    // cabelo de trás
    if (p.hair === 'long') {
      P(g, p.hairCol, (g) => g.ellipse(64, 66, 30, 36, 0, 0, TAU), 2);
    }
    if (p.hood) {
      P(g, p.cloakDark || p.cloak, (g) => g.ellipse(64, 56, 33, 40, 0, 0, TAU), 2.4);
    }
    // rosto
    P(g, p.skin, (g) => g.ellipse(64, 60, 23, 27, 0, 0, TAU), 2);
    // cabelo / capuz da frente
    if (p.hair === 'short') {
      P(g, p.hairCol, (g) => {
        g.moveTo(40, 58);
        g.quadraticCurveTo(38, 30, 64, 30);
        g.quadraticCurveTo(92, 30, 88, 58);
        g.quadraticCurveTo(80, 44, 64, 42);
        g.quadraticCurveTo(50, 44, 40, 58);
        g.closePath();
      }, 2);
    }
    if (p.hair === 'long') {
      P(g, p.hairCol, (g) => {
        g.moveTo(40, 60);
        g.quadraticCurveTo(38, 32, 64, 33);
        g.quadraticCurveTo(90, 32, 88, 60);
        g.quadraticCurveTo(82, 44, 64, 42);
        g.quadraticCurveTo(46, 44, 40, 60);
        g.closePath();
      }, 2);
    }
    if (p.hair === 'bald') {
      line(g, [[46, 42], [82, 42]], 'rgba(0,0,0,0.12)', 2);
    }
    if (p.hood) {
      P(g, p.cloakDark || p.cloak, (g) => {
        g.moveTo(38, 60);
        g.quadraticCurveTo(64, 28, 90, 60);
        g.quadraticCurveTo(84, 46, 64, 44);
        g.quadraticCurveTo(44, 46, 38, 60);
        g.closePath();
      }, 2);
    }
    if (p.beard) {
      P(g, p.beard, (g) => {
        g.moveTo(42, 72);
        g.quadraticCurveTo(64, 112, 86, 72);
        g.quadraticCurveTo(80, 84, 64, 84);
        g.quadraticCurveTo(48, 84, 42, 72);
        g.closePath();
      }, 1.6);
    }
    // olhos e boca
    const eyeY = 62;
    for (const ex of [54, 74]) {
      if (p.glow) {
        dot(g, ex, eyeY, 7, p.glow);
      }
      dot(g, ex, eyeY, 3.2, p.eye || '#24182e');
      dot(g, ex + 0.9, eyeY - 0.9, 1, '#fff');
    }
    if (p.brow) line(g, [[46, 52], [60, 54]], p.brow, 2.4);
    if (p.brow) line(g, [[68, 54], [82, 52]], p.brow, 2.4);
    if (p.mouth === 'smile') {
      g.beginPath();
      g.arc(64, 76, 6, 0.2, Math.PI - 0.2);
      g.strokeStyle = '#7a3b3b';
      g.lineWidth = 2;
      g.stroke();
    } else if (p.mouth === 'jagged') {
      line(g, [[52, 82], [58, 86], [64, 82], [70, 86], [76, 82]], '#2a0f10', 2.2);
    } else {
      line(g, [[58, 80], [70, 80]], '#7a3b3b', 2);
    }
    // acessórios
    if (p.accessory === 'circlet') {
      line(g, [[42, 40], [64, 36], [86, 40]], '#e0b84a', 3);
      dot(g, 64, 36, 3, '#ffcf5a');
    }
    if (p.accessory === 'crown_root') {
      for (const [x, h] of [[44, 14], [54, 22], [64, 28], [74, 22], [84, 14]]) {
        P(g, '#6bbf55', (g) => {
          g.moveTo(x - 4, 36);
          g.quadraticCurveTo(x, 36 - h, x + 4, 36);
          g.closePath();
        }, 1.4, '#1d3a18');
      }
    }
    if (p.accessory === 'crown_obs') {
      for (const [x, h] of [[44, 18], [54, 26], [64, 32], [74, 26], [84, 18]]) {
        P(g, '#ffb347', (g) => {
          g.moveTo(x - 5, 38);
          g.lineTo(x, 38 - h);
          g.lineTo(x + 5, 38);
          g.closePath();
        }, 1.6);
      }
    }
    if (p.accessory === 'halo') {
      g.beginPath();
      g.arc(64, 60, 40, 0, TAU);
      g.strokeStyle = 'rgba(255,207,90,0.35)';
      g.lineWidth = 9;
      g.stroke();
      g.beginPath();
      g.arc(64, 60, 40, 0, TAU);
      g.strokeStyle = '#ffcf5a';
      g.lineWidth = 3;
      g.stroke();
    }
    if (p.accessory === 'hat') {
      P(g, '#2a2f75', (g) => {
        g.moveTo(64, 2);
        g.lineTo(38, 40);
        g.lineTo(90, 40);
        g.closePath();
      }, 2);
      P(g, '#2a2f75', (g) => g.ellipse(64, 40, 30, 6, 0, 0, TAU), 2);
    }
  }

  // ---------- Pisos e obstáculos por cenário ----------

  function drawFloor(g, w, h, theme, rng) {
    g.fillStyle = theme.a;
    g.fillRect(0, 0, w, h);
    const T = 24;
    for (let y = 0; y < h; y += T) {
      for (let x = 0; x < w; x += T) {
        if (((x / T) + (y / T)) % 2 === 0) {
          g.fillStyle = theme.b;
          g.fillRect(x, y, T, T);
        }
        g.fillStyle = theme.dots;
        for (let i = 0; i < 2; i++) {
          g.globalAlpha = 0.35 + rng.next() * 0.3;
          g.beginPath();
          g.arc(x + rng.next() * T, y + rng.next() * T, 0.8 + rng.next() * 1.2, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }
    // rachaduras e acentos suaves
    g.strokeStyle = theme.dots;
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng.next() - 0.5) * 22, y + (rng.next() - 0.5) * 22);
      g.stroke();
    }
    g.globalAlpha = 0.5;
    for (let i = 0; i < 9; i++) {
      dot(g, rng.next() * w, rng.next() * h, 1.6, theme.glow);
    }
    g.globalAlpha = 1;
  }

  function drawObstacle(g, kind, theme) {
    const acc = theme.accent;
    if (kind === 'bush') {
      shadow(g, 32, 52, 22, 6);
      for (const [x, y, r] of [[20, 34, 14], [44, 34, 14], [32, 24, 16], [32, 40, 14]]) {
        P(g, radial(g, x - 3, y - 4, 2, r + 2, [
          [0, '#8fd16c'],
          [1, '#2a5a2a'],
        ]), (g) => g.arc(x, y, r, 0, TAU), 2.2, '#152a16');
      }
      dot(g, 26, 22, 2, acc);
      dot(g, 40, 31, 1.6, acc);
    } else if (kind === 'rock') {
      shadow(g, 32, 52, 24, 6);
      P(g, radial(g, 24, 26, 2, 30, [
        [0, '#a9a2b3'],
        [1, '#4a4454'],
      ]), (g) => {
        g.moveTo(10, 48);
        g.lineTo(14, 26);
        g.lineTo(28, 14);
        g.lineTo(46, 16);
        g.lineTo(54, 34);
        g.lineTo(50, 48);
        g.closePath();
      }, 2.4);
      line(g, [[24, 24], [30, 34], [26, 44]], 'rgba(20,15,25,0.5)', 1.6);
      line(g, [[38, 22], [44, 30]], 'rgba(255,255,255,0.25)', 2);
    } else if (kind === 'pillar') {
      shadow(g, 32, 56, 20, 6);
      P(g, '#8d8798', (g) => g.rect(16, 14, 32, 40), 2.2);
      P(g, '#b3adbd', (g) => g.rect(12, 8, 40, 8), 2);
      P(g, '#6b6577', (g) => g.rect(12, 50, 40, 6), 2);
      line(g, [[24, 16], [24, 50]], 'rgba(0,0,0,0.18)', 2);
      line(g, [[40, 16], [40, 50]], 'rgba(255,255,255,0.18)', 2);
      dot(g, 32, 30, 2.2, acc);
    } else if (kind === 'crystal') {
      shadow(g, 32, 54, 20, 5);
      const shards = [
        [22, 50, 0.2, 26, 9],
        [34, 52, -0.1, 34, 11],
        [46, 48, 0.25, 22, 8],
      ];
      for (const [x, y, tilt, hgt, w] of shards) {
        P(g, radial(g, x, y - hgt / 2, 1, hgt, [
          [0, '#ffffff'],
          [0.4, acc],
          [1, '#2a1f3d'],
        ]), (g) => {
          g.moveTo(x - w / 2, y);
          g.lineTo(x + tilt * 8, y - hgt);
          g.lineTo(x + w / 2, y);
          g.closePath();
        }, 1.8, '#1a1020');
      }
    } else {
      P(g, '#6b4a2e', (g) => g.rect(24, 30, 16, 22), 2);
      P(g, '#3f7a3a', (g) => g.arc(32, 22, 16, 0, TAU), 2.2, '#16301a');
    }
  }

  // ---------- Registro de sprites de entidades ----------

  const SLIME = {
    g: { base: '#4fc25e', hi: '#d6ffd9' },
    p: { base: '#9a5cf0', hi: '#eadcff' },
    r: { base: '#e0573f', hi: '#ffd9b8' },
  };

  const DEFS = {
    player: { units: 64, px: 128, draw: (g, f) => drawPlayer(g, f) },
    slime_g: { units: 64, px: 128, draw: (g, f) => drawSlime(g, f, SLIME.g) },
    slime_p: { units: 64, px: 128, draw: (g, f) => drawSlime(g, f, SLIME.p) },
    slime_r: { units: 64, px: 128, draw: (g, f) => drawSlime(g, f, SLIME.r) },
    bat: { units: 64, px: 128, draw: (g, f) => drawBat(g, f) },
    skel: { units: 64, px: 128, draw: (g, f) => drawSkeleton(g, f) },
    wolf: { units: 64, px: 128, draw: (g, f) => drawWolf(g, f) },
    shaman: { units: 64, px: 128, draw: (g, f) => drawShaman(g, f) },
    golem: { units: 64, px: 128, draw: (g, f) => drawGolem(g, f) },
    spider: { units: 64, px: 128, draw: (g, f) => drawSpider(g, f) },
    wraith: { units: 64, px: 128, draw: (g, f) => drawWraith(g, f) },
    mage: { units: 64, px: 128, draw: (g, f) => drawMage(g, f) },
    boss_treant: { units: 128, px: 256, draw: (g, f) => drawTreant(g, f) },
    boss_king: { units: 128, px: 256, draw: (g, f) => drawKing(g, f) },
    boss_eclipse: { units: 128, px: 256, draw: (g, f) => drawEclipse(g, f) },
    arrow: { units: 32, px: 64, draw: (g) => drawArrow(g, false) },
    arrow_e: { units: 32, px: 64, draw: (g) => drawArrow(g, true) },
    orb_g: { units: 32, px: 64, draw: (g) => drawOrb(g, 'rgba(120,255,140,0.9)', '#f4fff0') },
    orb_p: { units: 32, px: 64, draw: (g) => drawOrb(g, 'rgba(190,120,255,0.95)', '#fbf0ff') },
    orb_r: { units: 32, px: 64, draw: (g) => drawOrb(g, 'rgba(255,110,90,0.95)', '#fff2e8') },
    orb_c: { units: 32, px: 64, draw: (g) => drawOrb(g, 'rgba(120,230,255,0.95)', '#f0ffff') },
    orb_y: { units: 32, px: 64, draw: (g) => drawOrb(g, 'rgba(255,200,90,0.95)', '#fffbe8') },
    star: { units: 32, px: 64, draw: (g) => drawStarBurst(g, '#ffd166') },
    web: { units: 32, px: 64, draw: (g) => drawWeb(g) },
    boulder: { units: 32, px: 64, draw: (g) => drawBoulder(g) },
    seed: { units: 24, px: 48, draw: (g) => drawSeed(g) },
    blade: { units: 32, px: 64, draw: (g) => drawBlade(g) },
    coin: { units: 32, px: 64, draw: (g) => drawCoin(g) },
    gem: { units: 32, px: 64, draw: (g) => drawGem(g) },
    heart: { units: 32, px: 64, draw: (g) => drawHeart(g) },
    xp: { units: 32, px: 64, draw: (g) => drawXp(g) },
    potion: { units: 32, px: 64, draw: (g) => drawPotion(g) },
  };

  const BUSTS = {
    ysa: {
      skin: '#f2cfa4', skinShade: '#d9ae84', hair: 'long', hairCol: '#3a2a5a', cloak: '#2f8f86', cloakDark: '#1d5a56',
      hood: true, eye: '#2a4e6e', mouth: 'smile', halo: '#2a5a58', trim: '#ffd166', accessory: null,
    },
    iolen: {
      skin: '#e8c4a0', skinShade: '#c99c74', hair: 'short', hairCol: '#ddd8e6', cloak: '#6a3a8a', beard: null,
      eye: '#3d2a1a', mouth: 'smile', halo: '#3a2a5a', trim: '#e0b84a', accessory: 'circlet', brow: '#bdb6c9',
    },
    gorm: {
      skin: '#e0b48a', skinShade: '#b98a62', hair: 'bald', cloak: '#7a4b2a', beard: '#8a5a3a', eye: '#1f1812',
      mouth: 'line', halo: '#4a3420', trim: '#ffb347', accessory: null, brow: '#5a3a22',
    },
    mirra: {
      skin: '#cfc3e6', skinShade: '#a79ac8', hair: 'long', hairCol: '#1d1a3a', cloak: '#2a2f75', cloakDark: '#1a1f55',
      hood: true, eye: '#9ff3ff', mouth: 'line', halo: '#2a2a5a', trim: '#b48cff', glow: 'rgba(159,243,255,0.35)',
    },
    treant: {
      skin: '#7a5530', skinShade: '#5a3b20', hair: 'short', hairCol: '#4a8a3a', cloak: '#3d2a18', eye: '#ffd34a',
      mouth: 'jagged', halo: '#1d3a18', trim: '#6bbf55', accessory: 'crown_root', brow: '#2a1a0c', glow: 'rgba(255,211,74,0.35)',
    },
    king: {
      skin: '#3a3442', skinShade: '#2b2630', hair: 'bald', cloak: '#2b2630', eye: '#ffb347', mouth: 'jagged',
      halo: '#3a2014', trim: '#ff7a2a', accessory: 'crown_obs', brow: '#ff7a2a', glow: 'rgba(255,179,71,0.35)',
    },
    eclipse: {
      skin: '#120c20', skinShade: '#0b0716', hair: 'bald', cloak: '#1d1333', cloakDark: '#241a40', hood: true,
      eye: '#ffcf5a', mouth: 'line', halo: '#2a1a40', trim: '#6b3fa8', accessory: 'halo', glow: 'rgba(255,207,90,0.4)',
    },
  };

  const CACHE_BUSTS = {};

  const Sprites = {
    THEMES,

    // Desenha um sprite de entidade centralizado em (x, y), com tamanho "size" em pixels lógicos.
    draw(g, id, x, y, size, o = {}) {
      const img = get(id, o.frame || 0);
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.translate(x, y);
      if (o.rot) g.rotate(o.rot);
      if (o.flip) g.scale(-1, 1);
      g.drawImage(img, -size / 2, -size / 2, size, size);
      g.restore();
    },

    // Retrato (bustos) para as cenas de história.
    bust(id) {
      if (!CACHE_BUSTS[id]) {
        const p = BUSTS[id];
        CACHE_BUSTS[id] = sprite(128, 256, (g) => drawBust(g, p));
      }
      return CACHE_BUSTS[id];
    },

    // Piso de sala, cacheado por tema e semente.
    floor(themeId, w, h, seed) {
      const key = `floor:${themeId}:${w}x${h}:${seed}`;
      return cached(key, () => {
        const c = makeCanvas(w * 2, h * 2);
        const g = c.getContext('2d');
        g.scale(2, 2);
        drawFloor(g, w, h, THEMES[themeId], V.Util.makeRng(seed));
        return c;
      });
    },

    // Obstáculo (bloqueante) cacheado por tema e tipo.
    obstacle(themeId, kind, w, h) {
      const key = `obs:${themeId}:${kind}:${w}x${h}`;
      return cached(key, () => {
        const c = makeCanvas(w * 2, h * 2);
        const g = c.getContext('2d');
        g.scale(2 * w / 64, 2 * h / 64);
        drawObstacle(g, kind, THEMES[themeId]);
        return c;
      });
    },

    has(id) {
      return Object.prototype.hasOwnProperty.call(DEFS, id);
    },
  };

  function get(id, frame) {
    const key = `${id}:${frame ? 1 : 0}`;
    let c = cache.get(key);
    if (!c) {
      const def = DEFS[id];
      if (!def) throw new Error('Sprite desconhecido: ' + id);
      c = sprite(def.units, def.px, (g) => def.draw(g, frame ? 1 : 0));
      cache.set(key, c);
    }
    return c;
  }

  function cached(key, make) {
    let c = cache.get(key);
    if (!c) {
      c = make();
      cache.set(key, c);
    }
    return c;
  }

  V.Sprites = Sprites;
})();

// Arte procedural original: texturas de circuito, ícones de itens e retratos de inimigos.
// Tudo é desenhado em canvas, sem arquivos externos.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Piso de placa de circuito com trilhas que brilham.
export function circuitFloorTexture(theme, seed = 7, size = 512, style = 'grid') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);

  g.fillStyle = theme.ground;
  g.fillRect(0, 0, size, size);

  // Grade sutil
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 2;
  for (let i = 0; i <= size; i += size / 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke();
  }

  // Pastilhas (pads) de solda
  for (let i = 0; i < 26; i++) {
    const x = r() * size, y = r() * size;
    g.fillStyle = 'rgba(210,190,120,0.35)';
    g.beginPath(); g.arc(x, y, 6 + r() * 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }

  drawFloorStyle(g, style, theme, size, r);

  // Trilhas brilhantes em ângulos retos
  for (let i = 0; i < 9; i++) {
    let x = r() * size, y = r() * size;
    g.strokeStyle = theme.trace;
    g.globalAlpha = 0.35;
    g.lineWidth = 3;
    g.shadowColor = theme.trace;
    g.shadowBlur = 10;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (k % 2 === 0) x += (r() - 0.5) * size * 0.6; else y += (r() - 0.5) * size * 0.6;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Textura de topo de chip (bloco de parede) com ranhuras e LEDs.
export function chipTopTexture(theme, seed = 3, size = 256, style = null) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#34465a';
  g.fillRect(0, 0, size, size);
  // Desenho próprio da zona sobre o chip (mesmo padrão do piso, mais discreto)
  if (style) drawFloorStyle(g, style, theme, size, r0(seed));
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  g.strokeRect(10, 10, size - 20, size - 20);
  // Pinos laterais
  g.fillStyle = 'rgba(200,200,220,0.5)';
  for (let i = 0; i < 8; i++) {
    g.fillRect(0, 22 + i * 26, 8, 10);
    g.fillRect(size - 8, 22 + i * 26, 8, 10);
  }
  // Núcleo com brilho
  const grd = g.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grd.addColorStop(0, theme.accent);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.25 + r() * 0.1;
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 1;
  // LEDs
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? theme.trace : theme.accent;
    g.beginPath(); g.arc(30 + i * 40, size - 30, 4, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Desenha um ícone de item (40x40 ou o tamanho do canvas).
export function drawItemIcon(canvas, glyph, color) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, s = Math.min(w, h);
  g.clearRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(s / 40, s / 40);
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.fillStyle = color + '33';
  g.lineWidth = 2.5;
  g.shadowColor = color;
  g.shadowBlur = 6;

  const path = (fn) => { g.beginPath(); fn(); g.closePath(); g.fill(); g.stroke(); };

  switch (glyph) {
    case 'drop': // gota térmica
      path(() => { g.moveTo(0, -15); g.quadraticCurveTo(12, 2, 0, 15); g.quadraticCurveTo(-12, 2, 0, -15); });
      break;
    case 'cap': // cápsula
      path(() => { g.roundRect(-9, -15, 18, 30, 9); });
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.stroke();
      break;
    case 'kit': // caixa de kit
      path(() => { g.roundRect(-14, -10, 28, 22, 3); });
      g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 12); g.moveTo(-14, 1); g.lineTo(14, 1); g.stroke();
      break;
    case 'blade': // lâmina
      path(() => { g.moveTo(-3, 16); g.lineTo(-3, -6); g.lineTo(0, -16); g.lineTo(3, -6); g.lineTo(3, 16); g.lineTo(-7, 16); g.lineTo(-7, 12); g.lineTo(7, 12); g.lineTo(7, 16); g.closePath(); });
      break;
    case 'pincer': // pinça
      g.beginPath(); g.moveTo(-6, 14); g.lineTo(-10, -10); g.moveTo(6, 14); g.lineTo(10, -10); g.stroke();
      g.beginPath(); g.arc(0, -12, 6, Math.PI, 0); g.stroke();
      break;
    case 'shield': // escudo com aletas
      path(() => { g.moveTo(0, -16); g.lineTo(14, -10); g.lineTo(12, 6); g.quadraticCurveTo(6, 16, 0, 18); g.quadraticCurveTo(-6, 16, -12, 6); g.lineTo(-14, -10); });
      g.beginPath(); for (let i = -8; i <= 8; i += 4) { g.moveTo(-10, i); g.lineTo(10, i); } g.stroke();
      break;
    case 'key': // chave
      g.beginPath(); g.arc(-8, 0, 7, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-1, 0); g.lineTo(16, 0); g.moveTo(10, 0); g.lineTo(10, 6); g.moveTo(15, 0); g.lineTo(15, 5); g.stroke();
      break;
    case 'frag': // fragmento de memória (losango partido)
      path(() => { g.moveTo(0, -15); g.lineTo(12, 0); g.lineTo(2, 4); g.lineTo(6, 15); g.lineTo(-12, 3); g.lineTo(-3, -2); g.closePath(); });
      break;
    case 'wire': // fio enrolado
      g.beginPath();
      for (let i = 0; i < 3; i++) g.ellipse(0, -10 + i * 10, 13 - i * 2, 4, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath(); g.moveTo(-13, -10); g.lineTo(-13, 10); g.stroke();
      break;
    case 'crystal': // cristal hexagonal
      path(() => { g.moveTo(0, -16); g.lineTo(11, -6); g.lineTo(11, 8); g.lineTo(0, 16); g.lineTo(-11, 8); g.lineTo(-11, -6); g.closePath(); });
      g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 16); g.moveTo(-11, -6); g.lineTo(11, 8); g.stroke();
      break;
    case 'alloy': // lingote de liga
      path(() => { g.moveTo(-15, 4); g.lineTo(-9, -8); g.lineTo(15, -8); g.lineTo(9, 4); g.closePath(); });
      path(() => { g.moveTo(-15, 4); g.lineTo(9, 4); g.lineTo(15, 12); g.lineTo(-9, 12); g.closePath(); });
      break;
    default:
      path(() => { g.arc(0, 0, 13, 0, Math.PI * 2); });
  }
  g.restore();
}

// Retrato grande do inimigo (para batalha). Cada glifo tem formato próprio.
export function drawEnemyArt(canvas, glyph, color, t = 0) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const bob = Math.sin(t * 0.004) * 6;
  g.save();
  g.translate(w / 2, h / 2 + bob);
  const sc = w / 256;
  g.scale(sc, sc);

  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 120);
  glow.addColorStop(0, color + '66');
  glow.addColorStop(1, color + '00');
  g.fillStyle = glow;
  g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.fill();

  g.lineWidth = 4;
  g.strokeStyle = color;
  g.fillStyle = color + '44';
  g.shadowColor = color;
  g.shadowBlur = 16;

  const eye = (x, y, r2 = 7) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x, y, r2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#100';
    g.beginPath(); g.arc(x, y, r2 * 0.45, 0, Math.PI * 2); g.fill();
    g.fillStyle = color + '44';
  };

  switch (glyph) {
    case 'pulga': // corpo oval com patas
      g.beginPath(); g.ellipse(0, 10, 50, 36, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 14, 40); g.lineTo(i * 22, 66); g.stroke(); }
      eye(-16, 0); eye(16, 0);
      break;
    case 'ruido': // nuvem de pixels em estática
      for (let i = 0; i < 60; i++) {
        const a = (i * 137.5) * Math.PI / 180;
        const d = 30 + (i % 7) * 10;
        g.fillStyle = i % 3 ? color + 'aa' : '#ffffff99';
        g.fillRect(Math.cos(a) * d - 4, Math.sin(a) * d - 4, 8, 8);
      }
      eye(-10, -4, 9); eye(12, -4, 9);
      break;
    case 'bloco': // bloco de memória com rachaduras
      g.beginPath(); g.roundRect(-58, -58, 116, 116, 10); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-40, -30); g.lineTo(-10, 0); g.lineTo(-30, 30); g.moveTo(20, -50); g.lineTo(30, -10); g.lineTo(10, 20); g.stroke();
      eye(-22, -8, 9); eye(22, -8, 9);
      break;
    case 'sobrecarga': // raio de tensão alta
      g.beginPath();
      g.moveTo(-10, -90); g.lineTo(30, -20); g.lineTo(8, -20); g.lineTo(44, 80); g.lineTo(-6, 10); g.lineTo(18, 10); g.lineTo(-30, -90);
      g.closePath(); g.fill(); g.stroke();
      eye(-6, -40, 8); eye(10, -40, 8);
      break;
    case 'titan': // silhueta de ferrugem em pilhas
      g.beginPath(); g.moveTo(-70, 80); g.lineTo(-80, -10); g.lineTo(-40, -80); g.lineTo(40, -80); g.lineTo(80, -10); g.lineTo(70, 80); g.lineTo(20, 60); g.lineTo(-20, 60); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffb07a55';
      for (let i = 0; i < 9; i++) g.fillRect(-60 + i * 14, 30 + (i % 3) * 8, 10, 6);
      eye(-30, -20, 12); eye(30, -20, 12);
      break;
    case 'vigia': // anel com olho central
      g.beginPath(); g.arc(0, 0, 80, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.001;
        g.beginPath(); g.arc(Math.cos(a) * 72, Math.sin(a) * 72, 5, 0, Math.PI * 2); g.fill();
      }
      eye(0, 0, 26);
      break;
    default:
      g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  g.restore();
}

// Padrão de piso próprio de cada zona (mesmo tema de cor, desenho diferente).
export const FLOOR_STYLE_BY_DECOR = {
  cells: 'grid', pins: 'hex', gears: 'gear', pipes: 'stripes', towers: 'bricks', lanes: 'lanes', rings: 'radial',
};

function drawFloorStyle(g, style, theme, size, r) {
  g.save();
  g.strokeStyle = theme.trace;
  g.globalAlpha = 0.22;
  g.lineWidth = 2;
  const step = size / 8;
  if (style === 'hex') {
    for (let y = 0; y < size + step; y += step * 0.866) {
      for (let x = 0; x < size + step; x += step) {
        const ox = ((y / (step * 0.866)) % 2) * step / 2;
        const cx = x + ox, cy = y;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * step * 0.5, py = cy + Math.sin(a) * step * 0.5;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.stroke();
      }
    }
  } else if (style === 'gear') {
    for (let i = 1; i <= 4; i++) {
      g.beginPath(); g.arc(size / 2, size / 2, i * step * 0.55, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath(); g.moveTo(size / 2 + Math.cos(a) * i * step * 0.5, size / 2 + Math.sin(a) * i * step * 0.5);
        g.lineTo(size / 2 + Math.cos(a) * i * step * 0.62, size / 2 + Math.sin(a) * i * step * 0.62); g.stroke();
      }
    }
  } else if (style === 'stripes') {
    for (let x = -size; x < size * 2; x += step * 0.7) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + size, size); g.stroke();
    }
  } else if (style === 'bricks') {
    for (let y = 0; y < size; y += step) {
      const off = (Math.floor(y / step) % 2) * step / 2;
      for (let x = -step; x < size + step; x += step) {
        g.strokeRect(x + off, y, step, step);
      }
    }
  } else if (style === 'lanes') {
    for (let y = 0; y < size; y += step / 2) {
      g.globalAlpha = 0.12 + (r() * 0.3);
      g.fillStyle = theme.trace;
      g.fillRect(0, y, size, 3);
    }
  } else if (style === 'radial') {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.beginPath(); g.moveTo(size / 2, size / 2);
      g.lineTo(size / 2 + Math.cos(a) * size, size / 2 + Math.sin(a) * size); g.stroke();
    }
  }
  g.restore();
}

// Rótulo de texto em sprite (nome do destino dos portais e de locais)
export function labelSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = Math.min(500, g.measureText(text).width + 40);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.roundRect(256 - w / 2, 18, w, 60, 14); g.fill();
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.6, 0.5, 1);
  return sp;
}

// Gerador rápido por semente (para o desenho das paredes)
function r0(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

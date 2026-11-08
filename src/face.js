// Rostos procedurais: olhos que piscam, boca que se move ao falar e expressões simples.
// Desenhados em canvas e aplicados num plano, então não há arquivos externos.
import * as THREE from 'three';

const FRAME_EVERY = 3; // redesenha a cada 3 quadros para economizar CPU em celulares

// Cria um rosto. color: cor dos olhos. Retorna { mesh, update(t, opts) }.
// opts: { talk: boolean, mood: 'neutral' | 'happy' | 'hurt' | 'surprised' | 'doubt' }
export function createFace({ width = 0.3, height = 0.12, color = '#1fe6d0', transparent = false, bg = '#0a1116' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent, depthWrite: !transparent });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  const g = canvas.getContext('2d');
  let frame = 0;
  let last = '';

  function draw(blink, talk, mood, t) {
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.lineCap = 'round';
    // Olhos
    if (blink) {
      g.fillRect(28, 30, 22, 4);
      g.fillRect(78, 30, 22, 4);
    } else if (mood === 'happy') {
      g.beginPath(); g.arc(39, 36, 11, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(89, 36, 11, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else if (mood === 'surprised') {
      g.lineWidth = 4;
      g.beginPath(); g.arc(39, 36, 10, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(89, 36, 10, 0, Math.PI * 2); g.stroke();
      g.fillRect(37, 34, 4, 4); g.fillRect(87, 34, 4, 4);
      g.lineWidth = 6;
    } else if (mood === 'doubt') {
      // Olho esquerdo normal, direito mais alto com sobrancelha inclinada
      g.beginPath(); g.roundRect(28, 24, 22, 26, 6); g.fill();
      g.beginPath(); g.roundRect(78, 16, 22, 24, 6); g.fill();
      g.beginPath(); g.moveTo(76, 12); g.lineTo(104, 20); g.stroke();
    } else if (mood === 'hurt') {
      g.beginPath(); g.moveTo(28, 22); g.lineTo(50, 34); g.lineTo(28, 42); g.stroke();
      g.beginPath(); g.moveTo(100, 22); g.lineTo(78, 34); g.lineTo(100, 42); g.stroke();
    } else {
      g.beginPath(); g.roundRect(28, 22, 22, 28, 6); g.fill();
      g.beginPath(); g.roundRect(78, 22, 22, 28, 6); g.fill();
    }
    // Boca: abre e fecha quando fala
    if (talk) {
      const open = 4 + Math.abs(Math.sin(t * 0.02)) * 10;
      g.beginPath(); g.ellipse(64, 54, 12, open, 0, 0, Math.PI * 2); g.fill();
    } else if (mood === 'surprised') {
      g.beginPath(); g.arc(64, 52, 6, 0, Math.PI * 2); g.stroke();
    } else if (mood === 'doubt') {
      g.beginPath(); g.moveTo(54, 52); g.lineTo(74, 48); g.stroke();
    } else if (mood === 'happy') {
      g.beginPath(); g.arc(64, 48, 12, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    } else if (mood === 'hurt') {
      g.beginPath(); g.arc(64, 58, 10, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke();
    } else {
      g.fillRect(54, 52, 20, 4);
    }
  }

  // t: tempo em ms. opts.talk, opts.mood
  function update(t, { talk = false, mood = 'neutral' } = {}) {
    frame++;
    if (frame % FRAME_EVERY !== 0) return;
    const blink = (t % 4200) < 130;
    // Redesenha só quando algo visível muda (ou durante a fala)
    const key = `${blink}|${talk}|${mood}|${talk ? Math.round(t / 80) : ''}`;
    if (key === last) return;
    last = key;
    draw(blink, talk, mood, t);
    tex.needsUpdate = true;
  }

  // Primeiro desenho imediato
  draw(false, false, 'neutral', 0);
  tex.needsUpdate = true;

  return { mesh, update, dispose: () => { tex.dispose(); mat.dispose(); } };
}

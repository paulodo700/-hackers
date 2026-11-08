// Efeitos de partículas no mundo 3D: faíscas de vitória e de coleta.
// Cada explosão é um Points com velocidades; some sozinha ao fim da vida útil.
import * as THREE from 'three';

const live = [];
const floats = [];

// Número de dano (ou texto curto) que sobe sobre uma posição e some
export function floatText(scene, pos, text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 60px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, 128, 48);
  g.fillStyle = color;
  g.fillText(text, 128, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.1, 0.42, 1);
  sp.position.set(pos.x, (pos.y ?? 0) + 1.6, pos.z);
  scene.add(sp);
  floats.push({ sp, tex, life: 0.9, max: 0.9, scene });
}

// Explosão de faíscas em `pos` (THREE.Vector3 ou {x,y,z}), na cor `color`.
export function burst(scene, pos, color = '#ffffff', { count = 28, life = 0.9, speed = 3, size = 0.16 } = {}) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x; positions[i * 3 + 1] = (pos.y ?? 0) + 0.6; positions[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2;
    const up = 0.6 + Math.random() * 1.2;
    const s = speed * (0.4 + Math.random() * 0.6);
    vel[i * 3] = Math.cos(a) * s;
    vel[i * 3 + 1] = up * s;
    vel[i * 3 + 2] = Math.sin(a) * s;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(color), size, transparent: true, opacity: 1, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  live.push({ points, geo, mat, vel, life, max: life, scene });
}

// Avança todas as explosões; chamado a cada quadro com o tempo em segundos
export function updateFx(dt) {
  for (let k = floats.length - 1; k >= 0; k--) {
    const f = floats[k];
    f.life -= dt;
    f.sp.position.y += dt * 1.1;
    f.sp.material.opacity = Math.max(0, f.life / f.max);
    if (f.life <= 0) {
      f.scene.remove(f.sp);
      f.tex.dispose();
      f.sp.material.dispose();
      floats.splice(k, 1);
    }
  }
  for (let k = live.length - 1; k >= 0; k--) {
    const f = live[k];
    f.life -= dt;
    const arr = f.geo.attributes.position;
    for (let i = 0; i < arr.count; i++) {
      arr.setX(i, arr.getX(i) + f.vel[i * 3] * dt);
      arr.setY(i, arr.getY(i) + f.vel[i * 3 + 1] * dt);
      arr.setZ(i, arr.getZ(i) + f.vel[i * 3 + 2] * dt);
      f.vel[i * 3 + 1] -= 6 * dt; // gravidade
    }
    arr.needsUpdate = true;
    f.mat.opacity = Math.max(0, f.life / f.max);
    if (f.life <= 0) {
      f.scene.remove(f.points);
      f.geo.dispose();
      f.mat.dispose();
      live.splice(k, 1);
    }
  }
}

export function activeBursts() {
  return live.length;
}

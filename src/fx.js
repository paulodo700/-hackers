// Efeitos de partículas no mundo 3D: faíscas de vitória e de coleta.
// Cada explosão é um Points com velocidades; some sozinha ao fim da vida útil.
import * as THREE from 'three';

const live = [];

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

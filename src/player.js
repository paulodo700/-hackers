// Personagem jogável: Bit, um bit de manutenção de forma humanoide, feito de primitivas.
import * as THREE from 'three';
import { TILE } from './world.js';

const RADIUS = 0.32;
const SPEED = 4.2;

export function createPlayer(scene) {
  const root = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xdfe9f0, roughness: 0.35, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.6, metalness: 0.3 });
  const trace = new THREE.MeshStandardMaterial({ color: 0x1fe6d0, emissive: 0x1fe6d0, emissiveIntensity: 1.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0a1116, emissive: 0x1fe6d0, emissiveIntensity: 1.4, roughness: 0.1 });

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Pernas
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.62, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), dark);
    leg.position.y = -0.3;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.34), shell);
    foot.position.set(0, -0.6, 0.06);
    pivot.add(leg, foot);
    bodyPivot.add(pivot);
    legs.push(pivot);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.3), shell);
  torso.position.y = 1.05;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), trace);
  chest.position.set(0, 1.1, 0.165);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.32), dark);
  belt.position.y = 0.82;
  bodyPivot.add(torso, chest, belt);

  // Braços
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.27, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), shell);
    arm.position.y = -0.26;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), trace);
    hand.position.y = -0.56;
    pivot.add(arm, hand);
    bodyPivot.add(pivot);
    arms.push(pivot);
  }

  // Cabeça com visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.34), shell);
  head.position.y = 1.6;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), visorMat);
  visor.position.set(0, 1.62, 0.18);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), dark);
  antenna.position.y = 1.86;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), trace);
  tip.position.y = 1.99;
  bodyPivot.add(head, visor, antenna, tip);

  // Capa de trilhas (fita brilhante nas costas)
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.9), new THREE.MeshStandardMaterial({ color: 0x0b3a40, emissive: 0x0b5560, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  cape.position.set(0, 0.95, -0.17);
  cape.rotation.x = 0.12;
  bodyPivot.add(cape);

  // Anel de seleção no chão
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0x1fe6d0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  root.add(ring);

  root.scale.setScalar(1.0);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(root);

  const p = {
    x: 0, z: 0,
    facing: 0,
    moving: false,
    obj: root,
    bodyPivot,
    ring,
    visorMat,
    walk: 0,
    teleport: 0,
  };

  // Verifica colisão com o raio do jogador em todas as células tocadas
  function blockedAt(layout, x, z) {
    const pts = [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]];
    for (const [ox, oz] of pts) {
      const c = Math.round((x + ox) / TILE);
      const r = Math.round((z + oz) / TILE);
      if (layout.solidAt(c, r)) return true;
    }
    return false;
  }

  p.setTile = (c, r) => {
    p.x = c * TILE;
    p.z = r * TILE;
    p.obj.position.set(p.x, 0, p.z);
  };

  p.update = (dt, input, layout, t) => {
    let mx = input.moveX, mz = input.moveY;
    const len = Math.hypot(mx, mz);
    p.moving = len > 0.05;
    if (p.moving) {
      if (len > 1) { mx /= len; mz /= len; }
      const step = SPEED * dt;
      const nx = p.x + mx * step;
      if (!blockedAt(layout, nx, p.z)) p.x = nx;
      const nz = p.z + mz * step;
      if (!blockedAt(layout, p.x, nz)) p.z = nz;
      // Vira para a direção do movimento
      const target = Math.atan2(mx, mz);
      let diff = target - p.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.facing += diff * Math.min(1, dt * 12);
      p.walk += dt * 9;
    } else {
      p.walk *= Math.max(0, 1 - dt * 10);
    }

    // Animação de caminhada
    const swing = Math.sin(p.walk) * (p.moving ? 0.7 : 0);
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    bodyPivot.position.y = p.moving ? Math.abs(Math.sin(p.walk)) * 0.05 : 0;

    p.obj.position.set(p.x, 0, p.z);
    p.obj.rotation.y = p.facing;
    ring.material.opacity = 0.35 + Math.sin(t * 0.005) * 0.2;
    visorMat.emissiveIntensity = 1.2 + Math.sin(t * 0.006) * 0.4;
  };

  p.tile = () => ({ c: Math.round(p.x / TILE), r: Math.round(p.z / TILE) });

  return p;
}

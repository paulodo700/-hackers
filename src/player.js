// Personagem jogável: Bit, um bit de manutenção humanoide, feito de primitivas com mais detalhes.
// Ações de animação: 'attack', 'victory', 'hurt'. Repouso: respiração e piscar do visor.
import * as THREE from 'three';
import { TILE } from './world.js';
import { createFace } from './face.js';

const RADIUS = 0.32;
const SPEED = 4.2;
const STEP_DIST = 1.5; // unidades percorridas por passo sonoro

export function createPlayer(scene) {
  const root = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xdfe9f0, roughness: 0.35, metalness: 0.5 });
  const shellDark = new THREE.MeshStandardMaterial({ color: 0x9fb2bf, roughness: 0.4, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.6, metalness: 0.3 });
  const trace = new THREE.MeshStandardMaterial({ color: 0x1fe6d0, emissive: 0x1fe6d0, emissiveIntensity: 1.6 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc8733c, roughness: 0.3, metalness: 0.8 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0a1116, emissive: 0x1fe6d0, emissiveIntensity: 1.4, roughness: 0.1 });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Pernas com joelheiras e pés
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.62, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), dark);
    leg.position.y = -0.3;
    const knee = box(0.2, 0.12, 0.08, shellDark, 0, -0.26, 0.11);
    const foot = box(0.22, 0.1, 0.34, shell, 0, -0.6, 0.06);
    const toeTrace = box(0.2, 0.02, 0.02, trace, 0, -0.56, 0.22);
    pivot.add(leg, knee, foot, toeTrace);
    bodyPivot.add(pivot);
    legs.push(pivot);
  }

  // Quadril e cinto com fivela brilhante
  bodyPivot.add(box(0.44, 0.14, 0.28, dark, 0, 0.78, 0));
  bodyPivot.add(box(0.48, 0.09, 0.32, dark, 0, 0.84, 0));
  bodyPivot.add(box(0.1, 0.08, 0.04, trace, 0, 0.84, 0.165));

  // Torso com placa de núcleo e costuras
  bodyPivot.add(box(0.46, 0.5, 0.3, shell, 0, 1.05, 0));
  bodyPivot.add(box(0.36, 0.22, 0.04, shellDark, 0, 1.08, 0.165));
  const core = box(0.2, 0.2, 0.04, trace, 0, 1.1, 0.19);
  bodyPivot.add(core);
  bodyPivot.add(box(0.06, 0.36, 0.05, copper, -0.14, 1.04, 0.16)); // cabo de cobre
  bodyPivot.add(box(0.46, 0.04, 0.32, copper, 0, 1.3, 0));          // faixa superior

  // Mochila de dissipação com aletas
  const pack = new THREE.Group();
  pack.position.set(0, 1.05, -0.24);
  pack.add(box(0.36, 0.5, 0.18, dark));
  for (let i = -2; i <= 2; i++) pack.add(box(0.36, 0.02, 0.2, shellDark, 0, i * 0.09, 0.0));
  pack.add(box(0.05, 0.05, 0.2, trace, 0.14, 0.2, -0.02));
  bodyPivot.add(pack);

  // Braços com ombreiras, punhos e mãos luminosas
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.27, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), shell);
    arm.position.y = -0.26;
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellDark);
    pad.position.y = 0.02;
    const cuff = box(0.2, 0.08, 0.2, dark, 0, -0.44, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), trace);
    hand.position.y = -0.56;
    pivot.add(arm, pad, cuff, hand);
    bodyPivot.add(pivot);
    arms.push(pivot);
  }

  // Cabeça: capacete com crista, visor com faixa de luz e antena
  const head = box(0.38, 0.34, 0.34, shell, 0, 1.6, 0);
  bodyPivot.add(head);
  bodyPivot.add(box(0.1, 0.06, 0.36, shellDark, 0, 1.79, 0));       // crista
  const visor = box(0.3, 0.1, 0.04, visorMat, 0, 1.62, 0.18);
  bodyPivot.add(visor);
  // Rosto no visor: olhos que piscam, boca que se move ao falar
  const face = createFace({ width: 0.28, height: 0.1, color: '#1fe6d0' });
  face.mesh.position.set(0, 1.62, 0.205);
  bodyPivot.add(face.mesh);
  bodyPivot.add(box(0.26, 0.02, 0.02, trace, 0, 1.62, 0.2));        // faixa de luz
  bodyPivot.add(box(0.05, 0.1, 0.36, shellDark, 0.19, 1.6, 0));     // orelhas laterais
  bodyPivot.add(box(0.05, 0.1, 0.36, shellDark, -0.19, 1.6, 0));
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), dark);
  antenna.position.set(0.1, 1.94, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), trace);
  tip.position.set(0.1, 2.08, 0);
  bodyPivot.add(antenna, tip);

  // Capa de trilhas (fita brilhante nas costas)
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.9), new THREE.MeshStandardMaterial({ color: 0x0b3a40, emissive: 0x0b5560, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  cape.position.set(0, 0.95, -0.3);
  cape.rotation.x = 0.12;
  bodyPivot.add(cape);

  // Anel de seleção no chão
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0x1fe6d0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  root.add(ring);

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
    face,
    talking: false,
    talkMood: null,
    mood: 'neutral',
    moodT: 0,
    action: null,      // { name, t, dur }
    stepAcc: 0,
    stepReady: false,
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

  // Dispara uma ação: 'attack' | 'victory' | 'hurt'
  p.play = (name) => {
    const dur = { attack: 0.45, victory: 1.2, hurt: 0.35 }[name];
    if (!dur) return;
    p.action = { name, t: 0, dur };
    p.mood = name === 'hurt' ? 'hurt' : name === 'victory' ? 'happy' : 'neutral';
    p.moodT = dur;
  };

  // Retorna true uma vez por passo dado (para o som)
  p.consumeStep = () => {
    if (!p.stepReady) return false;
    p.stepReady = false;
    return true;
  };

  p.update = (dt, input, layout, t) => {
    let mx = input.moveX, mz = input.moveY;
    const len = Math.hypot(mx, mz);
    p.moving = len > 0.05;
    if (p.moving) {
      if (len > 1) { mx /= len; mz /= len; }
      const step = SPEED * dt;
      const ox = p.x, oz = p.z;
      const nx = p.x + mx * step;
      if (!blockedAt(layout, nx, p.z)) p.x = nx;
      const nz = p.z + mz * step;
      if (!blockedAt(layout, p.x, nz)) p.z = nz;
      p.stepAcc += Math.hypot(p.x - ox, p.z - oz);
      if (p.stepAcc >= STEP_DIST) { p.stepAcc = 0; p.stepReady = true; }
      // Vira para a direção do movimento
      const target = Math.atan2(mx, mz);
      let diff = target - p.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.facing += diff * Math.min(1, dt * 12);
      p.walk += dt * 9;
    } else {
      p.walk *= Math.max(0, 1 - dt * 10);
    }

    // Caminhada
    const swing = Math.sin(p.walk) * (p.moving ? 0.7 : 0);
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    bodyPivot.position.y = p.moving ? Math.abs(Math.sin(p.walk)) * 0.05 : 0;

    // Repouso: respiração leve
    if (!p.moving && !p.action) {
      bodyPivot.scale.y = 1 + Math.sin(t * 0.0025) * 0.012;
      arms[0].rotation.z = Math.sin(t * 0.0025) * 0.03;
      arms[1].rotation.z = -Math.sin(t * 0.0025) * 0.03;
    } else {
      bodyPivot.scale.y = 1;
    }

    // Ações
    let armOverride = null;
    bodyPivot.rotation.x = 0;
    bodyPivot.position.y = p.moving ? bodyPivot.position.y : 0;
    if (p.action) {
      const a = p.action;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.name === 'attack') {
        // Braço direito estende para frente e volta
        const phase = Math.sin(k * Math.PI);
        armOverride = { r: -1.7 * phase, z: 0 };
        bodyPivot.rotation.x = -0.12 * phase;
      } else if (a.name === 'victory') {
        // Pulinho com os dois braços para cima
        const hop = Math.abs(Math.sin(k * Math.PI * 2));
        bodyPivot.position.y = hop * 0.35 * (1 - k * 0.3);
        armOverride = { r: -2.6, z: 0.9 * (1 - k * 0.1) };
      } else if (a.name === 'hurt') {
        const phase = Math.sin(k * Math.PI);
        bodyPivot.rotation.x = 0.25 * phase;
      }
      if (a.t >= a.dur) p.action = null;
    }
    if (armOverride) {
      arms[1].rotation.x = armOverride.r;
      arms[0].rotation.x = armOverride.r;
      arms[0].rotation.z = -armOverride.z;
      arms[1].rotation.z = armOverride.z;
    }

    p.obj.position.set(p.x, 0, p.z);
    p.obj.rotation.y = p.facing;
    ring.material.opacity = 0.35 + Math.sin(t * 0.005) * 0.2;
    // Piscar do visor a cada ~4 segundos
    const blink = (t % 4000) < 120 ? 0.2 : 1;
    visorMat.emissiveIntensity = (1.2 + Math.sin(t * 0.006) * 0.4) * blink;
    // Expressão volta a neutra quando a ação termina
    if (p.moodT > 0) { p.moodT -= dt; if (p.moodT <= 0) p.mood = 'neutral'; }
    face.update(t, { talk: p.talking, mood: p.talkMood && p.moodT <= 0 ? p.talkMood : p.mood });
  };

  p.tile = () => ({ c: Math.round(p.x / TILE), r: Math.round(p.z / TILE) });

  return p;
}

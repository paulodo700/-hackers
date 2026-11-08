// Entidades do mundo: NPCs, baús, nós de reparo, chefes e glitches que vagam.
import * as THREE from 'three';
import { TILE } from './world.js';
import { NPCS, ENEMIES, ITEMS } from './data/content.js';
import { hasFlag } from './state.js';
import { createFace } from './face.js';

// Rótulo de texto em sprite
function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.5)';
  const w = Math.min(500, g.measureText(text).width + 40);
  g.beginPath(); g.roundRect(256 - w / 2, 18, w, 60, 14); g.fill();
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 0.45, 1);
  return sp;
}

function glowMat(color, intensity = 1.2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.2 });
}

// Acessório marcante de cada NPC: facilita reconhecer personagens de longe.
const NPC_LOOK = {
  sementa: 'leaf', bigorna: 'anvil', rebite: 'goggles', ponteiro: 'pointer',
  arquivista: 'books', correio: 'satchel', lojista: 'apron', arquivista_final: 'books',
};

function makeNpc(def, id) {
  const g = new THREE.Group();
  const col = new THREE.Color(def.color || '#7dfff0');
  const cloth = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.45), roughness: 0.55 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8fa2ad, roughness: 0.3, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 14), cloth);
  body.position.y = 0.8;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20), metal);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.36;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), glowMat(col, 0.35));
  head.position.y = 1.8;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
  visor.position.set(0, 1.84, 0.33);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 8, 28), glowMat(col, 2));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
  g.add(body, belt, head, visor, ring);
  g.userData.ring = ring;
  g.userData.head = head;
  g.userData.look = NPC_LOOK[id] || 'plain';
  // Rosto na frente da cabeça
  const face = createFace({ width: 0.42, height: 0.2, color: def.color || '#7dfff0', transparent: true });
  face.mesh.position.set(0, 1.8, 0.4);
  g.add(face.mesh);
  g.userData.face = face;
  addLook(g, g.userData.look, col, metal, cloth);
  const label = nameSprite(def.name, def.color || '#7dfff0');
  label.position.y = 2.6;
  g.add(label);
  return g;
}

function addLook(g, look, col, metal, cloth) {
  const glow = glowMat(col, 1.2);
  if (look === 'leaf') {
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6), glow);
      leaf.position.set(s * 0.16, 2.2, 0); leaf.rotation.z = -s * 0.5;
      g.add(leaf);
    }
  } else if (look === 'anvil') {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.6), metal);
    pad.position.set(0, 1.45, 0);
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), metal);
    hammer.position.set(0.5, 1.2, -0.42); hammer.rotation.z = 0.4;
    g.add(pad, hammer);
  } else if (look === 'goggles') {
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 16), metal);
      lens.position.set(s * 0.15, 1.9, 0.34);
      g.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 24, Math.PI), metal);
    strap.position.set(0, 1.9, 0.02); strap.rotation.y = Math.PI / 2;
    g.add(strap);
  } else if (look === 'pointer') {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), metal);
    hand.position.set(0.6, 1.4, 0.1);
    hand.rotation.z = -0.5;
    g.add(hand);
  } else if (look === 'books') {
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), cloth);
      b.position.set(0, 1.0 + i * 0.13, -0.5);
      g.add(b);
    }
  } else if (look === 'satchel') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.22), cloth);
    bag.position.set(-0.5, 0.7, 0.1);
    const strapBag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), cloth);
    strapBag.position.set(-0.1, 1.2, 0.3); strapBag.rotation.z = 0.5;
    g.add(bag, strapBag);
  } else if (look === 'apron') {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.06), new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.8 }));
    apron.position.set(0, 0.8, 0.5);
    const till = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), metal);
    till.position.set(0.7, 0.4, 0.2);
    g.add(apron, till);
  }
}

function makeChest(id) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a2e1e, roughness: 0.6, metalness: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.9), mat);
  base.position.y = 0.35;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.7, -0.45);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.36, 0.9), mat);
  lid.position.set(0, 0.18, 0.45);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.05), glowMat(0xffd166, 2.5));
  glow.position.set(0, 0.6, 0.47);
  lidPivot.add(lid);
  g.add(base, lidPivot, glow);
  g.userData.lidPivot = lidPivot;
  g.userData.glow = glow;
  g.userData.id = id;
  return g;
}

function makeRepair(id) {
  const g = new THREE.Group();
  // Nó de trilha partida: losango com fenda
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glowMat(0xff5566, 1.6));
  core.position.y = 0.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 32, Math.PI * 1.6), glowMat(0xffd166, 1.6));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
  g.add(core, ring);
  g.userData.core = core;
  g.userData.ring = ring;
  g.userData.id = id;
  return g;
}

function makeBoss(def) {
  const g = new THREE.Group();
  const col = new THREE.Color(def.color);
  const s = def.scale || 1;
  const body = new THREE.Mesh(
    def.glyph === 'vigia' ? new THREE.TorusKnotGeometry(0.8, 0.22, 90, 14)
      : def.glyph === 'titan' ? new THREE.BoxGeometry(1.6, 2.2, 1.2)
        : new THREE.IcosahedronGeometry(0.9, 1),
    glowMat(col, 0.9),
  );
  body.position.y = 1.4;
  g.add(body);
  // Espinhos decorativos
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), glowMat(col, 1.4));
    sp.position.set(Math.cos(a) * 1.2, 1.4, Math.sin(a) * 1.2);
    sp.lookAt(0, 1.4, 0);
    sp.rotateX(Math.PI / 2);
    g.add(sp);
  }
  g.scale.setScalar(s);
  g.userData.body = body;
  g.userData.id = def.id;
  const label = nameSprite(def.name.split(' —')[0].split(' ').slice(0, 2).join(' '), def.color);
  label.position.y = 3.6 * s;
  g.add(label);
  return g;
}

function makeRoamer(def) {
  const g = new THREE.Group();
  const col = new THREE.Color(def.color);
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.42 * (def.scale || 1), 0), glowMat(col, 1.4));
  body.position.y = 0.6;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  g.add(body, shadow);
  g.userData.body = body;
  return g;
}

// Item no chão: cristal pequeno na cor do item, com anel de luz embaixo
function makePickup(itemId) {
  const g = new THREE.Group();
  const color = new THREE.Color(ITEMS[itemId]?.color || '#ffffff');
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat(color, 1.4));
  gem.position.y = 0.55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), glowMat(color, 0.8));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
  g.add(gem, ring);
  g.userData.gem = gem;
  return g;
}

// Bancada de criação: mesa com painel de circuito e ferramentas
function makeBench(id) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7 }));
  top.position.y = 0.95;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.7), glowMat(0x7CFC9A, 0.9));
  panel.position.y = 1.04;
  for (const x of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.8), new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8 }));
    leg.position.set(x, 0.47, 0);
    g.add(leg);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), glowMat(0xffd166, 2));
  lamp.position.set(0.6, 1.5, -0.2);
  g.add(top, panel, lamp);
  g.userData.lamp = lamp;
  g.userData.id = id;
  return g;
}

// Cria entidades a partir dos marcadores da zona.
export function createMarkerEntities(layout, scene) {
  const list = [];
  for (const m of layout.markers) {
    if (m.type === 'portal' || m.type === 'spawn') continue;
    // Itens já coletados não reaparecem
    if (m.type === 'pickup' && hasFlag(`picked_${m.id}`)) continue;
    let obj = null;
    let entity = { type: m.type, id: m.id, c: m.c, r: m.r };
    if (m.type === 'npc') {
      const def = NPCS[m.id];
      if (!def) continue;
      obj = makeNpc(def, m.id);
      entity.name = def.name;
    } else if (m.type === 'chest') {
      obj = makeChest(m.id);
    } else if (m.type === 'pickup') {
      obj = makePickup(m.item);
      entity.item = m.item;
      entity.n = 1;
    } else if (m.type === 'bench') {
      obj = makeBench(m.id);
    } else if (m.type === 'repair') {
      obj = makeRepair(m.id);
    } else if (m.type === 'boss') {
      const def = ENEMIES[m.id];
      if (!def) continue;
      if (hasFlag(`boss_${m.id}`)) continue;
      obj = makeBoss(def);
      entity.enemy = m.id;
    }
    if (!obj) continue;
    const p = layout.toWorld(m.c, m.r);
    obj.position.copy(p);
    obj.rotation.y = (m.c * 37 + m.r * 17) % 6;
    scene.add(obj);
    entity.obj = obj;
    list.push(entity);
  }
  return list;
}

// Atualiza aparência conforme o progresso (baús abertos, nós reparados, etc.)
export function refreshEntity(e) {
  if (!e.obj) return;
  if (e.type === 'chest') {
    const opened = hasFlag(`opened_${e.id}`);
    e.obj.userData.lidPivot.rotation.x = opened ? -1.9 : 0;
    e.obj.userData.glow.visible = !opened;
    e.opened = opened;
  }
  if (e.type === 'repair') {
    const fixed = hasFlag(`repaired_${e.id}`);
    e.obj.userData.core.material.color.set(fixed ? 0x5ec985 : 0xff5566);
    e.obj.userData.core.material.emissive.set(fixed ? 0x5ec985 : 0xff5566);
    e.fixed = fixed;
  }
}

// Remove entidade (ex.: chefe derrotado)
export function removeEntity(e, scene) {
  if (e.obj) scene.remove(e.obj);
  e.obj = null;
}

// Glitches que vagam pela zona e avançam ao jogador
export function createRoamers(layout, scene, count, rand) {
  const roamers = [];
  const pool = layout.enemyPool || [];
  if (!pool.length) return roamers;
  let attempts = 0;
  while (roamers.length < count && attempts < 400) {
    attempts++;
    const c = 1 + Math.floor(rand() * (layout.cols - 2));
    const r = 1 + Math.floor(rand() * (layout.rows - 2));
    if (layout.solidAt(c, r) || layout.chArt(c, r) === '~' || layout.chArt(c, r) === '_') continue;
    if (layout.markers.some((m) => m.c === c && m.r === r)) continue;
    const id = pool[Math.floor(rand() * pool.length)];
    const def = ENEMIES[id];
    const obj = makeRoamer(def);
    const p = layout.toWorld(c, r);
    obj.position.copy(p);
    scene.add(obj);
    roamers.push({
      enemy: id, obj, c, r,
      x: p.x, z: p.z,
      tx: p.x, tz: p.z,
      timer: rand() * 2,
      alive: true,
      rand,
    });
  }
  return roamers;
}

// Atualiza glitches: vagam aleatoriamente e perseguem o jogador de perto.
export function updateRoamers(roamers, layout, playerPos, dt, t) {
  const hit = [];
  for (const rm of roamers) {
    if (!rm.alive) continue;
    const dx = playerPos.x - rm.x, dz = playerPos.z - rm.z;
    const dist = Math.hypot(dx, dz);
    const chasing = dist < TILE * 3.2;
    if (chasing) {
      const speed = 1.8;
      const nx = rm.x + (dx / (dist || 1)) * speed * dt;
      const nz = rm.z + (dz / (dist || 1)) * speed * dt;
      const cc = Math.round(nx / TILE), rr = Math.round(nz / TILE);
      if (!layout.solidAt(cc, rr)) { rm.x = nx; rm.z = nz; }
    } else {
      rm.timer -= dt;
      if (rm.timer <= 0) {
        rm.timer = 1.5 + rm.rand() * 2.5;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [ddc, ddr] = dirs[Math.floor(rm.rand() * 4)];
        const cc = Math.round(rm.x / TILE) + ddc, rr = Math.round(rm.z / TILE) + ddr;
        if (!layout.solidAt(cc, rr) && layout.chArt(cc, rr) !== '~' && layout.chArt(cc, rr) !== '_') {
          rm.tx = cc * TILE; rm.tz = rr * TILE;
        }
      }
      const tdx = rm.tx - rm.x, tdz = rm.tz - rm.z;
      const td = Math.hypot(tdx, tdz);
      if (td > 0.05) {
        const s = Math.min(td, 0.9 * dt);
        rm.x += (tdx / td) * s; rm.z += (tdz / td) * s;
      }
    }
    rm.obj.position.set(rm.x, 0, rm.z);
    rm.obj.userData.body.position.y = 0.6 + Math.sin(t * 0.005 + rm.x) * 0.12;
    rm.obj.userData.body.rotation.y = t * 0.002;
    if (Math.hypot(playerPos.x - rm.x, playerPos.z - rm.z) < 1.1) hit.push(rm);
  }
  return hit;
}

// Animações leves para entidades estáticas
export function animateEntities(entities, t) {
  for (const e of entities) {
    if (!e.obj) continue;
    if (e.type === 'npc') {
      e.obj.userData.ring.rotation.z = t * 0.002;
      e.obj.userData.head.position.y = 1.8 + Math.sin(t * 0.002 + e.c) * 0.03;
      e.obj.userData.face.update(t, { talk: !!e.talk, mood: e.talkMood || 'neutral' });
    }
    if (e.type === 'bench') e.obj.userData.lamp.material.emissiveIntensity = 1.6 + Math.sin(t * 0.005) * 0.6;
    if (e.type === 'pickup') {
      e.obj.userData.gem.rotation.y = t * 0.0025;
      e.obj.userData.gem.position.y = 0.55 + Math.sin(t * 0.004 + e.c) * 0.08;
    }
    if (e.type === 'repair') {
      e.obj.userData.core.rotation.y = t * 0.002;
      e.obj.userData.core.position.y = 0.9 + Math.sin(t * 0.003) * 0.08;
      e.obj.userData.ring.rotation.z = t * 0.0015;
    }
    if (e.type === 'boss') {
      e.obj.userData.body.rotation.y = t * 0.0012;
      e.obj.userData.body.position.y = 1.4 + Math.sin(t * 0.002) * 0.12;
    }
    if (e.type === 'chest' && !e.opened) {
      e.obj.userData.glow.material.emissiveIntensity = 1.5 + Math.sin(t * 0.004) * 0.8;
    }
  }
}

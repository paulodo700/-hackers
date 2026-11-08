// Constrói o mundo 3D de uma zona a partir do mapa em texto.
import * as THREE from 'three';
import { circuitFloorTexture, chipTopTexture } from './textures.js';

export const TILE = 2;
const COLS = 24;
const SOLID_TERRAIN = new Set(['#', '~', '_']);
const OBJECT_TYPES = new Set(['npc', 'chest', 'repair', 'boss', 'bench']);

// Decorações visuais por tipo de zona. Só usam peças finas ou baixas, para não bloquear o caminho.
// Retorna objetos animados em `animated` ({ obj, speed }).
function addZoneDecor(kind, cells, group, theme, rand, animated) {
  if (!kind || !cells.length) return;
  const pick = cells.filter((_, i) => i % 3 === 0);
  const glow = (color, em) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: em, roughness: 0.4, metalness: 0.4 });
  const m = new THREE.Matrix4();
  if (kind === 'cells') {
    // Células de memória: cubos baixos com topo luminoso
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.6, metalness: 0.5 }), pick.length);
    const tops = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), glow(theme.trace, 1.4), pick.length);
    pick.forEach(([c, r], i) => {
      const x = c * TILE + (rand() - 0.5) * 0.5, z = r * TILE + (rand() - 0.5) * 0.5;
      m.makeTranslation(x, 0.4, z); body.setMatrixAt(i, m);
      m.makeTranslation(x, 0.82, z); tops.setMatrixAt(i, m);
    });
    group.add(body, tops);
  } else if (kind === 'pins') {
    // Pinos de registrador: hastes finas com cúpula brilhante
    const shaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0xc9b26a, metalness: 0.9, roughness: 0.3 }), pick.length);
    const dome = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), glow(theme.accent, 1.6), pick.length);
    pick.forEach(([c, r], i) => {
      const x = c * TILE + (rand() - 0.5) * 0.6, z = r * TILE + (rand() - 0.5) * 0.6;
      m.makeTranslation(x, 0.65, z); shaft.setMatrixAt(i, m);
      m.makeTranslation(x, 1.3, z); dome.setMatrixAt(i, m);
    });
    group.add(shaft, dome);
  } else if (kind === 'gears') {
    // Engrenagens girando no piso
    for (const [c, r] of pick.slice(0, 4)) {
      const gear = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 20), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, metalness: 0.7, roughness: 0.4 }));
      gear.add(ring);
      for (let k = 0; k < 8; k++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), glow(theme.trace, 0.6));
        const a = (k / 8) * Math.PI * 2;
        tooth.position.set(Math.cos(a) * 0.82, 0, Math.sin(a) * 0.82);
        gear.add(tooth);
      }
      gear.rotation.x = -Math.PI / 2;
      gear.position.set(c * TILE, 0.14, r * TILE);
      group.add(gear);
      animated.push({ obj: gear, speed: 0.6, axis: 'z' });
    }
  } else if (kind === 'pipes') {
    // Tubos horizontais de refrigeração
    for (const [c, r] of pick.slice(0, 6)) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, TILE * 1.6, 10), new THREE.MeshStandardMaterial({ color: 0x5b7a8a, metalness: 0.8, roughness: 0.25 }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(c * TILE, 0.22, r * TILE);
      group.add(pipe);
    }
  } else if (kind === 'towers') {
    // Torres baixas de memória com faixas de LED
    for (const [c, r] of pick.slice(0, 8)) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x2c2446, roughness: 0.5, metalness: 0.5 }));
      tower.position.set(c * TILE + 0.2, 0.55, r * TILE);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.72), glow(theme.accent, 2));
      led.position.set(0, 0.56, 0);
      tower.add(led);
      group.add(tower);
    }
  } else if (kind === 'lanes') {
    // Faixas de barramento: trilhas largas e luminosas no piso
    for (const [c, r] of pick.slice(0, 10)) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 0.03, 0.18), glow(theme.trace, 0.9));
      lane.position.set(c * TILE, 0.03, r * TILE);
      group.add(lane);
    }
  } else if (kind === 'rings') {
    // Anéis flutuantes em volta do núcleo
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 1.2, 0.06, 6, 48), glow(theme.trace, 1.5));
      ring.position.y = 2.6 + i * 0.5;
      ring.rotation.x = Math.PI / 2 + i * 0.4;
      group.add(ring);
      animated.push({ obj: ring, speed: 0.25 * (i % 2 ? -1 : 1), axis: 'y' });
    }
  }
}

// Padroniza larguras: linhas curtas ganham "." antes do último caractere,
// linhas longas perdem "." internos. Mapas podem ter alturas diferentes.
export function normalizeMap(raw) {
  return raw.map((row) => {
    let r = row;
    while (r.length < COLS) r = r.slice(0, -1) + '.' + r.slice(-1);
    while (r.length > COLS) {
      const idx = r.indexOf('.', 1);
      if (idx === -1 || idx >= r.length - 1) break;
      r = r.slice(0, idx) + r.slice(idx + 1);
    }
    return r.slice(0, COLS).padEnd(COLS, '#');
  });
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function buildZone(def, scene) {
  const map = normalizeMap(def.map);
  const rows = map.length;
  const cols = COLS;
  const theme = def.theme;
  const group = new THREE.Group();
  group.name = `zone:${def.id}`;
  const rand = rnd(hashStr(def.id));

  const cx = ((cols - 1) * TILE) / 2;
  const cz = ((rows - 1) * TILE) / 2;

  // Piso
  const floorTex = circuitFloorTexture(theme, hashStr(def.id));
  floorTex.repeat.set(cols / 4, rows / 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(cols * TILE, rows * TILE),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  group.add(floor);

  // Coleta de células
  const walls = [], traces = [], water = [], abyss = [], decor = [];
  const markers = [];
  const grid = [];
  let spawn = null;
  const portals = [];

  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      const solidT = SOLID_TERRAIN.has(ch);
      const def2 = def.markers?.[ch];
      let blocked = solidT;
      if (ch === '#') walls.push([c, r]);
      else if (ch === '=') traces.push([c, r]);
      else if (ch === '~') water.push([c, r]);
      else if (ch === '_') abyss.push([c, r]);
      else if (ch === 'S') spawn = { c, r };
      else if (def2) {
        markers.push({ ...def2, c, r, key: ch });
        if (def2.type === 'portal') portals.push({ c, r, to: def2.to, requires: def2.requires, key: ch });
        if (OBJECT_TYPES.has(def2.type)) blocked = true;
      } else if (ch === '.' && rand() < 0.06) {
        decor.push([c, r]);
      }
      grid[r].push({ blocked, ch });
    }
  }

  // Paredes (chips) — um InstancedMesh só
  if (walls.length) {
    const topTex = chipTopTexture(theme, hashStr(def.id) + 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6f8799, map: topTex, roughness: 0.5, metalness: 0.45,
      emissive: new THREE.Color(theme.accent).multiplyScalar(0.12),
    });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 2.6, TILE), mat, walls.length);
    inst.castShadow = true; inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    walls.forEach(([c, r], i) => {
      m.makeTranslation(c * TILE, 1.3, r * TILE);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // Trilhas brilhantes
  if (traces.length) {
    const mat = new THREE.MeshStandardMaterial({
      color: theme.trace, emissive: theme.trace, emissiveIntensity: 1.1, roughness: 0.3,
    });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 0.9, 0.04, TILE * 0.22), mat, traces.length * 2);
    const m = new THREE.Matrix4();
    let k = 0;
    traces.forEach(([c, r]) => {
      // Duas barras cruzadas dão a sensação de trilha de cobre
      m.makeRotationY(0).setPosition(c * TILE, 0.03, r * TILE);
      inst.setMatrixAt(k++, m);
      m.makeRotationY(Math.PI / 2).setPosition(c * TILE, 0.03, r * TILE);
      inst.setMatrixAt(k++, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // Poças de refrigerante
  if (water.length) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b6f80, emissive: 0x0b3b48, metalness: 0.9, roughness: 0.08,
      transparent: true, opacity: 0.88,
    });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 0.12, TILE), mat, water.length);
    const m = new THREE.Matrix4();
    water.forEach(([c, r], i) => { m.makeTranslation(c * TILE, 0.04, r * TILE); inst.setMatrixAt(i, m); });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // Abismos
  if (abyss.length) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x030306, emissive: theme.trace, emissiveIntensity: 0.15 });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 0.1, TILE), mat, abyss.length);
    const m = new THREE.Matrix4();
    abyss.forEach(([c, r], i) => { m.makeTranslation(c * TILE, -0.6, r * TILE); inst.setMatrixAt(i, m); });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // Decoração: capacitores e resistores pequenos
  if (decor.length) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.35 });
    const cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), mat, decor.length);
    const res = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 }), decor.length);
    const m = new THREE.Matrix4();
    decor.forEach(([c, r], i) => {
      const x = c * TILE + (rand() - 0.5) * 0.9, z = r * TILE + (rand() - 0.5) * 0.9;
      m.makeTranslation(x, 0.25, z); cap.setMatrixAt(i, m);
      m.makeTranslation(x + 0.2, 0.09, z - 0.2); res.setMatrixAt(i, m);
    });
    cap.instanceMatrix.needsUpdate = true; res.instanceMatrix.needsUpdate = true;
    cap.castShadow = true;
    group.add(cap, res);
  }

  // Portais: anéis que giram e feixe de luz
  const portalMeshes = [];
  for (const p of portals) {
    const pg = new THREE.Group();
    pg.position.set(p.c * TILE, 0, p.r * TILE);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.07, 12, 40),
      new THREE.MeshStandardMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 2 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 3.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 1.6;
    pg.add(ring, beam);
    group.add(pg);
    portalMeshes.push({ group: pg, ring, beam });
  }

  // Decoração específica da zona (tipo definido em zones.js)
  const animated = [];
  addZoneDecor(def.decor, decor, group, theme, rand, animated);

  // Luzes pontuais coloridas
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(theme.accent, 1.3, 14, 2);
    const t = traces[Math.floor(rand() * Math.max(1, traces.length))] || [cols / 2, rows / 2];
    light.position.set(t[0] * TILE, 2.4, t[1] * TILE);
    group.add(light);
  }

  // Partículas de bits flutuando
  const pCount = 160;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pos[i * 3] = rand() * cols * TILE;
    pos[i * 3 + 1] = rand() * 6;
    pos[i * 3 + 2] = rand() * rows * TILE;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: theme.trace, size: 0.12, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  group.add(particles);

  scene.add(group);

  const toWorld = (c, r) => new THREE.Vector3(c * TILE, 0, r * TILE);

  // Ponto de partida desta zona (S ou primeiro piso livre)
  const freeSpawn = () => {
    if (spawn) return spawn;
    for (let r = 1; r < rows; r++) for (let c = 1; c < cols; c++) if (!grid[r][c].blocked && map[r][c] === '.') return { c, r };
    return { c: 1, r: 1 };
  };

  // Destino de chegada: célula livre mais próxima do portal de retorno para zona `fromId`
  const arrivalFrom = (fromId) => {
    const back = portals.find((p) => p.to === fromId);
    if (!back) return freeSpawn();
    const seen = new Set([`${back.c},${back.r}`]);
    const queue = [[back.c, back.r]];
    while (queue.length) {
      const [c, r] = queue.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const key = `${nc},${nr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cell = grid[nr][nc];
        if (cell.blocked || cell.ch === '_' || cell.ch === '~') continue;
        if (portals.some((p) => p.c === nc && p.r === nr)) continue;
        return { c: nc, r: nr };
      }
      queue.push(...[[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen.has(`${x},${y}`)));
    }
    return freeSpawn();
  };

  const update = (t) => {
    // Engrenagens e anéis giram em torno do próprio eixo normal
    for (const a of animated) a.obj.rotation.z = t * 0.001 * a.speed * 10;
    for (const pm of portalMeshes) {
      pm.ring.rotation.z = t * 0.0015;
      pm.beam.material.opacity = 0.14 + Math.sin(t * 0.003) * 0.05;
    }
    const arr = particles.geometry.attributes.position;
    for (let i = 0; i < pCount; i++) {
      let y = arr.getY(i) + 0.004;
      if (y > 6) y = 0;
      arr.setY(i, y);
    }
    arr.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(group);
    group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mm) => { mm.map?.dispose?.(); mm.dispose(); });
      }
    });
  };

  return {
    id: def.id,
    name: def.name,
    rows, cols, map, grid, markers, portals,
    group, update, dispose, toWorld,
    spawn: freeSpawn(),
    arrivalFrom,
    solidAt(c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return true;
      return grid[r][c].blocked;
    },
    chArt(c, r) { return map[r][c]; },
    theme,
  };
}

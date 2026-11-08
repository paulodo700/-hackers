// Ponto de entrada: renderizador, câmera, laço principal e ligação entre os sistemas.
import * as THREE from 'three';
import { ZONES, START_ZONE } from './data/zones.js';
import { NPCS, QUESTS, ENEMIES, ITEMS, INTRO_TEXT, ENDING } from './data/content.js';
import {
  state, resetState, saveGame, loadGame, hasSave, maxHp, maxEn, gainXp, addItem,
  setFlag, hasFlag, bump, meets, questStatus, questStage, startQuest, checkQuests,
  discoverZone, clampVitals, activeQuestId,
} from './state.js';
import { buildZone } from './world.js';
import {
  createMarkerEntities, createRoamers, updateRoamers, animateEntities, refreshEntity, removeEntity,
} from './entities.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import * as UI from './ui.js';
import { startBattle, closeBattleScreen, isBattleOpen } from './battle.js';
import { startRepair, isRepairOpen, bindRepairUI, repairDebug } from './repair.js';
import { CHEST_LOOT, requirementText } from './loot.js';

const el = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Renderizador e cena ----------
const canvas = el('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#071f22');
scene.fog = new THREE.FogExp2(0x071f22, 0.03);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);

const hemi = new THREE.HemisphereLight(0xbfeaff, 0x0a1218, 0.9);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, far: 70 });
sun.shadow.bias = -0.0008;
scene.add(hemi, sun, sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 64 : 50; // mais campo de visão em celulares em pé
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Estado de execução ----------
const input = createInput(canvas);
let zone = null;
let player = null;
let entities = [];
let roamers = [];
let running = false;
let yaw = 0;
let camDist = 11;
let lastTile = null;
let prompt = null;
let bgYaw = 0;

// ---------- Utilidades ----------
function autosave() {
  if (!running || !player) return;
  const t = player.tile();
  state.pos = { c: t.c, r: t.r };
  saveGame();
}

function matchWhen(w) {
  if (!w) return true;
  if (w.quest) {
    if (w.done) return questStatus(w.quest) === 'done';
    return questStage(w.quest) === w.stage;
  }
  if (w.flag) return hasFlag(w.flag);
  return true;
}

function describeRewards(done) {
  return done.map((d) => `Missão concluída: ${QUESTS[d.id].title} (${UI.showRewardToast(d.reward) || 'sem recompensa'})`);
}

// Aplica efeitos de diálogos e checa missões
function applyActions(actions = []) {
  const msgs = [];
  for (const a of actions) {
    if (a.set) setFlag(a.set);
    if (a.start && startQuest(a.start)) msgs.push(`Nova missão: ${QUESTS[a.start].title}`);
    if (a.give) { addItem(a.give[0], a.give[1]); msgs.push(`${ITEMS[a.give[0]].name} ×${a.give[1]}`); }
    if (a.xp) gainXp(a.xp);
    if (a.gold) state.gold += a.gold;
  }
  const done = checkQuests();
  msgs.push(...describeRewards(done));
  if (msgs.length) UI.toast(msgs.join(' · '), 4200);
  UI.updateHud();
  UI.updateQuestBox();
  autosave();
}

// ---------- Zonas ----------
function clearZone() {
  for (const e of entities) removeEntity(e, scene);
  entities = [];
  for (const r of roamers) scene.remove(r.obj);
  roamers = [];
  if (zone) zone.dispose();
  zone = null;
}

// quiet: não altera o progresso (usado no fundo do título)
function loadZone(id, fromId = null, tile = null, quiet = false) {
  clearZone();
  const def = ZONES[id];
  zone = buildZone(def, scene);
  zone.enemyPool = def.enemies;
  scene.background.set(def.theme.fog);
  scene.fog.color.set(def.theme.fog);
  scene.fog.density = id === 'core' ? 0.045 : 0.03;

  entities = createMarkerEntities(zone, scene);
  entities.forEach(refreshEntity);
  roamers = createRoamers(zone, scene, def.encounter ? 4 : 0, Math.random);

  if (!player) player = createPlayer(scene);
  const t = tile || (fromId ? zone.arrivalFrom(fromId) : zone.spawn);
  player.setTile(t.c, t.r);
  player.facing = 0;
  lastTile = { c: t.c, r: t.r };
  updateSunAndCamera(1);

  if (!quiet) {
    state.zone = id;
    discoverZone(id);
    if (id === 'core') setFlag('entered_core');
    UI.setZoneName(def.name);
    UI.toast(def.name, 2400);
    UI.updateQuestBox();
    UI.updateHud();
    autosave();
  }
}

// ---------- Câmera e luz ----------
function updateSunAndCamera(snap = 0) {
  if (!player) return;
  const ty = 1.1;
  const pitch = 0.62;
  const want = new THREE.Vector3(
    player.x + Math.sin(yaw) * Math.cos(pitch) * camDist,
    ty + Math.sin(pitch) * camDist,
    player.z + Math.cos(yaw) * Math.cos(pitch) * camDist,
  );
  if (snap) camera.position.copy(want);
  else camera.position.lerp(want, 1 - Math.pow(0.0008, 1 / 60));
  camera.lookAt(player.x, ty, player.z);
  sun.position.set(player.x + 8, 18, player.z + 6);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();
}

// ---------- Interação ----------
function nearestEntity(maxDist = 2.4) {
  let best = null, bd = Infinity;
  for (const e of entities) {
    if (!e.obj) continue;
    const d = Math.hypot(e.obj.position.x - player.x, e.obj.position.z - player.z);
    if (d < bd && d <= maxDist) { bd = d; best = e; }
  }
  return best;
}

function promptFor(e) {
  if (e.type === 'npc') return `E · Falar com ${e.name}`;
  if (e.type === 'chest') return e.opened ? 'Baú vazio' : 'E · Abrir baú';
  if (e.type === 'repair') return e.fixed ? 'Trilha restaurada' : 'E · Reparar trilha';
  if (e.type === 'boss') return `E · Enfrentar ${ENEMIES[e.enemy].name.split(' —')[0]}`;
  return '';
}

function interact(e) {
  if (e.type === 'npc') {
    const def = NPCS[e.id];
    const sc = def.scenes.find((s) => !s.when || matchWhen(s.when));
    if (!sc) return;
    const lines = sc.lines.map((l) => ({ s: l.s || def.name, t: l.t }));
    // Cenas genéricas lembram o objetivo atual da missão ativa
    const aid = activeQuestId();
    if (!sc.when && aid) {
      const q = QUESTS[aid];
      lines.push({ s: 'Diário', t: `Objetivo — ${q.title}: ${q.stages[questStage(aid)].text}` });
    }
    UI.openDialog(lines, () => applyActions(sc.actions));
    return;
  }
  if (e.type === 'chest') {
    if (hasFlag(`opened_${e.id}`)) return UI.toast('Este baú já foi esvaziado.');
    setFlag(`opened_${e.id}`);
    bump(`chest_${zone.id}`);
    const names = [];
    for (const [id, n] of CHEST_LOOT[e.id] || []) { addItem(id, n); names.push(`${ITEMS[id].name} ×${n}`); }
    const credits = 5 + state.level * 2;
    state.gold += credits;
    refreshEntity(e);
    UI.toast(`Baú aberto: ${names.join(', ')} · +${credits} cr`, 3600);
    afterProgress();
    return;
  }
  if (e.type === 'repair') {
    if (hasFlag(`repaired_${e.id}`)) return UI.toast('Esta trilha já foi restaurada.');
    const size = zone.id === 'cache' ? 4 : zone.id === 'pipeline' ? 6 : 5;
    startRepair({
      size,
      title: `Reparo — ${zone.name}`,
      onDone: (ok) => {
        if (!ok) return UI.toast('Reparo interrompido.');
        setFlag(`repaired_${e.id}`);
        bump(`repair_${zone.id}`);
        refreshEntity(e);
        gainXp(20);
        state.gold += 10;
        UI.toast('Trilha restaurada! +20 XP · +10 cr', 3000);
        afterProgress();
      },
    });
    return;
  }
  if (e.type === 'boss') {
    const def = ENEMIES[e.enemy];
    UI.openDialog([{ s: def.name, t: def.lore }, { s: 'Bit', t: 'Vou consertar o que você quebrou.' }], () => beginBattle(e.enemy, e));
  }
}

function afterProgress(extra = {}) {
  const done = [...(extra.done || []), ...checkQuests()];
  if (done.length) UI.toast(describeRewards(done).join(' · '), 4200);
  UI.updateHud();
  UI.updateQuestBox();
  autosave();
}

// ---------- Batalhas ----------
function beginBattle(enemyId, entity) {
  startBattle(enemyId, (result, extra = {}) => {
    closeBattleScreen();
    if (result === 'win') {
      if (entity && entity.type === 'boss') removeEntity(entity, scene);
      if (enemyId === 'vigia') return onEnding();
      afterProgress(extra);
      return;
    }
    if (result === 'lose') {
      state.hp = Math.max(1, Math.ceil(maxHp() * 0.3));
      state.en = maxEn();
      state.gold = Math.floor(state.gold * 0.9);
      clampVitals();
      const sp = zone.spawn;
      player.setTile(sp.c, sp.r);
      lastTile = { c: sp.c, r: sp.r };
      updateSunAndCamera(1);
      UI.toast('Você foi restaurado no ponto seguro. Perdeu 10% dos créditos.', 3800);
      UI.updateHud();
      autosave();
      return;
    }
    if (result === 'flee') UI.toast('Você escapou pelas trilhas.');
    UI.updateHud();
  });
}

function onEnding() {
  UI.openDialog(ENDING, () => {
    setFlag('ending_seen');
    UI.toast('Obrigado por jogar Anel Zero! Continue explorando.', 4200);
    afterProgress();
  });
}

// ---------- Portais ----------
function tryPortal(p, prev) {
  if (!meets(p.requires)) {
    UI.toast(requirementText(p.requires), 3200);
    player.setTile(prev.c, prev.r);
    lastTile = prev;
    return;
  }
  loadZone(p.to, zone.id);
}

// ---------- Menus ----------
function openMainMenu() {
  if (!running || UI.isDialogOpen() || isBattleOpen() || isRepairOpen()) return;
  UI.openMenu('status', { refresh: () => { UI.updateHud(); UI.updateQuestBox(); } });
}

function busy() {
  return UI.isDialogOpen() || UI.isMenuOpen() || isBattleOpen() || isRepairOpen() || !running;
}

input.onInteract = () => {
  if (UI.isDialogOpen()) return UI.advanceDialog();
  if (!running || busy()) return;
  const e = nearestEntity();
  if (e) interact(e);
};
input.onMenu = () => {
  if (UI.isMenuOpen()) return UI.closeMenu();
  openMainMenu();
};

el('dialog').addEventListener('click', () => UI.advanceDialog());
el('btn-menu').addEventListener('click', openMainMenu);
el('btn-close').addEventListener('click', () => UI.closeMenu());
el('btn-save').addEventListener('click', () => {
  autosave();
  UI.toast('Jogo salvo.');
});
UI.bindMenuUI();
bindRepairUI();

// ---------- Título ----------
function showScreen(id) {
  for (const s of ['title', 'menu', 'battle', 'repair', 'controls']) el(s).classList.toggle('hidden', s !== id);
}

function enterGame() {
  el('hud').classList.remove('hidden');
  running = true;
  yaw = 0; // a câmera volta à visão padrão ao entrar no jogo
  camDist = 11;
  updateTouchVisibility();
}

function updateTouchVisibility() {
  el('touch').style.display = running && input.touchEnabled ? 'block' : 'none';
}

el('btn-new').addEventListener('click', () => {
  resetState();
  showScreen(null);
  loadZone(START_ZONE);
  enterGame();
  UI.openDialog(INTRO_TEXT, () => {
    UI.toast('Use WASD/Setas ou o joystick para explorar.', 3400);
  });
});

el('btn-continue').addEventListener('click', () => {
  if (!loadGame()) return;
  showScreen(null);
  const pos = state.pos && ZONES[state.zone] ? state.pos : null;
  loadZone(ZONES[state.zone] ? state.zone : START_ZONE, null, pos, false);
  enterGame();
});

el('btn-controls').addEventListener('click', () => showScreen('controls'));
el('btn-controls-back').addEventListener('click', () => showScreen('title'));

// Mostra os botões de título e atualiza o aviso de save
function refreshTitle() {
  const cont = el('btn-continue');
  cont.disabled = !hasSave();
  el('title-hint').textContent = hasSave()
    ? 'Progresso salvo encontrado neste navegador.'
    : 'Dica: o progresso fica salvo no seu navegador.';
}

// ---------- Laço principal ----------
let last = performance.now();
let autosaveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!zone) return;

  if (!running) {
    // Fundo animado no título
    bgYaw += dt * 0.12;
    yaw = bgYaw;
    player.update(dt, { moveX: 0, moveY: 0 }, zone, now);
    updateSunAndCamera(0);
    zone.update(now);
    animateEntities(entities, now);
    renderer.render(scene, camera);
    return;
  }

  input.update();
  const cam = input.consume();
  yaw += cam.yawDelta;
  camDist = clamp(camDist + cam.zoomDelta, 6, 18);

  if (!busy()) {
    // Converte direção de tela em direção de mundo, relativa à câmera
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const wx = input.moveX * rx + input.moveY * fx;
    const wz = input.moveX * rz + input.moveY * fz;
    const prev = { c: lastTile.c, r: lastTile.r };
    player.update(dt, { moveX: wx, moveY: wz }, zone, now);

    const tile = player.tile();
    if (tile.c !== lastTile.c || tile.r !== lastTile.r) {
      const portal = zone.portals.find((p) => p.c === tile.c && p.r === tile.r);
      lastTile = tile;
      if (portal) {
        tryPortal(portal, prev);
      }
    }

    // Glitches que perseguem
    const hits = updateRoamers(roamers, zone, { x: player.x, z: player.z }, dt, now);
    if (hits.length && !isBattleOpen()) {
      const rm = hits[0];
      rm.alive = false;
      scene.remove(rm.obj);
      beginBattle(rm.enemy, null);
    }
  } else {
    player.update(dt, { moveX: 0, moveY: 0 }, zone, now);
    updateRoamers(roamers, zone, { x: player.x, z: player.z }, 0, now);
  }

  // Prompt de interação
  const near = running && !busy() ? nearestEntity() : null;
  const txt = near ? promptFor(near) : '';
  if (txt !== prompt) {
    prompt = txt;
    const p = el('prompt');
    p.textContent = txt;
    p.classList.toggle('hidden', !txt);
  }

  updateSunAndCamera(0);
  zone.update(now);
  animateEntities(entities, now);

  autosaveTimer += dt;
  if (autosaveTimer > 20) { autosaveTimer = 0; autosave(); }
  UI.updateHud();
  renderer.render(scene, camera);
}

// Gancho de depuração para testes automatizados
window.__anelZero = {
  scene, camera, state, loadZone, beginBattle, interact, nearestEntity, repairDebug,
  get zone() { return zone; }, get player() { return player; }, get entities() { return entities; },
};

// Carrega o fundo do título e inicia o laço
loadZone(START_ZONE, null, null, true);
refreshTitle();
showScreen('title');
requestAnimationFrame((t) => { last = t; frame(t); });

window.addEventListener('beforeunload', () => autosave());

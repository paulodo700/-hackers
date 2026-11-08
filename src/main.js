// Ponto de entrada: renderizador, câmera, laço principal e ligação entre os sistemas.
import * as THREE from 'three';
import { ZONES, START_ZONE } from './data/zones.js';
import {
  NPCS, QUESTS, ENEMIES, ITEMS, INTRO_TEXT, endingLines, VIGIA_CHOICE, VIGIA_CHOICES, ENDING_RESUME,
} from './data/content.js';
import {
  state, resetState, saveGame, loadGame, hasSave, maxHp, maxEn, gainXp, addItem,
  setFlag, hasFlag, bump, meets, questStage, startQuest, checkQuests,
  discoverZone, clampVitals, activeQuestId, sceneMatches, questStatus,
  SLOT_COUNT, setSlot, slotInfo, deleteSlot, migrateLegacySave, markVisited, repairBestOf,
} from './state.js';
import { buildZone, TILE } from './world.js';
import {
  createMarkerEntities, createRoamers, updateRoamers, animateEntities, refreshEntity, removeEntity,
} from './entities.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import * as UI from './ui.js';
import { startBattle, closeBattleScreen, isBattleOpen } from './battle.js';
import { startRepair, isRepairOpen, bindRepairUI, repairDebug, REPAIR_TUTORIAL } from './repair.js';
import { initNav, focusFirst } from './nav.js';
import { CHEST_LOOT, requirementText } from './loot.js';
import { settings, loadSettings, applySettings, saveSettings, vibrate } from './settings.js';
import { unlockAudio, sfx, setMusicZone, setSoundEnabled, MAX_OUT } from './audio.js';

const el = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Configuração de reparo por zona: tamanho do tabuleiro, tempo limite (s) e fusíveis
const REPAIR_CFG = {
  cache: { size: 4, timeLimit: 0, fuses: 1 },
  regs: { size: 5, timeLimit: 120, fuses: 1 },
  alu: { size: 5, timeLimit: 0, fuses: 2 },
  pipeline: { size: 6, timeLimit: 90, fuses: 2 },
};

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
let transitioning = false;
let battlePending = false; // evita duas batalhas ao mesmo tempo quando vários glitches encostam
let yaw = 0;
let camDist = 11;
let lastTile = null;
let prompt = null;
let bgYaw = 0;
let talkingEntity = null; // NPC que está falando agora (anima o rosto)
let minimapTick = 0;
// Sinalizadores de depuração usados pelos testes (desligam encontros aleatórios)
const debugFlags = { noEncounters: false };

// ---------- Utilidades ----------
function autosave() {
  if (!running || !player) return;
  const t = player.tile();
  state.pos = { c: t.c, r: t.r };
  saveGame();
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
  if (msgs.length) { UI.toast(msgs.join(' · '), 4200); sfx('chest'); }
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
  hemi.color.set(def.theme.sky);
  setMusicZone(id);

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
    UI.setZoneName(def.name, repairBestOf(id));
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
  if (e.type === 'npc') {
    if (NPCS[e.id]?.shop) return `E · Comprar e vender (${e.name})`;
    return `E · Falar com ${e.name}`;
  }
  if (e.type === 'bench') return 'E · Bancada de criação';
  if (e.type === 'chest') return e.opened ? 'Baú vazio' : 'E · Abrir baú';
  if (e.type === 'repair') return e.fixed ? 'Trilha restaurada' : 'E · Reparar trilha';
  if (e.type === 'boss') {
    if (e.enemy === 'vigia') return hasFlag('ending_paz') || hasFlag('ending_guerra') ? 'O Vigia observa em silêncio' : 'E · Falar com o Vigia';
    return `E · Enfrentar ${ENEMIES[e.enemy].name.split(' —')[0]}`;
  }
  return '';
}

function interact(e) {
  if (e.type === 'npc') {
    const def = NPCS[e.id];
    if (def.shop) return UI.openShop('buy', { title: def.name, onChange: () => UI.updateHud() });
    const sc = def.scenes.find((s) => !s.when || sceneMatches(s.when));
    if (!sc) return;
    const lines = sc.lines.map((l) => ({ s: l.s || def.name, t: l.t }));
    // Cenas genéricas lembram o objetivo atual da missão ativa
    const aid = activeQuestId();
    if (!sc.when && aid) {
      const q = QUESTS[aid];
      lines.push({ s: 'Diário', t: `Objetivo — ${q.title}: ${q.stages[questStage(aid)].text}` });
    }
    talkingEntity = e;
    UI.openDialog(lines, () => { talkingEntity = null; applyActions(sc.actions); });
    return;
  }
  if (e.type === 'bench') {
    return UI.openShop('craft', { title: 'Bancada de criação', onChange: () => UI.updateHud() });
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
    sfx('chest');
    UI.toast(`Baú aberto: ${names.join(', ')} · +${credits} cr`, 3600);
    afterProgress();
    return;
  }
  if (e.type === 'repair') {
    if (hasFlag(`repaired_${e.id}`)) return UI.toast('Esta trilha já foi restaurada.');
    // Primeira vez no reparo: mostra o tutorial antes de abrir o tabuleiro
    if (!hasFlag('tut_repair')) return UI.openDialog(REPAIR_TUTORIAL, () => { setFlag('tut_repair'); interact(e); });
    const cfg = REPAIR_CFG[zone.id] || REPAIR_CFG.cache;
    startRepair({
      size: cfg.size,
      timeLimit: cfg.timeLimit,
      fuses: cfg.fuses,
      zoneId: zone.id,
      title: `Reparo — ${zone.name}`,
      onDone: (ok, score, reason) => {
        if (!ok) { sfx('locked'); return UI.toast(reason === 'timeout' ? 'Tempo esgotado. Tente de novo.' : 'Reparo interrompido.'); }
        setFlag(`repaired_${e.id}`);
        bump(`repair_${zone.id}`);
        UI.setZoneName(zone.name, repairBestOf(zone.id));
        refreshEntity(e);
        const xp = 20 + Math.round(score / 50);
        gainXp(xp);
        state.gold += 10;
        UI.toast(`Trilha restaurada! Pontos: ${score} · +${xp} XP · +10 cr`, 3600);
        afterProgress();
      },
    });
    return;
  }
  if (e.type === 'boss') {
    if (e.enemy === 'vigia') return interactVigia(e);
    const def = ENEMIES[e.enemy];
    UI.openDialog([{ s: def.name, t: def.lore }, { s: 'Bit', t: 'Vou consertar o que você quebrou.' }], () => beginBattle(e.enemy, e));
  }
}

// Confronto com o Vigia: escolha entre paz e guerra
function interactVigia(e) {
  if (hasFlag('ending_paz') || hasFlag('ending_guerra')) return UI.toast('O Vigia observa em silêncio.');
  UI.openDialog(VIGIA_CHOICE, (choice) => {
    if (choice === 'paz') {
      setFlag('choice_paz');
      setFlag('vigia_resolvido');
      setFlag('boss_vigia');
      removeEntity(e, scene);
      playEnding('paz');
    } else {
      setFlag('choice_guerra');
      beginBattle('vigia', e);
    }
  }, VIGIA_CHOICES);
}

function playEnding(kind) {
  const lines = endingLines(kind, state.flags);
  UI.openDialog(lines, () => {
    setFlag(`ending_${kind}`);
    UI.toast(ENDING_RESUME, 4200);
    afterProgress();
  });
}

function afterProgress(extra = {}) {
  const done = [...(extra.done || []), ...checkQuests()];
  if (done.length) { UI.toast(describeRewards(done).join(' · '), 4200); sfx('win'); }
  UI.updateHud();
  UI.updateQuestBox();
  autosave();
}

// ---------- Batalhas ----------
function beginBattle(enemyId, entity) {
  setMusicZone('battle');
  startBattle(enemyId, (result, extra = {}) => {
    closeBattleScreen();
    setMusicZone(zone.id);
    if (result === 'win') {
      if (entity && entity.type === 'boss') { removeEntity(entity, scene); setFlag(`boss_${enemyId}`); }
      player.play('victory');
      if (enemyId === 'vigia') {
        setFlag('vigia_resolvido');
        playEnding('guerra');
        return;
      }
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
      player.play('hurt');
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

// ---------- Portais ----------
function tryPortal(p, prev) {
  if (!meets(p.requires)) {
    sfx('locked');
    UI.toast(requirementText(p.requires), 3200);
    player.setTile(prev.c, prev.r);
    lastTile = prev;
    return;
  }
  transitioning = true;
  sfx('portal');
  UI.fadeTo(() => loadZone(p.to, zone.id)).then(() => { transitioning = false; });
}

// ---------- Menus ----------
function openMainMenu() {
  if (!running || UI.isDialogOpen() || isBattleOpen() || isRepairOpen() || UI.isShopOpen()) return;
  sfx('ui');
  UI.openMenu('status', { refresh: () => { UI.updateHud(); UI.updateQuestBox(); } });
}

function busy() {
  return UI.isDialogOpen() || UI.isMenuOpen() || UI.isShopOpen() || isBattleOpen() || isRepairOpen() || !running || transitioning;
}

input.onKey = (code, type, e) => {
  // N liga e desliga o som
  if (code === 'KeyN' && !e.repeat) {
    setSoundEnabled(!settings.sound);
    saveSettings();
    UI.toast(settings.sound ? 'Som ligado' : 'Som desligado', 1500);
    return true;
  }
  // 1, 2, 3 escolhem nas caixas de diálogo com opções
  if (/^Digit[1-3]$/.test(code) && UI.isDialogOpen()) {
    return UI.chooseByIndex(Number(code.slice(-1)));
  }
  return false;
};
input.onInteract = () => {
  if (UI.isDialogOpen()) return UI.advanceDialog();
  if (!running || busy()) return;
  const e = nearestEntity();
  if (e) interact(e);
};
input.onMenu = () => {
  if (UI.isShopOpen()) return UI.closeShop();
  if (UI.isMenuOpen()) return UI.closeMenu();
  openMainMenu();
};

el('dialog').addEventListener('click', (ev) => {
  // Cliques nos botões de escolha são tratados pela própria UI
  if (ev.target.closest('#dlg-choices button')) return;
  UI.advanceDialog();
});
el('btn-menu').addEventListener('click', openMainMenu);
el('btn-close').addEventListener('click', () => UI.closeMenu());
el('shop-close').addEventListener('click', () => UI.closeShop());
el('btn-save').addEventListener('click', () => {
  autosave();
  sfx('ui');
  UI.toast('Jogo salvo.');
});
UI.bindMenuUI();
UI.bindShopUI();
bindRepairUI();

// ---------- Título ----------
function showScreen(id) {
  for (const s of ['title', 'slots', 'menu', 'battle', 'repair', 'controls', 'shop']) el(s).classList.toggle('hidden', s !== id);
  if (id) focusFirst(`#${id}`);
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

// ---------- Título, slots e áudio ----------
function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '—'; }
}

function startNewGame(n) {
  setSlot(n);
  unlockAudio();
  resetState();
  showScreen(null);
  loadZone(START_ZONE);
  enterGame();
  sfx('ui');
  UI.openDialog(INTRO_TEXT, () => {
    UI.toast('Use WASD/Setas ou o joystick para explorar. N liga e desliga o som.', 3800);
  });
}

function continueGame(n) {
  unlockAudio();
  if (!loadGame(n)) { UI.toast('Este slot não pôde ser lido.'); return; }
  showScreen(null);
  const pos = state.pos && ZONES[state.zone] ? state.pos : null;
  loadZone(ZONES[state.zone] ? state.zone : START_ZONE, null, pos, false);
  enterGame();
}

// Lista os três slots: continuar/novo e apagar (com confirmação em dois cliques)
function renderSlots() {
  const list = el('slots-list');
  list.innerHTML = '';
  for (let n = 1; n <= SLOT_COUNT; n++) {
    const info = slotInfo(n);
    const row = document.createElement('div');
    row.className = 'slot-row';
    const txt = document.createElement('div');
    txt.className = 'info';
    if (info) {
      txt.innerHTML = `<b>Slot ${n}</b><br>`;
      txt.append(`${ZONES[info.zone]?.name || info.zone} · Nv ${info.level} · ${info.gold} cr`);
      txt.append(document.createElement('br'), `Salvo em ${formatDate(info.savedAt)}`);
    } else {
      txt.innerHTML = `<b>Slot ${n}</b><br>Vazio`;
    }
    const acts = document.createElement('div');
    acts.className = 'acts';
    const main = document.createElement('button');
    main.textContent = info ? 'Continuar' : 'Novo jogo';
    main.setAttribute('aria-label', `${main.textContent} no slot ${n}`);
    main.addEventListener('click', () => (info ? continueGame(n) : startNewGame(n)));
    acts.appendChild(main);
    if (info) {
      const del = document.createElement('button');
      del.textContent = 'Apagar';
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Confirmar?';
          setTimeout(() => { armed = false; del.textContent = 'Apagar'; }, 3000);
          return;
        }
        deleteSlot(n);
        UI.toast(`Slot ${n} apagado.`);
        renderSlots();
        focusFirst('#slots');
      });
      acts.appendChild(del);
    }
    row.append(txt, acts);
    list.appendChild(row);
  }
}

el('btn-play').addEventListener('click', () => { renderSlots(); showScreen('slots'); sfx('ui'); });
el('slots-back').addEventListener('click', () => showScreen('title'));
el('btn-controls').addEventListener('click', () => showScreen('controls'));
el('btn-controls-back').addEventListener('click', () => showScreen('title'));

// Desbloqueia o áudio no primeiro gesto (exigência dos navegadores)
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });
window.addEventListener('keydown', () => unlockAudio(), { once: true });

// Aviso no título sobre progresso salvo
function refreshTitle() {
  const any = [1, 2, 3].some((n) => hasSave(n));
  el('title-hint').textContent = any
    ? 'Há progresso salvo neste navegador. Escolha um slot para continuar.'
    : 'Até três jogos separados ficam salvos neste navegador.';
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
    if (player.moving && player.consumeStep()) sfx('step');

    const tile = player.tile();
    if (tile.c !== lastTile.c || tile.r !== lastTile.r) {
      const portal = zone.portals.find((p) => p.c === tile.c && p.r === tile.r);
      lastTile = tile;
      if (portal) tryPortal(portal, prev);
    }

    // Glitches que perseguem
    const hits = updateRoamers(roamers, zone, { x: player.x, z: player.z }, dt, now);
    if (hits.length && !isBattleOpen() && !battlePending && !debugFlags.noEncounters) {
      const rm = hits[0];
      rm.alive = false;
      scene.remove(rm.obj);
      battlePending = true;
      player.play('attack');
      setTimeout(() => { battlePending = false; beginBattle(rm.enemy, null); }, 380);
    }
  } else {
    player.update(dt, { moveX: 0, moveY: 0 }, zone, now);
    updateRoamers(roamers, zone, { x: player.x, z: player.z }, 0, now);
  }

  // Áreas visitadas (minimapa) e expressões
  const pt = player.tile();
  markVisited(zone.id, pt.c, pt.r);
  if (++minimapTick % 6 === 0) UI.drawMinimap(zone, pt);
  player.talking = UI.isDialogOpen();
  for (const en of entities) en.talk = en === talkingEntity && UI.isDialogOpen();

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
  get transitioning() { return transitioning; },
  flags: debugFlags,
  audio: () => ({ maxOut: MAX_OUT, music: settings.volMusic, sfx: settings.volSfx, captions: settings.captions }),
  zoneFloor: () => (zone ? zone.theme.trace : null),
};

// Ajustes salvos, aplicados antes de desenhar a tela
loadSettings();
applySettings();
migrateLegacySave();
initNav();

focusFirst('#title');

// Carrega o fundo do título e inicia o laço
loadZone(START_ZONE, null, null, true);
refreshTitle();
showScreen('title');
requestAnimationFrame((t) => { last = t; frame(t); });

window.addEventListener('beforeunload', () => autosave());

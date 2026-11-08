// Interface: HUD, diálogos com efeito de digitação, notificações e menus.
import { state, maxHp, maxEn, atk, def, xpForLevel, questStatus, questStage, useConsumable, equip, activeQuestId } from './state.js';
import { ITEMS, RARITY, QUESTS, QUEST_ORDER, CODEX } from './data/content.js';
import { drawItemIcon } from './textures.js';

const el = (id) => document.getElementById(id);

// ---------- HUD ----------
export function updateHud() {
  const hp = maxHp(), en = maxEn();
  el('bar-hp').style.width = `${(state.hp / hp) * 100}%`;
  el('bar-en').style.width = `${(state.en / en) * 100}%`;
  const need = xpForLevel(state.level);
  el('bar-xp').style.width = `${(state.xp / need) * 100}%`;
  el('txt-hp').textContent = `${Math.ceil(state.hp)}/${hp}`;
  el('txt-en').textContent = `${Math.floor(state.en)}/${en}`;
  el('txt-xp').textContent = `${state.xp}/${need}`;
  el('txt-lvl').textContent = `Nv ${state.level} · ${state.gold} cr`;
}

export function setZoneName(name) {
  el('zone-name').textContent = name;
}

export function updateQuestBox() {
  const id = activeQuestId();
  if (!id) {
    el('quest-title').textContent = 'Sem missão ativa';
    el('quest-obj').textContent = 'Explore o processador.';
    return;
  }
  const q = QUESTS[id];
  const idx = questStage(id);
  el('quest-title').textContent = q.title;
  el('quest-obj').textContent = q.stages[Math.min(idx, q.stages.length - 1)].text;
}

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- Diálogo ----------
let dlg = null;

export function isDialogOpen() {
  return !!dlg;
}

// Abre diálogo: lines = [{s, t}], onDone chamado ao terminar.
export function openDialog(lines, onDone) {
  dlg = { lines, i: 0, typing: null, onDone, full: false };
  el('dialog').classList.remove('hidden');
  showLine();
}

function showLine() {
  const line = dlg.lines[dlg.i];
  el('dlg-name').textContent = line.s;
  const text = el('dlg-text');
  text.textContent = '';
  const full = line.t;
  let k = 0;
  dlg.full = false;
  clearInterval(dlg.typing);
  dlg.typing = setInterval(() => {
    k += 2;
    text.textContent = full.slice(0, k);
    if (k >= full.length) { clearInterval(dlg.typing); dlg.full = true; }
  }, 22);
}

export function advanceDialog() {
  if (!dlg) return;
  if (!dlg.full) {
    clearInterval(dlg.typing);
    el('dlg-text').textContent = dlg.lines[dlg.i].t;
    dlg.full = true;
    return;
  }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) {
    const cb = dlg.onDone;
    dlg = null;
    el('dialog').classList.add('hidden');
    cb && cb();
  } else {
    showLine();
  }
}

// ---------- Notificações ----------
export function showRewardToast(reward) {
  const parts = [];
  if (reward.xp) parts.push(`+${reward.xp} XP`);
  if (reward.gold) parts.push(`+${reward.gold} cr`);
  for (const [id, n] of reward.items || []) parts.push(`${ITEMS[id].name} ×${n}`);
  return parts.join(' · ');
}

// ---------- Menu ----------
let menuTab = 'status';
let menuActions = {};

export function openMenu(tab, actions = {}) {
  menuActions = actions;
  if (tab) menuTab = tab;
  el('menu').classList.remove('hidden');
  renderMenu();
}

export function closeMenu() {
  el('menu').classList.add('hidden');
}

export function isMenuOpen() {
  return !el('menu').classList.contains('hidden');
}

function iconCanvas(id) {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 80;
  drawItemIcon(c, ITEMS[id].glyph, ITEMS[id].color);
  return c;
}

function renderMenu() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === menuTab));
  const body = el('menu-body');
  body.innerHTML = '';
  if (menuTab === 'status') renderStatus(body);
  if (menuTab === 'inv') renderInventory(body);
  if (menuTab === 'quests') renderQuests(body);
  if (menuTab === 'codex') renderCodex(body);
}

function row(label, value) {
  const d = document.createElement('div');
  d.innerHTML = `${label}<span></span>`;
  d.querySelector('span').textContent = value;
  return d;
}

function renderStatus(body) {
  const g = document.createElement('div');
  g.className = 'stat-grid';
  const w = state.equip.weapon ? ITEMS[state.equip.weapon].name : '—';
  const a = state.equip.armor ? ITEMS[state.equip.armor].name : '—';
  g.append(
    row('Nível', state.level),
    row('XP', `${state.xp}/${xpForLevel(state.level)}`),
    row('Integridade (HP)', `${Math.ceil(state.hp)}/${maxHp()}`),
    row('Energia (EN)', `${Math.floor(state.en)}/${maxEn()}`),
    row('Ataque', atk()),
    row('Defesa', def()),
    row('Créditos', state.gold),
    row('Missões concluídas', QUEST_ORDER.filter((id) => questStatus(id) === 'done').length),
  );
  body.appendChild(g);
  const eq = document.createElement('p');
  eq.className = 'hint';
  eq.style.textAlign = 'left';
  eq.textContent = `Arma: ${w} · Armadura: ${a}`;
  body.appendChild(eq);
}

function renderInventory(body) {
  const ids = Object.keys(state.inv);
  if (!ids.length) {
    body.innerHTML = '<p class="hint">Inventário vazio.</p>';
    return;
  }
  for (const id of ids) {
    const it = ITEMS[id];
    const r = document.createElement('div');
    r.className = 'item-row';
    r.appendChild(iconCanvas(id));
    const info = document.createElement('div');
    info.className = 'grow';
    info.innerHTML = `<div class="rarity-${it.rarity}"></div><div class="desc"></div>`;
    info.firstChild.textContent = `${it.name} ×${state.inv[id]} · ${RARITY[it.rarity].label}`;
    info.lastChild.textContent = it.desc;
    r.appendChild(info);
    if (it.slot === 'consumable') {
      const b = document.createElement('button');
      b.textContent = 'Usar';
      b.addEventListener('click', () => {
        const res = useConsumable(id);
        if (res) toast(`${it.name}: ${res}`);
        renderMenu();
        menuActions.refresh && menuActions.refresh();
      });
      r.appendChild(b);
    } else if (it.slot === 'weapon' || it.slot === 'armor') {
      const b = document.createElement('button');
      b.textContent = 'Equipar';
      b.addEventListener('click', () => {
        if (equip(id)) toast(`${it.name} equipado.`);
        renderMenu();
        menuActions.refresh && menuActions.refresh();
      });
      r.appendChild(b);
    }
    body.appendChild(r);
  }
}

function renderQuests(body) {
  for (const id of QUEST_ORDER) {
    const q = QUESTS[id];
    const st = questStatus(id);
    if (st === 'none') {
      const p = document.createElement('p');
      p.className = 'hint';
      p.style.textAlign = 'left';
      p.textContent = '??? — missão não descoberta';
      body.appendChild(p);
      continue;
    }
    const e = document.createElement('div');
    e.className = `quest-entry${st === 'done' ? ' done' : ''}`;
    const idx = questStage(id);
    const lines = q.stages.map((s, i) => {
      const mark = i < idx || st === 'done' ? '✔' : i === idx ? '▶' : '·';
      return `${mark} ${s.text}`;
    }).join('<br>');
    e.innerHTML = `<b></b><small>${st === 'done' ? 'Concluída' : 'Em andamento'}</small><div style="margin-top:6px;font-size:13px;line-height:1.5"></div>`;
    e.querySelector('b').textContent = q.title;
    e.querySelector('div').innerHTML = lines;
    body.appendChild(e);
  }
}

function renderCodex(body) {
  const zones = Object.entries(CODEX.zones).filter(([k]) => state.codex.zones[k]);
  const enemies = Object.entries(CODEX.enemies).filter(([k]) => state.codex.enemies[k]);
  if (!zones.length && !enemies.length) {
    body.innerHTML = '<p class="hint">Explore o processador para preencher o códex.</p>';
    return;
  }
  for (const [, txt] of zones) {
    const p = document.createElement('p');
    p.className = 'codex-entry';
    p.textContent = txt;
    body.appendChild(p);
  }
  for (const [, txt] of enemies) {
    const p = document.createElement('p');
    p.className = 'codex-entry';
    p.textContent = `Glitch: ${txt}`;
    body.appendChild(p);
  }
}

// Ligações de abas
export function bindMenuUI() {
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => { menuTab = b.dataset.tab; renderMenu(); });
  });
}


// Interface: HUD, diálogos com escolhas, notificações, menus, loja, bancada e ajustes.
import {
  state, maxHp, maxEn, atk, def, xpForLevel, questStatus, questStage, useConsumable, equip,
  activeQuestId, skillLevel, spendSkillPoint, skillCost, buyPrice, buyItem, sellPrice, sellItem,
  canCraft, craft,
} from './state.js';
import { ITEMS, RARITY, QUESTS, QUEST_ORDER, CODEX, SKILL_TREE, SKILLS, RECIPES, SHOP } from './data/content.js';
import { drawItemIcon } from './textures.js';
import { settings, saveSettings, applySettings, TEXT_SIZES, announce } from './settings.js';
import { setSoundEnabled, setVolume, sfx } from './audio.js';
import { focusFirst } from './nav.js';
import { isVisited } from './state.js';

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
  el('txt-lvl').textContent = `Nv ${state.level} · ${state.gold} cr${state.skillPoints ? ` · ◆${state.skillPoints}` : ''}`;
}

export function setZoneName(name, best = 0) {
  el('zone-name').textContent = best ? `${name} · ★ ${best}` : name;
}

// Minimapa: só mostra o que o jogador já visitou (névoa de guerra)
export function drawMinimap(zone, tile) {
  const c = el('minimap');
  if (!c || !zone) return;
  const g = c.getContext('2d');
  const cw = c.width / zone.cols, ch = c.height / zone.rows;
  g.fillStyle = '#04111a';
  g.fillRect(0, 0, c.width, c.height);
  const portals = new Set(zone.portals.map((p) => `${p.c},${p.r}`));
  for (let r = 0; r < zone.rows; r++) {
    for (let col = 0; col < zone.cols; col++) {
      if (!isVisited(zone.id, col, r)) continue;
      const k = zone.map[r][col];
      if (k === '#') g.fillStyle = '#2a3a48';
      else if (k === '~') g.fillStyle = '#1b6f80';
      else if (k === '_') g.fillStyle = '#000000';
      else g.fillStyle = zone.theme.trace + '66';
      g.fillRect(col * cw, r * ch, cw, ch);
      if (portals.has(`${col},${r}`)) {
        g.fillStyle = zone.theme.accent;
        g.fillRect(col * cw + cw * 0.25, r * ch + ch * 0.25, cw * 0.5, ch * 0.5);
      }
    }
  }
  if (tile) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc((tile.c + 0.5) * cw, (tile.r + 0.5) * ch, Math.max(3, cw * 0.45), 0, Math.PI * 2); g.fill();
  }
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
  el('quest-title').textContent = q.side ? `${q.title} (extra)` : q.title;
  el('quest-obj').textContent = q.stages[Math.min(idx, q.stages.length - 1)].text;
}

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  announce(msg);
}

// Transição: escurece, executa a troca (ex.: carregar zona) e clareia
export function fadeTo(fn) {
  const f = el('fade');
  f.classList.add('on');
  return new Promise((resolve) => {
    setTimeout(() => {
      try { fn(); } finally {
        setTimeout(() => { f.classList.remove('on'); resolve(); }, 60);
      }
    }, 300);
  });
}

// ---------- Diálogo ----------
let dlg = null;

export function isDialogOpen() {
  return !!dlg;
}

// Abre diálogo: lines = [{s, t}]. Se "choices" for dado, ao fim aparecem as opções
// [{ label, value }] e onDone(value) é chamado com a escolha.
export function openDialog(lines, onDone, choices = null) {
  dlg = { lines, i: 0, typing: null, onDone, full: false, choices };
  el('dialog').classList.remove('hidden');
  showLine();
}

function showLine() {
  const line = dlg.lines[dlg.i];
  el('dlg-name').textContent = line.s;
  el('dlg-choices').classList.add('hidden');
  el('dlg-choices').innerHTML = '';
  el('dlg-next').classList.remove('hidden');
  const text = el('dlg-text');
  text.textContent = '';
  const full = line.t;
  let k = 0;
  dlg.full = false;
  clearInterval(dlg.typing);
  dlg.typing = setInterval(() => {
    k += 2;
    text.textContent = full.slice(0, k);
    if (k >= full.length) { clearInterval(dlg.typing); dlg.full = true; onLineDone(); }
  }, 22);
}

// Ao terminar de digitar a última linha de um diálogo com escolhas, mostra os botões
function onLineDone() {
  if (!dlg || !dlg.choices || dlg.i < dlg.lines.length - 1) return;
  showChoices();
}

function showChoices() {
  const box = el('dlg-choices');
  box.innerHTML = '';
  dlg.choices.forEach((c, idx) => {
    const b = document.createElement('button');
    b.textContent = `${idx + 1}. ${c.label}`;
    b.addEventListener('click', (e) => { e.stopPropagation(); pickChoice(c.value); });
    box.appendChild(b);
  });
  box.classList.remove('hidden');
  el('dlg-next').classList.add('hidden');
  box.firstChild && box.firstChild.focus();
  sfx('choice');
}

function pickChoice(value) {
  if (!dlg) return;
  const cb = dlg.onDone;
  dlg = null;
  el('dialog').classList.add('hidden');
  cb && cb(value);
}

// Tecla numérica escolhe uma opção quando o diálogo está em modo de escolha
export function chooseByIndex(n) {
  if (!dlg || !dlg.choices || !dlg.full) return false;
  const c = dlg.choices[n - 1];
  if (!c) return false;
  pickChoice(c.value);
  return true;
}

// Fala atual (para escolher a expressão do rosto)
export function currentLine() {
  return dlg ? dlg.lines[dlg.i] : null;
}

export function advanceDialog() {
  if (!dlg) return;
  if (!dlg.full) {
    clearInterval(dlg.typing);
    el('dlg-text').textContent = dlg.lines[dlg.i].t;
    dlg.full = true;
    onLineDone();
    return;
  }
  // Com escolhas na tela, avançar não escolhe por você
  if (dlg.choices && dlg.i === dlg.lines.length - 1) return;
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
  focusFirst('#menu .tab.active');
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
  document.querySelectorAll('.tab[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === menuTab);
    b.setAttribute('aria-selected', String(b.dataset.tab === menuTab));
  });
  const body = el('menu-body');
  body.innerHTML = '';
  if (menuTab === 'status') renderStatus(body);
  if (menuTab === 'inv') renderInventory(body);
  if (menuTab === 'skills') renderSkills(body);
  if (menuTab === 'quests') renderQuests(body);
  if (menuTab === 'codex') renderCodex(body);
  if (menuTab === 'config') renderConfig(body);
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
    row('Pontos de habilidade', state.skillPoints),
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

function renderSkills(body) {
  const p = document.createElement('p');
  p.className = 'hint';
  p.style.textAlign = 'left';
  p.textContent = `Pontos disponíveis: ${state.skillPoints}. Cada nível concede 1 ponto.`;
  body.appendChild(p);
  for (const node of SKILL_TREE) {
    const lv = skillLevel(node.id);
    const r = document.createElement('div');
    r.className = 'skill-row';
    r.innerHTML = '<div class="grow"><div></div><div class="desc"></div><div class="pips"></div></div>';
    r.querySelector('.grow > div').textContent = `${node.name} (${lv}/${node.max})`;
    r.querySelector('.desc').textContent = node.desc;
    r.querySelector('.pips').textContent = '◆'.repeat(lv) + '◇'.repeat(node.max - lv);
    const b = document.createElement('button');
    b.textContent = '+1';
    b.disabled = state.skillPoints <= 0 || lv >= node.max;
    b.addEventListener('click', () => {
      if (spendSkillPoint(node.id)) {
        toast(`${node.name} aumentou.`);
        sfx('ui');
        renderMenu();
        menuActions.refresh && menuActions.refresh();
      }
    });
    r.appendChild(b);
    body.appendChild(r);
  }
  const s = document.createElement('p');
  s.className = 'hint';
  s.style.textAlign = 'left';
  s.textContent = 'Habilidades de combate:';
  body.appendChild(s);
  for (const sk of SKILLS) {
    const d = document.createElement('div');
    d.className = 'codex-entry';
    d.innerHTML = '<b></b>';
    d.querySelector('b').textContent = `${sk.name}`;
    d.append(` — Nv ${sk.level}, custo ${skillCost(sk)} EN. ${sk.desc}`);
    body.appendChild(d);
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
    e.innerHTML = `<b></b><small>${q.side ? 'Extra · ' : ''}${st === 'done' ? 'Concluída' : 'Em andamento'}</small><div style="margin-top:6px;font-size:13px;line-height:1.5"></div>`;
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

function setting(label, desc, buttonLabel, onClick) {
  const r = document.createElement('div');
  r.className = 'setting-row';
  r.innerHTML = '<div class="grow"><div></div><div class="desc"></div></div>';
  r.querySelector('.grow > div').textContent = label;
  r.querySelector('.desc').textContent = desc;
  const b = document.createElement('button');
  b.textContent = buttonLabel;
  b.addEventListener('click', onClick);
  r.appendChild(b);
  return r;
}

function renderConfig(body) {
  const textName = { normal: 'Normal', lg: 'Grande', xl: 'Muito grande' };
  body.appendChild(setting('Som', 'Efeitos e trilha procedural. Atalho: N.', settings.sound ? 'Ligado' : 'Desligado', () => {
    settings.sound = !settings.sound;
    setSoundEnabled(settings.sound);
    saveSettings();
    renderMenu();
  }));
  body.appendChild(setting('Vibração', 'Pulsos em golpes e reparos (celulares).', settings.vibe ? 'Ligada' : 'Desligada', () => {
    settings.vibe = !settings.vibe;
    saveSettings();
    renderMenu();
  }));
  body.appendChild(setting('Tamanho do texto', 'Aumenta diálogos, painéis e batalhas.', textName[settings.text], () => {
    const i = TEXT_SIZES.indexOf(settings.text);
    settings.text = TEXT_SIZES[(i + 1) % TEXT_SIZES.length];
    applySettings();
    saveSettings();
    renderMenu();
  }));
  const pct = (v) => `${Math.round(v * 100)}%`;
  const nextVol = (v) => (v >= 1 ? 0 : v >= 0.5 ? 1 : 0.5);
  body.appendChild(setting('Volume da trilha', 'Música de fundo e de batalha.', pct(settings.volMusic), () => {
    setVolume('music', nextVol(settings.volMusic));
    saveSettings();
    renderMenu();
  }));
  body.appendChild(setting('Volume dos efeitos', 'Passos, golpes, baús e vitória.', pct(settings.volSfx), () => {
    setVolume('sfx', nextVol(settings.volSfx));
    saveSettings();
    renderMenu();
  }));
  body.appendChild(setting('Legendas visuais', 'Mostra na tela os sons importantes (baú, vitória, bloqueio).', settings.captions ? 'Ligadas' : 'Desligadas', () => {
    settings.captions = !settings.captions;
    saveSettings();
    renderMenu();
  }));
  body.appendChild(setting('Alto contraste', 'Fundo preto, bordas e textos de alto contraste.', settings.hc ? 'Ligado' : 'Desligado', () => {
    settings.hc = !settings.hc;
    applySettings();
    saveSettings();
    renderMenu();
  }));
  const p = document.createElement('p');
  p.className = 'hint';
  p.style.textAlign = 'left';
  p.textContent = 'Atalhos: M/Esc menu · N som · E/Espaço ação · 1, 2, 3 escolhas nos diálogos.';
  body.appendChild(p);
}

// Ligações de abas
export function bindMenuUI() {
  document.querySelectorAll('.tab[data-tab]').forEach((b) => {
    b.addEventListener('click', () => { menuTab = b.dataset.tab; renderMenu(); b.focus(); });
  });
}

// ---------- Loja e bancada ----------
let shopMode = 'buy';
let shopActions = {};

export function openShop(mode, { title = 'Caixa de Peças', onChange } = {}) {
  shopMode = mode || 'buy';
  shopActions = { onChange };
  el('shop-title').textContent = title;
  el('shop').classList.remove('hidden');
  renderShop();
  focusFirst('#shop .tab.active');
}

export function closeShop() {
  el('shop').classList.add('hidden');
}

export function isShopOpen() {
  return !el('shop').classList.contains('hidden');
}

function renderShop() {
  document.querySelectorAll('.tab[data-shop]').forEach((b) => {
    b.classList.toggle('active', b.dataset.shop === shopMode);
  });
  el('shop-gold').textContent = `Seus créditos: ${state.gold} cr`;
  const body = el('shop-body');
  body.innerHTML = '';
  const refresh = () => { renderShop(); shopActions.onChange && shopActions.onChange(); };

  if (shopMode === 'buy') {
    for (const [id, price] of Object.entries(SHOP)) {
      const it = ITEMS[id];
      const r = document.createElement('div');
      r.className = 'item-row';
      r.appendChild(iconCanvas(id));
      const info = document.createElement('div');
      info.className = 'grow';
      info.innerHTML = '<div></div><div class="desc"></div>';
      info.firstChild.textContent = it.name;
      info.lastChild.textContent = it.desc;
      r.appendChild(info);
      const pr = document.createElement('div');
      pr.className = 'shop-price';
      pr.textContent = `${buyPrice(id) ?? price} cr`;
      r.appendChild(pr);
      const b = document.createElement('button');
      b.textContent = 'Comprar';
      b.disabled = state.gold < price;
      b.addEventListener('click', () => {
        if (buyItem(id)) { toast(`Comprado: ${it.name}`); sfx('chest'); } else { sfx('locked'); }
        refresh();
      });
      r.appendChild(b);
      body.appendChild(r);
    }
    return;
  }

  if (shopMode === 'sell') {
    const ids = Object.keys(state.inv).filter((id) => sellPrice(id) > 0);
    if (!ids.length) { body.innerHTML = '<p class="hint">Nada para vender.</p>'; return; }
    for (const id of ids) {
      const it = ITEMS[id];
      const r = document.createElement('div');
      r.className = 'item-row';
      r.appendChild(iconCanvas(id));
      const info = document.createElement('div');
      info.className = 'grow';
      info.innerHTML = '<div></div><div class="desc"></div>';
      info.firstChild.textContent = `${it.name} ×${state.inv[id]}`;
      info.lastChild.textContent = RARITY[it.rarity].label;
      r.appendChild(info);
      const pr = document.createElement('div');
      pr.className = 'shop-price';
      pr.textContent = `+${sellPrice(id)} cr`;
      r.appendChild(pr);
      const b = document.createElement('button');
      b.textContent = 'Vender 1';
      b.addEventListener('click', () => {
        const got = sellItem(id);
        if (got) toast(`Vendido: ${it.name} (+${got} cr)`);
        refresh();
      });
      r.appendChild(b);
      body.appendChild(r);
    }
    return;
  }

  // Bancada de criação
  for (const rec of RECIPES) {
    const it = ITEMS[rec.id];
    const r = document.createElement('div');
    r.className = 'item-row';
    r.appendChild(iconCanvas(rec.id));
    const info = document.createElement('div');
    info.className = 'grow';
    info.innerHTML = '<div></div><div class="desc"></div><div class="recipe-need"></div>';
    info.firstChild.textContent = `${it.name}${rec.qty > 1 ? ` ×${rec.qty}` : ''}`;
    info.children[1].textContent = it.desc;
    const need = info.children[2];
    need.innerHTML = Object.entries(rec.need).map(([mid, n]) => {
      const have = state.inv[mid] || 0;
      return `<span class="${have >= n ? 'ok' : 'miss'}">${ITEMS[mid].name} ${have}/${n}</span>`;
    }).join(' · ');
    r.appendChild(info);
    const b = document.createElement('button');
    b.textContent = 'Criar';
    b.disabled = !canCraft(rec);
    b.addEventListener('click', () => {
      if (craft(rec)) { toast(`Criado: ${it.name}`); sfx('repair'); }
      refresh();
    });
    r.appendChild(b);
    body.appendChild(r);
  }
}

export function bindShopUI() {
  document.querySelectorAll('.tab[data-shop]').forEach((b) => {
    b.addEventListener('click', () => { shopMode = b.dataset.shop; renderShop(); });
  });
}

// Uso de outras partes do jogo
export function sellableCount() {
  return Object.keys(state.inv).filter((id) => sellPrice(id) > 0).length;
}

export { SHOP, skillLevel, def };

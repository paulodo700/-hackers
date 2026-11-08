// Batalha por turnos: Ataque, Habilidades, Itens, Defender e Fugir.
// Inimigos mostram a intenção do próximo golpe. Chefes ganham uma segunda fase ao cair a 50% de vida.
import { ENEMIES, SKILLS, ITEMS, RARITY } from './data/content.js';
import {
  state, atk, def, maxHp, maxEn, clampVitals, gainXp, addItem, skillCost, skillLevel,
  useConsumable, bump, discoverEnemy, setFlag, checkQuests,
} from './state.js';
import { drawEnemyArt } from './textures.js';
import { sfx } from './audio.js';
import { vibrate } from './settings.js';

const el = (id) => document.getElementById(id);
let active = null;
let raf = 0;

function rand(a, b) { return a + Math.random() * (b - a); }

function log(text, cls = '') {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.textContent = text;
  const box = el('battle-log');
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

function bars() {
  const b = active;
  if (b) el('en-hp').style.width = `${Math.max(0, (b.eHp / b.def.hp) * 100)}%`;
  el('pl-hp').style.width = `${Math.max(0, (state.hp / maxHp()) * 100)}%`;
  el('pl-en').style.width = `${Math.max(0, (state.en / maxEn()) * 100)}%`;
}

// Números flutuantes sobre o inimigo (side='enemy') ou sobre o jogador (side='player')
function popup(text, kind = '', side = 'enemy') {
  const layer = el('dmg-layer');
  if (!layer) return;
  const d = document.createElement('div');
  d.className = `dmg ${kind}`;
  d.textContent = text;
  d.style.left = `${40 + rand(-12, 12)}%`;
  d.style.top = side === 'enemy' ? `${18 + rand(-4, 4)}%` : `${62 + rand(-4, 4)}%`;
  layer.appendChild(d);
  setTimeout(() => d.remove(), 950);
}

function shakeBattle(heavy = false) {
  const w = el('battle-wrap');
  w.classList.remove('shake', 'flash');
  void w.offsetWidth; // reinicia a animação
  w.classList.add('shake');
  if (heavy) w.classList.add('flash');
  setTimeout(() => w.classList.remove('shake', 'flash'), 450);
}

function hitEnemyArt() {
  const c = el('enemy-art');
  c.classList.remove('hit');
  void c.offsetWidth;
  c.classList.add('hit');
  setTimeout(() => c.classList.remove('hit'), 380);
}

function drawLoop(t) {
  if (!active) return;
  drawEnemyArt(el('enemy-art'), active.def.glyph, active.def.color, t);
  raf = requestAnimationFrame(drawLoop);
}

function cmd(label, onClick, disabled = false, title = '') {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = disabled;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

// ---- Intenção do inimigo ----
// Escolhe o próximo golpe e mostra ao jogador antes da sua escolha.
const INTENTS = {
  normal: { text: 'Vai atacar.', mult: 1 },
  pesado: { text: '⚠ Prepara um golpe pesado!', mult: 1.8 },
  reparar: { text: 'Vai se reparar (+15 HP).', mult: 0 },
};

function pickIntent() {
  const e = active.def;
  if (active.phase2 && Math.random() < 0.4) return 'pesado';
  if (e.boss && active.eHp < e.hp * 0.3 && Math.random() < 0.35) return 'reparar';
  return Math.random() < 0.22 ? 'pesado' : 'normal';
}

function showIntent() {
  const i = INTENTS[active.intent];
  el('en-intent').textContent = i.text;
}

function renderCmds() {
  const box = el('battle-cmds');
  box.innerHTML = '';
  if (!active || active.busy || active.over) return;
  if (active.menu === 'skills') {
    for (const s of SKILLS) {
      const ok = state.level >= s.level;
      const cost = skillCost(s);
      const can = ok && state.en >= cost;
      const label = ok ? `${s.name} (${cost} EN)` : `${s.name} (Nv ${s.level})`;
      box.appendChild(cmd(label, () => playerSkill(s), !can, s.desc));
    }
    box.appendChild(cmd('← Voltar', () => { active.menu = 'main'; renderCmds(); }));
    return;
  }
  if (active.menu === 'items') {
    const consumables = Object.keys(state.inv).filter((id) => ITEMS[id]?.slot === 'consumable');
    if (!consumables.length) log('Nenhum item disponível.', 'muted');
    for (const id of consumables) {
      const it = ITEMS[id];
      box.appendChild(cmd(`${it.name} ×${state.inv[id]}`, () => playerItem(id), false, it.desc));
    }
    box.appendChild(cmd('← Voltar', () => { active.menu = 'main'; renderCmds(); }));
    return;
  }
  box.appendChild(cmd('Atacar', () => playerAttack()));
  box.appendChild(cmd('Habilidades', () => { active.menu = 'skills'; renderCmds(); }));
  box.appendChild(cmd('Itens', () => { active.menu = 'items'; renderCmds(); }));
  box.appendChild(cmd('Defender', () => playerDefend(), false, 'Reduz o dano do próximo ataque e recupera 5 EN.'));
  box.appendChild(cmd('Fugir', () => playerFlee(), active.def.boss, active.def.boss ? 'Chefes não permitem fuga.' : 'Chance de escapar.'));
}

function dmgFrom(attack, defense, mult = 1) {
  const base = attack * mult - defense * 0.6;
  return Math.max(1, Math.round(base * rand(0.9, 1.1)));
}

function damageEnemy(d, label, kind = '') {
  active.eHp -= d;
  hitEnemyArt();
  popup(`-${d}`, kind, 'enemy');
  sfx(kind === 'crit' ? 'heavy' : 'hit');
  bars();
  return d;
}

function playerAttack() {
  active.menu = 'main';
  const d = dmgFrom(atk(), active.def.def, 1);
  log(`Você ataca e causa ${d} de dano.`);
  damageEnemy(d, 'ataque');
  afterPlayerAction();
}

function playerSkill(s) {
  active.menu = 'main';
  state.en -= skillCost(s);
  if (s.heal) {
    const before = state.hp;
    state.hp = Math.min(maxHp(), state.hp + s.heal);
    const gained = state.hp - before;
    log(`${s.name}: você recupera ${gained} HP.`, 'good');
    popup(`+${gained}`, 'heal', 'player');
    sfx('heal');
  } else {
    const defn = active.def.def * (1 - (s.pierce || 0));
    const d = dmgFrom(atk(), defn, s.mult);
    log(`${s.name} causa ${d} de dano!`, 'hit');
    damageEnemy(d, s.id, s.mult >= 2 ? 'crit' : '');
    if (s.mult >= 2) shakeBattle(false);
  }
  afterPlayerAction();
}

function playerItem(id) {
  active.menu = 'main';
  const res = useConsumable(id);
  if (res === null) { log('Item indisponível.', 'muted'); renderCmds(); return; }
  log(`Você usa ${ITEMS[id].name}: ${res}.`, 'good');
  popup('✚', 'heal', 'player');
  sfx('heal');
  afterPlayerAction();
}

function playerDefend() {
  active.menu = 'main';
  active.guard = true;
  state.en = Math.min(maxEn(), state.en + 5);
  log('Você se protege. O próximo golpe será reduzido.', 'muted');
  sfx('ui');
  afterPlayerAction();
}

function playerFlee() {
  active.menu = 'main';
  if (active.def.boss) return;
  if (Math.random() < 0.55) {
    log('Você escapa pelas trilhas!', 'muted');
    endBattle('flee');
  } else {
    log('Não conseguiu fugir!', 'muted');
    enemyTurn();
  }
}

function afterPlayerAction() {
  bars();
  if (active.eHp <= 0) return victory();
  // Segunda fase: chefe com menos da metade da vida
  if (active.def.boss && !active.phase2 && active.eHp <= active.def.hp * 0.5) {
    active.phase2 = true;
    el('enemy-art').classList.add('phase2');
    log(`${active.def.name} entra na FASE 2! Ataque aumentado.`, 'hit');
    sfx('heavy');
    shakeBattle(true);
    vibrate([60, 40, 60]);
  }
  active.busy = true;
  renderCmds();
  setTimeout(enemyTurn, 650);
}

function enemyTurn() {
  if (!active || active.over) return;
  const e = active.def;
  const intent = active.intent;
  if (intent === 'reparar') {
    const heal = Math.min(15, e.hp - active.eHp);
    active.eHp += heal;
    log(`${e.name} se repara (+${heal} de vida).`, 'muted');
    popup(`+${heal}`, 'heal', 'enemy');
    sfx('heal');
    bars();
  } else {
    const mult = INTENTS[intent].mult * (active.phase2 ? 1.15 : 1);
    let d = dmgFrom(e.atk, def(), mult);
    if (active.guard) { d = Math.max(1, Math.round(d * 0.45)); active.guard = false; }
    state.hp -= d;
    const heavy = intent === 'pesado';
    log(heavy ? `${e.name} acerta um golpe pesado: ${d} de dano!` : `${e.name} ataca e causa ${d} de dano.`, 'hurt');
    popup(`-${d}`, heavy ? 'crit' : 'hurt', 'player');
    sfx(heavy ? 'heavy' : 'hurt');
    shakeBattle(heavy);
    vibrate(heavy ? [80, 40, 80] : 40);
    clampVitals();
    bars();
    if (state.hp <= 0) return defeat();
  }
  // Próxima intenção
  active.intent = pickIntent();
  showIntent();
  active.busy = false;
  renderCmds();
}

function victory() {
  const e = active.def;
  active.over = true;
  el('en-intent').textContent = '';
  log(`${e.name} foi derrotado!`, 'good');
  const ups = gainXp(e.xp);
  state.gold += e.gold;
  log(`+${e.xp} XP, +${e.gold} créditos.`, 'good');
  if (ups) log(`Nível ${state.level}! Vitalidade e energia restauradas.`, 'good');
  const drops = [];
  for (const dr of e.drops || []) {
    if (Math.random() < dr.chance) {
      addItem(dr.item, 1);
      drops.push(dr.item);
    }
  }
  for (const id of drops) {
    const it = ITEMS[id];
    log(`Encontrado: ${it.name} (${RARITY[it.rarity].label}).`, 'good');
  }
  bump(`kill_${active.enemyId}`, 1);
  if (e.boss) setFlag(`boss_${active.enemyId}`);
  discoverEnemy(active.enemyId);
  const done = checkQuests();
  sfx('win');
  endBattle('win', { ups, drops, done });
}

function defeat() {
  active.over = true;
  el('en-intent').textContent = '';
  log('Seus sistemas caíram...', 'hurt');
  sfx('lose');
  endBattle('lose');
}

function endBattle(result, extra = {}) {
  if (!active) return;
  const cb = active.onEnd;
  cancelAnimationFrame(raf);
  bars(); // atualiza as barras enquanto "active" ainda existe
  active = null;
  el('enemy-art').classList.remove('phase2');
  const box = el('battle-cmds');
  box.innerHTML = '';
  if (result === 'flee') {
    // Fuga encerra sozinha, sem botão, para não disparar o retorno duas vezes
    setTimeout(() => cb && cb(result, extra), 700);
    return;
  }
  // Vitória ou derrota: o jogador confirma para sair da batalha
  const b = document.createElement('button');
  b.className = 'primary';
  b.textContent = result === 'lose' ? 'Reiniciar no ponto seguro' : 'Continuar';
  b.addEventListener('click', () => { b.disabled = true; cb && cb(result, extra); }, { once: true });
  box.appendChild(b);
  b.focus();
}

export function startBattle(enemyId, onEnd) {
  const def = ENEMIES[enemyId];
  if (!def) return;
  discoverEnemy(enemyId);
  active = {
    enemyId, def, eHp: def.hp, menu: 'main', busy: false, guard: false, over: false, onEnd,
    phase2: false, intent: 'normal',
  };
  active.intent = pickIntent();
  el('battle-log').innerHTML = '';
  el('en-name').textContent = def.name;
  el('battle-log').setAttribute('aria-label', `Batalha contra ${def.name}`);
  el('en-hp').style.width = '100%';
  log(`${def.name} bloqueia o caminho!`, 'hit');
  log(def.lore, 'muted');
  if (def.boss) log(`Chefe: ${def.name}. Ao cair a 50% de vida, ele entra na fase 2.`, 'muted');
  if (skillLevel('eficiencia') > 0) log(`Eficiência: habilidades custam ${skillLevel('eficiencia')} EN a menos.`, 'muted');
  showIntent();
  bars();
  renderCmds();
  el('battle').classList.remove('hidden');
  sfx('ui');
  raf = requestAnimationFrame(drawLoop);
}

export function isBattleOpen() {
  return !!active || !el('battle').classList.contains('hidden');
}

export function closeBattleScreen() {
  el('battle').classList.add('hidden');
}

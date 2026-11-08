// Estado do jogo: atributos, inventário, bandeiras, contadores, missões, habilidades,
// loja, criação, códex e salvamento versionado.
import { ITEMS, QUESTS, QUEST_ORDER, RARITY, RECIPES, SHOP, SKILL_TREE, SKILLS } from './data/content.js';

export const SAVE_VERSION = 2;
const SAVE_KEY = 'anel-zero-save-v1'; // a chave é a mesma; o campo "version" controla a migração

export function xpForLevel(lvl) {
  return Math.round(40 * Math.pow(lvl, 1.5));
}

function freshState() {
  return {
    version: SAVE_VERSION,
    level: 1, xp: 0, skillPoints: 0,
    skills: {},
    baseHp: 60, hp: 60, baseEn: 30, en: 30,
    baseAtk: 6, baseDef: 2,
    equip: { weapon: null, armor: null },
    inv: { pasta_termica: 2, capsula_energia: 1 },
    gold: 0,
    flags: {}, counters: {},
    quests: {},
    codex: { zones: {}, enemies: {} },
    repairBest: {},
    zone: 'cache',
    pos: null,
    playTime: 0,
  };
}

export const state = freshState();

export function resetState() {
  Object.assign(state, freshState());
}

// ---- Árvore de habilidades ----
export function skillLevel(id) {
  return state.skills[id] || 0;
}
export function spendSkillPoint(id) {
  const node = SKILL_TREE.find((n) => n.id === id);
  if (!node || state.skillPoints <= 0 || skillLevel(id) >= node.max) return false;
  state.skillPoints -= 1;
  state.skills[id] = skillLevel(id) + 1;
  clampVitals();
  return true;
}
// Custo real de uma habilidade (Eficiência reduz em 1 por ponto)
export function skillCost(s) {
  return Math.max(0, s.cost - skillLevel('eficiencia'));
}

// ---- Atributos derivados ----
export function maxHp() {
  const armor = ITEMS[state.equip.armor];
  return state.baseHp + (state.level - 1) * 10 + skillLevel('vigor') * 10 + (armor?.maxHp || 0);
}
export function maxEn() {
  return state.baseEn + (state.level - 1) * 5 + skillLevel('fonte') * 8;
}
export function atk() {
  const w = ITEMS[state.equip.weapon];
  return state.baseAtk + (state.level - 1) * 2 + skillLevel('lamina') * 2 + (w?.atk || 0);
}
export function def() {
  const a = ITEMS[state.equip.armor];
  return state.baseDef + Math.floor((state.level - 1) * 0.8) + skillLevel('couraca') + (a?.def || 0);
}

export function clampVitals() {
  state.hp = Math.max(0, Math.min(state.hp, maxHp()));
  state.en = Math.max(0, Math.min(state.en, maxEn()));
}

// ---- Inventário ----
export function addItem(id, n = 1) {
  if (!ITEMS[id] || n <= 0) return 0;
  state.inv[id] = (state.inv[id] || 0) + n;
  bump(`collect_${id}`, n);
  return n;
}
export function removeItem(id, n = 1) {
  if (!state.inv[id]) return false;
  state.inv[id] -= n;
  if (state.inv[id] <= 0) delete state.inv[id];
  return true;
}
export function hasItem(id) {
  return (state.inv[id] || 0) > 0;
}

// Usa um consumível. Retorna texto para o log ou null se não puder.
export function useConsumable(id) {
  const it = ITEMS[id];
  if (!it || it.slot !== 'consumable' || !hasItem(id)) return null;
  const parts = [];
  if (it.heal) { const before = state.hp; state.hp = Math.min(maxHp(), state.hp + it.heal); parts.push(`+${state.hp - before} HP`); }
  if (it.restoreEn) { const before = state.en; state.en = Math.min(maxEn(), state.en + it.restoreEn); parts.push(`+${state.en - before} EN`); }
  removeItem(id, 1);
  return parts.join(' ') || 'Nada aconteceu.';
}

export function equip(id) {
  const it = ITEMS[id];
  if (!it || !hasItem(id)) return false;
  if (it.slot !== 'weapon' && it.slot !== 'armor') return false;
  const prev = state.equip[it.slot];
  if (prev) addItem(prev, 1);
  state.equip[it.slot] = id;
  removeItem(id, 1);
  clampVitals();
  return true;
}

// ---- Loja e criação ----
export function buyPrice(id) {
  return SHOP[id] ?? null;
}
export function sellPrice(id) {
  const it = ITEMS[id];
  if (!it || it.slot === 'key') return 0;
  return RARITY[it.rarity].sell;
}
export function buyItem(id) {
  const price = buyPrice(id);
  if (price === null || state.gold < price) return false;
  state.gold -= price;
  addItem(id, 1);
  return true;
}
export function sellItem(id) {
  const price = sellPrice(id);
  if (!price || !hasItem(id)) return 0;
  removeItem(id, 1);
  state.gold += price;
  return price;
}
export function canCraft(recipe) {
  return Object.entries(recipe.need).every(([id, n]) => (state.inv[id] || 0) >= n);
}
export function craft(recipe) {
  if (!canCraft(recipe)) return false;
  for (const [id, n] of Object.entries(recipe.need)) removeItem(id, n);
  addItem(recipe.id, recipe.qty || 1);
  return true;
}
export { RECIPES, SKILLS };

// ---- Flags e contadores ----
export function setFlag(key) {
  state.flags[key] = true;
}
export function hasFlag(key) {
  return !!state.flags[key];
}
export function bump(key, n = 1) {
  state.counters[key] = (state.counters[key] || 0) + n;
}
export function counter(key) {
  return state.counters[key] || 0;
}

// Condição genérica: string = flag; { count, n } = contador >= n
export function meets(cond) {
  if (!cond) return true;
  if (typeof cond === 'string') return hasFlag(cond);
  if (cond.count) return counter(cond.count) >= cond.n;
  return false;
}

// Condição de cena de diálogo:
//   { quest, stage } | { quest, done: true } | { flag } | { gate: { quest, minStage } } (combinável)
export function sceneMatches(w) {
  if (!w) return true;
  if (w.quest) {
    const ok = w.done ? questStatus(w.quest) === 'done' : questStage(w.quest) === w.stage;
    if (!ok) return false;
  }
  if (w.flag && !hasFlag(w.flag)) return false;
  if (w.gate && questStage(w.gate.quest) < w.gate.minStage) return false;
  return true;
}

// ---- Missões ----
export function questStatus(id) {
  return state.quests[id]?.status || 'none';
}

export function stageSatisfied(stage) {
  if (stage.flag) return hasFlag(stage.flag);
  if (stage.count) return counter(stage.count) >= stage.n;
  if (stage.kill) return counter(`kill_${stage.kill}`) >= stage.n;
  return false;
}

// Índice do primeiro estágio pendente (0 se não iniciada; tamanho se concluída).
export function questStage(id) {
  const q = QUESTS[id];
  const status = questStatus(id);
  if (status === 'none') return 0;
  if (status === 'done') return q.stages.length;
  const idx = q.stages.findIndex((s) => !stageSatisfied(s));
  return idx === -1 ? q.stages.length : idx;
}

export function startQuest(id) {
  if (questStatus(id) !== 'none') return false;
  state.quests[id] = { status: 'active' };
  return true;
}

export function activeQuestId() {
  return QUEST_ORDER.find((id) => questStatus(id) === 'active') || null;
}

// Conclui missões cujos estágios foram cumpridos. Retorna lista de { id, reward }.
export function checkQuests() {
  const done = [];
  for (const id of QUEST_ORDER) {
    if (questStatus(id) !== 'active') continue;
    const q = QUESTS[id];
    if (q.stages.every(stageSatisfied)) {
      state.quests[id] = { status: 'done' };
      if (q.reward.gold) state.gold += q.reward.gold;
      for (const [item, n] of q.reward.items || []) addItem(item, n);
      if (q.reward.xp) gainXp(q.reward.xp);
      done.push({ id, reward: q.reward });
    }
  }
  return done;
}

export function questCompletedCount() {
  return QUEST_ORDER.filter((id) => questStatus(id) === 'done').length;
}

// ---- Experiência ----
// Retorna quantos níveis subiram. Cada nível dá 1 ponto de habilidade.
export function gainXp(n) {
  state.xp += n;
  let ups = 0;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    state.skillPoints += 1;
    ups += 1;
    state.hp = maxHp();
    state.en = maxEn();
  }
  return ups;
}

// ---- Reparo: melhor pontuação por zona ----
export function recordRepairScore(zone, score) {
  const prev = state.repairBest[zone] || 0;
  if (score > prev) state.repairBest[zone] = score;
  return score > prev;
}

// ---- Códex ----
export function discoverZone(id) {
  state.codex.zones[id] = true;
}
export function discoverEnemy(id) {
  state.codex.enemies[id] = true;
}

// ---- Salvamento (versionado) ----
// v1 (sem "version"): ganha campos novos com valores padrão.
// v2: formato atual.
function migrate(data) {
  const v = data.version || 1;
  const out = { ...freshState(), ...data };
  if (v < 2) {
    out.skills = {};
    out.repairBest = {};
    out.skillPoints = Math.max(0, (out.level || 1) - 1);
  }
  out.version = SAVE_VERSION;
  return out;
}

export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

// Só considera "existe save" se o conteúdo for um objeto JSON válido
export function hasSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!data && typeof data === 'object';
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return false;
    Object.assign(state, migrate(data));
    clampVitals();
    return true;
  } catch (e) {
    return false;
  }
}

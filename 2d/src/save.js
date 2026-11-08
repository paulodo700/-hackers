// Salvamento do progresso (localStorage), versão 2. Uma chave para a partida e uma por camada.
// A camada guarda o que mudou no mapa (diferenças em relação ao original), as falhas vivas com posição,
// e as células visitadas. Uma impressão digital do mapa original impede restaurar um mapa que mudou.
// Erros de leitura, de escrita e de dados inválidos nunca travam o jogo: a parte ruim é descartada.
import { mulberry32 } from './rng.js';
import { Grid, BLOCKING, FOE_CHARS, cellKey } from './grid.js';
import { LAYER_ORDER } from './layers.js';

export const FORMAT = 'anelzero-2d';
export const VERSION = 2;
const PREFIX = `anelzero2d.v${VERSION}`;
export const RUN_KEY = `${PREFIX}.run`;
export const layerKey = (id) => `${PREFIX}.layer.${id}`;
export const allKeys = () => [RUN_KEY, ...LAYER_ORDER.map(layerKey)];

// Impressão digital do mapa original (FNV-1a de 32 bits).
export function fingerprint(rows) {
  let h = 0x811c9dc5;
  const text = rows.join('\n');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------- Armazenamento ----------

export function memoryStorage(persistent = false) {
  const map = new Map();
  return {
    persistent,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// localStorage testado com uma gravação. Se não funcionar (modo privado, bloqueio), cai para a memória.
export function browserStorage(win = globalThis) {
  try {
    const ls = win.localStorage;
    const probe = `${PREFIX}.probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      persistent: true,
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
    };
  } catch {
    return memoryStorage(false);
  }
}

// ---------- Gravação ----------

// Estado do jogo como texto, uma entrada por chave.
export function serialize(game) {
  const p = game.player;
  const run = {
    format: FORMAT,
    version: VERSION,
    kind: 'run',
    seed: game.seed,
    nextEntityId: game.nextEntityId,
    player: {
      camada: p.camada, c: p.c, r: p.r, fc: p.fc, fr: p.fr,
      nivel: p.nivel, xp: p.xp, pontos: p.pontos,
      hp: p.hp, maxHp: p.maxHp, ep: p.ep, maxEp: p.maxEp,
      atk: p.atk, def: p.def, spd: p.spd, crit: p.crit,
      habilidades: [...p.habilidades], equip: { ...p.equip },
      calor: p.calor, passos: p.passos,
    },
    inv: { ...game.inv },
    ciclos: game.ciclos,
    flags: { ...game.flags },
    missoes: JSON.parse(JSON.stringify(game.missoes)),
    bestiario: JSON.parse(JSON.stringify(game.bestiario)),
    chefes: { ...game.chefes },
    bausAbertos: { ...game.bausAbertos },
    lojas: JSON.parse(JSON.stringify(game.lojas)),
    diario: [...game.diario],
    won: game.won,
    rng: typeof game.rng.state === 'function' ? game.rng.state() : null,
  };
  return [
    { key: RUN_KEY, json: JSON.stringify(run) },
    ...LAYER_ORDER.map((id) => ({ key: layerKey(id), json: JSON.stringify(layerState(game, id)) })),
  ];
}

// O que muda numa camada: diferenças do mapa, falhas vivas, visitas.
export function layerState(game, id) {
  const w = game.world[id];
  const origin = w.origin, atual = w.grid.rows;
  const changes = [];
  for (let r = 0; r < origin.length; r++) {
    for (let c = 0; c < origin[r].length; c++) {
      if (atual[r][c] !== origin[r][c]) changes.push([c, r, atual[r][c]]);
    }
  }
  return {
    format: FORMAT,
    version: VERSION,
    kind: 'layer',
    camada: id,
    fingerprint: fingerprint(origin),
    visited: [...w.visited].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]),
    entities: w.entities.map((e) => ({ id: e.id, foe: e.foe, c: e.c, r: e.r, origem: e.origem, comp: e.comp, boss: e.boss, ignorar: e.ignorar })),
    changes,
  };
}

// Grava só as chaves que mudaram desde a última gravação bem-sucedida.
export function createSaver(storage) {
  const written = new Map();
  return {
    save(game) {
      const result = { written: [], failed: [] };
      for (const { key, json } of serialize(game)) {
        if (written.get(key) === json) continue;
        try {
          storage.setItem(key, json);
          written.set(key, json);
          result.written.push(key);
        } catch {
          result.failed.push(key);
        }
      }
      result.ok = result.failed.length === 0;
      return result;
    },
    forget() { written.clear(); },
  };
}

export function clearSave(storage) {
  let ok = true;
  for (const key of allKeys()) {
    try { storage.removeItem(key); } catch { ok = false; }
  }
  return ok;
}

// ---------- Leitura ----------

const parse = (raw) => {
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
};
const isInt = (n) => Number.isInteger(n);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const fail = (error) => ({ error });
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function planRun(game, run) {
  if (!isObj(run)) return fail('partida ilegível');
  if (run.format !== FORMAT || run.version !== VERSION || run.kind !== 'run') return fail('formato ou versão diferente');
  const p = run.player;
  if (!isObj(p) || !LAYER_ORDER.includes(p.camada) || !isInt(p.c) || !isInt(p.r)) return fail('posição inválida');
  for (const k of ['nivel', 'xp', 'pontos', 'hp', 'maxHp', 'ep', 'maxEp', 'atk', 'def', 'spd', 'crit', 'calor', 'passos']) {
    if (!isNum(p[k]) || p[k] < 0) return fail(`atributo ${k} inválido`);
  }
  if (p.hp > p.maxHp || p.nivel < 1) return fail('vida ou nível inválidos');
  if (!Array.isArray(p.habilidades) || !isObj(p.equip)) return fail('habilidades ou equipamento inválidos');
  if (!isObj(run.inv) || Object.values(run.inv).some((n) => !isInt(n) || n < 1)) return fail('inventário inválido');
  if (!isInt(run.ciclos) || run.ciclos < 0) return fail('ciclos inválidos');
  if (!isObj(run.flags) || !isObj(run.missoes) || !isObj(run.bestiario) || !isObj(run.chefes)) return fail('registros inválidos');
  if (!isObj(run.bausAbertos) || !isObj(run.lojas) || !Array.isArray(run.diario)) return fail('registros inválidos');
  if (typeof run.won !== 'boolean') return fail('vitória inválida');
  if (run.rng !== null && !isNum(run.rng)) return fail('estado do sorteio inválido');
  if (!isInt(run.nextEntityId) || run.nextEntityId < 1) return fail('contador de entidades inválido');
  return {
    plan: {
      player: {
        camada: p.camada, c: p.c, r: p.r,
        fc: [-1, 0, 1].includes(p.fc) ? p.fc : 1, fr: [-1, 0, 1].includes(p.fr) ? p.fr : 0,
        nivel: p.nivel, xp: p.xp, pontos: p.pontos, hp: p.hp, maxHp: p.maxHp, ep: p.ep, maxEp: p.maxEp,
        atk: p.atk, def: p.def, spd: p.spd, crit: p.crit,
        habilidades: p.habilidades.filter((h) => typeof h === 'string'),
        equip: { dissipador: p.equip.dissipador ?? null, antena: p.equip.antena ?? null, modulo: p.equip.modulo ?? null },
        calor: Math.min(100, p.calor), passos: p.passos,
        estados: [], escudo: 0,
      },
      inv: { ...run.inv }, ciclos: run.ciclos, flags: { ...run.flags }, missoes: run.missoes,
      bestiario: run.bestiario, chefes: { ...run.chefes }, bausAbertos: { ...run.bausAbertos },
      lojas: run.lojas, diario: run.diario.filter((t) => typeof t === 'string'), won: run.won,
      rng: run.rng, nextEntityId: run.nextEntityId, seed: run.seed,
    },
  };
}

function planLayer(game, id, data) {
  if (!isObj(data)) return fail('ilegível');
  if (data.format !== FORMAT || data.version !== VERSION || data.kind !== 'layer' || data.camada !== id) return fail('formato ou versão diferente');
  const w = game.world[id];
  const origin = w.origin;
  if (data.fingerprint !== fingerprint(origin)) return fail('o mapa mudou desde o salvamento');
  const inside = (c, r) => isInt(c) && isInt(r) && r >= 0 && r < origin.length && c >= 0 && c < origin[r].length;
  if (!Array.isArray(data.visited) || !data.visited.every((v) => Array.isArray(v) && inside(v[0], v[1]))) return fail('visitas inválidas');
  if (!Array.isArray(data.changes) || !data.changes.every((ch) => Array.isArray(ch) && inside(ch[0], ch[1])
    && typeof ch[2] === 'string' && ch[2].length === 1 && ch[2] !== origin[ch[1]][ch[0]])) return fail('mudanças do mapa inválidas');
  if (!Array.isArray(data.entities)) return fail('falhas inválidas');
  for (const e of data.entities) {
    if (!isObj(e) || !isInt(e.id) || !game.catalog.falhas[e.foe] || !inside(e.c, e.r) || typeof e.boss !== 'boolean') return fail('falha inválida');
    if (!['patrulha', 'perseguidor', 'estatico'].includes(e.comp)) return fail('comportamento inválido');
    if (!isInt(e.ignorar) || e.ignorar < 0) return fail('contador de fuga inválido');
  }
  const grid = new Grid(origin);
  for (const [c, r, ch] of data.changes) grid.set(c, r, ch);
  return {
    plan: {
      grid,
      visited: new Set(data.visited.map(([c, r]) => cellKey(c, r))),
      entities: data.entities.map((e) => ({ id: e.id, foe: e.foe, camada: id, c: e.c, r: e.r, origem: e.origem ?? [e.c, e.r], comp: e.comp, boss: e.boss, ignorar: e.ignorar })),
    },
  };
}

function applyRun(game, plan) {
  Object.assign(game.player, plan.player);
  game.inv = plan.inv;
  game.ciclos = plan.ciclos;
  game.flags = plan.flags;
  game.missoes = plan.missoes;
  game.bestiario = plan.bestiario;
  game.chefes = plan.chefes;
  game.bausAbertos = plan.bausAbertos;
  game.lojas = plan.lojas;
  game.diario = plan.diario;
  game.won = plan.won;
  game.nextEntityId = plan.nextEntityId;
  if (plan.rng !== null) game.rng = mulberry32(plan.rng);
  game.battle = null;
  game.dialog = null;
  game.menu = null;
  game.menuStack = [];
  game.mapOpen = false;
  game.lojaPendente = null;
}

function applyLayer(game, id, plan) {
  const w = game.world[id];
  w.grid = plan.grid;
  w.visited = plan.visited;
  w.entities = plan.entities;
}

// Bit não pode ficar salvo sobre bloqueio ou falha: se estiver, volta para o início da camada.
function checkPosition(game) {
  const { camada, c, r } = game.player;
  const ch = game.world[camada].grid.at(c, r);
  const ocupada = game.world[camada].entities.some((e) => e.c === c && e.r === r);
  if (BLOCKING.has(ch) || ocupada || FOE_CHARS[ch]) game.placeAt(camada, 'S');
}

// Carrega o progresso salvo em game. Devolve um relatório do que foi restaurado e do que foi descartado.
export function loadGame(game, storage) {
  const report = { status: 'new', restored: [], discarded: [], notes: [] };
  let runRaw;
  try {
    runRaw = storage.getItem(RUN_KEY);
  } catch {
    return { ...report, status: 'unavailable', notes: ['não foi possível ler o salvamento'] };
  }
  if (runRaw === null || runRaw === undefined) return report;
  const runRes = planRun(game, parse(runRaw));
  if (runRes.error) return { ...report, status: 'discarded', notes: [`partida descartada: ${runRes.error}`] };

  const plans = {};
  for (const id of LAYER_ORDER) {
    let raw;
    try {
      raw = storage.getItem(layerKey(id));
    } catch {
      report.discarded.push(id);
      report.notes.push(`${id}: leitura falhou`);
      continue;
    }
    if (raw === null || raw === undefined) continue;
    const res = planLayer(game, id, parse(raw));
    if (res.error) {
      report.discarded.push(id);
      report.notes.push(`${id}: ${res.error}`);
      continue;
    }
    plans[id] = res.plan;
    report.restored.push(id);
  }

  applyRun(game, runRes.plan);
  for (const id of Object.keys(plans)) applyLayer(game, id, plans[id]);
  checkPosition(game);
  report.status = 'restored';
  return report;
}

export { DIRS };

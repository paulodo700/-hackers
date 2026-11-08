// Salvamento do progresso no navegador (localStorage).
// Uma chave para a partida (jogador, materiais, ferramentas, estado do sorteio) e uma chave por camada
// (trilhas reparadas, falhas vencidas, materiais coletados, células visitadas, falas do técnico).
// Cada chave traz formato e versão. A camada traz uma impressão digital do mapa original: se o mapa mudou
// desde o salvamento, a camada é descartada em vez de restaurar células fora do lugar.
// Erros de leitura, de escrita e de dados corrompidos nunca travam o jogo: a parte ruim é descartada.
import { mulberry32 } from './rng.js';
import { Grid, BLOCKING, TOOL_CELLS, OPENED, FOE_CHARS, PICKUP_ITEMS, FLOOR, SPAWN, cellKey } from './grid.js';
import { LAYER_ORDER } from './layers.js';

export const FORMAT = 'anelzero-2d';
export const VERSION = 1;
const PREFIX = `anelzero2d.v${VERSION}`;
export const RUN_KEY = `${PREFIX}.run`;
export const layerKey = (id) => `${PREFIX}.layer.${id}`;
export const allKeys = () => [RUN_KEY, ...LAYER_ORDER.map(layerKey)];

// Impressão digital do mapa original (FNV-1a de 32 bits). Muda se o gerador ou os dados da camada mudarem.
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

// Armazenamento em memória: usado quando o navegador não deixa gravar (modo privado, cota cheia, bloqueado).
export function memoryStorage(persistent = false) {
  const map = new Map();
  return {
    persistent,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// localStorage do navegador, testado com uma gravação. Se não funcionar, cai para a memória e avisa.
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

// Estado do jogo como texto por chave. Cada camada tem a sua chave.
export function serialize(game) {
  const p = game.player;
  const run = {
    format: FORMAT,
    version: VERSION,
    kind: 'run',
    player: { layer: p.layer, c: p.c, r: p.r, fc: p.fc, fr: p.fr, hp: p.hp, maxHp: p.maxHp, atk: p.atk, def: p.def },
    materials: { ...game.materials },
    tools: { ...game.tools },
    won: game.won,
    rng: typeof game.rng.state === 'function' ? game.rng.state() : null,
  };
  return [
    { key: RUN_KEY, json: JSON.stringify(run) },
    ...LAYER_ORDER.map((id) => ({ key: layerKey(id), json: JSON.stringify(layerState(game, id)) })),
  ];
}

// O que mudou numa camada em relação ao mapa original, mais as visitas e as falas do técnico.
export function layerState(game, id) {
  const w = game.world[id];
  const origin = w.origin, cur = w.grid.rows;
  const out = {
    format: FORMAT,
    version: VERSION,
    kind: 'layer',
    layer: id,
    fingerprint: fingerprint(origin),
    visited: [...w.visited].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]),
    repaired: [],
    defeated: [],
    collected: [],
    other: [],
    npc: w.npc,
  };
  for (let r = 0; r < origin.length; r++) {
    for (let c = 0; c < origin[r].length; c++) {
      const o = origin[r][c], ch = cur[r][c];
      if (ch === o) continue;
      if (TOOL_CELLS[o] && ch === OPENED[o]) out.repaired.push([c, r]);
      else if (FOE_CHARS[o] && ch === FLOOR) out.defeated.push([c, r]);
      else if (PICKUP_ITEMS[o] && ch === FLOOR) out.collected.push([c, r]);
      else out.other.push([c, r, ch]); // qualquer outra mudança é guardada, para mecânicas futuras
    }
  }
  return out;
}

// Grava só as chaves que mudaram desde a última gravação bem-sucedida. Falhas ficam para a próxima vez.
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

// Apaga todas as chaves do salvamento (novo jogo). Devolve false se alguma não pôde ser apagada.
export function clearSave(storage) {
  let ok = true;
  for (const key of allKeys()) {
    try { storage.removeItem(key); } catch { ok = false; }
  }
  return ok;
}

// ---------- Leitura ----------

function parse(raw) {
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const isInt = (n) => Number.isInteger(n);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const fail = (error) => ({ error });

function countsOk(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const got = Object.keys(obj);
  if (got.length !== keys.length || !keys.every((k) => got.includes(k))) return false;
  return keys.every((k) => isInt(obj[k]) && obj[k] >= 0);
}

// A direção de olhar é uma das quatro direções cardeais; qualquer outra coisa vira 'direita'.
function facingOf(p) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ok = dirs.some(([dc, dr]) => dc === p.fc && dr === p.fr);
  return ok ? { fc: p.fc, fr: p.fr } : { fc: 1, fr: 0 };
}

function planRun(game, run) {
  if (!run || typeof run !== 'object') return fail('partida ilegível');
  if (run.format !== FORMAT || run.version !== VERSION || run.kind !== 'run') return fail('formato ou versão diferente');
  const p = run.player;
  if (!p || typeof p !== 'object') return fail('jogador ausente');
  if (!LAYER_ORDER.includes(p.layer) || !isInt(p.c) || !isInt(p.r)) return fail('posição inválida');
  if (!isNum(p.hp) || !isNum(p.maxHp) || !isNum(p.atk) || !isNum(p.def)) return fail('atributos inválidos');
  if (p.hp < 0 || p.maxHp < 1) return fail('vida inválida');
  if (!countsOk(run.materials, Object.keys(game.materials))) return fail('materiais inválidos');
  if (!countsOk(run.tools, Object.keys(game.tools))) return fail('ferramentas inválidas');
  if (typeof run.won !== 'boolean') return fail('vitória inválida');
  if (run.rng !== null && !isNum(run.rng)) return fail('estado do sorteio inválido');
  return {
    plan: {
      player: {
        layer: p.layer, c: p.c, r: p.r,
        ...facingOf(p),
        hp: p.hp, maxHp: p.maxHp, atk: p.atk, def: p.def,
      },
      materials: { ...run.materials },
      tools: { ...run.tools },
      won: run.won,
      rng: run.rng,
    },
  };
}

function planLayer(game, id, data) {
  if (!data || typeof data !== 'object') return fail('ilegível');
  if (data.format !== FORMAT || data.version !== VERSION || data.kind !== 'layer' || data.layer !== id) {
    return fail('formato ou versão diferente');
  }
  const origin = game.world[id].origin;
  if (data.fingerprint !== fingerprint(origin)) return fail('o mapa mudou desde o salvamento');
  const grid = new Grid(origin);
  const inside = (cell) => Array.isArray(cell) && cell.length === 2 && isInt(cell[0]) && isInt(cell[1])
    && cell[1] >= 0 && cell[1] < origin.length && cell[0] >= 0 && cell[0] < origin[cell[1]].length;
  const lists = ['visited', 'repaired', 'defeated', 'collected', 'other'];
  if (!lists.every((k) => Array.isArray(data[k]))) return fail('listas ausentes');
  if (!data.visited.every(inside)) return fail('visitas fora do mapa');
  const visited = new Set(data.visited.map(([c, r]) => cellKey(c, r)));
  for (const [c, r] of data.repaired) {
    if (!inside([c, r]) || !TOOL_CELLS[origin[r][c]]) return fail('reparo em célula errada');
    grid.set(c, r, OPENED[origin[r][c]]);
  }
  for (const [c, r] of data.defeated) {
    if (!inside([c, r]) || !FOE_CHARS[origin[r][c]]) return fail('falha vencida em célula errada');
    grid.set(c, r, FLOOR);
  }
  for (const [c, r] of data.collected) {
    if (!inside([c, r]) || !PICKUP_ITEMS[origin[r][c]]) return fail('material coletado em célula errada');
    grid.set(c, r, FLOOR);
  }
  for (const entry of data.other) {
    const [c, r, ch] = entry;
    if (!inside([c, r]) || typeof ch !== 'string' || ch.length !== 1 || ch === origin[r][c]) return fail('mudança inválida');
    grid.set(c, r, ch);
  }
  if (!isInt(data.npc) || data.npc < 0) return fail('fala do técnico inválida');
  return { plan: { grid, visited, npc: data.npc } };
}

function applyRun(game, plan) {
  Object.assign(game.player, plan.player);
  Object.assign(game.materials, plan.materials);
  Object.assign(game.tools, plan.tools);
  game.won = plan.won;
  if (plan.rng !== null) game.rng = mulberry32(plan.rng);
  game.battle = null;
  game.dialog = null;
  game.craftOpen = false;
  game.mapOpen = false;
}

function applyLayer(game, id, plan) {
  const w = game.world[id];
  w.grid = plan.grid;
  w.visited = plan.visited;
  w.npc = plan.npc;
}

// Se o jogador ficou salvo sobre parede, técnico ou falha, volta para o início da camada.
function checkPosition(game) {
  const { layer, c, r } = game.player;
  const ch = game.world[layer].grid.at(c, r);
  if (BLOCKING.has(ch) || FOE_CHARS[ch]) game.placeAt(layer, SPAWN);
}

// Carrega o progresso salvo para dentro de game. Devolve um relatório do que foi restaurado e descartado.
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

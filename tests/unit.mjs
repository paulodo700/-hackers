// Testes de unidade: regras puras e formatos de dados. Rodam em Node, sem navegador.
import assert from 'node:assert/strict';

// Shim de localStorage para os módulos que salvam dados
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};

const combat = await import('../src/combat.js');
const state = await import('../src/state.js');
const content = await import('../src/data/content.js');
const sim = await import('./sim/sim.mjs');

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

// ---- Combate ----
t('dano mínimo é 1 mesmo com defesa alta', () => {
  assert.equal(combat.dmgFrom(1, 999, 1, () => 0.5), 1);
});
t('golpe pesado causa mais dano que o normal (mesma semente)', () => {
  const a = combat.enemyHit(12, 4, 'normal', false, combat.seededRng(3));
  const b = combat.enemyHit(12, 4, 'pesado', false, combat.seededRng(3));
  assert.ok(b > a, `pesado ${b} deve ser maior que normal ${a}`);
});
t('fase 2 só entra uma vez, abaixo de 50% de vida, em chefes', () => {
  assert.equal(combat.shouldEnterPhase2(true, 49, 100, false), true);
  assert.equal(combat.shouldEnterPhase2(true, 51, 100, false), false);
  assert.equal(combat.shouldEnterPhase2(false, 10, 100, false), false);
  assert.equal(combat.shouldEnterPhase2(true, 10, 100, true), false);
});
t('gerador seedado é reproduzível', () => {
  const a = combat.seededRng(42), b = combat.seededRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

// ---- Balanceamento (simulador) ----
t('metas de balanceamento do simulador são atendidas', () => {
  const fails = sim.checkTargets();
  assert.deepEqual(fails, [], fails.join('; '));
});

// ---- Conteúdo ----
t('drops, receitas, loja e missões apontam para itens e missões válidos', () => {
  for (const e of Object.values(content.ENEMIES)) {
    for (const d of e.drops || []) assert.ok(content.ITEMS[d.item], `drop inválido: ${d.item}`);
  }
  for (const r of content.RECIPES) {
    assert.ok(content.ITEMS[r.id], `receita sem item: ${r.id}`);
    for (const k of Object.keys(r.need)) assert.ok(content.ITEMS[k], `ingrediente inválido: ${k}`);
  }
  for (const k of Object.keys(content.SHOP)) assert.ok(content.ITEMS[k], `loja: ${k}`);
  for (const id of Object.keys(content.QUESTS)) {
    assert.ok(content.QUEST_ORDER.includes(id), `missão fora da ordem: ${id}`);
  }
});
t('todo chefe, NPC e baú do mundo existe no conteúdo', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const loot = await import('../src/loot.js');
  for (const z of Object.values(ZONES)) {
    for (const m of Object.values(z.markers)) {
      if (m.type === 'npc') assert.ok(content.NPCS[m.id], `NPC ausente: ${m.id}`);
      if (m.type === 'boss') assert.ok(content.ENEMIES[m.id], `chefe ausente: ${m.id}`);
      if (m.type === 'chest' && !m.extra) assert.ok(loot.CHEST_LOOT[m.id], `baú sem saque: ${m.id}`);
    }
  }
});

// ---- Finais ----
t('final da paz muda com a missão extra do Núcleo', () => {
  const com = content.endingLines('paz', { sq_nucleo_done: true });
  const sem = content.endingLines('paz', {});
  assert.notDeepEqual(com, sem);
  assert.ok(com.length > sem.length - 1);
});
t('final da guerra muda com a missão extra do Núcleo', () => {
  const com = content.endingLines('guerra', { sq_nucleo_done: true });
  const sem = content.endingLines('guerra', {});
  assert.notDeepEqual(com, sem);
});
t('finais terminam com a linha de fechamento', () => {
  for (const kind of ['paz', 'guerra']) {
    const lines = content.endingLines(kind, {});
    assert.match(lines[lines.length - 1].t, /FINAL/);
  }
});

// ---- Save: migrações e slots ----
const v1 = {
  level: 4, xp: 3, hp: 50, en: 20, baseHp: 60, baseEn: 30, baseAtk: 6, baseDef: 2,
  equip: { weapon: null, armor: null }, inv: { pasta_termica: 1 }, gold: 33,
  flags: { talked_sementa: true }, counters: {}, quests: {}, codex: { zones: {}, enemies: {} }, zone: 'regs',
};
t('migração v1 -> v3 preenche habilidades, reparos e mapa', () => {
  const m = state.migrate(v1);
  assert.equal(m.version, 3);
  assert.deepEqual(m.skills, {});
  assert.deepEqual(m.repairBest, {});
  assert.deepEqual(m.visited, {});
  assert.equal(m.skillPoints, 3);
  assert.equal(m.gold, 33);
});
t('migração v2 -> v3 mantém o progresso e acrescenta o mapa', () => {
  const v2 = { ...v1, version: 2, skills: { vigor: 2 }, repairBest: { cache: 500 }, skillPoints: 1 };
  const m = state.migrate(v2);
  assert.equal(m.version, 3);
  assert.deepEqual(m.skills, { vigor: 2 });
  assert.deepEqual(m.repairBest, { cache: 500 });
  assert.equal(m.skillPoints, 1);
  assert.deepEqual(m.visited, {});
});
t('migração é idempotente', () => {
  const once = state.migrate(v1);
  const twice = state.migrate(once);
  assert.deepEqual(twice, once);
});
t('save antigo é copiado para o slot 1 sem apagar o original', () => {
  localStorage.clear();
  localStorage.setItem('anel-zero-save-v1', JSON.stringify(v1));
  assert.equal(state.migrateLegacySave(), true);
  const info = state.slotInfo(1);
  assert.equal(info.zone, 'regs');
  assert.equal(info.gold, 33);
  assert.ok(localStorage.getItem('anel-zero-save-v1'), 'chave antiga deve permanecer');
});
t('migração não sobrescreve um slot 1 existente', () => {
  localStorage.clear();
  localStorage.setItem('anel-zero-save-v1', JSON.stringify(v1));
  localStorage.setItem('anel-zero-slot-1', JSON.stringify({ ...v1, gold: 999, version: 3, zone: 'cache' }));
  assert.equal(state.migrateLegacySave(), false);
  assert.equal(state.slotInfo(1).gold, 999);
});
t('slots são independentes e apagáveis', () => {
  localStorage.clear();
  state.resetState();
  state.setSlot(2);
  state.state.gold = 77;
  assert.equal(state.saveGame(), true);
  assert.equal(state.slotInfo(1), null);
  assert.equal(state.slotInfo(2).gold, 77);
  state.deleteSlot(2);
  assert.equal(state.hasSave(2), false);
});
t('save corrompido não conta como slot ocupado', () => {
  localStorage.clear();
  localStorage.setItem('anel-zero-slot-3', '{quebrado');
  assert.equal(state.slotInfo(3), null);
  assert.equal(state.hasSave(3), false);
  assert.equal(state.loadGame(3), false);
});
t('carregar um slot define o slot atual', () => {
  localStorage.clear();
  localStorage.setItem('anel-zero-slot-3', JSON.stringify({ ...v1, version: 3, zone: 'alu' }));
  assert.equal(state.loadGame(3), true);
  assert.equal(state.getSlot(), 3);
  assert.equal(state.state.zone, 'alu');
});

// ---- Mapa visitado ----
t('marcação de visitas é por zona e por célula', () => {
  state.resetState();
  state.markVisited('cache', 2, 3);
  assert.equal(state.isVisited('cache', 2, 3), true);
  assert.equal(state.isVisited('regs', 2, 3), false);
  assert.equal(state.isVisited('cache', 3, 2), false);
});

// ---- Missão extra do Núcleo ----
t('missão extra do Núcleo só abre depois da missão principal', () => {
  state.resetState();
  assert.equal(state.sceneMatches({ quest: 'sq_nucleo', stage: 0, gate: { quest: 'q_nucleo', minStage: 1 } }), false);
  state.startQuest('q_nucleo');
  state.setFlag('entered_core');
  assert.equal(state.sceneMatches({ quest: 'sq_nucleo', stage: 0, gate: { quest: 'q_nucleo', minStage: 1 } }), true);
});

t('expressão do rosto segue a pontuação da fala', async () => {
  const { moodForLine } = await import('../src/expression.js');
  assert.equal(moodForLine('Você voltou?'), 'doubt');
  assert.equal(moodForLine('Ei!'), 'surprised');
  assert.equal(moodForLine('Olá.'), 'neutral');
});

t('cansaço do rosto aparece só com vida abaixo de 30%', async () => {
  const { moodForVitals } = await import('../src/expression.js');
  assert.equal(moodForVitals(29, 100), 'tired');
  assert.equal(moodForVitals(30, 100), null);
  assert.equal(moodForVitals(0, 0), null);
});

t('todo inimigo comum aparece em pelo menos uma zona', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const used = new Set(Object.values(ZONES).flatMap((z) => z.enemies));
  for (const [id, e] of Object.entries(content.ENEMIES)) {
    if (!e.boss) assert.ok(used.has(id), `inimigo sem zona: ${id}`);
  }
});

t('mapas extensos: todo objeto e portal é alcançável a partir do nascimento', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const SOLID = new Set(['#', '~', '_']);
  for (const [id, z] of Object.entries(ZONES)) {
    if (!z.gen) continue; // o Núcleo é uma arena fixa
    const rows = z.map.length, cols = z.map[0].length;
    let spawn = null;
    z.map.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'S') spawn = [c, r]; }));
    assert.ok(spawn, `${id}: sem nascimento`);
    const seen = new Set([spawn.join(',')]);
    const queue = [spawn];
    while (queue.length) {
      const [c, r] = queue.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (SOLID.has(z.map[nr][nc])) continue;
        const k = `${nc},${nr}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nc, nr]);
      }
    }
    z.map.forEach((row, r) => [...row].forEach((ch, c) => {
      const isObject = z.markers[ch] && ch !== 'S';
      if (isObject) assert.ok(seen.has(`${c},${r}`), `${id}: '${ch}' inalcançável em ${c},${r}`);
    }));
  }
});
t('mapas extensos: tamanho e quantidade de itens por zona', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  for (const [id, z] of Object.entries(ZONES)) {
    if (!z.gen) continue;
    assert.ok(z.map.length >= 30 && z.map[0].length >= 50, `${id}: mapa pequeno (${z.map[0].length}x${z.map.length})`);
    const pickups = z.map.join('').split('').filter((ch) => z.markers[ch]?.type === 'pickup').length;
    const chests = z.map.join('').split('').filter((ch) => z.markers[ch]?.type === 'chest' && z.markers[ch].extra).length;
    assert.ok(pickups >= 10, `${id}: só ${pickups} itens no chão`);
    assert.ok(chests >= 4, `${id}: só ${chests} baús extras`);
  }
});
t('baús extras têm saque determinístico pela posição', async () => {
  const loot = await import('../src/loot.js');
  const a = loot.lootFor('cx_cache_12_7');
  const b = loot.lootFor('cx_cache_12_7');
  assert.deepEqual(a, b);
  assert.ok(a.length >= 1);
  for (const [item] of a) assert.ok(content.ITEMS[item], `item inválido no saque: ${item}`);
});

export async function runUnit() {
  let pass = 0;
  const failures = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      pass++;
      console.log(`  ok   ${name}`);
    } catch (e) {
      failures.push(name);
      console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`);
    }
  }
  return { pass, failures, total: tests.length };
}

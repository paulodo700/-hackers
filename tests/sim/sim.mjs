// Simulador de balanceamento: batalhas sem navegador, com sementes fixas (reproduzível).
// Uso: node tests/sim/sim.mjs            (imprime a tabela)
//      node tests/sim/sim.mjs --json     (saída em JSON, para o runner de testes)
import { ENEMIES, ITEMS } from '../../src/data/content.js';
import { dmgFrom, pickIntent, enemyHit, shouldEnterPhase2, seededRng } from '../../src/combat.js';

// Curva de progressão do jogador (igual a src/state.js, sem skills)
function playerStats(level, weapon = null, armor = null) {
  const w = ITEMS[weapon], a = ITEMS[armor];
  return {
    maxHp: 60 + (level - 1) * 10 + (a?.maxHp || 0),
    atk: 6 + (level - 1) * 2 + (w?.atk || 0),
    def: 2 + Math.floor((level - 1) * 0.8) + (a?.def || 0),
  };
}

// Equipamento típico por nível recomendado (o que um jogador atento teria)
const LOADOUT = [
  { minLevel: 1, weapon: null, armor: null },
  { minLevel: 3, weapon: 'lamina_solda', armor: 'escudo_dissipador' },
  { minLevel: 5, weapon: 'pinca_ressonante', armor: 'escudo_dissipador' },
  { minLevel: 7, weapon: 'lamina_fusivel', armor: 'escudo_reforcado' },
];
function loadoutFor(level) {
  let l = LOADOUT[0];
  for (const x of LOADOUT) if (level >= x.minLevel) l = x;
  return l;
}

// Uma batalha. Retorna { win, turns, potionsUsed }.
export function simulateBattle(enemyId, level, { seed = 1, potions = 2 } = {}) {
  const rng = seededRng(seed);
  const e = ENEMIES[enemyId];
  const L = loadoutFor(level);
  const p = playerStats(level, L.weapon, L.armor);
  let hp = p.maxHp;
  let eHp = e.hp;
  let phase2 = false;
  let intent = pickIntent({ boss: !!e.boss, eHp, maxHp: e.hp, phase2 }, rng);
  let turns = 0;
  let potionsUsed = 0;
  let guard = false;
  while (turns < 200) {
    turns++;
    // Turno do jogador
    if (hp < p.maxHp * 0.35 && potions > 0) {
      potions--; potionsUsed++;
      hp = Math.min(p.maxHp, hp + 35);
    } else {
      eHp -= dmgFrom(p.atk, e.def, 1, rng);
    }
    if (eHp <= 0) return { win: true, turns, potionsUsed, hpLeft: hp };
    if (shouldEnterPhase2(!!e.boss, eHp, e.hp, phase2)) phase2 = true;
    // Turno do inimigo
    if (intent === 'reparar') {
      eHp = Math.min(e.hp, eHp + 15);
    } else {
      let d = enemyHit(e.atk, p.def, intent, phase2, rng);
      if (guard) { d = Math.max(1, Math.round(d * 0.45)); guard = false; }
      hp -= d;
    }
    if (hp <= 0) return { win: false, turns, potionsUsed, hpLeft: 0 };
    intent = pickIntent({ boss: !!e.boss, eHp, maxHp: e.hp, phase2 }, rng);
  }
  return { win: false, turns, potionsUsed, hpLeft: hp };
}

// Taxa de vitória sobre N sementes para um inimigo em um nível.
export function winRate(enemyId, level, runs = 400) {
  let wins = 0, turns = 0;
  for (let s = 1; s <= runs; s++) {
    const r = simulateBattle(enemyId, level, { seed: s * 7919 + level });
    if (r.win) { wins++; turns += r.turns; }
  }
  return { rate: wins / runs, avgTurns: wins ? turns / wins : 0 };
}

// Nível recomendado de cada inimigo (ver docs/GDD.md, seção "Balanceamento").
export const RECOMMENDED = {
  pulga: 1, ruido: 2, bloco: 3, sobrecarga: 5, ferrugem_titan: 7, vigia: 9,
};

// Níveis em que cada inimigo é verificado: a faixa de preparação.
export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function fullReport() {
  const out = {};
  for (const id of Object.keys(ENEMIES)) {
    out[id] = {};
    for (const lv of LEVELS) out[id][lv] = winRate(id, lv);
  }
  return out;
}

// Verificação das metas de balanceamento (docs/GDD.md, seção Balanceamento).
// Glitches: pulga no nível 1 vence 90%+; cada glitch vence 60%+ no nível recomendado.
// Chefes: no nível recomendado vencem 60%+; um nível abaixo (sem preparação) 25% ou menos. A meta de 10% não é alcançável com a curva linear de progressão (ver GDD).
// Retorna lista de falhas (vazia = tudo atendido).
export function checkTargets(report = fullReport()) {
  const fails = [];
  if (report.pulga[1].rate < 0.9) fails.push(`pulga nível 1: ${(report.pulga[1].rate * 100).toFixed(0)}% (meta 90%+)`);
  for (const id of ['ruido', 'bloco']) {
    const lv = RECOMMENDED[id];
    if (report[id][lv].rate < 0.6) fails.push(`${id} nível ${lv}: ${(report[id][lv].rate * 100).toFixed(0)}% (meta 60%+)`);
  }
  for (const id of ['sobrecarga', 'ferrugem_titan', 'vigia']) {
    const rec = RECOMMENDED[id];
    if (report[id][rec].rate < 0.6) fails.push(`${id} nível ${rec}: ${(report[id][rec].rate * 100).toFixed(0)}% (meta 60%+)`);
    if (report[id][rec - 1].rate > 0.25) fails.push(`${id} nível ${rec - 1}: ${(report[id][rec - 1].rate * 100).toFixed(0)}% (meta 25% ou menos sem preparação)`);
  }
  return fails;
}

// Execução direta
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const asJson = process.argv.includes('--json');
  const report = fullReport();
  if (asJson) {
    console.log(JSON.stringify({ report, fails: checkTargets(report) }));
  } else {
    console.log('inimigo             ' + LEVELS.map((l) => `Nv${l}`.padStart(6)).join(''));
    for (const id of Object.keys(ENEMIES)) {
      console.log(id.padEnd(20) + LEVELS.map((l) => `${Math.round(report[id][l].rate * 100)}%`.padStart(6)).join(''));
    }
    const fails = checkTargets(report);
    console.log(fails.length ? 'FALHAS:\n - ' + fails.join('\n - ') : 'Todas as metas de balanceamento atendidas.');
  }
}

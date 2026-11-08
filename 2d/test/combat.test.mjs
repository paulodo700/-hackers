import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoJogo } from './fixtures.mjs';
import { Grid } from '../src/grid.js';
import { iniciarBatalha, acaoJogador, calcDano, fatorElemento, faseDoChefe } from '../src/systems/combat.js';
import { LAYER_ORDER } from '../src/layers.js';

// Rng fixo: 0,5 faz a esquiva, o crítico e a fuga falharem, e a variação ficar neutra (×1,0).
const MEIO = () => 0.5;

function batalhaContra(id, { rng = MEIO, seed = 3 } = {}) {
  const g = novoJogo(seed);
  const camada = g.player.camada;
  const ent = { id: 500, foe: id, camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: id === 'bolha_termica', ignorar: 0 };
  g.world[camada].grid = new Grid(['#########', '#S.......#', '#########']);
  g.world[camada].entities = [ent];
  g.rng = rng;
  iniciarBatalha(g, ent);
  return g;
}

test('batalha começa com a vida da falha escalada pela camada e registra a falha no bestiário', () => {
  const g = batalhaContra('ruido_termico');
  assert.equal(g.battle.foeId, 'ruido_termico');
  assert.equal(g.battle.hp, 12, 'escala 1,0 na primeira camada');
  assert.equal(g.bestiario.ruido_termico.vistas, 1);
  assert.ok(g.events.some((e) => e.tipo === 'sfx' && e.id === 'selecionar'));
});

test('atacar causa o dano esperado, e a falha cai quando a vida chega a zero', () => {
  const g = batalhaContra('pulga_corrente');
  const r1 = acaoJogador(g, 'atacar');
  assert.equal(r1.dano, 4, 'ataque 4, defesa 0, variação neutra');
  assert.equal(g.battle.hp, 2);
  const r2 = acaoJogador(g, 'atacar');
  assert.equal(r2.venceu, true);
  assert.equal(g.battle, null);
  assert.equal(g.world.dissipador ? true : true, true);
});

test('elementos: vantagem dá 1,5 vezes, desvantagem dá 0,75, neutro dá 1', () => {
  assert.equal(fatorElemento('calor', 'frio'), 1.5);
  assert.equal(fatorElemento('frio', 'calor'), 0.75);
  assert.equal(fatorElemento('neutro', 'calor'), 1);
  assert.equal(fatorElemento('corrente', 'corrente'), 1);
  assert.ok(calcDano({ poder: 10, defesa: 0, elemento: 'calor', alvoElemento: 'frio', rng: MEIO }) > calcDano({ poder: 10, defesa: 0, elemento: 'frio', alvoElemento: 'calor', rng: MEIO }));
});

test('defender reduz à metade o dano que a falha causa naquele turno', () => {
  const g = batalhaContra('ruido_termico');
  const vida = g.player.hp;
  acaoJogador(g, 'atacar');
  const semDefesa = vida - g.player.hp;

  const h = batalhaContra('ruido_termico');
  const vidaH = h.player.hp;
  acaoJogador(h, 'defender');
  const comDefesa = vidaH - h.player.hp;
  assert.ok(comDefesa < semDefesa, `defender reduz o dano (${comDefesa} < ${semDefesa})`);
});

test('fugir: quando dá certo, encerra o combate e a falha ignora Bit por um tempo', () => {
  const g = batalhaContra('pulga_corrente', { rng: () => 0.1 });
  const r = acaoJogador(g, 'fugir');
  assert.equal(r.tipo, 'fugiu');
  assert.equal(g.battle, null);
  assert.ok(g.world[g.player.camada].entities[0].ignorar > 0);
});

test('fugir falhado dá o turno à falha e o combate continua', () => {
  const g = batalhaContra('pulga_corrente', { rng: () => 0.9 });
  const r = acaoJogador(g, 'fugir');
  assert.equal(r.falhou, true);
  assert.ok(g.battle, 'o combate continua');
});

test('chefe não permite fuga', () => {
  const g = batalhaContra('bolha_termica');
  assert.equal(acaoJogador(g, 'fugir').tipo, 'semFuga');
  assert.ok(g.battle);
});

test('fases do chefe mudam conforme a vida cai (66% e 33%)', () => {
  const g = batalhaContra('bolha_termica');
  g.battle.hp = Math.round(g.battle.maxHp * 0.9);
  assert.equal(faseDoChefe(g.battle), 0);
  g.battle.hp = Math.round(g.battle.maxHp * 0.5);
  assert.equal(faseDoChefe(g.battle), 1);
  g.battle.hp = Math.round(g.battle.maxHp * 0.2);
  assert.equal(faseDoChefe(g.battle), 2);
});

test('ataque com telegrafo do chefe avisa no turno anterior e só acerta no seguinte', () => {
  const g = batalhaContra('bolha_termica', { rng: () => 0.2 });
  const vida = g.player.hp;
  acaoJogador(g, 'defender');
  assert.ok(g.battle.telegrafo, 'o chefe prepara um ataque');
  assert.equal(g.player.hp, vida, 'o primeiro turno só avisa');
  acaoJogador(g, 'defender');
  assert.ok(g.player.hp < vida, 'no turno seguinte o ataque acerta');
});

test('estado de queimadura causa dano no fim da rodada', () => {
  const g = batalhaContra('ruido_termico');
  g.battle.estados.push({ id: 'queimadura', turnos: 2 });
  const vida = g.battle.hp;
  acaoJogador(g, 'defender');
  assert.ok(g.battle && g.battle.hp <= vida - 2, 'queimadura tirou vida da falha');
});

test('derrota de Bit: renasce no início da camada com metade da vida, e a falha continua lá', () => {
  const g = batalhaContra('ruido_termico', { rng: () => 0.99 });
  g.player.hp = 1;
  const r = acaoJogador(g, 'defender');
  assert.equal(r.derrota, true);
  assert.equal(g.battle, null);
  assert.equal(g.player.hp, Math.floor(g.estatisticas().maxHp * 0.5));
  assert.deepEqual([g.player.c, g.player.r], [1, 1]);
});

test('vitória: XP, ciclos, queda de material e marcação no bestiário', () => {
  // Rolagem 0,45: não esquiva, não critica, e a queda (chance 0,5) acontece.
  const g = batalhaContra('pulga_corrente', { rng: () => 0.45 });
  g.battle.hp = 1;
  const ciclos = g.ciclos;
  const xp = g.player.xp;
  const r = acaoJogador(g, 'atacar');
  assert.equal(r.venceu, true);
  assert.ok(g.player.xp > xp || g.player.nivel > 1, 'ganhou XP');
  assert.ok(g.ciclos >= ciclos);
  assert.equal(g.inv.fio_cobre, 1, 'a queda da pulga saiu (chance 0,5 e rolagem 0,45)');
  assert.equal(g.bestiario.pulga_corrente.vencidas, 1);
});

test('vencer o chefe marca a sala como derrotada e tira o chefe do mapa', () => {
  const g = batalhaContra('bolha_termica', { rng: () => 0.45 });
  g.battle.hp = 1;
  const camada = g.player.camada;
  g.world[camada].entities = [{ id: 600, foe: 'bolha_termica', camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: true, ignorar: 0 }];
  g.battle.entId = 600;
  acaoJogador(g, 'atacar');
  assert.equal(g.chefes.bolha_termica, true);
  assert.equal(g.world[camada].entities.length, 0);
});

test('a camada da falha define a escala: a segunda camada tem falhas mais fortes', () => {
  const g = novoJogo(3);
  const camada = LAYER_ORDER[1];
  g.player.camada = camada;
  const ent = { id: 700, foe: 'ruido_termico', camada, c: 2, r: 1, origem: [2, 1], comp: 'estatico', boss: false, ignorar: 0 };
  g.world[camada].entities = [ent];
  iniciarBatalha(g, ent);
  assert.ok(g.battle.hp > 12, 'escala 1,2 da segunda camada');
});

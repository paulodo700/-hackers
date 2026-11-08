import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ART_SPRITES, ART_IDS, FX_IDS, spriteInfo, wallVariant, drawSprite } from '../src/art/index.js';

const FALHAS = ['pulga_corrente', 'rasgo_trilha', 'ruido_termico', 'vazamento_corrente', 'eletromigracao',
  'pico_de_tensao', 'fantasma_de_cache', 'sobrecarga_termica', 'bit_corrompido', 'glitch_de_pipeline'];
const CHEFES = ['bolha_termica', 'varredor_de_trilhas', 'guardiao_do_cache', 'nucleo_instavel', 'fila_infinita',
  'colapso_de_tensao', 'ponte_partida', 'anel_escuro'];
const ITENS = ['liga_ferrugem', 'fio_cobre', 'cristal_silicio', 'placa_base', 'polimero_termico', 'fragmento_escuro',
  'reparo_trilha', 'ajuste_energia', 'reforco_nucleo', 'chave_nucleo', 'pasta_termica', 'refrigerante', 'pulso_reset',
  'injecao_energia', 'patch_impulso', 'capacitor_reserva', 'kit_reparo', 'dissipador_mk1', 'dissipador_mk2',
  'dissipador_mk3', 'antena_mk1', 'antena_mk2', 'antena_mk3', 'modulo_sinal', 'modulo_termico', 'modulo_foco',
  'modulo_ressonante', 'missao_item'];
const RAMOS = ['ramo_fusao', 'ramo_reparo', 'ramo_dissipacao'];
const STATUS = ['queimadura', 'curto', 'lentidao', 'corrosao', 'fraqueza', 'regeneracao', 'escudo', 'foco',
  'impulso', 'bloqueio'].map((s) => `status_${s}`);
const NPCS = ['tecnico_a', 'tecnico_b', 'mercador_a', 'guardiao_a', 'narrador_a'];
const PAREDES = Array.from({ length: 16 }, (_, m) => `parede_${m}`);
const TILES = ['chao_a', 'chao_b', 'chao_c', 'trilha', 'trilha_rompida', 'porta_energia', 'encaixe', 'porta_chefe',
  'bau_fechado', 'bau_aberto', 'zona_quente', 'zona_fria', 'saida', 'anel', ...PAREDES];
const INTERFACE = ['icone_coracao', 'icone_energia', 'icone_ciclo', 'icone_calor', 'icone_seta'];
const FX = ['fx_faisca', 'fx_fumaca', 'fx_anel', 'fx_gelo', 'fx_fogo'];

const SIZES = [
  [['bit', ...FALHAS, ...ITENS, ...RAMOS, ...NPCS, ...TILES], 16],
  [CHEFES, 24],
  [[...STATUS, ...INTERFACE, ...FX, 'desconhecido'], 8],
];

test('todos os ids exigidos existem com o tamanho certo', () => {
  for (const [ids, size] of SIZES) {
    for (const id of ids) {
      assert.ok(ART_SPRITES[id], `falta a sprite ${id}`);
      assert.equal(ART_SPRITES[id].w, size, `${id}: largura`);
      assert.equal(ART_SPRITES[id].h, size, `${id}: altura`);
    }
  }
});

test('ART_IDS lista todas as chaves e FX_IDS existem', () => {
  assert.deepEqual([...ART_IDS].sort(), Object.keys(ART_SPRITES).sort());
  assert.deepEqual(FX_IDS, FX);
  for (const id of FX_IDS) {
    const n = ART_SPRITES[id].frames.length;
    assert.ok(n >= 2 && n <= 4, `${id}: ${n} quadros`);
  }
});

test('formato de cada sprite: linhas, larguras e paleta', () => {
  for (const id of ART_IDS) {
    const s = ART_SPRITES[id];
    assert.ok(Number.isInteger(s.w) && s.w > 0, `${id}: w`);
    assert.ok(Number.isInteger(s.h) && s.h > 0, `${id}: h`);
    assert.ok(Array.isArray(s.frames) && s.frames.length >= 1, `${id}: quadros`);
    assert.ok(!('.' in s.palette), `${id}: '.' não pode estar na paleta`);
    for (const [ch, color] of Object.entries(s.palette)) {
      assert.equal(ch.length, 1, `${id}: chave de paleta ${ch}`);
      assert.match(color, /^#[0-9a-f]{6}$/i, `${id}: cor ${color}`);
    }
    s.frames.forEach((rows, f) => {
      assert.equal(rows.length, s.h, `${id}#${f}: número de linhas`);
      for (const row of rows) {
        assert.equal(typeof row, 'string');
        assert.equal(row.length, s.w, `${id}#${f}: largura da linha "${row}"`);
        for (const ch of row) if (ch !== '.') assert.ok(ch in s.palette, `${id}#${f}: '${ch}' fora da paleta`);
      }
    });
  }
});

test('nenhuma sprite está vazia e as falhas são diferentes entre si', () => {
  for (const id of ART_IDS) {
    const filled = ART_SPRITES[id].frames.every((rows) => rows.some((r) => /[^.]/.test(r)));
    assert.ok(filled, `${id}: quadro vazio`);
  }
  const looks = new Set([...FALHAS, ...CHEFES].map((id) => ART_SPRITES[id].frames[0].join('\n')));
  assert.equal(looks.size, FALHAS.length + CHEFES.length);
});

test('bit tem 8 quadros, e os de direita espelham os de esquerda', () => {
  const bit = ART_SPRITES.bit;
  assert.equal(bit.frames.length, 8);
  assert.equal(spriteInfo('bit').frames, 8);
  const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
  assert.deepEqual(bit.frames[6], mirror(bit.frames[4]));
  assert.deepEqual(bit.frames[7], mirror(bit.frames[5]));
  assert.notDeepEqual(bit.frames[0], bit.frames[1]);
});

test('paredes: 16 variantes, wallVariant e cantos diferentes', () => {
  for (let m = 0; m < 16; m++) {
    assert.equal(wallVariant(m), `parede_${m}`);
    assert.ok(ART_SPRITES[wallVariant(m)]);
  }
  const looks = new Set(PAREDES.map((id) => ART_SPRITES[id].frames[0].join('\n')));
  assert.equal(looks.size, 16);
});

test('spriteInfo devolve dados e cai em desconhecido para ids estranhos', () => {
  assert.deepEqual(spriteInfo('bolha_termica'), { id: 'bolha_termica', w: 24, h: 24, frames: 1 });
  const fallback = { id: 'desconhecido', w: 8, h: 8, frames: 1 };
  assert.deepEqual(spriteInfo('nao_existe'), fallback);
  assert.deepEqual(spriteInfo(undefined), fallback);
  assert.deepEqual(spriteInfo('toString'), fallback);
});

test('drawSprite não faz nada no Node e não lança erro', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(drawSprite({}, 'bit', 0, 0, { scale: 3, frame: 2, flip: true }), false);
  assert.equal(drawSprite(null, 'nao_existe', 0, 0), false);
});

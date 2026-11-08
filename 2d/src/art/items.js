// Ícones de itens (16×16), ramos de habilidade (16×16), estados (8×8), interface (8×8),
// efeitos animados (8×8) e o glifo de reserva 'desconhecido'.
import { Px, sprite } from './px.js';

function icon(draw) {
  const p = new Px(16, 16);
  draw(p);
  p.outline('k');
  return p;
}

// ---------- materiais ----------
const ligaFerrugem = icon((p) => {
  p.poly([[2, 7], [5, 4], [15, 4], [12, 7]], '#');
  p.rect(2, 7, 10, 6, '@');
  p.poly([[12, 7], [15, 4], [15, 10], [12, 13]], '%');
  p.shade('@', { hi: 'o', mid: 'C', lo: 'c' });
  p.replace('#', 'O'); p.replace('%', 'c');
  for (const [x, y] of [[4, 9], [5, 10], [9, 8], [8, 11], [10, 11], [7, 5], [11, 5]]) p.set(x, y, 'h');
  p.set(4, 10, 'R'); p.set(9, 9, 'R'); p.set(13, 8, 'C');
});

const fioCobre = icon((p) => {
  p.rect(4, 4, 8, 8, '@');
  p.shade('@', { hi: 'O', mid: 'o', lo: 'C' });
  for (let y = 5; y < 12; y += 2) p.line(4, y, 11, y, 'C');
  p.rect(2, 2, 12, 2, '#'); p.rect(2, 12, 12, 2, '#');
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  p.line(12, 9, 15, 12, 'o'); p.set(15, 13, 'O');
});

const cristalSilicio = icon((p) => {
  p.poly([[7, 1], [10, 4], [10, 14], [4, 14], [4, 4]], '@');
  p.poly([[11, 6], [14, 8], [13, 14], [10, 14]], '#');
  p.poly([[1, 9], [4, 8], [4, 14], [2, 14]], '#');
  p.shade('@', { hi: 'I', mid: 'i', lo: 'B' });
  p.shade('#', { hi: 'i', mid: 'B', lo: 'b' });
  p.line(7, 2, 7, 13, 'I'); p.set(5, 5, 'I');
});

const placaBase = icon((p) => {
  p.rect(2, 3, 12, 10, '@');
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.line(4, 6, 9, 6, 'Y'); p.line(9, 6, 9, 10, 'Y'); p.line(4, 10, 7, 10, 'Y');
  p.rect(10, 4, 3, 3, 'k'); p.set(11, 5, '6');
  for (const [x, y] of [[3, 4], [3, 11], [12, 11], [6, 8]]) p.set(x, y, 'u');
});

const polimeroTermico = icon((p) => {
  p.rect(4, 3, 8, 11, '@');
  p.rect(6, 1, 4, 2, '#');
  p.shade('@', { hi: 'H', mid: 'h', lo: 'R' });
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  p.rect(5, 6, 6, 4, 'w'); p.rect(6, 7, 4, 2, 'R');
  p.set(5, 4, 'j');
});

const fragmentoEscuro = icon((p) => {
  p.poly([[9, 0], [13, 6], [11, 15], [5, 13], [3, 5]], '@');
  p.shade('@', { hi: 'M', mid: 'A', lo: 'a', hi2: 'm' });
  p.line(8, 2, 6, 11, 'p'); p.set(8, 2, 'P'); p.set(11, 7, 'p');
});

// ---------- ferramentas ----------
const reparoTrilha = icon((p) => {
  p.line(3, 13, 9, 7, '#'); p.line(4, 13, 10, 7, '#'); p.line(3, 12, 9, 6, '#');
  p.line(10, 6, 13, 3, '@'); p.line(10, 5, 12, 3, '@');
  p.shade('#', { hi: 'h', mid: 'R', lo: 'r' });
  p.shade('@', { hi: '7', mid: '6', lo: '5' });
  p.set(14, 2, 'u'); p.set(13, 2, 'H'); p.set(14, 1, 'j');
  p.set(6, 10, 'Y');
});

const ajusteEnergia = icon((p) => {
  p.disc(8, 8.5, 6.5, '@');
  p.shade('@', { hi: '7', mid: '6', lo: '5' });
  p.disc(8, 8.5, 4.5, 'k');
  p.stamp(['..uu', '.uu.', 'uuuu', '.uu.', 'uu..'], 6, 6);
  p.set(8, 1, 'Y'); p.set(8, 0, 'u');
});

const reforcoNucleo = icon((p) => {
  p.rect(2, 2, 12, 12, '@');
  p.shade('@', { hi: '7', mid: '6', lo: '5' });
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) p.set(x, y, 'O');
  p.rect(5, 5, 6, 6, 'k');
  p.rect(6, 6, 4, 4, 'q'); p.set(6, 6, 'Q'); p.set(9, 9, 'B');
});

const chaveNucleo = icon((p) => {
  p.disc(5, 6, 4, '@');
  p.rect(8, 5, 7, 2, '@'); p.rect(12, 7, 2, 3, '@'); p.rect(14, 7, 1, 2, '@');
  p.shade('@', { hi: 'u', mid: 'Y', lo: 'y' });
  p.disc(5, 6, 1.6, 'l'); p.set(4, 5, 'P');
});

// ---------- consumíveis ----------
const pastaTermica = icon((p) => {
  p.line(3, 12, 10, 5, '@'); p.line(4, 12, 11, 5, '@'); p.line(3, 11, 10, 4, '@'); p.line(4, 11, 10, 5, '@');
  p.shade('@', { hi: 'w', mid: 'T', lo: 't' });
  p.line(11, 4, 13, 2, '6'); p.set(14, 1, '7');
  p.line(1, 14, 2, 13, '6');
  p.line(5, 9, 8, 6, 'h');
});

const refrigerante = icon((p) => {
  p.rect(6, 1, 4, 4, '#');
  p.poly([[6, 5], [10, 5], [14, 12], [13, 14], [3, 14], [2, 12]], '@');
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  p.shade('@', { hi: 'I', mid: 'i', lo: 'B' });
  p.rect(4, 10, 8, 3, 'B'); p.set(6, 11, 'I'); p.set(9, 9, 'Q');
});

const pulsoReset = icon((p) => {
  p.ring(8, 8, 3.6, 6.2, '@');
  p.replace('@', '.', (x, y) => x > 8 && y < 7 && y > 1);
  p.shade('@', { hi: 's', mid: 'G', lo: 'g' });
  p.poly([[9, 0], [14, 3.5], [9, 7]], 's');
});

const injecaoEnergia = icon((p) => {
  p.rect(5, 3, 6, 10, '@');
  p.rect(7, 13, 2, 3, '#'); p.rect(6, 1, 4, 2, '#');
  p.shade('@', { hi: 'u', mid: 'Y', lo: 'y' });
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  p.stamp(['..k', '.k.', 'kkk', '.k.', 'k..'], 6, 5);
});

const patchImpulso = icon((p) => {
  p.rect(2, 2, 12, 12, '@');
  p.shade('@', { hi: 'H', mid: 'h', lo: 'R' });
  for (const y of [4, 8]) p.stamp(['...k...', '..kjk..', '.kj.jk.'], 4, y);
  p.set(2, 2, 'k'); p.set(13, 2, 'k'); p.set(2, 13, 'k'); p.set(13, 13, 'k');
});

const capacitorReserva = icon((p) => {
  p.rect(4, 2, 8, 11, '@');
  p.shade('@', { hi: 'E', mid: 'e', lo: 'v' });
  p.rect(9, 3, 2, 9, 'w'); p.rect(9, 6, 2, 1, 'v');
  p.rect(4, 2, 8, 1, '7');
  p.set(6, 13, '6'); p.set(6, 14, '6'); p.set(10, 13, '6'); p.set(10, 14, '6'); p.set(6, 15, '6');
});

const kitReparo = icon((p) => {
  p.rect(1, 5, 14, 9, '@');
  p.rect(5, 2, 6, 3, '#'); p.rect(7, 3, 2, 2, '.');
  p.shade('@', { hi: 'o', mid: 'C', lo: 'c' });
  p.shade('#', { hi: '7', mid: '6', lo: '5' });
  p.rect(1, 8, 14, 1, 'c');
  p.stamp(['7..7', '7777', '.77.', '.66.'], 6, 9);
});

// ---------- equipamentos ----------
function dissipador(level) {
  const ramp = [{ hi: '7', mid: '6', lo: '5' }, { hi: 'O', mid: 'o', lo: 'C' }, { hi: 'u', mid: 'Y', lo: 'y' }][level - 1];
  return icon((p) => {
    p.rect(2, 10, 12, 4, '@');
    const fins = level + 3, gap = Math.floor(12 / fins);
    for (let i = 0; i < fins; i++) p.rect(2 + i * gap + Math.floor((gap - 1) / 2), 2, 1, 8, '@');
    p.shade('@', ramp);
    if (level === 3) for (let x = 3; x < 13; x += 2) p.set(x, 11, 'q');
    for (let i = 0; i < level; i++) p.set(3 + i * 2, 12, 'l');
  });
}

function antena(level) {
  const tip = ['7', 'o', 'q'][level - 1];
  return icon((p) => {
    p.rect(7, 4, 2, 10, '@');
    p.rect(4, 13, 8, 2, '@');
    p.shade('@', { hi: '7', mid: '6', lo: '5' });
    p.disc(8, 3, 1.8, tip);
    for (let i = 1; i <= level; i++) {
      const r = 2 + i * 2;
      p.ring(8, 3.5, r - 0.5, r + 0.3, i === level ? 's' : 'G');
    }
    p.rect(7, 4, 2, 10, '7'); p.rect(8, 4, 1, 10, '6');
    p.replace('s', '.', (x, y) => y > 6); p.replace('G', '.', (x, y) => y > 6);
  });
}

function modulo(glyph) {
  return icon((p) => {
    p.rect(2, 2, 12, 12, '@');
    p.shade('@', { hi: '4', mid: '3', lo: '2' });
    for (let i = 3; i < 13; i += 3) { p.set(i, 1, 'Y'); p.set(i, 14, 'Y'); }
    p.rect(4, 4, 8, 8, 'k');
    glyph(p);
  });
}

const moduloSinal = modulo((p) => {
  p.stamp(['.s....', 's.s..s', '...s.s', '....s.'], 5, 6);
});
const moduloTermico = modulo((p) => {
  p.stamp(['..h...', '.hh.h.', '.hHhh.', 'hHjHh.', 'hHjjH.', '.hHh..'], 5, 5);
});
const moduloFoco = modulo((p) => {
  p.stamp(['..w...', '.www..', 'ww.ww.', '.www..', '..w...'], 5, 5);
  p.set(7, 7, 'l');
});
const moduloRessonante = modulo((p) => {
  p.ring(8, 8, 2.6, 3.4, 'P'); p.ring(8, 8, 0, 1.2, 'p');
  p.replace('P', 'k', (x, y) => x < 4 || x > 11 || y < 4 || y > 11);
});

const missaoItem = icon((p) => {
  p.rect(3, 2, 10, 12, '@');
  p.shade('@', { hi: 'u', mid: 'Y', lo: 'y' });
  p.rect(5, 2, 6, 3, 'k'); p.rect(6, 3, 4, 1, '6');
  p.stamp(['..j..', '.jjj.', 'jjjjj', '.j.j.'], 6, 7, { j: 'w' });
  p.set(8, 7, 'l');
});

// ---------- ramos de habilidade ----------
function ramo(rampBg, glyph) {
  const p = new Px(16, 16);
  p.disc(8, 8, 7.4, '@');
  p.shade('@', rampBg);
  p.disc(8, 8, 5.4, 'k');
  glyph(p);
  p.outline('k');
  return p;
}
const ramoFusao = ramo({ hi: 'H', mid: 'h', lo: 'R' }, (p) => {
  p.stamp(['...jj', '..jj.', '.jjjj', '..jj.', '.jj..', 'j....'], 5, 5);
  p.set(9, 4, 'u'); p.set(5, 10, 'u');
});
const ramoReparo = ramo({ hi: 's', mid: 'G', lo: 'g' }, (p) => {
  p.stamp(['.s..s', '.ssss', '..ss.', '..ss.', '.ss..', 'ss...'], 5, 4, { s: 'Q' });
  p.set(10, 4, 'w');
});
const ramoDissipacao = ramo({ hi: 'i', mid: 'B', lo: 'b' }, (p) => {
  p.stamp(['I.I.I', '.III.', 'IIqII', '.III.', 'I.I.I'], 6, 6);
});

// ---------- estados 8×8 ----------
const STATUS = {
  status_queimadura: ['...h....', '..hh.h..', '..hHhh..', '.hHHjh..', '.hHjjHh.', '.hHjjHh.', '..hHHh..', '...kk...'],
  status_curto: ['....uk..', '...uk...', '..uk....', '.uuuuk..', '...uk...', '..uk....', '.uk.....', '.k......'],
  status_lentidao: ['kkkkkkk.', 'kiiiiik.', '.kiIik..', '..kik...', '..kik...', '.kiIik..', 'kiiiiik.', 'kkkkkkk.'],
  status_corrosao: ['..G.....', '.GsG..G.', '.GGG.GsG', '..g..GGG', '.....g..', '.G......', 'GsG.....', '.g......'],
  status_fraqueza: ['..kMMk..', '..kMMk..', '..kMMk..', 'kkkMMkkk', '.kMppMk.', '..kMMk..', '...kk...', '........'],
  status_regeneracao: ['..kkkk..', '..ksGk..', 'kkksGkkk', 'ksssssGk', 'kGGsGGGk', 'kkksGkkk', '..kGgk..', '..kkkk..'],
  status_escudo: ['kkkkkkk.', 'kQqqqBk.', 'kQqqqBk.', 'kqqqqBk.', 'kqqqBBk.', '.kqqBk..', '..kBk...', '...k....'],
  status_foco: ['...w....', '..kwk...', '.k...k..', 'ww.l.ww.', '.k...k..', '..kwk...', '...w....', '........'],
  status_impulso: ['...kk...', '..kjjk..', '.kjHHjk.', 'kkkjjkkk', '..khhk..', '.khHHhk.', 'kkkhhkkk', '...kk...'],
  status_bloqueio: ['..kkkk..', '.k7kk6k.', '.k7..6k.', 'kkkkkkkk', 'k777766k', 'k76kk65k', 'k766665k', 'kkkkkkkk'],
};

// ---------- interface 8×8 ----------
const UI = {
  icone_coracao: ['.kk.kk..', 'klRkRRk.', 'klRRRRk.', 'kRRRRrk.', '.kRRrk..', '..kRk...', '...k....', '........'],
  icone_energia: ['...kuk..', '..kuk...', '.kuuuk..', 'kuuuuuk.', '..kuk...', '.kuk....', '.kk.....', '........'],
  icone_ciclo: ['..kkkk..', '.kuuYYk.', 'kuukkYyk', 'kuYkkYyk', 'kuYkkYyk', 'kYYkkyyk', '.kYyyyk.', '..kkkk..'],
  icone_calor: ['...kk...', '..kwTk..', '..kwRk..', '..kwRk..', '..kRRk..', '.kRhhRk.', '.kRhhRk.', '..kkkk..'],
  icone_seta: ['.kk.....', '.kwk....', '.kwwk...', '.kwwTk..', '.kwwk...', '.kwk....', '.kk.....', '........'],
};

// ---------- efeitos 8×8 ----------
const FX = {
  fx_faisca: [
    ['........', '........', '...j....', '..jjj...', '...j....', '........', '........', '........'],
    ['...u....', '...j....', '.u.j.u..', 'uujjjuu.', '...j....', '.u.j.u..', '...u....', '........'],
    ['u..H..u.', '........', '..H.H...', 'H.....H.', '..H.H...', '........', 'u..H..u.', '........'],
  ],
  fx_fumaca: [
    ['........', '........', '........', '........', '...TT...', '..TTTt..', '..tTtt..', '...tt...'],
    ['........', '........', '..TT....', '.TTTtT..', '.tTttTt.', '..tttt..', '...tt...', '........'],
    ['..t.....', '.tTt.t..', 't.tt.Tt.', '.t..tt..', '..t..t..', '........', '........', '........'],
  ],
  fx_anel: [
    ['........', '........', '...qq...', '..q..q..', '..q..q..', '...qq...', '........', '........'],
    ['........', '..qqqq..', '.q....q.', '.q....q.', '.q....q.', '.q....q.', '..qqqq..', '........'],
    ['..QQQQ..', '.Q....Q.', 'Q......Q', 'Q......Q', 'Q......Q', 'Q......Q', '.Q....Q.', '..QQQQ..'],
  ],
  fx_gelo: [
    ['........', '........', '...i....', '..iIi...', '...i....', '........', '........', '........'],
    ['...i....', '.i.I.i..', '..iIi...', 'iIIIIIi.', '..iIi...', '.i.I.i..', '...i....', '........'],
    ['...I....', '.I.i.I..', '..B.B...', 'Ii...iI.', '..B.B...', '.I.i.I..', '...I....', '........'],
  ],
  fx_fogo: [
    ['........', '...h....', '..hH....', '..hHh...', '.hHjHh..', '.hHjjh..', '..hHh...', '...R....'],
    ['....h...', '...hh...', '..hHh.h.', '.hHHHhh.', '.hHjjHh.', '.hjjjHh.', '..hHHh..', '..RRR...'],
    ['...h....', '..hh.h..', '..hHhh..', '.hHHjh..', 'hHjjjHh.', '.hHjjh..', '..hHh...', '...R....'],
  ],
};

const DESCONHECIDO = ['.kkkkk..', 'kpPPPpk.', 'kpkkkpk.', '.kkkpPk.', '...kpk..', '...kkk..', '...kpk..', '...kkk..'];

export const ITEM_SPRITES = {
  liga_ferrugem: sprite(ligaFerrugem),
  fio_cobre: sprite(fioCobre),
  cristal_silicio: sprite(cristalSilicio),
  placa_base: sprite(placaBase),
  polimero_termico: sprite(polimeroTermico),
  fragmento_escuro: sprite(fragmentoEscuro),
  reparo_trilha: sprite(reparoTrilha),
  ajuste_energia: sprite(ajusteEnergia),
  reforco_nucleo: sprite(reforcoNucleo),
  chave_nucleo: sprite(chaveNucleo),
  pasta_termica: sprite(pastaTermica),
  refrigerante: sprite(refrigerante),
  pulso_reset: sprite(pulsoReset),
  injecao_energia: sprite(injecaoEnergia),
  patch_impulso: sprite(patchImpulso),
  capacitor_reserva: sprite(capacitorReserva),
  kit_reparo: sprite(kitReparo),
  dissipador_mk1: sprite(dissipador(1)),
  dissipador_mk2: sprite(dissipador(2)),
  dissipador_mk3: sprite(dissipador(3)),
  antena_mk1: sprite(antena(1)),
  antena_mk2: sprite(antena(2)),
  antena_mk3: sprite(antena(3)),
  modulo_sinal: sprite(moduloSinal),
  modulo_termico: sprite(moduloTermico),
  modulo_foco: sprite(moduloFoco),
  modulo_ressonante: sprite(moduloRessonante),
  missao_item: sprite(missaoItem),
  ramo_fusao: sprite(ramoFusao),
  ramo_reparo: sprite(ramoReparo),
  ramo_dissipacao: sprite(ramoDissipacao),
};
for (const [id, rows] of Object.entries({ ...STATUS, ...UI })) ITEM_SPRITES[id] = sprite(rows);
for (const [id, frames] of Object.entries(FX)) ITEM_SPRITES[id] = sprite(...frames);
ITEM_SPRITES.desconhecido = sprite(DESCONHECIDO);

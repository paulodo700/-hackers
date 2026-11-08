// Bit (o robô de manutenção) e os modelos de NPC. 16×16, luz do alto à esquerda.
import { Px, sprite } from './px.js';

const ANTENNA = [
  '.........kuk....',
  '..........k.....',
];

const HEAD = {
  baixo: [
    '.....kkkkkk.....',
    '....kww7777k....',
    '...kw7777776k...',
    '...k7vvvvvv6k...',
    '...k7vqVVqv6k...',
    '...k7vvvvvv6k...',
    '...k66666663k...',
    '....kkkkkkkk....',
  ],
  cima: [
    '.....kkkkkk.....',
    '....kw77776k....',
    '...kw7777766k...',
    '...k77777666k...',
    '...k76363636k...',
    '...k76363636k...',
    '...k66666663k...',
    '....kkkkkkkk....',
  ],
  esq: [
    '.....kkkkkk.....',
    '....kww7777k....',
    '...kw7777776k...',
    '...kvvvv7776k...',
    '...kqVvv7776k...',
    '...kvvvv7766k...',
    '...k66666663k...',
    '....kkkkkkkk....',
  ],
};

const BODY = {
  baixo: [
    '..kkEEEeeeeekk..',
    '.k7kEOoeeeevk7k.',
    '.k6kEoceeeevk6k.',
    '..kkkkkkkkkkkk..',
  ],
  cima: [
    '..kkEEEeeeeekk..',
    '.k7kEe7776evk7k.',
    '.k6kEe6663evk6k.',
    '..kkkkkkkkkkkk..',
  ],
  esq: [
    '...kEEEeeeeek...',
    '...kEOk7keevk...',
    '...kEck6keevk...',
    '...kkkkkkkkkk...',
  ],
};

const LEGS = {
  frente: [['....k6k..k6k....', '....kkk..kkk....'], ['...k6k....k6k...']],
  lado: [['....k6k.k6k.....', '....kkk.kkk.....'], ['...k6k...k6k....']],
};

// step 0: em pé; step 1: o corpo desce um pixel (balanço do passo) e as pernas abrem.
function bitFrame(dir, step) {
  const p = new Px(16, 16);
  const dy = step;
  p.stamp(ANTENNA, 0, dy);
  p.stamp(HEAD[dir], 0, 2 + dy);
  p.stamp(BODY[dir], 0, 10 + dy);
  const legs = LEGS[dir === 'esq' ? 'lado' : 'frente'][step];
  p.stamp(legs, 0, 16 - legs.length);
  return p;
}

const bitFrames = [];
for (const dir of ['baixo', 'cima', 'esq']) bitFrames.push(bitFrame(dir, 0), bitFrame(dir, 1));
bitFrames.push(bitFrames[4].flipX(), bitFrames[5].flipX());

export const CHARACTER_SPRITES = {
  bit: sprite(...bitFrames),

  // Técnico A: capacete amarelo, prancheta de dados na mão.
  tecnico_a: sprite([
    '.....kkkkkk.....',
    '....kuuuYYYk....',
    '...kuYYYYYYyk...',
    '..kkkkkkkkkkkk..',
    '....kffffFFk....',
    '....kfkffkFk....',
    '....kffffFFk....',
    '.....kkFFkk.....',
    '...kkGGGGGgkk...',
    '..kGkGGsGGgkgk..',
    '..kGkGGGGGkkkkk.',
    '..kfkGGGGkkwwwk.',
    '...kkgggk.k7s7k.',
    '....k6kk6kk777k.',
    '....k6k.k6kkkkk.',
    '....kkk.kkk.....',
  ]),

  // Técnico B: óculos de proteção cianos, cabelo curto, macacão laranja, ferramenta no cinto.
  tecnico_b: sprite([
    '................',
    '.....kkkkkk.....',
    '....kNNNNNnk....',
    '...kNNNnnnnnk...',
    '...kffffffFFk...',
    '...kkqqkkqqkk...',
    '...kfQqffQqFk...',
    '....kffffFFk....',
    '.....kkkkkk.....',
    '...kkHHhhhhkk...',
    '..kHkHHkkhhkhk..',
    '..kHkHhkkhhkhk..',
    '..kfkkYkkkkkfk..',
    '....kRRkRRk.....',
    '....kRRkRRk.....',
    '....kkk.kkk.....',
  ]),

  // Mercador: capuz de cobre, saco de peças nas costas.
  mercador_a: sprite([
    '......kkkk......',
    '....kkOooCkk....',
    '...kOoooooCCk...',
    '..kOokkkkkkCCk..',
    '..kokffffFFkCk..',
    '..kokfkffkFkCkkk',
    '..kCkffffFFkknNk',
    '..kCCkkFFkkCknNk',
    '.kkoooCCCCCCknnk',
    '.kOookoooCCCknnk',
    '.kOookYCCCCCkkkk',
    '.kookkoooCCCknk.',
    '.kkkk.kCCCCCkkk.',
    '......kckkcck...',
    '......kck.kck...',
    '......kkk.kkk...',
  ]),

  // Guardião: armadura de aço, viseira estreita, ombreiras largas e escudo com núcleo.
  guardiao_a: sprite([
    '.....kkkkkk.....',
    '....kww7776k....',
    '...kw777776Kk...',
    '...k7kkkkkk6k...',
    '...k7kqqqqk6k...',
    '...k77kkkk66k...',
    '..kkk666663kkk..',
    '.kw77kkkkkk776k.',
    '.k7776w7766k76k.',
    '.kk7kkkkkkkk6kk.',
    '.k76kw7777k6k...',
    '.k76kw7qq6k6k...',
    '.kkkkw7qq6kkk...',
    '....kk7666k.....',
    '....k6kkk6k.....',
    '....kkk.kkk.....',
  ]),

  // Narrador: cabeça de tela luminosa com rosto em sinal, corpo de manto escuro.
  narrador_a: sprite([
    '..kkkkkkkkkkkk..',
    '.k766666666663k.',
    '.k6gggggggggg3k.',
    '.k6gsGggggsGg3k.',
    '.k6gGgggggGgg3k.',
    '.k6gggggggggg3k.',
    '.k6ggsssssggg3k.',
    '.k6gggggggggg3k.',
    '.k33333333333Kk.',
    '..kkkk6kk3kkkk..',
    '...kAAAmmmmmk...',
    '..kAAmAmmmmmmk..',
    '..kAmmAmmGmmmk..',
    '..kAmmmAmmmmmk..',
    '..kmmmmmmmmmmk..',
    '..kkkkkkkkkkkk..',
  ]),
};

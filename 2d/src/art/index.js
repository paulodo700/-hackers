// Interface de arte (GDD §12). Sprites em pixel art: {w, h, frames: [linhas...], palette}.
// '.' é transparente; todo outro caractere está na paleta. drawSprite só age no navegador.
import { CHARACTER_SPRITES } from './characters.js';
import { FOE_SPRITES } from './foes.js';
import { ITEM_SPRITES } from './items.js';
import { TILE_SPRITES } from './tiles.js';

export const ART_SPRITES = {
  ...CHARACTER_SPRITES,
  ...FOE_SPRITES,
  ...ITEM_SPRITES,
  ...TILE_SPRITES,
};

export const ART_IDS = Object.keys(ART_SPRITES);

export const FX_IDS = ['fx_faisca', 'fx_fumaca', 'fx_anel', 'fx_gelo', 'fx_fogo'];

const FALLBACK = 'desconhecido';

function resolve(id) {
  return Object.prototype.hasOwnProperty.call(ART_SPRITES, id) ? id : FALLBACK;
}

export function spriteInfo(id) {
  const key = resolve(id);
  const s = ART_SPRITES[key];
  return { id: key, w: s.w, h: s.h, frames: s.frames.length };
}

// Bits da máscara: norte 1, leste 2, sul 4, oeste 8.
export function wallVariant(mask) {
  const m = Number.isInteger(mask) ? mask & 15 : 0;
  return `parede_${m}`;
}

const cache = new Map();

function buildCanvas(s, frame, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = s.w * scale;
  canvas.height = s.h * scale;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rows = s.frames[frame];
  for (let y = 0; y < s.h; y++) {
    const row = rows[y];
    for (let x = 0; x < s.w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = s.palette[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

export function drawSprite(ctx, id, x, y, opts = {}) {
  if (typeof document === 'undefined' || !ctx) return false;
  const { scale = 2, frame = 0, flip = false, alpha = 1 } = opts;
  const key = resolve(id);
  const s = ART_SPRITES[key];
  const n = s.frames.length;
  const f = ((Math.floor(frame) % n) + n) % n;
  const sc = Math.max(1, Math.round(scale));
  const cacheKey = `${key}|${f}|${sc}`;
  let canvas = cache.get(cacheKey);
  if (!canvas) {
    canvas = buildCanvas(s, f, sc);
    cache.set(cacheKey, canvas);
  }
  const prevAlpha = ctx.globalAlpha;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + canvas.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(canvas, x, y);
  }
  ctx.globalAlpha = prevAlpha;
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}

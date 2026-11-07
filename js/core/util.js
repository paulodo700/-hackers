// Utilitários gerais: matemática, RNG semeado, armazenamento seguro e texto.
(() => {
  const V = (window.V = window.V || {});

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
  const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeInOut = (t) => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const smoothstep = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Gerador pseudoaleatório semeado (mulberry32): mesma semente, mesma sequência.
  function makeRng(seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()), // inclusivo
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      weighted(items) {
        let total = 0;
        for (const it of items) total += it.w;
        let r = next() * total;
        for (const it of items) {
          r -= it.w;
          if (r <= 0) return it;
        }
        return items[items.length - 1];
      },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
  }

  // RNG do combate (não precisa ser reproduzível).
  const R = makeRng((Math.random() * 0xffffffff) >>> 0);

  // Armazenamento seguro: nunca quebra o jogo se localStorage estiver bloqueado.
  const store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem('vaelmor:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem('vaelmor:' + key, JSON.stringify(value));
      } catch (e) {
        /* modo privado ou armazenamento cheio: ignora */
      }
    },
  };

  // Quebra um texto em linhas que caibam em maxW pixels com a fonte atual do contexto.
  function wrapText(g, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (g.measureText(test).width <= maxW || !line) {
          line = test;
        } else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }

  const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif";
  const FONT_TITLE = "Georgia, 'Times New Roman', serif";

  V.Util = {
    TAU,
    clamp,
    lerp,
    approach,
    dist,
    dist2,
    angleTo,
    easeOutCubic,
    easeInOut,
    smoothstep,
    makeRng,
    R,
    store,
    wrapText,
    FONT,
    FONT_TITLE,
  };
})();

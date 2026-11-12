// Locais conhecidos da cidade: os que a central cadastra e os que o sistema aprende com as corridas.
// É o que dá precisão de número de casa onde o mapa gratuito só conhece a rua.
const { AppError } = require('./errors');
const { validCoord } = require('./geo');

const ABBREV = {
  r: 'rua', av: 'avenida', avda: 'avenida', tv: 'travessa', trav: 'travessa', pc: 'praca', pca: 'praca',
  al: 'alameda', rod: 'rodovia', est: 'estrada', qd: 'quadra', lt: 'lote', st: 'setor', jd: 'jardim',
  dr: 'doutor', dra: 'doutora', prof: 'professor', sta: 'santa', sto: 'santo', cel: 'coronel', pe: 'padre',
};
const IGNORE = new Set(['n', 'no', 'num', 'numero', 'de', 'da', 'do', 'das', 'dos', 'e']);

// "R. 13 de Maio, nº 500 - Centro" → "rua 13 maio 500 centro"
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[º°ª]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => ABBREV[w] || w)
    .filter((w) => w && !IGNORE.has(w))
    .join(' ');
}

// Textos que não são endereço (já normalizados, sem "no"/"de").
const GENERIC = /^(local marcado mapa|partida|destino|buscando endereco)?$/;
const STREET_WORDS = new Set(['rua', 'avenida', 'travessa', 'praca', 'alameda', 'rodovia', 'estrada', 'quadra', 'setor']);

// Tem número de casa? Um número só depois de "rua" é nome da rua ("Rua 13 de Maio"), não número.
function hasHouseNumber(norm) {
  const words = norm.split(' ');
  const nums = words.map((w, i) => ({ w, i })).filter((x) => /^\d+$/.test(x.w));
  if (!nums.length) return false;
  if (nums.length === 1 && nums[0].i > 0 && STREET_WORDS.has(words[nums[0].i - 1])) return false;
  return true;
}

function createPlaces({ db }) {
  const public_ = (r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, source: r.source, uses: r.uses, updated_at: r.updated_at });

  // Busca por palavras: todas as palavras digitadas precisam aparecer no nome.
  function search(q, limit = 4) {
    const words = normalize(q).split(' ').filter(Boolean);
    if (!words.length || words.join('').length < 2) return [];
    const where = words.map(() => "(' ' || norm) LIKE ?").join(' AND ');
    const args = words.map((w) => `% ${w.replace(/[%_]/g, '')}%`);
    return db
      .prepare(`SELECT * FROM places WHERE ${where} ORDER BY source = 'central' DESC, uses DESC, LENGTH(norm) LIMIT ?`)
      .all(...args, limit)
      .map(public_);
  }

  function upsert(name, pos, source) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const norm = normalize(clean);
    if (norm.length < 3 || GENERIC.test(norm)) throw new AppError(400, 'Informe o nome do local');
    if (!validCoord(pos)) throw new AppError(400, 'Marque o local no mapa');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO places (name, norm, lat, lng, source, uses, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(norm, source) DO UPDATE SET name = excluded.name, lat = excluded.lat, lng = excluded.lng,
         uses = uses + 1, updated_at = excluded.updated_at`
    ).run(clean, norm, pos.lat, pos.lng, source, now);
    return public_(db.prepare('SELECT * FROM places WHERE norm = ? AND source = ?').get(norm, source));
  }

  // Cadastro feito pela central.
  const add = (name, pos) => upsert(name, pos, 'central');

  // Aprendizado: endereço com número, cuja posição foi confirmada por uma pessoa (pino ajustado ou GPS)
  // em uma corrida que realmente aconteceu. Nunca atrapalha a corrida se algo der errado.
  function learn(text, pos) {
    try {
      const norm = normalize(text);
      if (!hasHouseNumber(norm) || norm.split(' ').length < 2 || GENERIC.test(norm)) return null;
      return upsert(text, pos, 'corrida');
    } catch {
      return null;
    }
  }

  function remove(id) {
    const info = db.prepare('DELETE FROM places WHERE id = ?').run(Number(id));
    if (info.changes !== 1) throw new AppError(404, 'Local não encontrado');
  }

  function list(q) {
    const rows = q ? search(q, 200) : db.prepare("SELECT * FROM places ORDER BY source = 'central' DESC, uses DESC, name LIMIT 500").all().map(public_);
    const total = db.prepare('SELECT COUNT(*) AS n FROM places').get().n;
    return { total, places: rows };
  }

  return { search, add, learn, remove, list };
}

module.exports = { createPlaces, normalize };

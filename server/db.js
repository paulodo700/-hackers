const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { AppError } = require('./errors');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('passenger','driver','admin')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS drivers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  plate TEXT NOT NULL DEFAULT '',
  moto_model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')),
  online INTEGER NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passenger_id INTEGER REFERENCES users(id),
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL DEFAULT '',
  driver_id INTEGER REFERENCES users(id),
  origin_text TEXT NOT NULL DEFAULT '',
  origin_lat REAL NOT NULL,
  origin_lng REAL NOT NULL,
  dest_text TEXT NOT NULL DEFAULT '',
  dest_lat REAL NOT NULL,
  dest_lng REAL NOT NULL,
  distance_km REAL NOT NULL,
  price REAL NOT NULL,
  payment TEXT NOT NULL CHECK (payment IN ('cash','pix')),
  status TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('app','central')),
  notes TEXT NOT NULL DEFAULT '',
  rating INTEGER,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  arrived_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS rides_passenger ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS rides_driver ON rides(driver_id);
CREATE TABLE IF NOT EXISTS ride_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ride_id INTEGER NOT NULL REFERENCES rides(id),
  driver_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','expired')),
  exclusive INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS offers_ride ON ride_offers(ride_id);
CREATE TABLE IF NOT EXISTS driver_bank (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  holder_name TEXT NOT NULL,
  holder_doc TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  pix_type TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS driver_docs (
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  rides INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  admin_id INTEGER REFERENCES users(id),
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  amount REAL NOT NULL,
  kind TEXT NOT NULL,
  ride_id INTEGER,
  withdrawal_id INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_once_per_ride ON ledger(kind, ride_id, account) WHERE ride_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_account ON ledger(account);
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  amount REAL NOT NULL,
  holder_name TEXT NOT NULL,
  holder_doc TEXT NOT NULL,
  pix_type TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','rejected')),
  requested_at TEXT NOT NULL,
  paid_at TEXT,
  admin_id INTEGER,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_user ON push_subs(user_id);
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('central','corrida')),
  uses INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (norm, source)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// Padrões da especificação. A cidade é ajustada pela central nas configurações.
const DEFAULTS = {
  base_fare: 3,
  per_km: 2,
  min_fare: 6,
  commission_percent: 10,
  offer_timeout_s: 20,
  city_name: 'Minha Cidade',
  city_lat: -15.7801,
  city_lng: -47.9292,
  tz_offset_hours: -3,
  brand_name: 'Mototáxi',
  brand_color: '#ffc107',
  support_phone: '',
  // Personalização feita pela central
  slogan: 'Peça sua moto em poucos toques',
  notice_passenger: '',
  notice_driver: '',
  pix_key: '',
  default_theme: 'auto',
  pay_cash: 1,
  pay_pix: 1,
  // Itens do menu lateral de cada tela (1 = aparece)
  p_history: 1,
  p_support: 1,
  p_terms: 1,
  d_earnings: 1,
  d_support: 1,
  d_terms: 1,
  // Só aprova motoqueiro com documentos e dados bancários enviados
  require_docs: 1,
  // Conta da central (para receber a comissão). `pix_key` acima é a chave dela.
  central_holder: '',
  central_doc: '',
  central_bank: '',
  central_pix_type: '',
};

// Chaves de liga/desliga.
const FLAGS = ['pay_cash', 'pay_pix', 'p_history', 'p_support', 'p_terms', 'd_earnings', 'd_support', 'd_terms', 'require_docs'];
// Dados bancários da central: só mudam pela rota própria, que exige a senha.
const BANK_KEYS = ['pix_key', 'central_holder', 'central_doc', 'central_bank', 'central_pix_type'];
// Textos: tamanho máximo e se podem ficar vazios.
const TEXTS = {
  city_name: { max: 80 },
  brand_name: { max: 30 },
  brand_color: { max: 7 },
  support_phone: { max: 30, optional: true },
  slogan: { max: 60 },
  notice_passenger: { max: 160, optional: true },
  notice_driver: { max: 160, optional: true },
  pix_key: { max: 80, optional: true },
  central_holder: { max: 60, optional: true },
  central_doc: { max: 20, optional: true },
  central_bank: { max: 40, optional: true },
  central_pix_type: { max: 12, optional: true },
  default_theme: { max: 10 },
};
// O que as telas de passageiro e motoqueiro podem saber (preços e comissão ficam de fora).
const PUBLIC_KEYS = [
  'city_name', 'city_lat', 'city_lng', 'tz_offset_hours', 'brand_name', 'brand_color', 'support_phone', 'slogan',
  'notice_passenger', 'notice_driver', 'default_theme', ...FLAGS.filter((k) => k !== 'require_docs'),
];

// Limites aceitos em cada configuração numérica.
const LIMITS = {
  base_fare: [0, 1000],
  per_km: [0, 1000],
  min_fare: [0, 1000],
  commission_percent: [0, 100],
  offer_timeout_s: [5, 120],
  city_lat: [-90, 90],
  city_lng: [-180, 180],
  tz_offset_hours: [-12, 14],
  ...Object.fromEntries(FLAGS.map((k) => [k, [0, 1]])),
};

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // Bancos criados em versões anteriores ganham as colunas novas sem perder nada.
  const rideCols = new Set(db.prepare('PRAGMA table_info(rides)').all().map((c) => c.name));
  if (!rideCols.has('duration_min')) db.exec('ALTER TABLE rides ADD COLUMN duration_min REAL');
  if (!rideCols.has('route')) db.exec('ALTER TABLE rides ADD COLUMN route TEXT');
  const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  for (const col of ['email', 'emergency_name', 'emergency_phone', 'cpf', 'asaas_customer_id']) {
    if (!userCols.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
  }
  if (!userCols.has('blocked')) db.exec('ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0');
  for (const [col, type] of [['commission', 'REAL'], ['settled_at', 'TEXT'], ['settlement_id', 'INTEGER'], ['origin_precise', 'INTEGER'], ['dest_precise', 'INTEGER'], ['payment_status', "TEXT NOT NULL DEFAULT 'pending'"], ['paid_at', 'TEXT'], ['payment_ref', 'TEXT'], ['wallet_at', 'TEXT']]) {
    if (!rideCols.has(col)) db.exec(`ALTER TABLE rides ADD COLUMN ${col} ${type}`);
  }
  const driverCols = new Set(db.prepare('PRAGMA table_info(drivers)').all().map((c) => c.name));
  if (!driverCols.has('cnh_expires')) db.exec("ALTER TABLE drivers ADD COLUMN cnh_expires TEXT NOT NULL DEFAULT ''");
  if (!driverCols.has('asaas_wallet_id')) db.exec("ALTER TABLE drivers ADD COLUMN asaas_wallet_id TEXT NOT NULL DEFAULT ''");
  if (!driverCols.has('pay_notice_at')) db.exec('ALTER TABLE drivers ADD COLUMN pay_notice_at TEXT');
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULTS)) insert.run(key, String(value));
  // Corridas concluídas antes de existir o controle de comissão recebem o valor pela taxa atual.
  // Uma vez só: corridas concluídas antes da carteira já foram pagas no sistema antigo, então entram como pagas.
  const migrated = db.prepare("SELECT value FROM settings WHERE key = 'wallet_migrated'").get();
  if (!migrated) {
    db.prepare("UPDATE rides SET payment_status = 'paid', paid_at = COALESCE(completed_at, created_at) WHERE status = 'completed'").run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('wallet_migrated', '1')").run();
  }
  const pct = Number(db.prepare("SELECT value FROM settings WHERE key = 'commission_percent'").get().value);
  db.prepare("UPDATE rides SET commission = ROUND(price * ? / 100, 2) WHERE status = 'completed' AND commission IS NULL").run(pct);
  return db;
}

function getSettings(db) {
  const out = {};
  for (const { key, value } of db.prepare('SELECT key, value FROM settings').all()) {
    if (!(key in DEFAULTS)) continue;
    out[key] = typeof DEFAULTS[key] === 'number' ? Number(value) : value;
  }
  return out;
}

function setSettings(db, patch) {
  const clean = {};
  for (const [key, raw] of Object.entries(patch || {})) {
    if (!(key in DEFAULTS) || BANK_KEYS.includes(key)) continue;
    if (FLAGS.includes(key)) {
      if (raw === true || raw === 1 || raw === '1') clean[key] = 1;
      else if (raw === false || raw === 0 || raw === '0') clean[key] = 0;
      else throw new AppError(400, `Valor inválido para ${key}`);
    } else if (typeof DEFAULTS[key] === 'number') {
      const n = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
      const [min, max] = LIMITS[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
        throw new AppError(400, `Valor inválido para ${key}`);
      }
      clean[key] = n;
    } else {
      const rule = TEXTS[key];
      const s = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, rule.max);
      if (!s && !rule.optional) throw new AppError(400, `Valor inválido para ${key}`);
      if (key === 'support_phone') {
        // Telefone/WhatsApp da central mostrado aos usuários. Vazio = não mostrar.
        const digits = s.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
        if (s && digits.length !== 10 && digits.length !== 11) throw new AppError(400, 'Telefone da central inválido (use DDD + número)');
        clean[key] = s ? digits : '';
      } else if (key === 'brand_color') {
        if (!/^#[0-9a-f]{6}$/i.test(s)) throw new AppError(400, 'Cor inválida');
        clean[key] = s.toLowerCase();
      } else if (key === 'default_theme') {
        if (!['auto', 'claro', 'escuro'].includes(s)) throw new AppError(400, 'Tema inválido');
        clean[key] = s;
      } else {
        clean[key] = s;
      }
    }
  }
  const after = { ...getSettings(db), ...clean };
  if (!after.pay_cash && !after.pay_pix) throw new AppError(400, 'Deixe pelo menos uma forma de pagamento ligada');
  const save = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(clean)) save.run(key, String(value));
  })();
}

function publicSettings(db) {
  const all = getSettings(db);
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, all[k]]));
}

// Grava os dados bancários da central (já validados por quem chama).
function setCentralBank(db, bank) {
  const save = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  db.transaction(() => {
    save.run('central_holder', bank.holder_name);
    save.run('central_doc', bank.holder_doc);
    save.run('central_bank', bank.bank_name);
    save.run('central_pix_type', bank.pix_type);
    save.run('pix_key', bank.pix_key);
  })();
}

module.exports = { openDb, getSettings, setSettings, setCentralBank, publicSettings, DEFAULTS, FLAGS };

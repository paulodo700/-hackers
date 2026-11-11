const fs = require('node:fs');
const path = require('node:path');

// Carrega o arquivo .env (se existir) sem depender de biblioteca externa.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile(path.join(__dirname, '..', '.env'));

const crypto = require('node:crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'mototaxi.db');

// Segredo que assina os logins. Se não vier por variável de ambiente, é sorteado uma vez e
// guardado ao lado do banco de dados; nunca existe um segredo padrão conhecido.
function loadJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'troque-este-segredo') return process.env.JWT_SECRET;
  const random = () => crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_TEST_CONTEXT || dbPath === ':memory:') return random();
  const file = path.join(path.dirname(dbPath), '.jwt-secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch {
    /* ainda não existe */
  }
  const secret = random();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: loadJwtSecret(),
  dbPath,
  // Modo de teste: permite abrir dentro de uma pré-visualização e marcar a posição do motoqueiro no mapa.
  demo: !!process.env.DEMO_MODE,
  // Pasta das cópias de segurança diárias (pode apontar para um pendrive ou pasta do Google Drive).
  backupDir: process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups'),
  adminPhone: process.env.ADMIN_PHONE || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org',
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
};

module.exports = config;

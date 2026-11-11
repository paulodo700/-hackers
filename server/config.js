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

const DEV_SECRET = 'segredo-apenas-para-desenvolvimento';

const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || DEV_SECRET,
  usingDevSecret: !process.env.JWT_SECRET,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'mototaxi.db'),
  adminPhone: process.env.ADMIN_PHONE || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org',
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
};

module.exports = config;

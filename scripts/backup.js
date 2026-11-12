// Cópia de segurança do banco de dados. Pode rodar com o servidor ligado.
// Uso: node scripts/backup.js [pasta-de-destino]
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../server/config');

const KEEP = 30; // quantas cópias guardar

async function backup(dbPath, destDir, now = new Date()) {
  if (!fs.existsSync(dbPath)) throw new Error(`Banco de dados nao encontrado em ${dbPath}`);
  fs.mkdirSync(destDir, { recursive: true });
  const stamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
  const dest = path.join(destDir, `mototaxi-${stamp}.db`);
  const db = new Database(dbPath, { readonly: true });
  try {
    await db.backup(dest); // cópia consistente, mesmo com o servidor gravando
  } finally {
    db.close();
  }
  // Confere se a cópia abre e está íntegra antes de apagar as antigas.
  // Também a deixa em um arquivo só (sem os auxiliares -wal/-shm), fácil de copiar para um pendrive.
  const check = new Database(dest);
  const ok = check.pragma('integrity_check', { simple: true }) === 'ok';
  check.pragma('journal_mode = DELETE');
  check.close();
  if (!ok) throw new Error('A copia ficou corrompida. Nada foi apagado.');

  const old = fs
    .readdirSync(destDir)
    .filter((f) => /^mototaxi-.*\.db$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) fs.unlinkSync(path.join(destDir, f));
  return dest;
}

// Faz a cópia do dia, se ainda não existir (o servidor chama isto de hora em hora).
async function dailyBackup(dbPath, destDir, now = new Date()) {
  const today = `mototaxi-${now.toISOString().slice(0, 10)}`;
  if (fs.existsSync(destDir) && fs.readdirSync(destDir).some((f) => f.startsWith(today))) return null;
  return backup(dbPath, destDir, now);
}

if (require.main === module) {
  const destDir = process.argv[2] || path.join(__dirname, '..', 'backups');
  backup(config.dbPath, destDir)
    .then((dest) => console.log(`Copia de seguranca criada: ${dest}`))
    .catch((err) => {
      console.error('Erro no backup:', err.message);
      process.exit(1);
    });
}

module.exports = { backup, dailyBackup, KEEP };

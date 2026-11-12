const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { openDb } = require('../server/db');
const { backup, dailyBackup, KEEP } = require('../scripts/backup');

test('backup: copia íntegra com o banco aberto e guarda só as mais recentes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mototaxi-bkp-'));
  const dbPath = path.join(dir, 'data', 'mototaxi.db');
  const live = openDb(dbPath); // fica aberto, como o servidor ligado
  live.prepare("INSERT INTO users (role, name, phone, password_hash, created_at) VALUES ('passenger', 'Maria', '11988887777', 'x', 'agora')").run();

  const dest = path.join(dir, 'backups');
  const file = await backup(dbPath, dest, new Date('2026-11-11T15:30:00Z'));
  assert.equal(path.basename(file), 'mototaxi-2026-11-11_15h30.db');
  const copy = new Database(file, { readonly: true });
  assert.equal(copy.prepare('SELECT name FROM users').get().name, 'Maria');
  copy.close();

  for (let day = 1; day <= KEEP + 4; day++) {
    await backup(dbPath, dest, new Date(Date.UTC(2027, 0, day, 3, 0)));
  }
  const files = fs.readdirSync(dest).sort();
  assert.equal(files.length, KEEP);
  assert.equal(files.at(-1), `mototaxi-2027-02-03_03h00.db`);
  assert.ok(!files.includes('mototaxi-2026-11-11_15h30.db'));

  // Cópia diária: só uma por dia.
  const day = new Date('2027-03-10T08:00:00Z');
  assert.ok(await dailyBackup(dbPath, dest, day));
  assert.equal(await dailyBackup(dbPath, dest, new Date('2027-03-10T20:00:00Z')), null);
  assert.ok(await dailyBackup(dbPath, dest, new Date('2027-03-11T08:00:00Z')));
  live.close();

  await assert.rejects(backup(path.join(dir, 'nao-existe.db'), dest));
});

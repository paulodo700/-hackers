const http = require('node:http');
const { EventEmitter } = require('node:events');
const config = require('./config');
const { openDb } = require('./db');
const { ensureAdmin } = require('./auth');
const geo = require('./geo');
const { createRideService } = require('./rides');
const { createDriverService } = require('./drivers');
const { createDispatcher } = require('./dispatch');
const { createAudit } = require('./audit');
const { createDocs } = require('./docs');
const { createFinance } = require('./finance');
const { createApp } = require('./app');
const { attachRealtime } = require('./realtime');

// Junta todas as peças. `geo` pode ser trocado nos testes.
function buildServer({ dbPath = config.dbPath, geoImpl = geo, docsDir = config.docsDir } = {}) {
  const db = openDb(dbPath);
  const bus = new EventEmitter();
  const rides = createRideService({ db, bus });
  const drivers = createDriverService({ db, bus });
  const dispatch = createDispatcher({ db, bus, rides });
  const audit = createAudit({ db });
  const docs = createDocs({ db, dir: docsDir });
  const finance = createFinance({ db, audit });
  const deps = { db, bus, rides, drivers, dispatch, audit, docs, finance, geo: geo.withRouteCache(geoImpl) };
  const app = createApp(deps);
  const server = http.createServer(app);
  const io = attachRealtime(server, deps);
  const close = () =>
    new Promise((resolve) => {
      dispatch.stop();
      io.close(() => {
        db.close();
        resolve();
      });
    });
  return { ...deps, app, server, io, close };
}

if (require.main === module) {
  const built = buildServer();
  const admin = ensureAdmin(built.db, { phone: config.adminPhone, password: config.adminPassword });
  if (admin === 'created') console.log(`Acesso da central criado para o telefone ${config.adminPhone}.`);
  if (admin === 'missing') {
    console.warn('AVISO: nenhum acesso da central existe. Defina ADMIN_PHONE e ADMIN_PASSWORD (mínimo 6 caracteres).');
  }
  built.dispatch.recover();
  built.server.listen(config.port, () => {
    console.log(`Mototáxi rodando em http://localhost:${config.port}`);
    console.log(`Banco de dados em ${config.dbPath}`);
    console.log(`Copias de seguranca em ${config.backupDir}`);
    if (config.demo) console.warn('AVISO: DEMO_MODE ligado. Não use assim com passageiros de verdade.');
  });

  // Cópia de segurança automática: uma por dia, guardando as 30 mais recentes.
  const { dailyBackup } = require('../scripts/backup');
  const runBackup = () =>
    dailyBackup(config.dbPath, config.backupDir)
      .then((file) => file && console.log(`Copia de seguranca criada: ${file}`))
      .catch((err) => console.error('Falha na copia de seguranca:', err.message));
  setTimeout(runBackup, 60 * 1000).unref();
  setInterval(runBackup, 60 * 60 * 1000).unref();

  // A hospedagem avisa antes de desligar ou atualizar: fecha tudo direito para não corromper o banco.
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      console.log('Desligando…');
      setTimeout(() => process.exit(0), 5000).unref();
      built.close().then(() => process.exit(0));
    });
  }
}

module.exports = { buildServer };

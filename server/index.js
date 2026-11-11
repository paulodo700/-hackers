const http = require('node:http');
const { EventEmitter } = require('node:events');
const config = require('./config');
const { openDb } = require('./db');
const { ensureAdmin } = require('./auth');
const geo = require('./geo');
const { createRideService } = require('./rides');
const { createDriverService } = require('./drivers');
const { createDispatcher } = require('./dispatch');
const { createApp } = require('./app');
const { attachRealtime } = require('./realtime');

// Junta todas as peças. `geo` pode ser trocado nos testes.
function buildServer({ dbPath = config.dbPath, geoImpl = geo } = {}) {
  const db = openDb(dbPath);
  const bus = new EventEmitter();
  const rides = createRideService({ db, bus });
  const drivers = createDriverService({ db, bus });
  const dispatch = createDispatcher({ db, bus, rides });
  const deps = { db, bus, rides, drivers, dispatch, geo: geoImpl };
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
  });
}

module.exports = { buildServer };

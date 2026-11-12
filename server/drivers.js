const { AppError } = require('./errors');
const { validCoord } = require('./geo');
const { WITH_DRIVER } = require('./rides');

// Posição com mais de 2 minutos é considerada velha: o motoqueiro para de receber ofertas.
const FRESH_MS = 120 * 1000;

function createDriverService({ db, bus, now = Date.now }) {
  const marks = WITH_DRIVER.map(() => '?').join(',');

  function get(id) {
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.created_at, d.plate, d.moto_model, d.status, d.online, d.lat, d.lng, d.last_seen, d.cnh_expires
           FROM users u JOIN drivers d ON d.user_id = u.id WHERE u.id = ?`
      )
      .get(Number(id));
    return row ? decorate(row) : null;
  }

  function decorate(row) {
    const busy = !!db
      .prepare(`SELECT 1 FROM rides WHERE driver_id = ? AND status IN (${marks})`)
      .get(row.id, ...WITH_DRIVER);
    return {
      ...row,
      online: !!row.online,
      fresh: row.last_seen != null && now() - row.last_seen <= FRESH_MS,
      busy,
    };
  }

  function list() {
    return db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.created_at, d.plate, d.moto_model, d.status, d.online, d.lat, d.lng, d.last_seen, d.cnh_expires
           FROM users u JOIN drivers d ON d.user_id = u.id ORDER BY d.status = 'pending' DESC, u.name`
      )
      .all()
      .map(decorate);
  }

  function mustGet(id) {
    const driver = get(id);
    if (!driver) throw new AppError(404, 'Motoqueiro não encontrado');
    return driver;
  }

  function updateLocation(id, pos) {
    const p = { lat: pos && pos.lat, lng: pos && pos.lng };
    if (!validCoord(p)) throw new AppError(400, 'Localização inválida');
    db.prepare('UPDATE drivers SET lat = ?, lng = ?, last_seen = ? WHERE user_id = ?').run(p.lat, p.lng, now(), id);
    bus.emit('driver:location', { driverId: id, lat: p.lat, lng: p.lng });
  }

  function setOnline(id, online, pos) {
    const driver = mustGet(id);
    if (online) {
      if (driver.status === 'pending') throw new AppError(403, 'Seu cadastro ainda não foi aprovado pela central');
      if (driver.status !== 'approved') throw new AppError(403, 'Seu cadastro está bloqueado. Fale com a central.');
      if (!validCoord(pos)) throw new AppError(400, 'Ative a localização (GPS) para ficar online');
      updateLocation(id, pos);
    } else if (driver.busy) {
      throw new AppError(409, 'Finalize a corrida antes de ficar offline');
    }
    db.prepare('UPDATE drivers SET online = ? WHERE user_id = ?').run(online ? 1 : 0, id);
    bus.emit('drivers:update');
    return get(id);
  }

  function setStatus(id, status) {
    mustGet(id);
    if (!['pending', 'approved', 'blocked'].includes(status)) throw new AppError(400, 'Situação inválida');
    if (status === 'approved') {
      db.prepare('UPDATE drivers SET status = ? WHERE user_id = ?').run(status, id);
    } else {
      db.prepare('UPDATE drivers SET status = ?, online = 0 WHERE user_id = ?').run(status, id);
    }
    bus.emit('drivers:update');
    bus.emit('driver:status', { driverId: Number(id), status });
    return get(id);
  }

  return { get, list, updateLocation, setOnline, setStatus };
}

module.exports = { createDriverService, FRESH_MS };

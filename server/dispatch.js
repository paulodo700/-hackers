const { AppError } = require('./errors');
const { getSettings } = require('./db');
const { haversineKm } = require('./geo');
const { WITH_DRIVER } = require('./rides');
const { FRESH_MS } = require('./drivers');

// Distribui corridas: oferece ao motoqueiro livre mais próximo, um de cada vez.
function createDispatcher({ db, bus, rides, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout }) {
  const timers = new Map(); // offerId -> temporizador
  const marks = WITH_DRIVER.map(() => '?').join(',');

  const isBusy = (driverId) =>
    !!db.prepare(`SELECT 1 FROM rides WHERE driver_id = ? AND status IN (${marks})`).get(driverId, ...WITH_DRIVER) ||
    !!db.prepare("SELECT 1 FROM ride_offers WHERE driver_id = ? AND status = 'pending'").get(driverId);

  function candidates(ride) {
    const tried = new Set(
      db.prepare('SELECT driver_id FROM ride_offers WHERE ride_id = ?').all(ride.id).map((r) => r.driver_id)
    );
    return db
      .prepare(
        "SELECT user_id AS id, lat, lng, last_seen FROM drivers WHERE status = 'approved' AND online = 1 AND lat IS NOT NULL"
      )
      .all()
      .filter((d) => !tried.has(d.id) && now() - d.last_seen <= FRESH_MS && !isBusy(d.id))
      .map((d) => ({ driverId: d.id, km: haversineKm(ride.origin, d) }))
      .sort((a, b) => a.km - b.km);
  }

  // Usado pela central antes de escolher um motoqueiro à mão.
  function checkAssignable(driverId) {
    const d = db.prepare('SELECT status, online FROM drivers WHERE user_id = ?').get(Number(driverId));
    if (!d) throw new AppError(404, 'Motoqueiro não encontrado');
    if (d.status !== 'approved') throw new AppError(409, 'Este motoqueiro não está aprovado');
    if (!d.online) throw new AppError(409, 'Este motoqueiro está offline');
    if (isBusy(Number(driverId))) throw new AppError(409, 'Este motoqueiro está ocupado');
  }

  function closeTimer(offerId) {
    if (timers.has(offerId)) {
      cancelSchedule(timers.get(offerId));
      timers.delete(offerId);
    }
  }

  function offerNext(rideId, onlyDriverId) {
    const ride = rides.getRide(rideId);
    if (!ride || ride.status !== 'searching') return null;
    if (db.prepare("SELECT 1 FROM ride_offers WHERE ride_id = ? AND status = 'pending'").get(ride.id)) return null;

    let driverId = null;
    if (onlyDriverId) {
      try {
        checkAssignable(onlyDriverId);
        driverId = Number(onlyDriverId);
      } catch {
        driverId = null;
      }
    } else {
      const list = candidates(ride);
      driverId = list.length ? list[0].driverId : null;
    }
    if (!driverId) {
      rides.markNoDrivers(ride.id);
      return null;
    }

    const timeoutS = getSettings(db).offer_timeout_s;
    const info = db
      .prepare("INSERT INTO ride_offers (ride_id, driver_id, status, exclusive, created_at) VALUES (?, ?, 'pending', ?, ?)")
      .run(ride.id, driverId, onlyDriverId ? 1 : 0, now());
    const offerId = Number(info.lastInsertRowid);
    // Um erro aqui não pode derrubar o servidor inteiro.
    const timer = schedule(() => {
      try {
        expire(offerId);
      } catch (err) {
        console.error('Falha ao expirar oferta:', err);
      }
    }, timeoutS * 1000);
    if (timer && typeof timer.unref === 'function') timer.unref();
    timers.set(offerId, timer);
    // `serverNow` deixa o celular calcular o tempo restante mesmo com o relógio dele errado.
    bus.emit('ride:offer', { offerId, driverId, ride, timeoutS, expiresAt: now() + timeoutS * 1000, serverNow: now() });
    return offerId;
  }

  // Fecha a oferta e segue a fila (ou avisa a central, se a oferta era só para um motoqueiro).
  function closeAndContinue(offer, status) {
    const info = db
      .prepare("UPDATE ride_offers SET status = ? WHERE id = ? AND status = 'pending'")
      .run(status, offer.id);
    if (info.changes !== 1) return false;
    closeTimer(offer.id);
    bus.emit('ride:offer_closed', { offerId: offer.id, driverId: offer.driver_id, rideId: offer.ride_id });
    if (offer.exclusive) rides.markNoDrivers(offer.ride_id);
    else offerNext(offer.ride_id);
    return true;
  }

  const getOffer = (id) => db.prepare('SELECT * FROM ride_offers WHERE id = ?').get(Number(id));

  function expire(offerId) {
    const offer = getOffer(offerId);
    if (offer) closeAndContinue(offer, 'expired');
  }

  function respond(offerId, driverId, accept) {
    const offer = getOffer(offerId);
    if (!offer) throw new AppError(404, 'Oferta não encontrada');
    if (offer.driver_id !== driverId) throw new AppError(403, 'Esta oferta não é sua');
    if (offer.status !== 'pending') throw new AppError(409, 'Esta oferta já expirou');

    if (!accept) {
      closeAndContinue(offer, 'declined');
      return rides.getRide(offer.ride_id);
    }
    // Marca como aceita antes de atribuir, para o aviso de "corrida atualizada" não fechá-la como expirada.
    db.prepare("UPDATE ride_offers SET status = 'accepted' WHERE id = ?").run(offer.id);
    closeTimer(offer.id);
    try {
      return rides.assignDriver(offer.ride_id, driverId);
    } catch (err) {
      // Outro motoqueiro pegou antes (ou a corrida foi cancelada).
      db.prepare("UPDATE ride_offers SET status = 'expired' WHERE id = ?").run(offer.id);
      throw err;
    } finally {
      bus.emit('ride:offer_closed', { offerId: offer.id, driverId, rideId: offer.ride_id });
    }
  }

  // Oferta pendente do motoqueiro, para a tela restaurar o estado ao abrir.
  function pendingOfferFor(driverId) {
    const offer = db
      .prepare("SELECT * FROM ride_offers WHERE driver_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1")
      .get(driverId);
    if (!offer) return null;
    const timeoutS = getSettings(db).offer_timeout_s;
    return {
      offerId: offer.id,
      driverId,
      ride: rides.getRide(offer.ride_id),
      timeoutS,
      expiresAt: offer.created_at + timeoutS * 1000,
      serverNow: now(),
    };
  }

  function closeOffersOfRide(rideId) {
    const open = db.prepare("SELECT * FROM ride_offers WHERE ride_id = ? AND status = 'pending'").all(rideId);
    for (const offer of open) {
      db.prepare("UPDATE ride_offers SET status = 'expired' WHERE id = ?").run(offer.id);
      closeTimer(offer.id);
      bus.emit('ride:offer_closed', { offerId: offer.id, driverId: offer.driver_id, rideId });
    }
  }

  const onSearching = ({ rideId, driverId }) => offerNext(rideId, driverId);
  const onUpdate = (ride) => {
    if (ride && ride.status !== 'searching') closeOffersOfRide(ride.id);
  };
  bus.on('ride:searching', onSearching);
  bus.on('ride:update', onUpdate);

  // Ao religar o servidor: ofertas que ficaram abertas são descartadas e as buscas recomeçam.
  function recover() {
    db.prepare("DELETE FROM ride_offers WHERE status = 'pending'").run();
    for (const { id } of db.prepare("SELECT id FROM rides WHERE status = 'searching'").all()) offerNext(id);
  }

  function stop() {
    for (const id of [...timers.keys()]) closeTimer(id);
    bus.off('ride:searching', onSearching);
    bus.off('ride:update', onUpdate);
  }

  return { candidates, checkAssignable, offerNext, respond, expire, pendingOfferFor, recover, stop };
}

module.exports = { createDispatcher };

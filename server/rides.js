const { AppError } = require('./errors');
const { getSettings } = require('./db');
const { calcPrice } = require('./pricing');
const { validCoord } = require('./geo');

// Corrida "ativa" = ainda em andamento para passageiro ou motoqueiro.
const ACTIVE = ['searching', 'accepted', 'arrived', 'in_progress'];
const WITH_DRIVER = ['accepted', 'arrived', 'in_progress'];
const MAX_KM = 80;
// Passageiro pode cancelar sem custo nos 3 minutos depois do pedido, enquanto busca ou o motorista vem.
const FREE_CANCEL_MS = 3 * 60 * 1000;
// Para terminar a corrida, o motorista precisa estar a até 300 m do destino (ou a central confirma).
const ARRIVE_RADIUS_KM = 0.3;

const now = () => new Date().toISOString();
const text = (value, max) => String(value ?? '').trim().slice(0, max);

function createRideService({ db, bus, places = null, wallet = null }) {
  const driverInfo = db.prepare(
    `SELECT u.id, u.name, u.phone, d.plate, d.moto_model, d.lat, d.lng
       FROM users u JOIN drivers d ON d.user_id = u.id WHERE u.id = ?`
  );

  function toRide(row, withRoute = true) {
    if (!row) return null;
    let route = null;
    if (withRoute && row.route) {
      try {
        route = JSON.parse(row.route);
      } catch {
        route = null;
      }
    }
    return {
      id: row.id,
      status: row.status,
      source: row.source,
      passenger_id: row.passenger_id,
      passenger_name: row.passenger_name,
      passenger_phone: row.passenger_phone,
      driver_id: row.driver_id,
      driver: row.driver_id ? driverInfo.get(row.driver_id) || null : null,
      origin: { text: row.origin_text, lat: row.origin_lat, lng: row.origin_lng },
      dest: { text: row.dest_text, lat: row.dest_lat, lng: row.dest_lng },
      distance_km: row.distance_km,
      duration_min: row.duration_min,
      route,
      price: row.price,
      payment: row.payment,
      payment_status: row.payment_status || 'pending',
      notes: row.notes,
      rating: row.rating,
      created_at: row.created_at,
      accepted_at: row.accepted_at,
      arrived_at: row.arrived_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      cancelled_at: row.cancelled_at,
      cancel_reason: row.cancel_reason,
      cancelled_by: row.cancelled_by,
    };
  }

  const getRow = (id) => db.prepare('SELECT * FROM rides WHERE id = ?').get(Number(id));
  const getRide = (id) => toRide(getRow(id));

  function mustGet(id) {
    const row = getRow(id);
    if (!row) throw new AppError(404, 'Corrida não encontrada');
    return row;
  }

  // Avisa todo mundo interessado. `extraUserIds` cobre quem saiu da corrida (ex.: motoqueiro que desistiu).
  function publish(id, extraUserIds = []) {
    const ride = getRide(id);
    bus.emit('ride:update', ride, { extraUserIds });
    return ride;
  }

  function point(p, label) {
    // `precise`: a posição foi confirmada por uma pessoa (GPS, toque no mapa ou pino ajustado).
    const out = { text: text(p && p.text, 160), lat: p && p.lat, lng: p && p.lng, precise: !!(p && p.precise) };
    if (!validCoord(out)) throw new AppError(400, `Informe ${label} no mapa`);
    return out;
  }

  function activeRideFor(user) {
    const marks = ACTIVE.map(() => '?').join(',');
    const column = user.role === 'driver' ? 'driver_id' : 'passenger_id';
    const row = db
      .prepare(`SELECT * FROM rides WHERE ${column} = ? AND status IN (${marks}) ORDER BY id DESC LIMIT 1`)
      .get(user.id, ...ACTIVE);
    return toRide(row);
  }

  function createRide(input) {
    const origin = point(input.origin, 'o local de partida');
    const dest = point(input.dest, 'o destino');
    const name = text(input.passengerName, 60);
    if (name.length < 2) throw new AppError(400, 'Informe o nome do passageiro');
    if (input.payment !== 'cash' && input.payment !== 'pix') {
      throw new AppError(400, 'Forma de pagamento inválida');
    }
    if (input.source !== 'app' && input.source !== 'central') throw new AppError(400, 'Origem inválida');
    const km = input.distanceKm;
    if (!Number.isFinite(km) || km < 0) throw new AppError(400, 'Distância inválida');
    if (km > MAX_KM) throw new AppError(400, 'Destino fora da área de atendimento');
    const price = calcPrice(km, getSettings(db));
    const minutes = Number.isFinite(input.durationMin) && input.durationMin > 0 ? Math.round(input.durationMin) : null;
    const routeOk =
      Array.isArray(input.route) &&
      input.route.length >= 2 &&
      input.route.length <= 400 &&
      input.route.every((p) => Array.isArray(p) && validCoord({ lat: p[0], lng: p[1] }));
    const routeJson = routeOk ? JSON.stringify(input.route.map((p) => [p[0], p[1]])) : null;

    if (input.passengerId && activeRideFor({ id: input.passengerId, role: 'passenger' })) {
      throw new AppError(409, 'Você já tem uma corrida em andamento');
    }

    const info = db
      .prepare(
        `INSERT INTO rides (passenger_id, passenger_name, passenger_phone, origin_text, origin_lat, origin_lng,
           dest_text, dest_lat, dest_lng, distance_km, price, payment, status, source, notes, created_at,
           duration_min, route, origin_precise, dest_precise)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'searching', ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.passengerId || null,
        name,
        text(input.passengerPhone, 20),
        origin.text,
        origin.lat,
        origin.lng,
        dest.text,
        dest.lat,
        dest.lng,
        km,
        price,
        input.payment,
        input.source,
        text(input.notes, 200),
        now(),
        minutes,
        routeJson,
        origin.precise ? 1 : 0,
        dest.precise ? 1 : 0
      );
    const id = Number(info.lastInsertRowid);
    publish(id);
    bus.emit('ride:searching', { rideId: id, driverId: input.driverId || null });
    return getRide(id);
  }

  // Só funciona se a corrida ainda estiver procurando: garante um único motoqueiro por corrida.
  function assignDriver(rideId, driverId) {
    const info = db
      .prepare("UPDATE rides SET status = 'accepted', driver_id = ?, accepted_at = ? WHERE id = ? AND status = 'searching'")
      .run(driverId, now(), Number(rideId));
    if (info.changes !== 1) {
      throw new AppError(409, 'Esta corrida não está mais disponível');
    }
    return publish(rideId);
  }

  function step(row, from, to, column) {
    const info = db
      .prepare(`UPDATE rides SET status = ?, ${column} = ? WHERE id = ? AND status = ?`)
      .run(to, now(), row.id, from);
    if (info.changes !== 1) throw new AppError(409, 'Esta ação não é possível agora');
    return publish(row.id);
  }

  function cancel(row, actor, reason) {
    const isAdmin = actor.role === 'admin';
    const isOwner = actor.role === 'passenger' && row.passenger_id === actor.id;
    const isDriver = actor.role === 'driver' && row.driver_id === actor.id;
    if (!isAdmin && !isOwner && !isDriver) throw new AppError(403, 'Você não participa desta corrida');

    if (isDriver) {
      // Motoqueiro desiste antes de embarcar: a corrida volta para a fila e vai para outro.
      if (row.status !== 'accepted' && row.status !== 'arrived') {
        throw new AppError(409, 'Não é possível desistir da corrida agora');
      }
      db.transaction(() => {
        db.prepare(
          "UPDATE rides SET status = 'searching', driver_id = NULL, accepted_at = NULL, arrived_at = NULL WHERE id = ?"
        ).run(row.id);
        db.prepare(
          "UPDATE ride_offers SET status = 'declined' WHERE ride_id = ? AND driver_id = ? AND status = 'accepted'"
        ).run(row.id, actor.id);
      })();
      const ride = publish(row.id, [actor.id]);
      bus.emit('ride:searching', { rideId: row.id, driverId: null });
      return ride;
    }

    const allowed = isAdmin ? [...ACTIVE, 'no_drivers'] : ['searching', 'accepted'];
    if (!allowed.includes(row.status)) {
      throw new AppError(409, 'Não é possível cancelar a corrida agora');
    }
    if (isOwner && Date.now() - Date.parse(row.created_at) > FREE_CANCEL_MS) {
      throw new AppError(409, 'O prazo para cancelar pelo aplicativo acabou. Fale com a central.');
    }
    const info = db
      .prepare(
        'UPDATE rides SET status = ?, cancelled_at = ?, cancel_reason = ?, cancelled_by = ? WHERE id = ? AND status = ?'
      )
      .run('cancelled', now(), text(reason, 200), actor.role, row.id, row.status);
    if (info.changes !== 1) throw new AppError(409, 'Não é possível cancelar a corrida agora');
    return publish(row.id);
  }

  function act(rideId, action, actor, reason) {
    const row = mustGet(rideId);
    if (action === 'cancel') return cancel(row, actor, reason);

    const isDriver = actor.role === 'driver' && row.driver_id === actor.id;
    if (!isDriver && actor.role !== 'admin') throw new AppError(403, 'Esta corrida não é sua');
    if (action === 'arrive') return step(row, 'accepted', 'arrived', 'arrived_at');
    if (action === 'start') return step(row, 'arrived', 'in_progress', 'started_at');
    if (action === 'complete') {
      // Só termina perto do destino: a central pode encerrar à mão (ex.: GPS do motorista falhou).
      if (actor.role !== 'admin') {
        const pos = db.prepare('SELECT lat, lng FROM drivers WHERE user_id = ?').get(actor.id);
        if (!pos || pos.lat === null) throw new AppError(409, 'Ative o GPS para finalizar a corrida');
        const { haversineKm } = require('./geo');
        const far = haversineKm({ lat: pos.lat, lng: pos.lng }, { lat: row.dest_lat, lng: row.dest_lng });
        if (far > ARRIVE_RADIUS_KM) {
          throw new AppError(409, `Você ainda está a ${Math.round(far * 1000)} m do destino. Finalize ao chegar.`);
        }
      }
      const done = step(row, 'in_progress', 'completed', 'completed_at');
      // A comissão fica gravada na corrida: mudar a taxa depois não altera o que já foi feito.
      // Se o pagamento já caiu, a carteira divide agora. Senão, divide quando o pagamento for confirmado.
      if (wallet) wallet.onCompleted(row.id);
      // A corrida aconteceu de verdade: os endereços com número e posição confirmada viram locais conhecidos.
      if (places) {
        if (row.origin_precise) places.learn(row.origin_text, { lat: row.origin_lat, lng: row.origin_lng });
        if (row.dest_precise) places.learn(row.dest_text, { lat: row.dest_lat, lng: row.dest_lng });
      }
      return done;
    }
    throw new AppError(400, 'Ação desconhecida');
  }

  function markNoDrivers(rideId) {
    const info = db
      .prepare("UPDATE rides SET status = 'no_drivers' WHERE id = ? AND status = 'searching'")
      .run(Number(rideId));
    return info.changes === 1 ? publish(rideId) : getRide(rideId);
  }

  function retry(rideId, driverId) {
    const row = mustGet(rideId);
    const info = db
      .prepare("UPDATE rides SET status = 'searching' WHERE id = ? AND status = 'no_drivers'")
      .run(row.id);
    if (info.changes !== 1) throw new AppError(409, 'Esta corrida não pode ser reenviada');
    // Nova rodada: quem recusou antes pode receber de novo.
    db.prepare('DELETE FROM ride_offers WHERE ride_id = ?').run(row.id);
    publish(row.id);
    bus.emit('ride:searching', { rideId: row.id, driverId: driverId || null });
    return getRide(row.id);
  }

  function rate(rideId, passengerId, rating) {
    const row = mustGet(rideId);
    if (row.passenger_id !== passengerId) throw new AppError(404, 'Corrida não encontrada');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, 'A nota deve ser de 1 a 5');
    }
    const info = db
      .prepare("UPDATE rides SET rating = ? WHERE id = ? AND status = 'completed' AND rating IS NULL")
      .run(rating, row.id);
    if (info.changes !== 1) throw new AppError(409, 'Esta corrida não pode ser avaliada');
    return publish(row.id);
  }

  function list({ passengerId, driverId, status, from, to, limit = 50 } = {}) {
    const where = [];
    const args = [];
    if (passengerId) (where.push('passenger_id = ?'), args.push(passengerId));
    if (driverId) (where.push('driver_id = ?'), args.push(driverId));
    if (status) {
      const all = String(status).split(',').filter(Boolean);
      where.push(`status IN (${all.map(() => '?').join(',')})`);
      args.push(...all);
    }
    if (from) (where.push('created_at >= ?'), args.push(from));
    if (to) (where.push('created_at < ?'), args.push(to));
    const sql = `SELECT * FROM rides ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
    const max = Math.min(Math.max(Number(limit) || 50, 1), 500);
    // Listas não levam o desenho da rota (fica pesado); só a corrida aberta leva.
    return db.prepare(sql).all(...args, max).map((row) => toRide(row, false));
  }

  return { createRide, getRide, activeRideFor, assignDriver, act, markNoDrivers, retry, rate, list };
}

module.exports = { createRideService, ACTIVE, WITH_DRIVER };

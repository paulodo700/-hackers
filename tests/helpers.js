const { EventEmitter } = require('node:events');
const { openDb } = require('../server/db');
const { hashPassword } = require('../server/auth');
const { createRideService } = require('../server/rides');
const { createDriverService } = require('../server/drivers');
const { createDispatcher } = require('../server/dispatch');

const PASSWORD_HASH = hashPassword('123456');
let phoneSeq = 0;
const nextPhone = () => `119${String(10000000 + ++phoneSeq)}`;

// Contexto completo em memória. O relógio e os temporizadores são controlados pelo teste.
function makeCtx({ withDispatch = true } = {}) {
  const db = openDb(':memory:');
  const bus = new EventEmitter();
  const clock = { t: 1_700_000_000_000 };
  const now = () => clock.t;
  const scheduled = [];
  const schedule = (fn, ms) => {
    const handle = { fn, ms, cancelled: false };
    scheduled.push(handle);
    return handle;
  };
  const cancelSchedule = (handle) => { if (handle) handle.cancelled = true; };
  const events = [];
  for (const name of ['ride:update', 'ride:searching', 'ride:offer', 'ride:offer_closed']) {
    bus.on(name, (payload) => events.push({ name, payload }));
  }
  const rides = createRideService({ db, bus });
  const drivers = createDriverService({ db, bus, now });
  const dispatch = withDispatch ? createDispatcher({ db, bus, rides, now, schedule, cancelSchedule }) : null;
  return { db, bus, rides, drivers, dispatch, clock, scheduled, events };
}

function addUser(db, { role = 'passenger', name = 'Fulano', phone = nextPhone() } = {}) {
  const info = db
    .prepare('INSERT INTO users (role, name, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(role, name, phone, PASSWORD_HASH, new Date().toISOString());
  return { id: Number(info.lastInsertRowid), role, name, phone };
}

function addDriver(ctx, { name = 'Moto', lat = -10, lng = -48, online = true, status = 'approved', lastSeen } = {}) {
  const user = addUser(ctx.db, { role: 'driver', name });
  ctx.db
    .prepare('INSERT INTO drivers (user_id, plate, moto_model, status, online, lat, lng, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, 'ABC1D23', 'CG 160', status, online ? 1 : 0, lat, lng, lastSeen ?? ctx.clock.t);
  return user;
}

const ORIGIN = { text: 'Praça Central', lat: -10, lng: -48 };
const DEST = { text: 'Rodoviária', lat: -10.02, lng: -48.02 };

function rideInput(extra = {}) {
  return {
    passengerName: 'Maria',
    passengerPhone: '11988887777',
    origin: ORIGIN,
    dest: DEST,
    distanceKm: 2,
    payment: 'cash',
    source: 'app',
    ...extra,
  };
}

module.exports = { makeCtx, addUser, addDriver, rideInput, ORIGIN, DEST };

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCtx, addUser, addDriver, rideInput } = require('./helpers');

const status = (fn) => {
  try { fn(); } catch (err) { return err.status; }
  return 'sem erro';
};

function setup() {
  const ctx = makeCtx({ withDispatch: false });
  const passenger = addUser(ctx.db, { role: 'passenger', name: 'Maria' });
  const driver = addDriver(ctx, { name: 'João' });
  const admin = addUser(ctx.db, { role: 'admin', name: 'Central' });
  return { ...ctx, passenger, driver, admin };
}

test('caminho feliz: procura → aceita → chegou → em viagem → concluída → avaliada', () => {
  const { rides, passenger, driver, db } = setup();
  let ride = rides.createRide(rideInput({ passengerId: passenger.id, distanceKm: 2.6 }));
  assert.equal(ride.status, 'searching');
  assert.equal(ride.price, 8.5);
  assert.equal(ride.driver, null);

  ride = rides.assignDriver(ride.id, driver.id);
  assert.equal(ride.status, 'accepted');
  assert.equal(ride.driver.name, 'João');
  assert.equal(ride.driver.plate, 'ABC1D23');
  ride = rides.act(ride.id, 'arrive', driver);
  assert.equal(ride.status, 'arrived');
  ride = rides.act(ride.id, 'start', driver);
  assert.equal(ride.status, 'in_progress');
  db.prepare('UPDATE drivers SET lat = ?, lng = ? WHERE user_id = ?').run(-10.02, -48.02, driver.id); // chegou ao destino
  ride = rides.act(ride.id, 'complete', driver);
  assert.equal(ride.status, 'completed');
  for (const k of ['created_at', 'accepted_at', 'arrived_at', 'started_at', 'completed_at']) assert.ok(ride[k], k);

  assert.equal(rides.activeRideFor(passenger), null);
  assert.equal(status(() => rides.rate(ride.id, passenger.id, 6)), 400);
  assert.equal(rides.rate(ride.id, passenger.id, 5).rating, 5);
  assert.equal(status(() => rides.rate(ride.id, passenger.id, 4)), 409);
});

test('passageiro só tem uma corrida ativa (toque duplo em "Pedir")', () => {
  const { rides, passenger, db } = setup();
  rides.createRide(rideInput({ passengerId: passenger.id }));
  assert.equal(status(() => rides.createRide(rideInput({ passengerId: passenger.id }))), 409);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM rides').get().n, 1);
});

test('entradas inválidas são rejeitadas', () => {
  const { rides, passenger } = setup();
  const bad = (extra) => status(() => rides.createRide(rideInput({ passengerId: passenger.id, ...extra })));
  assert.equal(bad({ origin: { lat: 91, lng: 0 } }), 400);
  assert.equal(bad({ dest: null }), 400);
  assert.equal(bad({ payment: 'cartao' }), 400);
  assert.equal(bad({ passengerName: '' }), 400);
  assert.equal(bad({ distanceKm: NaN }), 400);
  assert.equal(bad({ distanceKm: 500 }), 400);
});

test('transições fora de ordem e de quem não participa são barradas', () => {
  const ctx = setup();
  const { rides, passenger, driver } = ctx;
  const other = addDriver(ctx, { name: 'Outro' });
  const stranger = addUser(ctx.db, { role: 'passenger' });
  const ride = rides.createRide(rideInput({ passengerId: passenger.id }));

  assert.equal(status(() => rides.act(ride.id, 'arrive', driver)), 403); // ainda sem motoqueiro
  rides.assignDriver(ride.id, driver.id);
  assert.equal(status(() => rides.assignDriver(ride.id, other.id)), 409);
  assert.equal(rides.getRide(ride.id).driver_id, driver.id);
  assert.equal(status(() => rides.act(ride.id, 'start', driver)), 409);
  assert.equal(status(() => rides.act(ride.id, 'complete', driver)), 409);
  assert.equal(status(() => rides.act(ride.id, 'arrive', other)), 403);
  assert.equal(status(() => rides.act(ride.id, 'cancel', stranger)), 403);
  assert.equal(status(() => rides.act(999, 'arrive', driver)), 404);
});

test('cancelamento: passageiro até a chegada, central sempre', () => {
  const { rides, passenger, driver, admin } = setup();
  let ride = rides.createRide(rideInput({ passengerId: passenger.id }));
  rides.assignDriver(ride.id, driver.id);
  rides.act(ride.id, 'arrive', driver);
  rides.act(ride.id, 'start', driver);
  assert.equal(status(() => rides.act(ride.id, 'cancel', passenger)), 409);
  ride = rides.act(ride.id, 'cancel', admin, 'passageiro desistiu');
  assert.equal(ride.status, 'cancelled');
  assert.equal(ride.cancelled_by, 'admin');
  assert.equal(ride.cancel_reason, 'passageiro desistiu');
  assert.equal(status(() => rides.act(ride.id, 'cancel', admin)), 409);

  const second = rides.createRide(rideInput({ passengerId: passenger.id }));
  assert.equal(rides.act(second.id, 'cancel', passenger).status, 'cancelled');
});

test('motoqueiro desiste: corrida volta para a fila sem motoqueiro', () => {
  const { rides, passenger, driver, events } = setup();
  const ride = rides.createRide(rideInput({ passengerId: passenger.id }));
  rides.assignDriver(ride.id, driver.id);
  events.length = 0;
  const back = rides.act(ride.id, 'cancel', driver);
  assert.equal(back.status, 'searching');
  assert.equal(back.driver_id, null);
  assert.equal(back.accepted_at, null);
  assert.ok(events.some((e) => e.name === 'ride:searching' && e.payload.rideId === ride.id));

  rides.assignDriver(ride.id, driver.id);
  rides.act(ride.id, 'arrive', driver);
  rides.act(ride.id, 'start', driver);
  assert.equal(status(() => rides.act(ride.id, 'cancel', driver)), 409);
});

test('sem motoqueiros e reenvio pela central', () => {
  const { rides, passenger, events } = setup();
  const ride = rides.createRide(rideInput({ passengerId: passenger.id }));
  assert.equal(status(() => rides.retry(ride.id)), 409);
  assert.equal(rides.markNoDrivers(ride.id).status, 'no_drivers');
  assert.equal(rides.activeRideFor(passenger), null);
  events.length = 0;
  assert.equal(rides.retry(ride.id).status, 'searching');
  assert.ok(events.some((e) => e.name === 'ride:searching'));
});

test('listagem filtra por passageiro, motoqueiro e status', () => {
  const { rides, passenger, driver } = setup();
  const a = rides.createRide(rideInput({ passengerId: passenger.id }));
  rides.act(a.id, 'cancel', passenger);
  const b = rides.createRide(rideInput({ passengerId: passenger.id }));
  rides.assignDriver(b.id, driver.id);
  rides.createRide(rideInput({ source: 'central' }));
  assert.equal(rides.list({ passengerId: passenger.id }).length, 2);
  assert.equal(rides.list({ driverId: driver.id }).length, 1);
  assert.equal(rides.list({ status: 'cancelled,accepted' }).length, 2);
  assert.equal(rides.list().length, 3);
});

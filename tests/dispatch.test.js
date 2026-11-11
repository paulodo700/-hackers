const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCtx, addUser, addDriver, rideInput } = require('./helpers');

const status = (fn) => {
  try { fn(); } catch (err) { return err.status; }
  return 'sem erro';
};
const offers = (ctx) => ctx.events.filter((e) => e.name === 'ride:offer').map((e) => e.payload);
const lastOffer = (ctx) => offers(ctx).at(-1);

test('oferece ao motoqueiro livre mais próximo', () => {
  const ctx = makeCtx();
  addDriver(ctx, { name: 'Longe', lat: -10.05, lng: -48.05 });
  const near = addDriver(ctx, { name: 'Perto', lat: -10.001, lng: -48.001 });
  const ride = ctx.rides.createRide(rideInput());
  assert.equal(ride.status, 'searching');
  const offer = lastOffer(ctx);
  assert.equal(offer.driverId, near.id);
  assert.equal(offer.timeoutS, 20);
  assert.equal(offer.ride.id, ride.id);
  assert.equal(ctx.scheduled.at(-1).ms, 20000);
});

test('ignora offline, pendente, bloqueado, ocupado e posição velha', () => {
  const ctx = makeCtx();
  addDriver(ctx, { name: 'Offline', online: false });
  addDriver(ctx, { name: 'Pendente', status: 'pending' });
  addDriver(ctx, { name: 'Bloqueado', status: 'blocked' });
  addDriver(ctx, { name: 'Sumido', lastSeen: ctx.clock.t - 121_000 });
  const busy = addDriver(ctx, { name: 'Ocupado' });
  ctx.db.prepare(
    `INSERT INTO rides (passenger_name, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, price, payment, status, source, driver_id, created_at)
     VALUES ('x', 0, 0, 0, 0, 1, 6, 'cash', 'in_progress', 'app', ?, 'agora')`
  ).run(busy.id);
  const ride = ctx.rides.createRide(rideInput());
  assert.equal(ride.status, 'no_drivers');
  assert.equal(offers(ctx).length, 0);
});

test('recusa e expiração passam para o próximo; sem mais ninguém vira "sem motoqueiros"', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, { name: 'A', lat: -10.001, lng: -48 });
  const b = addDriver(ctx, { name: 'B', lat: -10.002, lng: -48 });
  const c = addDriver(ctx, { name: 'C', lat: -10.003, lng: -48 });
  const ride = ctx.rides.createRide(rideInput());

  assert.equal(lastOffer(ctx).driverId, a.id);
  ctx.dispatch.respond(lastOffer(ctx).offerId, a.id, false);
  assert.equal(lastOffer(ctx).driverId, b.id);

  ctx.scheduled.at(-1).fn(); // o tempo de B acabou
  assert.equal(lastOffer(ctx).driverId, c.id);
  assert.equal(status(() => ctx.dispatch.respond(offers(ctx)[1].offerId, b.id, true)), 409);

  ctx.dispatch.respond(lastOffer(ctx).offerId, c.id, false);
  assert.equal(ctx.rides.getRide(ride.id).status, 'no_drivers');
  assert.equal(offers(ctx).length, 3);
});

test('aceitar atribui a corrida e cancela o temporizador', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, { name: 'A' });
  const other = addDriver(ctx, { name: 'Outro', lat: -10.5, lng: -48.5 });
  const created = ctx.rides.createRide(rideInput());
  const offer = lastOffer(ctx);
  assert.equal(status(() => ctx.dispatch.respond(offer.offerId, other.id, true)), 403);
  assert.equal(status(() => ctx.dispatch.respond(9999, a.id, true)), 404);

  const ride = ctx.dispatch.respond(offer.offerId, a.id, true);
  assert.equal(ride.status, 'accepted');
  assert.equal(ride.driver_id, a.id);
  assert.equal(ctx.scheduled.at(-1).cancelled, true);
  assert.equal(ctx.db.prepare('SELECT status FROM ride_offers WHERE id = ?').get(offer.offerId).status, 'accepted');
  assert.equal(ctx.events.filter((e) => e.name === 'ride:offer_closed').length, 1);

  ctx.dispatch.expire(offer.offerId); // temporizador atrasado não desfaz nada
  assert.equal(ctx.rides.getRide(created.id).status, 'accepted');
  assert.equal(ctx.dispatch.pendingOfferFor(a.id), null);
});

test('quem está com oferta aberta ou corrida aceita não recebe outra', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, { name: 'A' });
  ctx.rides.createRide(rideInput());
  assert.equal(ctx.dispatch.pendingOfferFor(a.id).driverId, a.id);
  const second = ctx.rides.createRide(rideInput());
  assert.equal(second.status, 'no_drivers');
});

test('atribuição manual oferece só ao escolhido; recusa devolve para a central', () => {
  const ctx = makeCtx();
  addDriver(ctx, { name: 'Perto', lat: -10.001, lng: -48 });
  const chosen = addDriver(ctx, { name: 'Escolhido', lat: -10.2, lng: -48.2 });
  const ride = ctx.rides.createRide(rideInput({ source: 'central', driverId: chosen.id }));
  assert.equal(lastOffer(ctx).driverId, chosen.id);
  ctx.dispatch.respond(lastOffer(ctx).offerId, chosen.id, false);
  assert.equal(ctx.rides.getRide(ride.id).status, 'no_drivers');
  assert.equal(offers(ctx).length, 1);

  ctx.rides.retry(ride.id); // central reenvia no automático
  assert.equal(offers(ctx).length, 2);
  assert.equal(ctx.rides.getRide(ride.id).status, 'searching');
});

test('checkAssignable explica por que o motoqueiro não pode receber', () => {
  const ctx = makeCtx();
  const off = addDriver(ctx, { online: false });
  const pending = addDriver(ctx, { status: 'pending' });
  const ok = addDriver(ctx, {});
  assert.equal(status(() => ctx.dispatch.checkAssignable(off.id)), 409);
  assert.equal(status(() => ctx.dispatch.checkAssignable(pending.id)), 409);
  assert.equal(status(() => ctx.dispatch.checkAssignable(12345)), 404);
  assert.equal(status(() => ctx.dispatch.checkAssignable(ok.id)), 'sem erro');
});

test('corrida cancelada fecha a oferta aberta', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, {});
  const passenger = addUser(ctx.db, {});
  const ride = ctx.rides.createRide(rideInput({ passengerId: passenger.id }));
  const offer = lastOffer(ctx);
  ctx.rides.act(ride.id, 'cancel', passenger);
  assert.ok(ctx.events.some((e) => e.name === 'ride:offer_closed' && e.payload.offerId === offer.offerId));
  assert.equal(status(() => ctx.dispatch.respond(offer.offerId, a.id, true)), 409);
  assert.equal(ctx.rides.getRide(ride.id).status, 'cancelled');
});

test('dois motoqueiros aceitam a mesma corrida: só o primeiro fica com ela', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, { name: 'A' });
  const b = addDriver(ctx, { name: 'B', lat: -10.4, lng: -48.4 });
  const ride = ctx.rides.createRide(rideInput());
  const first = lastOffer(ctx);
  // Força uma segunda oferta aberta para a mesma corrida (situação de corrida entre dois aparelhos).
  const info = ctx.db
    .prepare("INSERT INTO ride_offers (ride_id, driver_id, status, created_at) VALUES (?, ?, 'pending', ?)")
    .run(ride.id, b.id, ctx.clock.t);
  assert.equal(ctx.dispatch.respond(first.offerId, a.id, true).driver_id, a.id);
  assert.equal(status(() => ctx.dispatch.respond(Number(info.lastInsertRowid), b.id, true)), 409);
  assert.equal(ctx.rides.getRide(ride.id).driver_id, a.id);
});

test('motoqueiro que desiste não recebe a mesma corrida de novo', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, { name: 'A', lat: -10.001, lng: -48 });
  const b = addDriver(ctx, { name: 'B', lat: -10.3, lng: -48.3 });
  const ride = ctx.rides.createRide(rideInput());
  ctx.dispatch.respond(lastOffer(ctx).offerId, a.id, true);
  ctx.rides.act(ride.id, 'cancel', a);
  assert.equal(lastOffer(ctx).driverId, b.id);
});

test('recover: ao religar, ofertas abertas são refeitas', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, {});
  const ride = ctx.rides.createRide(rideInput());
  const stale = lastOffer(ctx).offerId;
  ctx.dispatch.recover();
  assert.equal(ctx.rides.getRide(ride.id).status, 'searching');
  assert.equal(offers(ctx).length, 2);
  assert.notEqual(ctx.dispatch.pendingOfferFor(a.id).offerId, stale);
});

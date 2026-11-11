const test = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { normalizePhone } = require('../server/auth');
const { startServer: start } = require('./helpers');

const O = { text: 'Praça Central', lat: -10, lng: -48 };
const D = { text: 'Rodoviária', lat: -10.02, lng: -48.02 };

test('telefone: formatos diferentes viram o mesmo número', () => {
  assert.equal(normalizePhone('+55 (11) 98888-7777'), '11988887777');
  assert.equal(normalizePhone('11 98888 7777'), '11988887777');
  assert.equal(normalizePhone('5511988887777'), '11988887777');
  assert.equal(normalizePhone('(63) 3333-4444'), '6333334444');
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizePhone(''), null);
});

test('cadastro, login e permissões', async (t) => {
  const s = await start();
  t.after(() => s.close());

  const reg = await s.call('/api/auth/register', {
    body: { role: 'passenger', name: 'Maria', phone: '+55 (11) 98888-7777', password: '123456' },
  });
  assert.equal(reg.status, 201);
  const login = await s.call('/api/auth/login', { body: { phone: '11 98888 7777', password: '123456' } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, reg.body.user.id);
  assert.equal(login.body.user.password_hash, undefined);

  const again = await s.call('/api/auth/register', {
    body: { role: 'passenger', name: 'Outra', phone: '11988887777', password: '123456' },
  });
  assert.equal(again.status, 409);
  assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: 'errada' } })).status, 401);
  const reg2 = (b) => s.call('/api/auth/register', { body: { name: 'Zé', phone: '11977776666', password: '123456', ...b } });
  assert.equal((await reg2({ role: 'passenger', password: '12345' })).status, 400);
  assert.equal((await reg2({ role: 'admin' })).status, 400);
  assert.equal((await reg2({ role: 'driver' })).status, 400); // sem placa e modelo
  assert.equal((await reg2({ role: 'passenger', phone: '123' })).status, 400);

  assert.equal((await s.call('/api/auth/me')).status, 401);
  assert.equal((await s.call('/api/auth/me', { token: 'lixo' })).status, 401);
  assert.equal((await s.call('/api/auth/me', { token: reg.body.token })).body.user.name, 'Maria');
  assert.equal((await s.call('/api/admin/overview', { token: reg.body.token })).status, 403);
  assert.equal((await s.call('/api/driver/state', { token: reg.body.token })).status, 403);
  assert.equal((await s.call('/api/rides/active', { token: s.admin.token })).status, 403);
  assert.equal((await s.call('/api/nao-existe')).status, 404);

  assert.deepEqual((await s.call('/api/health')).body, { ok: true });
  // O mapa (OpenStreetMap) bloqueia sites que escondem a própria identificação.
  // O endereço principal leva direto ao passageiro; nada aponta para as outras telas.
  const root = await fetch(s.base + '/', { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/passageiro/');
  const passengerHtml = await (await fetch(s.base + '/passageiro/')).text();
  assert.ok(!/central|motoqueiro/i.test(passengerHtml.replace(/<title>.*?<\/title>/, '')));
  assert.equal((await fetch(s.base + '/central/')).headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await fetch(s.base + '/motoqueiro/')).headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await fetch(s.base + '/passageiro/')).headers.get('x-robots-tag'), null);
  const page = await fetch(s.base + '/passageiro/');
  assert.equal(page.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const cfg = await s.call('/api/public/config');
  assert.equal(cfg.status, 200);
  assert.ok(cfg.body.city_name);
});

test('limite de tentativas de login', async (t) => {
  const s = await start();
  t.after(() => s.close());
  await s.register('passenger', 'Maria', '11988887777');
  for (let i = 0; i < 10; i++) {
    assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: 'x' } })).status, 401);
  }
  assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: '123456' } })).status, 429);
});

test('corrida completa pelo app do passageiro', async (t) => {
  const s = await start();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const other = await s.register('passenger', 'Curioso', '11966665555');

  const pending = await s.register('driver', 'João', '11955554444', { plate: 'abc1d23', moto_model: 'CG 160' });
  assert.equal((await s.call('/api/auth/me', { token: pending.token })).body.driver.status, 'pending');
  const blocked = await s.call('/api/driver/online', { token: pending.token, body: { online: true, lat: -10, lng: -48 } });
  assert.equal(blocked.status, 403);
  await s.call(`/api/admin/drivers/${pending.user.id}/status`, { token: s.admin.token, body: { status: 'approved' } });
  assert.equal((await s.call('/api/driver/online', { token: pending.token, body: { online: true } })).status, 400); // sem GPS
  const on = await s.call('/api/driver/online', { token: pending.token, body: { online: true, lat: -10.001, lng: -48.001 } });
  assert.equal(on.body.driver.online, true);
  const d = pending;

  const est = await s.call('/api/rides/estimate', { token: p.token, body: { origin: O, dest: D } });
  assert.deepEqual(est.body, { distance_km: 2, source: 'osrm', price: 7, duration_min: 5, route: [[O.lat, O.lng], [D.lat, D.lng]] });
  assert.equal((await s.call('/api/rides/estimate', { token: p.token, body: { origin: O } })).status, 400);

  // O passageiro não escolhe o preço: o servidor calcula.
  const created = await s.call('/api/rides', {
    token: p.token,
    body: { origin: O, dest: D, payment: 'pix', notes: 'portão azul', price: 1, distance_km: 0 },
  });
  assert.equal(created.status, 201);
  const rideId = created.body.ride.id;
  assert.equal(created.body.ride.price, 7);
  assert.equal(created.body.ride.duration_min, 5);
  assert.equal(created.body.ride.route.length, 2);
  assert.equal(created.body.ride.status, 'searching');
  assert.equal((await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'pix' } })).status, 409);

  assert.equal((await s.call(`/api/rides/${rideId}`, { token: other.token })).status, 404);
  assert.equal((await s.call(`/api/rides/${rideId}/cancel`, { token: other.token, body: {} })).status, 404);

  const st = await s.call('/api/driver/state', { token: d.token });
  assert.equal(st.body.offer.ride.id, rideId);
  assert.equal(st.body.offer.ride.notes, 'portão azul');
  const offerId = st.body.offer.offerId;

  const acc = await s.call(`/api/driver/offers/${offerId}/accept`, { token: d.token, body: {} });
  assert.equal(acc.body.ride.status, 'accepted');
  assert.equal(acc.body.offer, null);
  assert.equal((await s.call('/api/driver/online', { token: d.token, body: { online: false } })).status, 409);

  const active = await s.call('/api/rides/active', { token: p.token });
  assert.equal(active.body.ride.driver.name, 'João');
  assert.equal(active.body.ride.driver.plate, 'ABC1D23');

  assert.equal((await s.call(`/api/driver/rides/${rideId}/start`, { token: d.token, body: {} })).status, 409);
  assert.equal((await s.call(`/api/driver/rides/${rideId}/arrive`, { token: d.token, body: {} })).body.ride.status, 'arrived');
  assert.equal((await s.call(`/api/driver/rides/${rideId}/start`, { token: d.token, body: {} })).body.ride.status, 'in_progress');
  assert.equal((await s.call(`/api/rides/${rideId}/cancel`, { token: p.token, body: {} })).status, 409);
  const done = await s.call(`/api/driver/rides/${rideId}/complete`, { token: d.token, body: {} });
  assert.equal(done.body.ride, null);
  assert.equal(done.body.last.status, 'completed');

  assert.equal((await s.call(`/api/rides/${rideId}/rate`, { token: p.token, body: { rating: 5 } })).body.ride.rating, 5);
  const hist = await s.call('/api/rides/history', { token: p.token });
  assert.equal(hist.body.rides[0].id, rideId);
  assert.equal(hist.body.rides[0].route, null); // listas não carregam o desenho da rota
  assert.equal((await s.call('/api/driver/history', { token: d.token })).body.rides[0].id, rideId);
  const sum = await s.call('/api/driver/summary', { token: d.token });
  assert.deepEqual(sum.body.today, { rides: 1, total: 7, commission: 0.7 });
  assert.equal((await s.call('/api/rides/active', { token: p.token })).body.ride, null);
});

test('central: lançar corrida, escolher motoqueiro, relatório e configurações', async (t) => {
  const s = await start();
  t.after(() => s.close());
  const adm = s.admin.token;
  const near = await s.approvedDriver('Perto', '11911110001', { lat: -10.001, lng: -48.001 });
  const far = await s.approvedDriver('Longe', '11911110002', { lat: -10.2, lng: -48.2 });

  // Automático: vai para o mais próximo.
  const auto = await s.call('/api/admin/rides', {
    token: adm,
    body: { passenger_name: 'Dona Ana', passenger_phone: '(11) 97777-0000', origin: O, dest: D, payment: 'cash' },
  });
  assert.equal(auto.status, 201);
  assert.equal(auto.body.ride.source, 'central');
  assert.equal(auto.body.ride.passenger_phone, '11977770000');
  const nearState = await s.call('/api/driver/state', { token: near.token });
  assert.equal(nearState.body.offer.ride.id, auto.body.ride.id);
  await s.call(`/api/driver/offers/${nearState.body.offer.offerId}/accept`, { token: near.token, body: {} });

  // Escolhido à mão: só ele recebe.
  const busy = await s.call('/api/admin/rides', {
    token: adm,
    body: { passenger_name: 'Seu Zé', origin: O, dest: D, driver_id: near.user.id },
  });
  assert.equal(busy.status, 409); // já está em corrida
  const manual = await s.call('/api/admin/rides', {
    token: adm,
    body: { passenger_name: 'Seu Zé', origin: O, dest: D, driver_id: far.user.id },
  });
  assert.equal(manual.status, 201);
  const farState = await s.call('/api/driver/state', { token: far.token });
  assert.equal(farState.body.offer.ride.id, manual.body.ride.id);
  await s.call(`/api/driver/offers/${farState.body.offer.offerId}/decline`, { token: far.token, body: {} });
  const afterDecline = await s.call('/api/admin/overview', { token: adm });
  const stuck = afterDecline.body.activeRides.find((r) => r.id === manual.body.ride.id);
  assert.equal(stuck.status, 'no_drivers');
  const retried = await s.call(`/api/admin/rides/${manual.body.ride.id}/retry`, { token: adm, body: {} });
  assert.equal(retried.body.ride.status, 'searching');
  const farAgain = await s.call('/api/driver/state', { token: far.token });
  await s.call(`/api/driver/offers/${farAgain.body.offer.offerId}/accept`, { token: far.token, body: {} });

  for (const [d, id] of [[near, auto.body.ride.id], [far, manual.body.ride.id]]) {
    for (const action of ['arrive', 'start', 'complete']) {
      const r = await s.call(`/api/driver/rides/${id}/${action}`, { token: d.token, body: {} });
      assert.equal(r.status, 200, `${action} ${JSON.stringify(r.body)}`);
    }
  }

  const rep = await s.call('/api/admin/reports', { token: adm });
  assert.deepEqual(rep.body.totals, { rides: 2, revenue: 14, commission: 1.4, cancelled: 0 });
  assert.equal(rep.body.byDriver.length, 2);
  assert.equal(rep.body.byDriver[0].commission, 0.7);
  assert.equal(rep.body.byDay.length, 1);
  assert.equal((await s.call('/api/admin/reports?from=2030-01-02&to=2030-01-01', { token: adm })).status, 400);

  const ov = await s.call('/api/admin/overview', { token: adm });
  assert.equal(ov.body.stats.today_rides, 2);
  assert.equal(ov.body.stats.today_revenue, 14);
  assert.equal(ov.body.stats.online_drivers, 2);

  // Configurações mudam a próxima estimativa.
  assert.equal((await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { per_km: -3 } })).status, 400);
  const set = await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { per_km: 3, city_name: 'Vila Bela' } });
  assert.equal(set.body.settings.per_km, 3);
  const est = await s.call('/api/admin/rides/estimate', { token: adm, body: { origin: O, dest: D } });
  assert.equal(est.body.price, 9);
  assert.equal((await s.call('/api/public/config')).body.city_name, 'Vila Bela');

  // Marca: nome e cor configuráveis, com validação.
  const brand0 = (await s.call('/api/public/config')).body;
  assert.equal(brand0.brand_name, 'Mototáxi');
  assert.equal(brand0.brand_color, '#ffc107');
  assert.equal((await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { brand_color: 'vermelho' } })).status, 400);
  assert.equal((await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { brand_color: '#12AB9Z' } })).status, 400);
  await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { brand_name: 'Moto Já', brand_color: '#0A7CFF' } });
  const brand1 = (await s.call('/api/public/config')).body;
  assert.equal(brand1.brand_name, 'Moto Já');
  assert.equal(brand1.brand_color, '#0a7cff');

  // Bloquear tira de online.
  const blk = await s.call(`/api/admin/drivers/${far.user.id}/status`, { token: adm, body: { status: 'blocked' } });
  assert.equal(blk.body.driver.online, false);
  assert.equal((await s.call('/api/driver/online', { token: far.token, body: { online: true, lat: -10, lng: -48 } })).status, 403);
  assert.equal((await s.call('/api/admin/rides?status=completed', { token: adm })).body.rides.length, 2);

  // Central cancela corrida em busca.
  const c = await s.call('/api/admin/rides', { token: adm, body: { passenger_name: 'Lia', origin: O, dest: D } });
  const cancelled = await s.call(`/api/admin/rides/${c.body.ride.id}/cancel`, { token: adm, body: { reason: 'engano' } });
  assert.equal(cancelled.body.ride.status, 'cancelled');
  assert.equal((await s.call('/api/driver/state', { token: near.token })).body.offer, null);
});

test('tempo real: passageiro e motoqueiro recebem os avisos; sem token é recusado', async (t) => {
  const s = await start();
  const sockets = [];
  t.after(async () => {
    sockets.forEach((x) => x.close());
    await s.close();
  });
  const connect = (token) =>
    new Promise((resolve, reject) => {
      const socket = ioClient(s.base, { auth: { token }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  const next = (socket, event, match = () => true) =>
    new Promise((resolve) => {
      const handler = (payload) => {
        if (!match(payload)) return;
        socket.off(event, handler);
        resolve(payload);
      };
      socket.on(event, handler);
    });

  await assert.rejects(connect(''));
  await assert.rejects(connect('token-falso'));

  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const ps = await connect(p.token);
  const ds = await connect(d.token);
  const as = await connect(s.admin.token);

  const offerP = next(ds, 'ride:offer');
  const created = await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'cash' } });
  const offer = await offerP;
  assert.equal(offer.ride.id, created.body.ride.id);
  assert.equal(offer.timeoutS, 20);

  const acceptedP = next(ps, 'ride:update', (r) => r.status === 'accepted');
  const adminSawP = next(as, 'ride:update', (r) => r.status === 'accepted');
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: d.token, body: {} });
  assert.equal((await acceptedP).driver.name, 'João');
  await adminSawP;

  const locP = next(ps, 'driver:location');
  const adminLocP = next(as, 'driver:location');
  ds.emit('driver:location', { lat: -10.0005, lng: -48.0005 });
  assert.deepEqual(await locP, { driverId: d.user.id, lat: -10.0005, lng: -48.0005 });
  await adminLocP;

  // Motoqueiro desiste: ele próprio é avisado de que saiu da corrida.
  const backP = next(ds, 'ride:update', (r) => r.status !== 'accepted');
  await s.call(`/api/driver/rides/${created.body.ride.id}/cancel`, { token: d.token, body: {} });
  assert.equal((await backP).driver_id, null);
});

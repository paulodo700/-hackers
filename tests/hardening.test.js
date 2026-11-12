const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, makeCtx, addDriver, rideInput } = require('./helpers');
const { createLimiter } = require('../server/limit');
const { withRouteCache } = require('../server/geo');

const O = { text: 'Praça Central', lat: -10, lng: -48 };
const D = { text: 'Rodoviária', lat: -10.02, lng: -48.02 };

test('trocar a própria senha derruba os logins antigos', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');

  assert.equal((await s.call('/api/auth/password', { token: p.token, body: { current: 'errada', password: 'nova-senha' } })).status, 401);
  assert.equal((await s.call('/api/auth/password', { token: p.token, body: { current: '123456', password: '123' } })).status, 400);
  assert.equal((await s.call('/api/auth/password', { body: { current: '123456', password: 'nova-senha' } })).status, 401);

  const changed = await s.call('/api/auth/password', { token: p.token, body: { current: '123456', password: 'nova-senha' } });
  assert.equal(changed.status, 200);
  assert.equal((await s.call('/api/auth/me', { token: p.token })).status, 401); // token antigo não vale mais
  assert.equal((await s.call('/api/auth/me', { token: changed.body.token })).status, 200);
  assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: '123456' } })).status, 401);
  assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: 'nova-senha' } })).status, 200);
});

test('central redefine a senha de quem esqueceu', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const adm = s.admin.token;
  const p = await s.register('passenger', 'Maria', '11988887777');
  const reset = (body, token = adm) => s.call('/api/admin/users/password', { token, body });

  assert.equal((await reset({ phone: '11988887777', password: 'abc12345' }, p.token)).status, 403);
  assert.equal((await reset({ phone: '11900001111', password: 'abc12345' })).status, 404);
  assert.equal((await reset({ phone: '123', password: 'abc12345' })).status, 400);
  assert.equal((await reset({ phone: '11988887777', password: '123' })).status, 400);
  assert.equal((await reset({ phone: '11900000000', password: 'abc12345' })).status, 403); // a própria central

  const ok = await reset({ phone: '(11) 98888-7777', password: 'abc12345' });
  assert.deepEqual(ok.body, { ok: true, name: 'Maria', role: 'passenger' });
  assert.equal((await s.call('/api/auth/me', { token: p.token })).status, 401);
  assert.equal((await s.call('/api/auth/login', { body: { phone: '11988887777', password: 'abc12345' } })).status, 200);
});

test('telefone da central e nome do aplicativo instalado seguem as configurações', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const put = (body) => s.call('/api/admin/settings', { token: s.admin.token, method: 'PUT', body });

  assert.equal((await s.call('/api/public/config')).body.support_phone, '');
  assert.equal((await put({ support_phone: '12345' })).status, 400);
  assert.equal((await put({ support_phone: '+55 (63) 99999-0000' })).body.settings.support_phone, '63999990000');
  assert.equal((await s.call('/api/public/config')).body.support_phone, '63999990000');
  assert.equal((await put({ support_phone: '' })).body.settings.support_phone, '');

  await put({ brand_name: 'Moto Já' });
  const manifest = async (app) => (await fetch(`${s.base}/${app}/manifest.webmanifest`)).json();
  assert.equal((await manifest('passageiro')).name, 'Moto Já');
  assert.equal((await manifest('passageiro')).start_url, '/passageiro/');
  // Três aplicativos separados: cada um com seu endereço, alcance e ícone.
  for (const app of ['passageiro', 'motoqueiro', 'central']) {
    const m = await manifest(app);
    assert.equal(m.id, `/${app}/`);
    assert.equal(m.scope, `/${app}/`);
    assert.equal(m.icons[1].src, `/icon-${app}-512.png`);
    assert.equal((await fetch(s.base + m.icons[1].src)).status, 200);
  }
  assert.equal((await manifest('motoqueiro')).name, 'Moto Já Motoqueiro');
  assert.equal((await manifest('central')).short_name, 'Central');
  assert.equal((await fetch(`${s.base}/outro/manifest.webmanifest`)).status, 404);
});

test('o preço confirmado é o mesmo da estimativa, mesmo se o serviço de rota mudar a resposta', async (t) => {
  let calls = 0;
  const geo = {
    // Primeira resposta: 2 km. Depois o serviço "cai" e passaria a responder 9 km.
    routeDistanceKm: async () => ({ km: ++calls === 1 ? 2 : 9, source: 'osrm' }),
    searchAddress: async () => [],
    reverseAddress: async () => null,
  };
  const s = await startServer({ geo });
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const est = await s.call('/api/rides/estimate', { token: p.token, body: { origin: O, dest: D } });
  const created = await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'cash' } });
  assert.equal(est.body.price, 7);
  assert.equal(created.body.ride.price, 7);
  assert.equal(calls, 1);
});

test('cache de rotas: expira, e estimativas duram menos', async () => {
  let calls = 0;
  let source = 'osrm';
  const clock = { t: 0 };
  const geo = withRouteCache({ routeDistanceKm: async () => ({ km: ++calls, source }) }, { ttlMs: 600_000, max: 2, now: () => clock.t });
  assert.equal((await geo.routeDistanceKm(O, D)).km, 1);
  assert.equal((await geo.routeDistanceKm(O, D)).km, 1);
  clock.t = 600_001;
  assert.equal((await geo.routeDistanceKm(O, D)).km, 2);

  source = 'estimate';
  const other = { lat: -11, lng: -49 };
  assert.equal((await geo.routeDistanceKm(O, other)).km, 3);
  clock.t += 121_000; // estimativa vale só 2 minutos
  assert.equal((await geo.routeDistanceKm(O, other)).km, 4);

  // Não cresce sem limite.
  await geo.routeDistanceKm(D, other);
  await geo.routeDistanceKm(other, D);
  assert.equal(calls, 6);
});

test('oferta leva a hora do servidor (celular com relógio errado calcula certo)', () => {
  const ctx = makeCtx();
  const a = addDriver(ctx, {});
  ctx.rides.createRide(rideInput());
  const offer = ctx.events.find((e) => e.name === 'ride:offer').payload;
  assert.equal(offer.serverNow, ctx.clock.t);
  assert.equal(offer.expiresAt - offer.serverNow, 20000);
  ctx.clock.t += 5000;
  const again = ctx.dispatch.pendingOfferFor(a.id);
  assert.equal(again.expiresAt - again.serverNow, 15000);
});

test('limitador: bloqueia acima do máximo por endereço e conta falhas à parte', () => {
  const limit = createLimiter({ windowMs: 60_000, max: 3 });
  const run = (ip) => {
    let err = null;
    limit({ ip }, {}, (e) => (err = e || null));
    return err ? err.status : 200;
  };
  assert.deepEqual([run('a'), run('a'), run('a'), run('a')], [200, 200, 200, 429]);
  assert.equal(run('b'), 200);

  const fails = createLimiter({ windowMs: 60_000, max: 2 });
  assert.equal(fails.blocked('x'), false);
  fails.fail('x');
  fails.fail('x');
  assert.equal(fails.blocked('x'), true);
  assert.equal(fails.blocked('y'), false);
});

test('cadastros em excesso do mesmo endereço são barrados', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  let last;
  for (let i = 0; i < 21; i++) {
    last = await s.call('/api/auth/register', {
      body: { role: 'passenger', name: 'Robô', phone: `119${String(10000000 + i)}`, password: '123456' },
    });
    if (i < 20) assert.equal(last.status, 201, `cadastro ${i}`);
  }
  assert.equal(last.status, 429);
});

test('erro em uma oferta que expira não derruba o servidor', () => {
  const ctx = makeCtx();
  addDriver(ctx, {});
  ctx.rides.createRide(rideInput());
  const original = console.error;
  console.error = () => {};
  ctx.db.exec('DROP TABLE ride_offers'); // força um erro dentro do temporizador
  assert.doesNotThrow(() => ctx.scheduled.at(-1).fn());
  console.error = original;
});

test('personalização: ajustes públicos, liga/desliga e validações', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const put = (body) => s.call('/api/admin/settings', { token: s.admin.token, method: 'PUT', body });
  const pub = async () => (await s.call('/api/public/config')).body;

  const first = await pub();
  assert.equal(first.slogan, 'Peça sua moto em poucos toques');
  assert.equal(first.pay_cash, 1);
  assert.equal(first.p_history, 1);
  assert.equal(first.default_theme, 'auto');
  assert.equal(first.base_fare, undefined); // preços e comissão não vão para as telas públicas
  assert.equal(first.commission_percent, undefined);

  await put({ slogan: 'A moto mais rápida da cidade', notice_passenger: '  Promoção:   hoje sem taxa!  ', pix_key: 'golpe@pix.com', p_history: false, d_terms: 0, default_theme: 'escuro' });
  const now = await pub();
  assert.equal(now.slogan, 'A moto mais rápida da cidade');
  assert.equal(now.notice_passenger, 'Promoção: hoje sem taxa!');
  assert.equal(now.pix_key, undefined); // dados bancários não são públicos...
  assert.equal((await s.call('/api/admin/bank', { token: s.admin.token })).body.bank, null); // ...nem mudam por aqui
  assert.equal(now.p_history, 0);
  assert.equal(now.d_terms, 0);
  assert.equal(now.default_theme, 'escuro');

  assert.equal((await put({ notice_passenger: '' })).status, 200); // aviso pode ser apagado
  assert.equal((await put({ slogan: '' })).status, 400);
  assert.equal((await put({ default_theme: 'rosa' })).status, 400);
  assert.equal((await put({ p_history: 'talvez' })).status, 400);
  assert.equal((await put({ pay_cash: false, pay_pix: false })).status, 400);
  assert.equal((await pub()).pay_cash, 1); // nada foi gravado no pedido recusado

  // Forma de pagamento desligada não é aceita no pedido.
  await put({ pay_pix: false });
  const p = await s.register('passenger', 'Maria', '11988887777');
  const O = { lat: -10, lng: -48 };
  const D = { lat: -10.02, lng: -48.02 };
  assert.equal((await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'pix' } })).status, 400);
  assert.equal((await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'cash' } })).status, 201);
});

test('perfil: a pessoa corrige o próprio nome', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Mria', '11988887777');
  assert.equal((await s.call('/api/auth/profile', { token: p.token, method: 'PUT', body: { name: 'M' } })).status, 400);
  assert.equal((await s.call('/api/auth/profile', { method: 'PUT', body: { name: 'Maria' } })).status, 401);
  const ok = await s.call('/api/auth/profile', { token: p.token, method: 'PUT', body: { name: '  Maria   Silva ' } });
  assert.equal(ok.body.user.name, 'Maria Silva');
  assert.equal((await s.call('/api/auth/me', { token: p.token })).body.user.name, 'Maria Silva');
});

test('central: lista passageiros, bloqueia e vê os números dos motoqueiros', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const adm = s.admin.token;
  const O = { lat: -10, lng: -48 };
  const D = { lat: -10.02, lng: -48.02 };
  const maria = await s.register('passenger', 'Maria', '11988887777');
  await s.register('passenger', 'José', '11977776666');
  const d = await s.approvedDriver('João', '11955554444');

  const ride = (await s.call('/api/rides', { token: maria.token, body: { origin: O, dest: D, payment: 'cash' } })).body.ride;
  const offer = (await s.call('/api/driver/state', { token: d.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: d.token, body: {} });
  for (const a of ['arrive', 'start', 'complete']) await s.call(`/api/driver/rides/${ride.id}/${a}`, { token: d.token, body: {} });
  await s.call(`/api/rides/${ride.id}/rate`, { token: maria.token, body: { rating: 4 } });

  const list = await s.call('/api/admin/passengers', { token: adm });
  assert.equal(list.body.total, 2);
  const m = list.body.passengers.find((x) => x.name === 'Maria');
  assert.deepEqual({ rides: m.rides, spent: m.spent, blocked: m.blocked, phone: m.phone }, { rides: 1, spent: 7, blocked: false, phone: '11988887777' });
  assert.equal(m.password_hash, undefined);
  assert.equal((await s.call('/api/admin/passengers?q=jos', { token: adm })).body.passengers.length, 1);
  assert.equal((await s.call('/api/admin/passengers?q=%25', { token: adm })).body.passengers.length, 2); // curinga é ignorado
  assert.equal((await s.call('/api/admin/passengers', { token: maria.token })).status, 403);

  const stats = (await s.call('/api/admin/drivers/stats', { token: adm })).body.stats;
  assert.deepEqual({ rides: stats[0].rides, revenue: stats[0].revenue, rating: stats[0].rating, ratings: stats[0].ratings }, { rides: 1, revenue: 7, rating: 4, ratings: 1 });

  // Bloqueado não pede corrida; desbloqueado volta a pedir. Motoqueiro não é "passageiro".
  assert.equal((await s.call(`/api/admin/passengers/${d.user.id}/block`, { token: adm, body: { blocked: true } })).status, 404);
  await s.call(`/api/admin/passengers/${maria.user.id}/block`, { token: adm, body: { blocked: true } });
  const denied = await s.call('/api/rides', { token: maria.token, body: { origin: O, dest: D, payment: 'cash' } });
  assert.equal(denied.status, 403);
  assert.match(denied.body.error, /bloqueada/);
  await s.call(`/api/admin/passengers/${maria.user.id}/block`, { token: adm, body: { blocked: false } });
  assert.equal((await s.call('/api/rides', { token: maria.token, body: { origin: O, dest: D, payment: 'cash' } })).status, 201);
});

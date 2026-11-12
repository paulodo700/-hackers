const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../server/geo');

const sp = { lat: -23.5505, lng: -46.6333 };
const rio = { lat: -22.9068, lng: -43.1729 };
const okJson = (body) => async () => ({ ok: true, json: async () => body });

test('haversine: São Paulo → Rio ≈ 360 km', () => {
  const km = geo.haversineKm(sp, rio);
  assert.ok(Math.abs(km - 360) < 10, `km=${km}`);
  assert.equal(geo.haversineKm(sp, sp), 0);
});

test('validCoord', () => {
  assert.equal(geo.validCoord(sp), true);
  assert.equal(geo.validCoord({ lat: 91, lng: 0 }), false);
  assert.equal(geo.validCoord({ lat: 0, lng: 181 }), false);
  assert.equal(geo.validCoord({ lat: '1', lng: 2 }), false);
  assert.equal(geo.validCoord({ lat: NaN, lng: 2 }), false);
  assert.equal(geo.validCoord(null), false);
});

test('rota usa OSRM quando responde', async () => {
  const body = { routes: [{ distance: 2500, duration: 400, geometry: { coordinates: [[-46.6333, -23.5505], [-46.5, -23.4], [-43.1729, -22.9068]] } }] };
  const r = await geo.routeDistanceKm(sp, rio, okJson(body));
  assert.deepEqual(r, { km: 2.5, source: 'osrm', min: 7, points: [[-23.5505, -46.6333], [-23.4, -46.5], [-22.9068, -43.1729]] });

  // Resposta sem tempo nem desenho: completa com estimativa em linha reta.
  const bare = await geo.routeDistanceKm(sp, rio, okJson({ routes: [{ distance: 5000 }] }));
  assert.equal(bare.min, 12); // 5 km a 25 km/h
  assert.deepEqual(bare.points, [[sp.lat, sp.lng], [rio.lat, rio.lng]]);

  // Rota muito detalhada é reduzida, mantendo as pontas.
  const many = Array.from({ length: 1000 }, (_, i) => [-46 + i / 1e4, -23 + i / 1e4]);
  const big = await geo.routeDistanceKm(sp, rio, okJson({ routes: [{ distance: 9000, duration: 900, geometry: { coordinates: many } }] }));
  assert.equal(big.points.length, 160);
  assert.deepEqual(big.points[0], [-23, -46]);
  assert.deepEqual(big.points.at(-1), [-22.9001, -45.9001]);
});

test('rota cai para estimativa quando o serviço falha', async () => {
  const expected = Math.round(geo.haversineKm(sp, rio) * 1.3 * 100) / 100;
  const rejects = async () => { throw new Error('fora do ar'); };
  const est = await geo.routeDistanceKm(sp, rio, rejects);
  assert.equal(est.km, expected);
  assert.equal(est.source, 'estimate');
  assert.equal(est.points.length, 2);
  assert.ok(est.min > 0);
  const http500 = async () => ({ ok: false, json: async () => ({}) });
  assert.equal((await geo.routeDistanceKm(sp, rio, http500)).source, 'estimate');
  assert.equal((await geo.routeDistanceKm(sp, rio, okJson({ routes: [] }))).source, 'estimate');
});

test('rota não trava quando o serviço nunca responde', async () => {
  const never = () => new Promise(() => {});
  const started = Date.now();
  const r = await geo.routeDistanceKm(sp, rio, never, 50);
  assert.equal(r.source, 'estimate');
  assert.ok(Date.now() - started < 1000);
});

test('busca de endereço devolve rótulo curto e coordenadas', async () => {
  const body = [
    { lat: '-10.1', lon: '-48.3', name: '', display_name: 'x', address: { road: 'Rua das Flores', house_number: '12', suburb: 'Centro' } },
    { lat: 'abc', lon: '1', display_name: 'ruim' },
  ];
  const r = await geo.searchAddress('rua das flores', { lat: -10, lng: -48 }, okJson(body));
  assert.deepEqual(r, [{ label: 'Rua das Flores, 12 - Centro', lat: -10.1, lng: -48.3, approx: false }]);
  assert.deepEqual(await geo.searchAddress('ab', { lat: 0, lng: 0 }, okJson(body)), []);
  const rejects = async () => { throw new Error('x'); };
  assert.deepEqual(await geo.searchAddress('rua tal', { lat: 0, lng: 0 }, rejects), []);
});

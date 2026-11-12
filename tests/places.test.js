const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../server/db');
const { createPlaces, normalize } = require('../server/places');
const geo = require('../server/geo');
const { startServer } = require('./helpers');

const status = (fn) => {
  try { fn(); } catch (err) { return err.status; }
  return 'sem erro';
};
const okJson = (body) => async () => ({ ok: true, json: async () => body });
const NEAR = { lat: -10.17, lng: -48.88 };

test('normalização: abreviações, acentos e "nº" viram a mesma coisa', () => {
  assert.equal(normalize('R. 13 de Maio, nº 500 - Centro'), 'rua 13 maio 500 centro');
  assert.equal(normalize('Rua Treze de Maio 500 centro'), 'rua treze maio 500 centro');
  assert.equal(normalize('Av. Bernardo Sayão, 1.200'), 'avenida bernardo sayao 1 200');
  assert.equal(normalize('  PÇA.  da   Matriz '), 'praca matriz');
  assert.equal(normalize(null), '');
});

test('separa o número da rua', () => {
  assert.deepEqual(geo.splitNumber('rua 13 de maio 500'), { street: 'rua 13 de maio', number: '500' });
  assert.deepEqual(geo.splitNumber('Av. Brasil, nº 1200'), { street: 'Av. Brasil', number: '1200' });
  assert.deepEqual(geo.splitNumber('rua alfredo nasser, 45B'), { street: 'rua alfredo nasser', number: '45B' });
  assert.deepEqual(geo.splitNumber('rodoviária'), { street: 'rodoviária', number: '' });
  assert.deepEqual(geo.splitNumber('rua 7'), { street: 'rua 7', number: '' }); // "7" é o nome da rua
  assert.deepEqual(geo.splitNumber('quadra 12 lote 5'), { street: 'quadra 12 lote', number: '5' });
});

test('busca no mapa: mantém o número digitado, marca como aproximado e tira ruas repetidas', async () => {
  const body = [
    { lat: '-10.20', lon: '-48.90', category: 'highway', name: 'Rua 13 de Maio', address: { road: 'Rua 13 de Maio', suburb: 'Centro' } },
    { lat: '-10.171', lon: '-48.881', category: 'highway', name: 'Rua 13 de Maio', address: { road: 'Rua 13 de Maio', suburb: 'Centro' } },
    { lat: '-10.18', lon: '-48.87', category: 'highway', name: 'Rua 13 de Maio', address: { road: 'Rua 13 de Maio', suburb: 'Setor Oeste' } },
  ];
  const r = await geo.searchAddress('rua 13 de maio 500', NEAR, okJson(body));
  assert.deepEqual(r, [
    { label: 'Rua 13 de Maio, 500 - Centro', lat: -10.171, lng: -48.881, approx: true }, // o pedaço mais perto
    { label: 'Rua 13 de Maio, 500 - Setor Oeste', lat: -10.18, lng: -48.87, approx: true },
  ]);

  // Sem número digitado, a rua não é "aproximada".
  const street = await geo.searchAddress('rua 13 de maio', NEAR, okJson(body));
  assert.equal(street[0].label, 'Rua 13 de Maio - Centro');
  assert.equal(street[0].approx, false);
});

test('busca no mapa: número que o mapa conhece vem primeiro e como exato; lugares com nome ficam como são', async () => {
  const body = [
    { lat: '-10.171', lon: '-48.881', category: 'highway', name: 'Rua Tapajós', address: { road: 'Rua Tapajós', suburb: 'Centro' } },
    { lat: '-10.19', lon: '-48.89', category: 'amenity', name: 'Hospital do Coração', address: { road: 'Rua Tapajós', house_number: '260', suburb: 'Centro' } },
  ];
  const r = await geo.searchAddress('rua tapajos 260', NEAR, okJson(body));
  assert.deepEqual(r[0], { label: 'Hospital do Coração - Rua Tapajós, 260 - Centro', lat: -10.19, lng: -48.89, approx: false });
  assert.equal(r[1].approx, true);
  assert.equal(r[1].label, 'Rua Tapajós, 260 - Centro');
});

test('locais conhecidos: central cadastra, sistema aprende, busca por pedaços do nome', () => {
  const db = openDb(':memory:');
  const places = createPlaces({ db });
  const pos = { lat: -10.17, lng: -48.88 };

  places.add('Rodoviária', pos);
  places.add('Hospital Regional', { lat: -10.2, lng: -48.9 });
  assert.equal(status(() => places.add('', pos)), 400);
  assert.equal(status(() => places.add('Local marcado no mapa', pos)), 400);
  assert.equal(status(() => places.add('Farmácia', { lat: 200, lng: 0 })), 400);

  // Aprende só endereço com número; texto genérico ou sem número é ignorado.
  assert.ok(places.learn('Rua 13 de Maio, 500 - Centro', { lat: -10.1712, lng: -48.8813 }));
  assert.equal(places.learn('Rua 13 de Maio - Centro', pos), null);
  assert.equal(places.learn('Local marcado no mapa', pos), null);
  assert.equal(places.learn('500', pos), null);

  assert.equal(places.search('rodov')[0].name, 'Rodoviária');
  assert.equal(places.search('hosp reg')[0].name, 'Hospital Regional');
  assert.equal(places.search('RODOVIARIA')[0].name, 'Rodoviária'); // sem acento também acha
  const hit = places.search('r. 13 de maio 500')[0];
  assert.deepEqual({ name: hit.name, lat: hit.lat, source: hit.source }, { name: 'Rua 13 de Maio, 500 - Centro', lat: -10.1712, source: 'corrida' });
  assert.deepEqual(places.search('rua 13 de maio 700'), []); // outro número não serve
  assert.deepEqual(places.search('x'), []);
  assert.deepEqual(places.search('%'), []);

  // Aprender de novo atualiza a posição e conta o uso.
  places.learn('rua 13 de maio 500 centro', { lat: -10.1713, lng: -48.8814 });
  const again = places.search('13 maio 500')[0];
  assert.equal(again.uses, 2);
  assert.equal(again.lat, -10.1713);
  assert.equal(places.list().total, 3);

  places.remove(again.id);
  assert.equal(status(() => places.remove(again.id)), 404);
  assert.deepEqual(places.search('13 maio 500'), []);
});

test('fluxo completo: endereço confirmado numa corrida passa a ser achado com exatidão', async (t) => {
  let searches = 0;
  const geoImpl = {
    routeDistanceKm: async () => ({ km: 2, source: 'osrm' }),
    searchAddress: async (q) => {
      searches += 1;
      return q.includes('nada') ? [] : [{ label: 'Rua 13 de Maio, 500 - Centro', lat: -10.2, lng: -48.9, approx: true }];
    },
    reverseAddress: async () => null,
  };
  const s = await startServer({ geo: geoImpl });
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const search = async (q) => (await s.call(`/api/geo/search?q=${encodeURIComponent(q)}`, { token: p.token })).body.results;

  // Antes: só o mapa, aproximado (meio da rua).
  assert.deepEqual(await search('rua 13 de maio 500'), [{ label: 'Rua 13 de Maio, 500 - Centro', lat: -10.2, lng: -48.9, approx: true }]);
  await search('rua 13 de maio 500');
  assert.equal(searches, 1); // a segunda busca igual veio da memória
  await search('nada aqui');
  await search('nada aqui');
  assert.equal(searches, 3); // busca sem resultado não fica guardada

  // A passageira ajusta o pino para o lugar certo e a corrida acontece.
  const exact = { text: 'Rua 13 de Maio, 500 - Centro', lat: -10.1712, lng: -48.8813, precise: true };
  const vague = { text: 'Rua das Flores, 80 - Centro', lat: -10.3, lng: -48.7 }; // não confirmada: não aprende
  const ride = (await s.call('/api/rides', { token: p.token, body: { origin: vague, dest: exact, payment: 'cash' } })).body.ride;
  const offer = (await s.call('/api/driver/state', { token: d.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: d.token, body: {} });
  for (const a of ['arrive', 'start']) await s.call(`/api/driver/rides/${ride.id}/${a}`, { token: d.token, body: {} });
  assert.equal((await search('13 de maio 500')).some((r) => r.known), false); // ainda não concluiu
  await s.call('/api/driver/location', { token: d.token, body: { lat: exact.lat, lng: exact.lng } }); // chegou ao destino exato
  await s.call(`/api/driver/rides/${ride.id}/complete`, { token: d.token, body: {} });

  // Depois: o endereço aprendido vem primeiro, exato, e o repetido do mapa some.
  const after = await search('r 13 de maio 500');
  assert.deepEqual(after, [{ label: 'Rua 13 de Maio, 500 - Centro', lat: -10.1712, lng: -48.8813, approx: false, known: true }]);
  assert.equal((await search('rua das flores 80')).some((r) => r.known), false);

  // Destinos recentes da passageira.
  assert.deepEqual((await s.call('/api/rides/recent-places', { token: p.token })).body.places, [{ label: 'Rua 13 de Maio, 500 - Centro', lat: -10.1712, lng: -48.8813 }]);

  // A central cadastra, vê e apaga locais.
  const adm = s.admin.token;
  assert.equal((await s.call('/api/admin/places', { token: adm, body: { name: 'Rodoviária', lat: -10.18, lng: -48.87 } })).status, 201);
  assert.equal((await s.call('/api/admin/places', { token: adm, body: { name: 'X', lat: -10.18, lng: -48.87 } })).status, 400);
  assert.equal((await s.call('/api/admin/places', { token: p.token, body: { name: 'Golpe', lat: 0, lng: 0 } })).status, 403);
  assert.equal((await search('rodov'))[0].label, 'Rodoviária');
  const list = (await s.call('/api/admin/places', { token: adm })).body;
  assert.equal(list.total, 2);
  const learned = list.places.find((x) => x.source === 'corrida');
  assert.equal((await s.call(`/api/admin/places/${learned.id}`, { token: adm, method: 'DELETE' })).status, 200);
  assert.equal((await search('13 de maio 500')).some((r) => r.known), false);
});

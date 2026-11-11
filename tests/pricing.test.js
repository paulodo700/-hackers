const test = require('node:test');
const assert = require('node:assert/strict');
const { calcPrice } = require('../server/pricing');
const { openDb, getSettings, setSettings } = require('../server/db');

const s = { base_fare: 3, per_km: 2, min_fare: 6 };

test('preço respeita o valor mínimo', () => {
  assert.equal(calcPrice(0.5, s), 6);
  assert.equal(calcPrice(0, s), 6);
});

test('preço = taxa inicial + km, arredondado para cima a 0,50', () => {
  assert.equal(calcPrice(2, s), 7);
  assert.equal(calcPrice(2.6, s), 8.5);
  assert.equal(calcPrice(3.5, s), 10);
  assert.equal(calcPrice(2.25, s), 7.5);
});

test('distância inválida é rejeitada', () => {
  assert.throws(() => calcPrice(-1, s));
  assert.throws(() => calcPrice(NaN, s));
  assert.throws(() => calcPrice(Infinity, s));
});

test('configurações: padrões, gravação e validação', () => {
  const db = openDb(':memory:');
  const d = getSettings(db);
  assert.equal(d.base_fare, 3);
  assert.equal(d.per_km, 2);
  assert.equal(d.min_fare, 6);
  assert.equal(d.commission_percent, 10);
  assert.equal(d.offer_timeout_s, 20);

  setSettings(db, { per_km: 2.5, city_name: 'Vila Bela', desconhecida: 1 });
  const n = getSettings(db);
  assert.equal(n.per_km, 2.5);
  assert.equal(n.city_name, 'Vila Bela');
  assert.equal(n.desconhecida, undefined);

  setSettings(db, { per_km: '3,5' });
  assert.equal(getSettings(db).per_km, 3.5);

  assert.throws(() => setSettings(db, { per_km: -1 }));
  assert.throws(() => setSettings(db, { per_km: 'abc' }));
  assert.throws(() => setSettings(db, { commission_percent: 150 }));
  assert.equal(getSettings(db).per_km, 3.5);
});

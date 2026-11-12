const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

const O = { lat: -10, lng: -48 };
const D = { lat: -10.02, lng: -48.02 };

// Gateway simulado (mesmas formas de resposta da documentação do Asaas).
function fakeAsaas() {
  const log = [];
  return {
    enabled: true,
    validWebhook: (token) => token === 'token-webhook-longo',
    createCustomer: async (dados) => { log.push(['customer', dados]); return { id: 'cus_TESTE' }; },
    createPixCharge: async (dados) => { log.push(['charge', dados]); return { id: 'pay_TESTE' }; },
    pixQrCode: async (id) => ({ encodedImage: 'iVBORw0KGgo=', payload: '00020126580014br.gov.bcb.pix0136TESTE', expirationDate: '2026-11-12 23:59:59', id }),
    log,
  };
}

async function corridaEmAndamento(s, passenger, driver) {
  const ride = (await s.call('/api/rides', { token: passenger.token, body: { origin: O, dest: D, payment: 'pix' } })).body.ride;
  const offer = (await s.call('/api/driver/state', { token: driver.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: driver.token, body: {} });
  await s.call(`/api/driver/rides/${ride.id}/arrive`, { token: driver.token, body: {} });
  await s.call(`/api/driver/rides/${ride.id}/start`, { token: driver.token, body: {} });
  return ride.id;
}

test('Pix pelo Asaas: cobra com CPF do passageiro, divide para a conta do motorista e confirma pelo webhook', async (t) => {
  const asaas = fakeAsaas();
  const s = await startServer({ asaas });
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const rideId = await corridaEmAndamento(s, p, d);

  // Motorista sem conta Asaas: não cobra e explica.
  const semConta = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(semConta.status, 409);
  assert.match(semConta.body.error, /conta de recebimento/);
  assert.equal((await s.call(`/api/admin/drivers/${d.user.id}/asaas-wallet`, { token: s.admin.token, method: 'PUT', body: { wallet_id: 'x' } })).status, 400);
  assert.equal((await s.call(`/api/admin/drivers/${d.user.id}/asaas-wallet`, { token: s.admin.token, method: 'PUT', body: { wallet_id: 'wal_motorista_1' } })).status, 200);

  // Sem CPF do passageiro: não cobra e explica.
  const semCpf = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(semCpf.status, 409);
  assert.match(semCpf.body.error, /CPF/);
  assert.equal((await s.call('/api/auth/profile', { token: p.token, method: 'PUT', body: { name: 'Maria', cpf: '123' } })).status, 400);
  assert.equal((await s.call('/api/auth/profile', { token: p.token, method: 'PUT', body: { name: 'Maria', cpf: '529.982.247-25' } })).status, 200);
  // Salvar o perfil com o CPF mascarado não o estraga.
  assert.equal((await s.call('/api/auth/profile', { token: p.token, method: 'PUT', body: { name: 'Maria', cpf: '•••.•••.•••-25' } })).status, 200);
  assert.equal((await s.call('/api/auth/me', { token: p.token })).body.user.cpf_masked, '•••.•••.•••-25');

  const pix = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(pix.status, 200);
  assert.equal(pix.body.provider, 'asaas');
  assert.equal(pix.body.qrImage, 'iVBORw0KGgo=');
  assert.match(pix.body.code, /^000201/);
  const cobranca = asaas.log.find((x) => x[0] === 'charge')[1];
  assert.equal(cobranca.customerId, 'cus_TESTE');
  assert.equal(cobranca.value, 7);
  assert.equal(cobranca.externalReference, `corrida-${rideId}`);
  // A parte do motorista sai do próprio Asaas: R$ 7 − 10% = R$ 6,30 para a subconta dele.
  assert.deepEqual(cobranca.split, [{ walletId: 'wal_motorista_1', fixedValue: 6.3, externalReference: `corrida-${rideId}-motorista` }]);

  // Pedir o Pix de novo não cria outra cobrança.
  await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(asaas.log.filter((x) => x[0] === 'charge').length, 1);

  // Corrida termina; o Asaas avisa que o Pix caiu.
  await s.call('/api/driver/location', { token: d.token, body: { lat: D.lat, lng: D.lng } });
  await s.call(`/api/driver/rides/${rideId}/complete`, { token: d.token, body: {} });
  const aviso = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_TESTE', value: 7, externalReference: `corrida-${rideId}` } };
  const post = (body, token) => fetch(`${s.base}/api/payments/asaas`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': token }, body: JSON.stringify(body) });
  assert.equal((await post(aviso, 'chute')).status, 401);
  assert.equal((await post(aviso, 'token-webhook-longo')).status, 200);
  // Repetição do mesmo aviso: responde 200 e não divide de novo.
  assert.equal((await post(aviso, 'token-webhook-longo')).status, 200);
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 6.3);
  // Com o Asaas ligado, o saque interno fica fechado (o Asaas já pagou a subconta).
  const saque = await s.call('/api/driver/wallet/withdraw', { token: d.token, body: { password: '123456', amount: 10 } });
  assert.equal(saque.status, 409);
  assert.match(saque.body.error, /gateway/);
});

test('webhook do Asaas ignora eventos que não são pagamento confirmado', async (t) => {
  const asaas = fakeAsaas();
  const s = await startServer({ asaas });
  t.after(() => s.close());
  const r = await fetch(`${s.base}/api/payments/asaas`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': 'token-webhook-longo' }, body: JSON.stringify({ event: 'PAYMENT_CREATED', payment: { externalReference: 'corrida-1' } }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ignored, true);
});

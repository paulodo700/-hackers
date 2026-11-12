const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

const O = { lat: -10, lng: -48 };
const D = { lat: -10.02, lng: -48.02 };
const SUB = { email: 'joao@exemplo.com', mobilePhone: '11955554444', incomeValue: 3000, address: 'Rua das Flores', addressNumber: '10', province: 'Centro', postalCode: '01001000' };
const CENTRAL_BANK = { holder_name: 'Central Mototáxi LTDA', holder_doc: '11.222.333/0001-81', bank_name: 'Banco Central', pix_type: 'cnpj', pix_key: '11.222.333/0001-81' };

// A central precisa ter conta cadastrada: é ela o cliente das cobranças.
async function ligarCentral(s) {
  const r = await s.call('/api/admin/bank', { token: s.admin.token, method: 'PUT', body: { password: 'central123', ...CENTRAL_BANK } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
}
const PAYLOAD = '00020126580014br.gov.bcb.pix0136teste-chave5204000053039865802BR5913TESTE6008BRASIL62070503***6304ABCD';

// Simula a API do Asaas. Tudo que não é do Asaas passa para o fetch real (o próprio servidor de teste).
function fakeAsaas(t) {
  const realFetch = globalThis.fetch;
  const calls = [];
  let seq = 0;
  globalThis.fetch = async (url, opts = {}) => {
    if (!String(url).includes('asaas.com')) return realFetch(url, opts);
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method: opts.method, url: String(url), headers: opts.headers, body });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    const u = String(url);
    if (u.endsWith('/v3/customers')) return json(200, { id: 'cus_1' });
    if (u.endsWith('/v3/accounts')) return json(200, { id: 'acc_1', walletId: 'wal_motorista_1', accessToken: { apiKey: 'nao-guardar' } });
    if (u.endsWith('/v3/payments')) return json(200, { id: `pay_${++seq}`, status: 'PENDING' });
    if (u.includes('/pixQrCode')) return json(200, { encodedImage: 'AAAA', payload: PAYLOAD, expirationDate: '2026-12-31 23:59:59' });
    return json(404, { errors: [{ code: 'not_found', description: 'não existe' }] });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  return calls;
}

async function completedPixRide(s, passenger, driver) {
  const ride = (await s.call('/api/rides', { token: passenger.token, body: { origin: O, dest: D, payment: 'pix' } })).body.ride;
  const offer = (await s.call('/api/driver/state', { token: driver.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: driver.token, body: {} });
  for (const a of ['arrive', 'start']) await s.call(`/api/driver/rides/${ride.id}/${a}`, { token: driver.token, body: {} });
  await s.call('/api/driver/location', { token: driver.token, body: { lat: -10.02, lng: -48.02 } });
  await s.call(`/api/driver/rides/${ride.id}/complete`, { token: driver.token, body: {} });
  return ride.id;
}

test('asaas: sem chave configurada, nada é enviado e o Pix segue como antes', async (t) => {
  const config = require('../server/config');
  const antes = config.asaasApiKey;
  t.after(() => { config.asaasApiKey = antes; });
  const s = await startServer();
  t.after(() => s.close());
  const d = await s.approvedDriver('João', '11955554444');
  const adm = s.admin.token;
  config.asaasApiKey = '';
  const r = await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: SUB });
  assert.equal(r.status, 503);
});

test('asaas: a central abre a subconta do motoqueiro e só o walletId é guardado', async (t) => {
  const config = require('../server/config');
  const antes = config.asaasApiKey;
  t.after(() => { config.asaasApiKey = antes; });
  config.asaasApiKey = 'chave-de-teste';
  const calls = fakeAsaas(t);
  const s = await startServer();
  t.after(() => s.close());
  const d = await s.approvedDriver('João', '11955554444');
  const adm = s.admin.token;

  const incompleto = await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: { ...SUB, email: 'nao-e-email' } });
  assert.equal(incompleto.status, 400);
  assert.equal(calls.length, 0, 'dados inválidos não devem chegar ao Asaas');

  const ok = await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: SUB });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.walletId, 'wal_motorista_1');
  const acc = calls.find((c) => c.url.endsWith('/v3/accounts'));
  assert.equal(acc.method, 'POST');
  assert.equal(acc.headers.access_token, 'chave-de-teste');
  assert.equal(acc.body.cpfCnpj, '52998224725'); // CPF da conta bancária do motoqueiro
  assert.equal(acc.body.postalCode, '01001000');

  // Não cria duas subcontas para o mesmo motoqueiro.
  assert.equal((await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: SUB })).status, 409);
  assert.equal(calls.filter((c) => c.url.endsWith('/v3/accounts')).length, 1);
});

test('asaas: corrida Pix vira cobrança com divisão para a subconta; QR Code vem do Asaas', async (t) => {
  const config = require('../server/config');
  const antes = config.asaasApiKey;
  t.after(() => { config.asaasApiKey = antes; });
  config.asaasApiKey = 'chave-de-teste';
  const calls = fakeAsaas(t);
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const adm = s.admin.token;
  await ligarCentral(s);
  await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: SUB });

  const rideId = await completedPixRide(s, p, d);
  const pix = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(pix.status, 200, JSON.stringify(pix.body));
  const cliente = calls.find((c) => c.url.endsWith('/v3/customers'));
  assert.equal(cliente.body.cpfCnpj, '11222333000181'); // a central é o cliente das cobranças
  assert.equal(pix.body.provider, 'asaas');
  assert.equal(pix.body.code, PAYLOAD);
  assert.match(pix.body.qr, /<svg/);

  const cobranca = calls.find((c) => c.url.endsWith('/v3/payments'));
  assert.equal(cobranca.body.billingType, 'PIX');
  assert.equal(cobranca.body.externalReference, String(rideId));
  assert.equal(cobranca.body.customer, 'cus_1');
  const [split] = cobranca.body.split;
  assert.equal(split.walletId, 'wal_motorista_1');
  assert.equal(split.fixedValue, Math.round((cobranca.body.value * 0.9) * 100) / 100); // 10% da central
  assert.equal(pix.body.fee, Math.round((cobranca.body.value * 0.1) * 100) / 100);

  // Pedir o QR de novo reaproveita a cobrança, não cria outra.
  await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(calls.filter((c) => c.url.endsWith('/v3/payments')).length, 1);
});

test('asaas: sem subconta, o Pix não é cobrado direto do motoqueiro', async (t) => {
  const config = require('../server/config');
  const antes = config.asaasApiKey;
  t.after(() => { config.asaasApiKey = antes; });
  config.asaasApiKey = 'chave-de-teste';
  fakeAsaas(t);
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const rideId = await completedPixRide(s, p, d);
  const pix = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  assert.equal(pix.status, 409);
});

test('asaas: webhook confirma o Pix com token próprio, uma vez só, e divide sozinho', async (t) => {
  const config = require('../server/config');
  const antes = { key: config.asaasApiKey, hook: config.asaasWebhookToken };
  t.after(() => { config.asaasApiKey = antes.key; config.asaasWebhookToken = antes.hook; });
  config.asaasApiKey = 'chave-de-teste';
  config.asaasWebhookToken = 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa';
  fakeAsaas(t);
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const adm = s.admin.token;
  await ligarCentral(s);
  await s.call(`/api/admin/wallet/drivers/${d.user.id}/subaccount`, { token: adm, body: SUB });
  const rideId = await completedPixRide(s, p, d);
  const pix = await s.call(`/api/rides/${rideId}/pix`, { token: p.token });
  const valor = pix.body.amount;

  const hook = (body, token) =>
    fetch(`${s.base}/api/payments/asaas/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token !== undefined ? { 'asaas-access-token': token } : {}) },
      body: JSON.stringify(body),
    });
  const evento = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', value: valor, externalReference: String(rideId) } };

  config.asaasWebhookToken = 'curto-demais';
  assert.equal((await hook(evento, 'curto-demais')).status, 503); // token fora das regras do Asaas
  config.asaasWebhookToken = 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa';
  assert.equal((await hook(evento)).status, 401);
  assert.equal((await hook(evento, 'chute')).status, 401);
  assert.equal((await hook({ ...evento, payment: { ...evento.payment, value: 999 } }, 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa')).status, 409);
  assert.equal((await hook({ event: 'PAYMENT_CREATED', payment: evento.payment }, 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa')).status, 200); // ignorado
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 0);

  assert.equal((await hook(evento, 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa')).status, 200);
  assert.equal((await (await hook({ ...evento, event: 'PAYMENT_CONFIRMED' }, 'Tq7mZ2xK9pLwR4vB8nHc3sYd6fGj1eUa')).json()).duplicate, true);
  // A parte do motorista já está na subconta dele: o saldo interno não credita de novo.
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 0);
  // A comissão fica na central.
  assert.equal((await s.call('/api/admin/wallet', { token: adm })).body.balance, Math.round((valor * 0.1) * 100) / 100);
  // A confirmação manual não pode pagar de novo uma corrida que já tem cobrança no Asaas.
  const manual = await s.call(`/api/admin/wallet/rides/${rideId}/paid`, { token: adm, body: { amount: valor } });
  assert.equal(manual.status, 409);
});

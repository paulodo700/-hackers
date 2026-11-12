const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, BANK, FAKE_JPEG } = require('./helpers');
const { crc16 } = require('../server/pix');

const O = { lat: -10, lng: -48 };
const D = { lat: -10.02, lng: -48.02 };
const CENTRAL_BANK = { holder_name: 'Central Mototáxi LTDA', holder_doc: '11.222.333/0001-81', bank_name: 'Banco Central', pix_type: 'cnpj', pix_key: '11.222.333/0001-81' };

// Faz uma corrida completa e devolve o id.
async function fullRide(s, passenger, driver, payment = 'pix') {
  const ride = (await s.call('/api/rides', { token: passenger.token, body: { origin: O, dest: D, payment } })).body.ride;
  const offer = (await s.call('/api/driver/state', { token: driver.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: driver.token, body: {} });
  for (const a of ['arrive', 'start', 'complete']) await s.call(`/api/driver/rides/${ride.id}/${a}`, { token: driver.token, body: {} });
  return ride.id;
}

test('cadastro do motoqueiro: documentos e conta bancária', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const d = await s.register('driver', 'João', '11955554444', { plate: 'abc1d23', moto_model: 'CG 160' });
  const p = await s.register('passenger', 'Maria', '11988887777');

  let ob = (await s.call('/api/driver/onboarding', { token: d.token })).body;
  assert.deepEqual(ob.docs, { cnh: null, crlv: null, selfie: null });
  assert.equal(ob.bank, null);
  assert.equal(ob.complete, false);
  assert.equal((await s.call('/api/driver/onboarding', { token: p.token })).status, 403);

  // Envio de fotos: só imagem de verdade, só tipos conhecidos, só motoqueiro.
  assert.equal((await s.upload(d.token, 'cnh', Buffer.from('<script>alert(1)</script>'.repeat(10)))).status, 400);
  assert.equal((await s.upload(d.token, 'passaporte')).status, 404);
  assert.equal((await s.upload(p.token, 'cnh')).status, 403);
  assert.equal((await s.upload('', 'cnh')).status, 401);
  assert.equal((await s.upload(d.token, 'cnh', Buffer.alloc(7 * 1024 * 1024, 1))).status, 413);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
  assert.equal((await s.upload(d.token, 'cnh', png, 'image/png')).status, 200);
  assert.equal((await s.upload(d.token, 'cnh')).status, 200); // reenviar troca a foto
  assert.deepEqual(fs.readdirSync(path.join(s.docsDir, String(d.user.id))), ['cnh.jpg']);
  await s.upload(d.token, 'crlv');
  ob = (await s.upload(d.token, 'selfie')).body;
  assert.ok(ob.docs.cnh && ob.docs.crlv && ob.docs.selfie);
  assert.equal(ob.complete, false); // ainda falta a conta

  // Conta bancária: exige a senha e dados válidos.
  const bank = (body) => s.call('/api/driver/bank', { token: d.token, method: 'PUT', body });
  assert.equal((await bank({ ...BANK })).status, 401);
  assert.equal((await bank({ password: 'errada', ...BANK })).status, 401);
  assert.equal((await bank({ password: '123456', ...BANK, holder_doc: '111.111.111-11' })).status, 400);
  assert.equal((await bank({ password: '123456', ...BANK, pix_key: '123' })).status, 400);
  const saved = await bank({ password: '123456', ...BANK });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.complete, true);
  assert.equal(saved.body.bank.pix_key, '+5511955554444');
  assert.equal(saved.body.bank.holder_doc, '•••••••••25'); // documento não volta inteiro para a tela

  // A central vê a ficha completa e as fotos; ninguém mais vê.
  const detail = await s.call(`/api/admin/drivers/${d.user.id}`, { token: s.admin.token });
  assert.equal(detail.body.bank.holder_doc, '52998224725');
  assert.ok(detail.body.docs.selfie);
  const photo = (token) => fetch(`${s.base}/api/admin/drivers/${d.user.id}/documents/cnh`, { headers: { Authorization: `Bearer ${token}` } });
  const ok = await photo(s.admin.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), FAKE_JPEG);
  assert.equal((await photo(d.token)).status, 403);
  assert.equal((await photo(p.token)).status, 403);
  assert.equal((await fetch(`${s.base}/api/admin/drivers/${d.user.id}/documents/cnh`)).status, 401);
  assert.equal((await fetch(`${s.base}/docs/${d.user.id}/cnh.jpg`)).status, 404); // não há caminho público
  assert.equal((await s.call(`/api/admin/drivers/${d.user.id}/documents/passaporte`, { token: s.admin.token })).status, 404);
});

test('a exigência de documentos pode ser desligada pela central', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const d = await s.register('driver', 'João', '11955554444', { plate: 'abc1d23', moto_model: 'CG 160' });
  const approve = () => s.call(`/api/admin/drivers/${d.user.id}/status`, { token: s.admin.token, body: { status: 'approved' } });
  assert.equal((await approve()).status, 409);
  await s.call('/api/admin/settings', { token: s.admin.token, method: 'PUT', body: { require_docs: false } });
  assert.equal((await approve()).status, 200);
});

test('Pix da corrida vai para a conta do motoqueiro', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const other = await s.register('passenger', 'Curioso', '11966665555');
  const d = await s.approvedDriver('João', '11955554444');

  const ride = (await s.call('/api/rides', { token: p.token, body: { origin: O, dest: D, payment: 'pix' } })).body.ride;
  assert.equal((await s.call(`/api/rides/${ride.id}/pix`, { token: p.token })).status, 409); // ainda não embarcou
  const offer = (await s.call('/api/driver/state', { token: d.token })).body.offer;
  await s.call(`/api/driver/offers/${offer.offerId}/accept`, { token: d.token, body: {} });
  await s.call(`/api/driver/rides/${ride.id}/arrive`, { token: d.token, body: {} });
  await s.call(`/api/driver/rides/${ride.id}/start`, { token: d.token, body: {} });

  const pix = await s.call(`/api/rides/${ride.id}/pix`, { token: p.token });
  assert.equal(pix.status, 200);
  assert.equal(pix.body.amount, 7);
  assert.equal(pix.body.to, 'motoqueiro');
  assert.ok(pix.body.code.includes('+5511955554444')); // chave do motoqueiro, não da central
  assert.ok(pix.body.code.includes('54047.00'));
  assert.ok(pix.body.code.includes(`CORRIDA${ride.id}`));
  assert.equal(pix.body.code.slice(-4), crc16(pix.body.code.slice(0, -4)));
  assert.ok(pix.body.qr.includes('<svg'));

  assert.equal((await s.call(`/api/driver/rides/${ride.id}/pix`, { token: d.token })).body.code, pix.body.code);
  assert.equal((await s.call(`/api/rides/${ride.id}/pix`, { token: other.token })).status, 404);

  // Corrida em dinheiro não tem Pix.
  await s.call(`/api/driver/rides/${ride.id}/complete`, { token: d.token, body: {} });
  const cashId = await fullRide(s, p, d, 'cash');
  assert.equal((await s.call(`/api/rides/${cashId}/pix`, { token: p.token })).status, 409);
});

test('carteira: a corrida paga é dividida sozinha, sem ninguém pagar comissão', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const adm = s.admin.token;
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const central = () => s.call('/api/admin/wallet', { token: adm }).then((r) => r.body);
  const mine = () => s.call('/api/driver/wallet', { token: d.token }).then((r) => r.body);

  // Corrida concluída sem pagamento confirmado: não divide ainda.
  const rideId = await fullRide(s, p, d, 'pix');
  assert.equal((await mine()).balance, 0);
  assert.equal((await central()).balance, 0);
  assert.equal((await central()).awaiting.length, 1);

  // Pagamento confere com o valor: divide sozinho (R$ 7: 10% para a central, R$ 6,30 para o motorista).
  assert.equal((await s.call(`/api/admin/wallet/rides/${rideId}/paid`, { token: adm, body: { amount: 6.5 } })).status, 409);
  assert.equal((await s.call(`/api/admin/wallet/rides/${rideId}/paid`, { token: d.token, body: { amount: 7 } })).status, 403);
  const paid = await s.call(`/api/admin/wallet/rides/${rideId}/paid`, { token: adm, body: { amount: 7, ref: 'extrato-1' } });
  assert.equal(paid.status, 200);
  assert.equal((await s.call(`/api/admin/wallet/rides/${rideId}/paid`, { token: adm, body: { amount: 7 } })).status, 409); // não paga duas vezes
  assert.equal((await mine()).balance, 6.3);
  assert.equal((await central()).balance, 0.7);
  assert.equal((await central()).awaiting.length, 0);
  assert.equal((await mine()).statement[0].kind, 'ride_share');

  // Dinheiro (ou qualquer pagamento) chegando depois de concluir também divide, uma vez só.
  const late = await fullRide(s, p, d, 'cash');
  assert.equal((await mine()).balance, 6.3);
  await s.call(`/api/admin/wallet/rides/${late}/paid`, { token: adm, body: { amount: 7 } });
  assert.equal((await mine()).balance, 12.6);
  assert.equal((await central()).balance, 1.4);

  // Relatório continua batendo com a comissão gravada.
  const rep = (await s.call('/api/admin/reports', { token: adm })).body;
  assert.equal(rep.totals.commission, 1.4);
});

test('carteira: webhook do gateway confirma o pagamento com token e valor certos', async (t) => {
  const config = require('../server/config');
  const antes = config.paymentWebhookToken;
  t.after(() => { config.paymentWebhookToken = antes; });
  const s = await startServer();
  t.after(() => s.close());
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const rideId = await fullRide(s, p, d, 'pix');
  const hook = (body, token) =>
    fetch(`${s.base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token !== undefined ? { 'x-payment-token': token } : {}) },
      body: JSON.stringify(body),
    });
  const body = { ride_id: rideId, status: 'paid', amount: 7, provider_ref: 'pix-123' };

  // Sem token configurado, o webhook fica desligado.
  config.paymentWebhookToken = '';
  assert.equal((await hook(body, 'qualquer')).status, 503);

  config.paymentWebhookToken = 'segredo-do-gateway-123';
  assert.equal((await hook(body)).status, 401); // sem token
  assert.equal((await hook(body, 'chute')).status, 401); // token errado
  assert.equal((await hook({ ...body, amount: 99 }, 'segredo-do-gateway-123')).status, 409); // valor diferente
  assert.equal((await hook({ ...body, status: 'pending' }, 'segredo-do-gateway-123')).status, 200); // ignorado
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 0);

  assert.equal((await hook(body, 'segredo-do-gateway-123')).status, 200);
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 6.3); // dividiu sozinho
  assert.equal((await hook(body, 'segredo-do-gateway-123')).status, 409); // mesma confirmação não conta duas vezes
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 6.3);
});

test('carteira: saque — mínimo, saldo, senha, devolução e pagamento', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const adm = s.admin.token;
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');
  const rides = [];
  for (let i = 0; i < 3; i++) rides.push(await fullRide(s, p, d, 'pix'));
  for (const id of rides) await s.call(`/api/admin/wallet/rides/${id}/paid`, { token: adm, body: { amount: 7 } });
  // Saldo do motorista: 3 × R$ 6,30 = R$ 18,90
  const withdraw = (body, token = d.token) => s.call('/api/driver/wallet/withdraw', { token, body });
  assert.equal((await withdraw({ password: '123456', amount: 5 })).status, 400); // mínimo R$ 10
  assert.equal((await withdraw({ password: 'errada', amount: 10 })).status, 401);
  assert.equal((await withdraw({ password: '123456', amount: 50 })).status, 409); // mais que o saldo
  const ok = await withdraw({ password: '123456', amount: 12 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.balance, 6.9); // desconta já: não dá para sacar o mesmo dinheiro de novo
  assert.equal((await withdraw({ password: '123456', amount: 10 })).status, 409);

  // Central vê o pedido; recusar devolve o valor.
  const list = (await s.call('/api/admin/wallet', { token: adm })).body.withdrawals;
  const id = list[0].id;
  assert.equal(list[0].status, 'pending');
  assert.equal((await s.call(`/api/admin/wallet/withdrawals/${id}/rejected`, { token: adm, body: { password: 'central123', note: 'dados errados' } })).status, 200);
  assert.equal((await s.call('/api/driver/wallet', { token: d.token })).body.balance, 18.9);

  // Pago: confirma com a senha da central e não pode ser tratado de novo.
  const again = await withdraw({ password: '123456', amount: 12 });
  const id2 = again.body.id;
  assert.equal((await s.call(`/api/admin/wallet/withdrawals/${id2}/paid`, { token: adm, body: { password: 'errada' } })).status, 401);
  assert.equal((await s.call(`/api/admin/wallet/withdrawals/${id2}/paid`, { token: adm, body: { password: 'central123' } })).status, 200);
  assert.equal((await s.call(`/api/admin/wallet/withdrawals/${id2}/paid`, { token: adm, body: { password: 'central123' } })).status, 409);
  const dw = (await s.call('/api/driver/wallet', { token: d.token })).body;
  assert.equal(dw.balance, 6.9);
  assert.equal(dw.withdrawals[0].status, 'paid');

  // Central também saca (a comissão), e tudo fica no registro de atividades.
  // Comissão de R$ 2,10 ainda não chega ao mínimo de saque: a central recebe a mensagem certa.
  const cw = await s.call('/api/admin/wallet/withdraw', { token: adm, body: { password: 'central123', amount: 2.1 } });
  assert.equal(cw.status, 400);
  assert.match(cw.body.error, /mínimo/);
  const log = (await s.call('/api/admin/audit', { token: adm })).body.entries.map((e) => e.action);
  for (const a of ['Saque solicitado', 'Saque recusado', 'Saque pago (Pix enviado)', 'Pagamento de corrida confirmado']) assert.ok(log.includes(a), a);
});

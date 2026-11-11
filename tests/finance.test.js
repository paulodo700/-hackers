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

test('comissão: o motoqueiro deve, paga por Pix à central e a central confirma', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const adm = s.admin.token;
  const p = await s.register('passenger', 'Maria', '11988887777');
  const d = await s.approvedDriver('João', '11955554444');

  await fullRide(s, p, d, 'pix');
  await fullRide(s, p, d, 'cash');
  let st = (await s.call('/api/driver/settlement', { token: d.token })).body;
  assert.deepEqual(st.owed, { rides: 2, amount: 1.4 }); // 10% de R$ 7 + R$ 7
  assert.equal(st.central_ready, false);
  assert.equal((await s.call('/api/driver/settlement/pix', { token: d.token })).status, 409); // central sem conta

  // A central cadastra a conta dela: exige a senha, valida os dados.
  const setBank = (body, token = adm) => s.call('/api/admin/bank', { token, method: 'PUT', body });
  assert.equal((await setBank({ ...CENTRAL_BANK })).status, 401);
  assert.equal((await setBank({ password: 'central123', ...CENTRAL_BANK, pix_key: '00.000.000/0000-00' })).status, 400);
  assert.equal((await setBank({ password: '123456', ...CENTRAL_BANK }, d.token)).status, 403);
  const saved = await setBank({ password: 'central123', ...CENTRAL_BANK });
  assert.equal(saved.body.bank.pix_key, '11222333000181');
  assert.equal((await s.call('/api/public/config')).body.pix_key, undefined);

  const pix = await s.call('/api/driver/settlement/pix', { token: d.token });
  assert.equal(pix.body.amount, 1.4);
  assert.equal(pix.body.to, 'central');
  assert.ok(pix.body.code.includes('011411222333000181'));
  assert.ok(pix.body.code.includes('54041.40'));

  // Mudar a taxa depois não muda o que já foi rodado.
  await s.call('/api/admin/settings', { token: adm, method: 'PUT', body: { commission_percent: 50 } });
  assert.equal((await s.call('/api/driver/settlement', { token: d.token })).body.owed.amount, 1.4);

  assert.equal((await s.call('/api/driver/settlement/notify', { token: d.token, body: {} })).status, 200);
  const ov = (await s.call('/api/admin/settlements', { token: adm })).body;
  assert.equal(ov.total, 1.4);
  assert.equal(ov.drivers.length, 1);
  assert.ok(ov.drivers[0].notice_at);
  assert.equal((await s.call('/api/admin/settlements', { token: d.token })).status, 403);

  const paid = await s.call('/api/admin/settlements', { token: adm, body: { driver_id: d.user.id, note: 'Pix recebido' } });
  assert.equal(paid.status, 201);
  assert.deepEqual({ amount: paid.body.settlement.amount, rides: paid.body.settlement.rides }, { amount: 1.4, rides: 2 });
  assert.equal((await s.call('/api/admin/settlements', { token: adm, body: { driver_id: d.user.id } })).status, 409); // nada em aberto
  assert.equal((await s.call('/api/admin/settlements', { token: adm, body: { driver_id: 9999 } })).status, 404);

  st = (await s.call('/api/driver/settlement', { token: d.token })).body;
  assert.deepEqual(st.owed, { rides: 0, amount: 0 });
  assert.equal(st.notice_at, null);
  assert.equal(st.history.length, 1);
  assert.equal(st.history[0].amount, 1.4);
  assert.equal((await s.call('/api/driver/settlement/notify', { token: d.token, body: {} })).status, 409);

  // Corrida nova entra num acerto novo, já com a taxa nova.
  await fullRide(s, p, d, 'cash');
  assert.deepEqual((await s.call('/api/driver/settlement', { token: d.token })).body.owed, { rides: 1, amount: 3.5 });

  // Relatório soma a comissão gravada em cada corrida.
  const rep = (await s.call('/api/admin/reports', { token: adm })).body;
  assert.equal(rep.totals.revenue, 21);
  assert.equal(rep.totals.commission, 4.9);

  // Tudo que mexe com dinheiro e acesso fica registrado.
  const log = (await s.call('/api/admin/audit', { token: adm })).body.entries.map((e) => e.action);
  for (const action of ['Dados bancários do motoqueiro alterados', 'Motoqueiro aprovado', 'Dados bancários da central alterados', 'Acerto de comissão confirmado', 'Configurações alteradas']) {
    assert.ok(log.includes(action), action);
  }
  assert.equal((await s.call('/api/admin/audit', { token: d.token })).status, 403);
});

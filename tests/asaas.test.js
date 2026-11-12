const test = require('node:test');
const assert = require('node:assert/strict');
const { createAsaas } = require('../server/asaas');

// API simulada que responde como o Asaas responde (formatos da documentação).
function fakeApi(handler) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url, method: opts.method, headers: opts.headers, body });
    const r = handler(url, opts.method, body);
    return { ok: r.status < 400, status: r.status, json: async () => r.data };
  };
  return { calls, fetchImpl };
}

test('cliente: envia o cabeçalho access_token e usa o endereço do ambiente certo', async () => {
  const api = fakeApi(() => ({ status: 200, data: { id: 'cus_1' } }));
  const a = createAsaas({ apiKey: 'chave-teste', env: 'sandbox', fetchImpl: api.fetchImpl });
  await a.createCustomer({ name: 'Maria', cpfCnpj: '52998224725' });
  assert.equal(api.calls[0].url, 'https://api-sandbox.asaas.com/v3/customers');
  assert.equal(api.calls[0].headers.access_token, 'chave-teste');
  assert.equal(api.calls[0].headers.Authorization, undefined);

  const prod = createAsaas({ apiKey: 'x', env: 'production', fetchImpl: api.fetchImpl });
  await prod.createCustomer({ name: 'Maria', cpfCnpj: '52998224725' });
  assert.equal(api.calls[1].url, 'https://api.asaas.com/v3/customers');
});

test('cobrança Pix: sai com divisão para a subconta do motorista (valor fixo)', async () => {
  const api = fakeApi(() => ({ status: 200, data: { id: 'pay_9', value: 7 } }));
  const a = createAsaas({ apiKey: 'k', fetchImpl: api.fetchImpl });
  await a.createPixCharge({
    customerId: 'cus_1', value: 7, dueDate: '2026-11-12', externalReference: 'corrida-12',
    description: 'Corrida #12', split: [{ walletId: 'wal_motorista', fixedValue: 6.3 }],
  });
  const body = api.calls[0].body;
  assert.equal(api.calls[0].url.endsWith('/payments'), true);
  assert.equal(body.billingType, 'PIX');
  assert.equal(body.value, 7);
  assert.equal(body.externalReference, 'corrida-12');
  assert.deepEqual(body.split, [{ walletId: 'wal_motorista', fixedValue: 6.3 }]);
});

test('QR Code Pix: pega imagem, copia e cola e vencimento', async () => {
  const api = fakeApi((url) => (url.endsWith('/pixQrCode')
    ? { status: 200, data: { encodedImage: 'iVBOR...', payload: '00020126...', expirationDate: '2026-11-12 23:59:59' } }
    : { status: 404, data: {} }));
  const a = createAsaas({ apiKey: 'k', fetchImpl: api.fetchImpl });
  const qr = await a.pixQrCode('pay_9');
  assert.equal(api.calls[0].url, 'https://api-sandbox.asaas.com/v3/payments/pay_9/pixQrCode');
  assert.equal(qr.payload, '00020126...');
});

test('erros do gateway viram mensagens claras; falha de rede não derruba o servidor', async () => {
  const api = fakeApi(() => ({ status: 400, data: { errors: [{ description: 'CPF inválido' }] } }));
  const a = createAsaas({ apiKey: 'k', fetchImpl: api.fetchImpl });
  await assert.rejects(a.createCustomer({ name: 'x', cpfCnpj: '1' }), (e) => e.status === 400 && /CPF inválido/.test(e.message));
  const down = createAsaas({ apiKey: 'k', fetchImpl: async () => { throw new Error('sem rede'); } });
  await assert.rejects(down.createCustomer({ name: 'x', cpfCnpj: '1' }), (e) => e.status === 502);
  const semChave = createAsaas({ apiKey: '' });
  assert.equal(semChave.enabled, false);
  await assert.rejects(semChave.createCustomer({ name: 'x', cpfCnpj: '1' }), (e) => e.status === 503);
});

test('webhook do Asaas: só aceita o token configurado', () => {
  const a = createAsaas({ apiKey: 'k', webhookToken: 'segredo-longo-123' });
  assert.equal(a.validWebhook('segredo-longo-123'), true);
  assert.equal(a.validWebhook('segredo-longo-124'), false);
  assert.equal(a.validWebhook(undefined), false);
  assert.equal(createAsaas({ apiKey: 'k', webhookToken: '' }).validWebhook(''), false);
});

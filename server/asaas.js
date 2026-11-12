// Asaas: gateway de pagamento para o Pix com divisão automática.
// - Cada motoqueiro vira uma subconta (POST /v3/accounts) e ganha um walletId.
// - Cada corrida paga em Pix vira uma cobrança (POST /v3/payments) com split: o valor do motoqueiro
//   vai para a subconta dele e o resto (comissão) fica na conta da central.
// - O QR Code/copia e cola vem de GET /v3/payments/{id}/pixQrCode.
// - A confirmação chega pelo webhook (ver server/app.js), que reaproveita wallet.markPaid.
// A chave da API nunca é gravada no banco nem devolvida ao navegador.
const QRCode = require('qrcode');
const config = require('./config');
const { AppError } = require('./errors');
const { getSettings } = require('./db');

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const today = () => new Date().toISOString().slice(0, 10);

// Campos que o Asaas exige para abrir uma subconta (conferidos pelo servidor antes de enviar).
function subaccountFields(input) {
  const i = input || {};
  const clean = {
    email: String(i.email || '').trim().toLowerCase().slice(0, 100),
    mobilePhone: digits(i.mobilePhone),
    incomeValue: round2(i.incomeValue),
    address: String(i.address || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    addressNumber: String(i.addressNumber || '').trim().slice(0, 10),
    province: String(i.province || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    postalCode: digits(i.postalCode),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new AppError(400, 'Informe um e-mail válido para a subconta');
  if (clean.mobilePhone.length < 10) throw new AppError(400, 'Informe o celular com DDD');
  if (!(clean.incomeValue > 0)) throw new AppError(400, 'Informe a renda mensal estimada do motoqueiro');
  if (!clean.address || !clean.addressNumber || !clean.province) throw new AppError(400, 'Informe endereço, número e bairro');
  if (clean.postalCode.length !== 8) throw new AppError(400, 'Informe o CEP com 8 números');
  return clean;
}

function createAsaas({ db, fetchImpl = globalThis.fetch }) {
  db.exec('CREATE TABLE IF NOT EXISTS asaas_config (k TEXT PRIMARY KEY, v TEXT NOT NULL)');

  const enabled = () => !!config.asaasApiKey;

  // Uma chamada à API. Erros viram AppError com a mensagem do próprio Asaas (em português).
  async function call(method, route, body) {
    if (!enabled()) throw new AppError(503, 'Pix automático ainda não está ligado');
    let res;
    try {
      res = await fetchImpl(`${config.asaasBaseUrl}${route}`, {
        method,
        headers: { accept: 'application/json', 'content-type': 'application/json', access_token: config.asaasApiKey },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new AppError(502, 'Não foi possível falar com o gateway de pagamento. Tente de novo em instantes.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new AppError(502, 'Chave do gateway de pagamento inválida. Avise o suporte.');
      const first = data && data.errors && data.errors[0];
      throw new AppError(res.status >= 500 ? 502 : 409, (first && first.description) || 'O gateway de pagamento recusou a operação');
    }
    return data;
  }

  // Cliente único que representa os passageiros nas cobranças (o Asaas exige um cliente em cada cobrança).
  async function customerId() {
    const row = db.prepare("SELECT v FROM asaas_config WHERE k = 'customer_id'").get();
    if (row) return row.v;
    const c = await call('POST', '/v3/customers', { name: 'Passageiros do Mototáxi', externalReference: 'mototaxi-passageiros' });
    db.prepare("INSERT OR REPLACE INTO asaas_config (k, v) VALUES ('customer_id', ?)").run(c.id);
    return c.id;
  }

  // Abre a subconta do motoqueiro. Só a central chama. Guarda só o walletId (o apiKey da subconta não é usado).
  async function createSubaccount(driverId, input) {
    const bank = db.prepare('SELECT holder_name, holder_doc, asaas_wallet_id FROM driver_bank WHERE user_id = ?').get(Number(driverId));
    if (!bank) throw new AppError(409, 'O motoqueiro ainda não cadastrou a conta bancária');
    if (bank.asaas_wallet_id) throw new AppError(409, 'Este motoqueiro já tem subconta no Asaas');
    const fields = subaccountFields(input);
    const acc = await call('POST', '/v3/accounts', {
      name: bank.holder_name,
      cpfCnpj: bank.holder_doc,
      ...fields,
    });
    if (!acc.walletId) throw new AppError(502, 'O Asaas não devolveu o identificador da subconta');
    db.prepare('UPDATE driver_bank SET asaas_wallet_id = ? WHERE user_id = ?').run(acc.walletId, Number(driverId));
    return { walletId: acc.walletId };
  }

  // Cobrança Pix da corrida com divisão. Reaproveita a cobrança se ela já existir.
  async function rideCharge(ride, walletId) {
    const pct = getSettings(db).commission_percent;
    const fee = round2((ride.price * pct) / 100);
    const share = round2(ride.price - fee);
    // Lê do banco: a lista pública de campos da corrida não traz este id.
    let paymentId = db.prepare('SELECT asaas_payment_id FROM rides WHERE id = ?').get(ride.id)?.asaas_payment_id || null;
    if (!paymentId) {
      const p = await call('POST', '/v3/payments', {
        customer: await customerId(),
        billingType: 'PIX',
        value: round2(ride.price),
        dueDate: today(),
        description: `Corrida #${ride.id} (mototáxi)`,
        externalReference: String(ride.id),
        split: [{ walletId, fixedValue: share, externalReference: `corrida-${ride.id}`, description: 'Motoqueiro' }],
      });
      paymentId = p.id;
      db.prepare('UPDATE rides SET asaas_payment_id = ? WHERE id = ?').run(paymentId, ride.id);
    }
    const qr = await call('GET', `/v3/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
    const svg = await QRCode.toString(qr.payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return {
      code: qr.payload,
      qr: svg,
      amount: round2(ride.price),
      fee,
      share,
      expires: qr.expirationDate || null,
      to: 'motoqueiro',
      provider: 'asaas',
    };
  }

  return { enabled, createSubaccount, rideCharge, subaccountFields };
}

module.exports = { createAsaas, subaccountFields };

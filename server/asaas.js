// Cliente do Asaas (gateway de pagamento licenciado). O dinheiro fica com o Asaas:
// a cobrança Pix já sai com divisão (split) para a subconta do motorista; o resto fica na conta da central.
// Documentação: https://docs.asaas.com (base /v3, cabeçalho access_token, webhook com asaas-access-token).
const { AppError } = require('./errors');

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
};

function createAsaas({ apiKey, env = 'sandbox', webhookToken = '', fetchImpl = fetch, timeoutMs = 15000 }) {
  const base = BASES[env] || BASES.sandbox;
  const enabled = !!apiKey;

  async function call(method, path, body) {
    if (!enabled) throw new AppError(503, 'Pagamento automático não está configurado');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', access_token: apiKey, 'User-Agent': 'mototaxi-cidade/1.0' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new AppError(502, 'Não foi possível falar com o gateway de pagamento. Tente de novo.');
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.errors && data.errors[0] && data.errors[0].description) || 'O gateway recusou a operação';
      throw new AppError(res.status >= 500 ? 502 : 400, msg);
    }
    return data;
  }

  // Cliente (quem paga). O Asaas exige nome e CPF/CNPJ.
  const createCustomer = ({ name, cpfCnpj, email }) => call('POST', '/customers', { name, cpfCnpj, email: email || undefined, notificationDisabled: true });

  // Cobrança Pix com divisão: `split` = [{ walletId, fixedValue }] para cada subconta que recebe.
  function createPixCharge({ customerId, value, dueDate, externalReference, description, split = [] }) {
    return call('POST', '/payments', {
      customer: customerId,
      billingType: 'PIX',
      value,
      dueDate,
      externalReference,
      description: (description || '').slice(0, 500),
      split: split.map((s) => ({ walletId: s.walletId, fixedValue: s.fixedValue, externalReference: s.externalReference || undefined })),
    });
  }

  // QR Code Pix dinâmico: imagem (base64), texto copia e cola e vencimento.
  async function pixQrCode(paymentId) {
    const data = await call('GET', `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
    return { encodedImage: data.encodedImage, payload: data.payload, expirationDate: data.expirationDate };
  }

  // Subconta do motorista (recebe a parte dele). Devolve walletId e apiKey (guardar: não aparece de novo).
  const createSubaccount = (dados) => call('POST', '/accounts', dados);

  // O Asaas assina o webhook com o token configurado; confere sem vazar tempo de comparação.
  function validWebhook(headerValue) {
    if (!webhookToken) return false;
    const got = String(headerValue || '');
    if (got.length !== webhookToken.length) return false;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ webhookToken.charCodeAt(i);
    return diff === 0;
  }

  return { enabled, env, base, createCustomer, createPixCharge, pixQrCode, createSubaccount, validWebhook };
}

module.exports = { createAsaas, BASES };

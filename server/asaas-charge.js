// Cobrança Pix de uma corrida pelo Asaas, já com a divisão para a subconta do motorista.
// A central fica com o restante na própria conta Asaas. Guarda o id da cobrança na corrida.
const { AppError } = require('./errors');
const { getSettings } = require('./db');
const { validCpf } = require('./pix');

function createAsaasCharge({ db, asaas }) {
  // Data de vencimento: hoje (horário de Brasília), para o Pix não ficar aberto por dias.
  function today() {
    const tz = getSettings(db).tz_offset_hours || 0;
    return new Date(Date.now() + tz * 3600 * 1000).toISOString().slice(0, 10);
  }

  async function ensureCustomer(user) {
    const row = db.prepare('SELECT name, cpf, email, asaas_customer_id FROM users WHERE id = ?').get(user.id);
    if (row.asaas_customer_id) return row.asaas_customer_id;
    if (!row.cpf || !validCpf(row.cpf)) throw new AppError(409, 'Informe seu CPF em "Meu perfil" para pagar com Pix.');
    const customer = await asaas.createCustomer({ name: row.name, cpfCnpj: row.cpf, email: row.email });
    db.prepare('UPDATE users SET asaas_customer_id = ? WHERE id = ?').run(customer.id, user.id);
    return customer.id;
  }

  // Devolve { code, qrImage, amount, holder, to, expires } para a tela.
  async function chargeRide(ride) {
    if (ride.payment !== 'pix') throw new AppError(409, 'Esta corrida não é paga em Pix');
    if (!['in_progress', 'completed'].includes(ride.status)) throw new AppError(409, 'O Pix fica disponível depois do embarque');
    const driver = ride.driver_id && db.prepare('SELECT asaas_wallet_id FROM drivers WHERE user_id = ?').get(ride.driver_id);
    if (!driver || !driver.asaas_wallet_id) throw new AppError(409, 'O motorista ainda não tem a conta de recebimento ativa. Combine o pagamento com ele.');

    const pct = getSettings(db).commission_percent;
    const commission = Math.round((ride.price * pct) / 100 * 100) / 100;
    const driverShare = Math.round((ride.price - commission) * 100) / 100;

    const saved = db.prepare('SELECT payment_ref, payment_status FROM rides WHERE id = ?').get(ride.id);
    let paymentId = saved && saved.payment_ref && saved.payment_ref.startsWith('asaas:') ? saved.payment_ref.slice(6) : null;
    if (saved && saved.payment_status === 'paid') throw new AppError(409, 'Esta corrida já foi paga');
    if (!paymentId) {
      const customerId = await ensureCustomer({ id: ride.passenger_id });
      const charge = await asaas.createPixCharge({
        customerId,
        value: ride.price,
        dueDate: today(),
        externalReference: `corrida-${ride.id}`,
        description: `Corrida #${ride.id}`,
        split: [{ walletId: driver.asaas_wallet_id, fixedValue: driverShare, externalReference: `corrida-${ride.id}-motorista` }],
      });
      paymentId = charge.id;
      db.prepare("UPDATE rides SET payment_ref = ? WHERE id = ?").run(`asaas:${paymentId}`, ride.id);
    }
    const qr = await asaas.pixQrCode(paymentId);
    return { code: qr.payload, qrImage: qr.encodedImage, amount: ride.price, expires: qr.expirationDate, holder: 'Mototáxi', to: 'motoqueiro', provider: 'asaas' };
  }

  return { chargeRide };
}

module.exports = { createAsaasCharge };

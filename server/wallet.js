// Carteira interna: cada corrida paga é dividida sozinha entre o motorista e a central.
// Não guarda dinheiro de verdade: registra valores e pedidos de saque. A transferência do dinheiro
// é feita pelo gateway de pagamento (divisão automática) ou, enquanto não houver um, confirmada pela central.
const { AppError } = require('./errors');
const { getSettings } = require('./db');

const CENTRAL = 'central';
const MIN_WITHDRAW = 10;
const cents = (n) => Math.round(Number(n) * 100) / 100;
const driverAccount = (id) => `driver:${Number(id)}`;

function createWallet({ db, audit, finance }) {
  const sumOf = db.prepare('SELECT COALESCE(SUM(amount), 0) AS v FROM ledger WHERE account = ?');
  const insertEntry = db.prepare(
    'INSERT INTO ledger (account, amount, kind, ride_id, withdrawal_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const balance = (account) => cents(sumOf.get(account).v);

  function statement(account, limit = 40) {
    return db
      .prepare('SELECT amount, kind, ride_id, withdrawal_id, note, created_at FROM ledger WHERE account = ? ORDER BY id DESC LIMIT ?')
      .all(account, limit)
      .map((r) => ({ ...r, amount: cents(r.amount) }));
  }

  /* ----- Pagamento da corrida ----- */

  // Marca a corrida como paga (confirmação do gateway, ou da central quando o Pix cai na conta dela).
  function markPaid(rideId, { amount, provider = 'manual', ref = '', by = null }) {
    const ride = db.prepare('SELECT id, price, status, payment_status, asaas_payment_id FROM rides WHERE id = ?').get(Number(rideId));
    if (!ride) throw new AppError(404, 'Corrida não encontrada');
    if (ride.payment_status === 'paid') throw new AppError(409, 'Esta corrida já foi paga');
    // Com cobrança no Asaas, a confirmação é automática: confirmar à mão pagaria o motorista duas vezes.
    if (provider !== 'asaas' && ride.asaas_payment_id) throw new AppError(409, 'Esta corrida tem cobrança no Asaas: ela é confirmada automaticamente');
    if (cents(amount) !== cents(ride.price)) throw new AppError(409, `O valor recebido não confere com a corrida (R$ ${cents(ride.price).toFixed(2)})`);
    db.transaction(() => {
      db.prepare("UPDATE rides SET payment_status = 'paid', paid_at = ?, payment_ref = ? WHERE id = ?").run(new Date().toISOString(), `${provider}:${ref}`.slice(0, 80), ride.id);
      if (ride.status === 'completed') split(ride.id);
    })();
    audit && audit.log(by, 'Pagamento de corrida confirmado', `#${ride.id} · ${provider}`);
    return { ride_id: ride.id, payment_status: 'paid' };
  }

  // Divide a corrida: comissão para a central, o resto para o motorista. Só uma vez por corrida.
  function split(rideId) {
    const r = db.prepare("SELECT id, driver_id, price, payment_status, status, wallet_at, payment_ref FROM rides WHERE id = ?").get(Number(rideId));
    if (!r || r.status !== 'completed' || r.payment_status !== 'paid' || !r.driver_id || r.wallet_at) return false;
    const pct = getSettings(db).commission_percent;
    const fee = cents((r.price * pct) / 100);
    const share = cents(r.price - fee);
    const now = new Date().toISOString();
    // Corrida paga pelo Asaas: o motorista já recebeu na subconta dele (divisão feita pelo Asaas).
    // Não creditamos de novo; a linha de R$ 0,00 só mostra o registro no extrato.
    const viaAsaas = String(r.payment_ref || '').startsWith('asaas:');
    db.transaction(() => {
      if (viaAsaas) insertEntry.run(driverAccount(r.driver_id), 0, 'asaas_share', r.id, null, `Corrida #${r.id}: paga na sua conta Asaas`, now);
      else insertEntry.run(driverAccount(r.driver_id), share, 'ride_share', r.id, null, `Corrida #${r.id}`, now);
      if (fee > 0) insertEntry.run(CENTRAL, fee, 'ride_fee', r.id, null, `Comissão da corrida #${r.id}`, now);
      db.prepare('UPDATE rides SET wallet_at = ?, commission = ? WHERE id = ?').run(now, fee, r.id);
    })();
    return { share: viaAsaas ? 0 : share, fee, viaAsaas };
  }

  // Chamado quando a corrida termina.
  function onCompleted(rideId) {
    return split(rideId);
  }

  /* ----- Saques ----- */

  function bankOf(account) {
    if (account === CENTRAL) return finance.centralBank();
    const id = Number(account.split(':')[1]);
    return finance.driverBank(id);
  }

  function requestWithdrawal(user, account, amount, { note = '' } = {}) {
    const value = cents(amount);
    if (!Number.isFinite(value) || value < MIN_WITHDRAW) throw new AppError(400, `O saque mínimo é R$ ${MIN_WITHDRAW.toFixed(2)}`);
    const bank = bankOf(account);
    if (!bank) throw new AppError(409, 'Cadastre a conta para receber antes de sacar');
    const available = balance(account);
    if (value > available) throw new AppError(409, `Saldo insuficiente. Disponível: R$ ${available.toFixed(2)}`);
    const id = db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO withdrawals (account, amount, holder_name, holder_doc, pix_type, pix_key, status, requested_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(account, value, bank.holder_name, bank.holder_doc, bank.pix_type, bank.pix_key, 'pending', new Date().toISOString(), String(note).slice(0, 120));
      const wid = Number(info.lastInsertRowid);
      // Desconta já: o mesmo dinheiro não pode ser sacado duas vezes.
      insertEntry.run(account, -value, 'withdrawal', null, wid, 'Saque solicitado', new Date().toISOString());
      return wid;
    })();
    audit && audit.log(user, 'Saque solicitado', `R$ ${value.toFixed(2)} · ${account}`);
    return id;
  }

  // A central confirma que enviou o Pix (ou recusa e devolve o valor).
  function decideWithdrawal(admin, id, decision, note = '') {
    const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(Number(id));
    if (!w) throw new AppError(404, 'Saque não encontrado');
    if (w.status !== 'pending') throw new AppError(409, 'Este saque já foi tratado');
    const now = new Date().toISOString();
    db.transaction(() => {
      if (decision === 'paid') {
        db.prepare("UPDATE withdrawals SET status = 'paid', paid_at = ?, admin_id = ?, note = ? WHERE id = ?").run(now, admin.id, String(note).slice(0, 120), w.id);
      } else if (decision === 'rejected') {
        db.prepare("UPDATE withdrawals SET status = 'rejected', paid_at = ?, admin_id = ?, note = ? WHERE id = ?").run(now, admin.id, String(note).slice(0, 120), w.id);
        insertEntry.run(w.account, w.amount, 'withdrawal_refund', null, w.id, 'Saque recusado: valor devolvido', now);
      } else {
        throw new AppError(400, 'Decisão inválida');
      }
    })();
    audit && audit.log(admin, decision === 'paid' ? 'Saque pago (Pix enviado)' : 'Saque recusado', `R$ ${w.amount.toFixed(2)} · ${w.holder_name}`);
    return { id: w.id, status: decision === 'paid' ? 'paid' : 'rejected' };
  }

  function withdrawals(account = null, status = null, limit = 100) {
    const where = [];
    const args = [];
    if (account) (where.push('account = ?'), args.push(account));
    if (status) (where.push('status = ?'), args.push(status));
    return db
      .prepare(`SELECT * FROM withdrawals ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
      .all(...args, limit)
      .map((w) => ({ ...w, amount: cents(w.amount) }));
  }

  // Corridas pagas? Não: aguardando pagamento, ainda sem divisão. A central vê e confirma o recebimento.
  function awaitingPayment(limit = 50) {
    return db
      .prepare(
        `SELECT r.id, r.price, r.completed_at, r.payment, r.passenger_name, r.driver_id, u.name AS driver_name
           FROM rides r LEFT JOIN users u ON u.id = r.driver_id
          WHERE r.status = 'completed' AND r.payment_status = 'pending' ORDER BY r.id DESC LIMIT ?`
      )
      .all(limit);
  }

  return { CENTRAL, MIN_WITHDRAW, balance, statement, markPaid, split, onCompleted, requestWithdrawal, decideWithdrawal, withdrawals, awaitingPayment, driverAccount };
}

module.exports = { createWallet, CENTRAL, driverAccount, MIN_WITHDRAW };

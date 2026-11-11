// Dinheiro: dados bancários do motoqueiro e da central, cobrança Pix e acerto de comissão.
// O sistema não movimenta dinheiro. Ele gera os códigos Pix e controla quem deve quanto.
const { AppError } = require('./errors');
const { getSettings, setCentralBank } = require('./db');
const { cleanBank, pixCharge, maskDoc } = require('./pix');

const round2 = (n) => Math.round(n * 100) / 100;

function createFinance({ db, audit }) {
  /* ----- Banco do motoqueiro ----- */
  function driverBank(userId) {
    return db.prepare('SELECT holder_name, holder_doc, bank_name, pix_type, pix_key, updated_at FROM driver_bank WHERE user_id = ?').get(Number(userId)) || null;
  }

  function setDriverBank(user, input) {
    const bank = cleanBank(input);
    db.prepare(
      `INSERT INTO driver_bank (user_id, holder_name, holder_doc, bank_name, pix_type, pix_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET holder_name = excluded.holder_name, holder_doc = excluded.holder_doc,
         bank_name = excluded.bank_name, pix_type = excluded.pix_type, pix_key = excluded.pix_key, updated_at = excluded.updated_at`
    ).run(user.id, bank.holder_name, bank.holder_doc, bank.bank_name, bank.pix_type, bank.pix_key, new Date().toISOString());
    audit.log(user, 'Dados bancários do motoqueiro alterados', `Chave ${bank.pix_type}`);
    return driverBank(user.id);
  }

  /* ----- Banco da central ----- */
  function centralBank() {
    const s = getSettings(db);
    if (!s.pix_key || !s.central_pix_type) return null;
    return { holder_name: s.central_holder, holder_doc: s.central_doc, bank_name: s.central_bank, pix_type: s.central_pix_type, pix_key: s.pix_key };
  }

  function setCentral(user, input) {
    const bank = cleanBank(input);
    setCentralBank(db, bank);
    audit.log(user, 'Dados bancários da central alterados', `Chave ${bank.pix_type}`);
    return centralBank();
  }

  // Para mostrar em tela sem expor o documento inteiro.
  const present = (bank) => (bank ? { ...bank, holder_doc: maskDoc(bank.holder_doc) } : null);

  /* ----- Pix da corrida: vai direto para a conta do motoqueiro ----- */
  async function rideCharge(ride) {
    if (ride.payment !== 'pix') throw new AppError(409, 'Esta corrida não é paga em Pix');
    if (!['in_progress', 'completed'].includes(ride.status)) throw new AppError(409, 'O Pix fica disponível depois do embarque');
    const bank = ride.driver_id ? driverBank(ride.driver_id) : null;
    if (!bank) throw new AppError(409, 'O motoqueiro ainda não cadastrou a chave Pix. Combine o pagamento com ele.');
    const charge = await pixCharge({
      key: bank.pix_key,
      name: bank.holder_name,
      city: getSettings(db).city_name,
      amount: ride.price,
      txid: `CORRIDA${ride.id}`,
    });
    return { ...charge, to: 'motoqueiro' };
  }

  /* ----- Comissão: quanto cada motoqueiro deve à central ----- */
  function owed(driverId) {
    const row = db
      .prepare("SELECT COUNT(*) AS rides, COALESCE(SUM(commission), 0) AS amount FROM rides WHERE driver_id = ? AND status = 'completed' AND settled_at IS NULL")
      .get(Number(driverId));
    return { rides: row.rides, amount: round2(row.amount) };
  }

  async function settlementCharge(driverId) {
    const due = owed(driverId);
    if (due.amount <= 0) throw new AppError(409, 'Você não tem comissão em aberto');
    const bank = centralBank();
    if (!bank) throw new AppError(409, 'A central ainda não cadastrou a conta para receber. Fale com a central.');
    const charge = await pixCharge({
      key: bank.pix_key,
      name: bank.holder_name,
      city: getSettings(db).city_name,
      amount: due.amount,
      txid: `ACERTO${driverId}`,
    });
    return { ...charge, to: 'central' };
  }

  function notifyPaid(user) {
    if (owed(user.id).amount <= 0) throw new AppError(409, 'Você não tem comissão em aberto');
    db.prepare('UPDATE drivers SET pay_notice_at = ? WHERE user_id = ?').run(new Date().toISOString(), user.id);
  }

  // A central confirma que recebeu: as corridas em aberto do motoqueiro ficam quitadas.
  function settle(admin, driverId, note) {
    const id = Number(driverId);
    if (!db.prepare('SELECT 1 FROM drivers WHERE user_id = ?').get(id)) throw new AppError(404, 'Motoqueiro não encontrado');
    return db.transaction(() => {
      const due = owed(id);
      if (due.rides === 0) throw new AppError(409, 'Este motoqueiro não tem comissão em aberto');
      const paidAt = new Date().toISOString();
      const info = db
        .prepare('INSERT INTO settlements (driver_id, amount, rides, paid_at, admin_id, note) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, due.amount, due.rides, paidAt, admin.id, String(note || '').trim().slice(0, 120));
      const settlementId = Number(info.lastInsertRowid);
      db.prepare("UPDATE rides SET settled_at = ?, settlement_id = ? WHERE driver_id = ? AND status = 'completed' AND settled_at IS NULL").run(paidAt, settlementId, id);
      db.prepare('UPDATE drivers SET pay_notice_at = NULL WHERE user_id = ?').run(id);
      const name = db.prepare('SELECT name FROM users WHERE id = ?').get(id).name;
      audit.log(admin, 'Acerto de comissão confirmado', `${name}: R$ ${due.amount.toFixed(2)} (${due.rides} corridas)`);
      return { id: settlementId, driver_id: id, amount: due.amount, rides: due.rides, paid_at: paidAt };
    })();
  }

  function history(driverId, limit = 30) {
    const where = driverId ? 'WHERE s.driver_id = ?' : '';
    const args = driverId ? [Number(driverId), limit] : [limit];
    return db
      .prepare(`SELECT s.id, s.driver_id, u.name AS driver_name, s.amount, s.rides, s.paid_at, s.note FROM settlements s JOIN users u ON u.id = s.driver_id ${where} ORDER BY s.id DESC LIMIT ?`)
      .all(...args);
  }

  // Visão da central: quem deve, quanto, e quem avisou que já pagou.
  function overview() {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.phone, d.pay_notice_at AS notice_at,
                COUNT(r.id) AS rides, COALESCE(SUM(r.commission), 0) AS amount
           FROM users u JOIN drivers d ON d.user_id = u.id
           LEFT JOIN rides r ON r.driver_id = u.id AND r.status = 'completed' AND r.settled_at IS NULL
          GROUP BY u.id HAVING rides > 0 ORDER BY amount DESC`
      )
      .all()
      .map((r) => ({ ...r, amount: round2(r.amount) }));
    return { drivers: rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)), history: history(null, 50) };
  }

  return { driverBank, setDriverBank, centralBank, setCentral, present, rideCharge, owed, settlementCharge, notifyPaid, settle, history, overview };
}

module.exports = { createFinance };

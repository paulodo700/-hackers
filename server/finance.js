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

  return { driverBank, setDriverBank, centralBank, setCentral, present, rideCharge };
}

module.exports = { createFinance };

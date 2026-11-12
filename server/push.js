// Notificações push: avisam o passageiro (e o motorista) mesmo com o app fechado.
// Chaves VAPID geradas uma vez e guardadas no banco. Falha de envio nunca derruba uma corrida.
const webpush = require('web-push');
const { AppError } = require('./errors');

const MESSAGES = {
  accepted: { title: 'Motorista a caminho', body: 'Seu motorista aceitou a corrida e está indo até você.' },
  arrived: { title: 'Seu motorista chegou', body: 'Procure a moto no local de partida.' },
  in_progress: { title: 'Corrida iniciada', body: 'Boa viagem! Use o capacete.' },
  completed: { title: 'Corrida concluída', body: 'Obrigado por usar o serviço. Avalie sua corrida.' },
  cancelled: { title: 'Corrida cancelada', body: 'Sua corrida foi cancelada.' },
  no_drivers: { title: 'Sem motorista agora', body: 'Não encontramos motorista livre. Tente de novo.' },
};

function createPush({ db, config }) {
  let keys = null;
  function vapid() {
    if (keys) return keys;
    const row = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    let pub = row('vapid_public');
    let priv = row('vapid_private');
    if (!pub || !priv) {
      const made = webpush.generateVAPIDKeys();
      db.prepare("INSERT INTO settings (key, value) VALUES ('vapid_public', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(made.publicKey);
      db.prepare("INSERT INTO settings (key, value) VALUES ('vapid_private', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(made.privateKey);
      pub = { value: made.publicKey };
      priv = { value: made.privateKey };
    }
    keys = { publicKey: pub.value, privateKey: priv.value };
    webpush.setVapidDetails(`mailto:${config.contactEmail || 'contato@localhost'}`, keys.publicKey, keys.privateKey);
    return keys;
  }

  function subscribe(userId, sub) {
    const endpoint = String((sub && sub.endpoint) || '');
    const p256dh = String((sub && sub.keys && sub.keys.p256dh) || '');
    const auth = String((sub && sub.keys && sub.keys.auth) || '');
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 600 || !p256dh || !auth) throw new AppError(400, 'Assinatura de notificação inválida');
    db.prepare(
      `INSERT INTO push_subs (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
    ).run(userId, endpoint, p256dh, auth, new Date().toISOString());
  }

  function unsubscribe(userId, endpoint) {
    db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(userId, String(endpoint || ''));
  }

  // Envia para todos os aparelhos da pessoa. Aparelho que recusa (ex.: desinstalou) é removido.
  async function notifyUser(userId, { title, body, url = '/' }) {
    if (!userId) return 0;
    vapid();
    const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').all(userId);
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url }), { TTL: 600 });
          sent += 1;
        } catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) unsubscribe(userId, s.endpoint);
        }
      })
    );
    return sent;
  }

  // Aviso de mudança de status da corrida para o passageiro.
  function rideChanged(ride) {
    const msg = MESSAGES[ride.status];
    if (!msg || !ride.passenger_id) return Promise.resolve(0);
    return notifyUser(ride.passenger_id, { ...msg, url: '/passageiro/' }).catch(() => 0);
  }

  return { publicKey: () => vapid().publicKey, subscribe, unsubscribe, notifyUser, rideChanged };
}

module.exports = { createPush, MESSAGES };

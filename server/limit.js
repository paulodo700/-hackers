const { AppError } = require('./errors');

// Limite de pedidos por endereço (IP), em memória. Protege contra abuso e contra estourar
// os serviços gratuitos de mapa.
function createLimiter({ windowMs, max, message = 'Muitas tentativas. Aguarde um pouco e tente de novo.' }) {
  const hits = new Map(); // ip -> { count, resetAt }
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, Math.max(windowMs, 60 * 1000));
  sweep.unref();

  function entryFor(ip) {
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    return entry;
  }

  // Conta todo pedido.
  const middleware = (req, res, next) => {
    const entry = entryFor(req.ip);
    entry.count += 1;
    if (entry.count > max) return next(new AppError(429, message));
    next();
  };
  // Para contar só as falhas (login): `blocked` consulta, `fail` registra.
  middleware.blocked = (ip) => entryFor(ip).count >= max;
  middleware.fail = (ip) => {
    entryFor(ip).count += 1;
  };
  middleware.size = () => hits.size;
  return middleware;
}

module.exports = { createLimiter };

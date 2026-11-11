const { AppError } = require('./errors');

// preço = max(mínimo, taxa inicial + valor por km × distância),
// arredondado para cima em múltiplos de R$ 0,50.
function calcPrice(distanceKm, { base_fare, per_km, min_fare }) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new AppError(400, 'Distância inválida');
  }
  const raw = Math.max(min_fare, base_fare + per_km * distanceKm);
  return Math.ceil(raw * 2 - 1e-9) / 2;
}

module.exports = { calcPrice };

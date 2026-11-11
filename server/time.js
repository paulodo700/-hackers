// Datas "locais" da cidade a partir de um fuso fixo (ex.: -3 para o horário de Brasília).
const HOUR = 3600 * 1000;

function localDay(dateOrIso, offsetHours) {
  const ms = new Date(dateOrIso).getTime() + offsetHours * HOUR;
  return new Date(ms).toISOString().slice(0, 10);
}

// Início (inclusive) e fim (exclusive) de um dia local, em ISO/UTC.
function dayRange(day, offsetHours) {
  const start = Date.parse(`${day}T00:00:00.000Z`) - offsetHours * HOUR;
  return { from: new Date(start).toISOString(), to: new Date(start + 24 * HOUR).toISOString() };
}

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function shiftDay(day, days) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 24 * HOUR).toISOString().slice(0, 10);
}

module.exports = { localDay, dayRange, isDay, shiftDay };

const config = require('./config');

const USER_AGENT = 'mototaxi-cidade/1.0';

function validCoord(p) {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

// Distância em linha reta entre dois pontos, em km.
function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round2 = (n) => Math.round(n * 100) / 100;

// Busca JSON com limite de tempo. Qualquer falha vira null (quem chama decide o plano B).
async function fetchJson(url, fetchImpl, timeoutMs) {
  let timer;
  const controller = new AbortController();
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const request = (async () => {
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Distância pela rua (OSRM). Se o serviço falhar ou demorar, estima por linha reta × 1,3.
async function routeDistanceKm(a, b, fetchImpl = fetch, timeoutMs = 4000) {
  const url = `${config.osrmUrl}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
  const data = await fetchJson(url, fetchImpl, timeoutMs);
  const meters = data && data.routes && data.routes[0] && data.routes[0].distance;
  if (typeof meters === 'number' && Number.isFinite(meters) && meters >= 0) {
    return { km: round2(meters / 1000), source: 'osrm' };
  }
  return { km: round2(haversineKm(a, b) * 1.3), source: 'estimate' };
}

// Monta um rótulo curto: "Rua X, 123 - Bairro".
function shortLabel(item) {
  const a = item.address || {};
  const street = a.road || a.pedestrian || a.footway || a.path || '';
  const name = item.name && item.name !== street ? item.name : '';
  const first = [name, [street, a.house_number].filter(Boolean).join(', ')].filter(Boolean).join(' - ');
  const area = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city || '';
  const label = [first, area].filter(Boolean).join(' - ');
  return label || String(item.display_name || '').split(',').slice(0, 3).join(',').trim();
}

// Busca de endereço (Nominatim), limitada à região em volta de `near`.
async function searchAddress(q, near, fetchImpl = fetch, timeoutMs = 5000) {
  const query = String(q || '').trim().slice(0, 120);
  if (query.length < 3) return [];
  const d = 0.25;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'br',
    viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    bounded: '1',
  });
  const data = await fetchJson(`${config.nominatimUrl}/search?${params}`, fetchImpl, timeoutMs);
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({ label: shortLabel(item), lat: Number(item.lat), lng: Number(item.lon) }))
    .filter((r) => validCoord(r));
}

async function reverseAddress(lat, lng, fetchImpl = fetch, timeoutMs = 5000) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });
  const data = await fetchJson(`${config.nominatimUrl}/reverse?${params}`, fetchImpl, timeoutMs);
  if (!data || data.error) return null;
  return shortLabel(data) || null;
}

module.exports = { validCoord, haversineKm, routeDistanceKm, searchAddress, reverseAddress };

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

const round5 = (n) => Math.round(n * 1e5) / 1e5;
const MAX_POINTS = 160;
const MOTO_KMH = 25; // velocidade média usada quando não há rota calculada

// Reduz o desenho da rota a um número razoável de pontos (sempre mantém o primeiro e o último).
function thin(points) {
  if (points.length <= MAX_POINTS) return points;
  const step = (points.length - 1) / (MAX_POINTS - 1);
  const out = [];
  for (let i = 0; i < MAX_POINTS; i++) out.push(points[Math.round(i * step)]);
  return out;
}

// Completa uma rota com tempo e desenho quando eles não vieram (estimativa em linha reta).
function completeRoute(route, a, b) {
  const km = route.km;
  const min = Number.isFinite(route.min) ? route.min : Math.max(1, Math.round((km / MOTO_KMH) * 60));
  const points =
    Array.isArray(route.points) && route.points.length >= 2
      ? route.points
      : [[round5(a.lat), round5(a.lng)], [round5(b.lat), round5(b.lng)]];
  return { km, source: route.source, min, points };
}

// Rota pela rua (OSRM): distância, tempo e desenho. Se o serviço falhar ou demorar,
// estima por linha reta × 1,3.
async function routeDistanceKm(a, b, fetchImpl = fetch, timeoutMs = 4000) {
  const url = `${config.osrmUrl}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const data = await fetchJson(url, fetchImpl, timeoutMs);
  const best = data && data.routes && data.routes[0];
  const meters = best && best.distance;
  if (typeof meters === 'number' && Number.isFinite(meters) && meters >= 0) {
    const route = { km: round2(meters / 1000), source: 'osrm' };
    if (Number.isFinite(best.duration)) route.min = Math.max(1, Math.round(best.duration / 60));
    const coords = best.geometry && best.geometry.coordinates;
    if (Array.isArray(coords)) {
      const points = coords
        .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .map(([lng, lat]) => [round5(lat), round5(lng)]);
      if (points.length >= 2) route.points = thin(points);
    }
    return completeRoute(route, a, b);
  }
  return completeRoute({ km: round2(haversineKm(a, b) * 1.3), source: 'estimate' }, a, b);
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

// Guarda as rotas calculadas por alguns minutos. Assim o preço mostrado na estimativa é o mesmo
// cobrado ao confirmar, e o serviço de rotas recebe menos pedidos.
function withRouteCache(geoImpl, { ttlMs = 10 * 60 * 1000, max = 500, now = Date.now } = {}) {
  const cache = new Map();
  const key = (a, b) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(',');
  return {
    ...geoImpl,
    async routeDistanceKm(a, b) {
      const k = key(a, b);
      const hit = cache.get(k);
      if (hit && hit.until > now()) return hit.route;
      const route = await geoImpl.routeDistanceKm(a, b);
      // Estimativa (serviço fora do ar) fica guardada por pouco tempo, para tentar de novo logo.
      cache.delete(k);
      cache.set(k, { route, until: now() + (route.source === 'osrm' ? ttlMs : Math.min(ttlMs, 2 * 60 * 1000)) });
      if (cache.size > max) cache.delete(cache.keys().next().value);
      return route;
    },
  };
}

module.exports = { validCoord, haversineKm, routeDistanceKm, completeRoute, withRouteCache, searchAddress, reverseAddress };

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

// O serviço gratuito de endereços pede no máximo um pedido por segundo: os pedidos entram em fila.
let nominatimQueue = Promise.resolve();
let nominatimLast = 0;
function nominatim(url, fetchImpl, timeoutMs, gapMs = 1100) {
  const run = async () => {
    const wait = nominatimLast + gapMs - Date.now();
    if (fetchImpl === fetch && wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
    return fetchJson(url, fetchImpl, timeoutMs);
  };
  const job = nominatimQueue.then(run, run);
  nominatimQueue = job.catch(() => null);
  return job;
}

const streetOf = (a) => a.road || a.pedestrian || a.footway || a.path || a.residential || '';
const areaOf = (a) => a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city || '';

// Monta um rótulo curto: "Rua X, 123 - Bairro". `number` é o número digitado pela pessoa.
function shortLabel(item, number) {
  const a = item.address || {};
  const street = streetOf(a);
  const isStreet = item.category === 'highway' || item.class === 'highway' || !item.name || item.name === street;
  const name = isStreet ? '' : item.name;
  const num = a.house_number || (isStreet ? number : '') || '';
  const first = [name, [street, num].filter(Boolean).join(', ')].filter(Boolean).join(' - ');
  const label = [first, areaOf(a)].filter(Boolean).join(' - ');
  return label || String(item.display_name || '').split(',').slice(0, 3).join(',').trim();
}

// Separa o número da casa do resto: "rua 13 de maio 500" → { street: "rua 13 de maio", number: "500" }.
// O número é o último bloco de dígitos, desde que sobre um nome de rua antes dele.
function splitNumber(q) {
  const m = String(q).trim().match(/^(.*\D)[\s,]+(?:n[ºo°.]?\s*)?(\d{1,5}[a-zA-Z]?)\s*$/);
  if (!m) return { street: String(q).trim(), number: '' };
  // Tira do fim da rua a vírgula e o "nº" que vinham antes do número.
  const street = m[1].replace(/[\s,]+(?:n[ºo°]\.?|n\.?)?[\s,]*$/i, '').trim();
  // Nome de rua com menos de 4 letras ("rua") não conta: o número faz parte do nome.
  return street.length >= 4 ? { street, number: m[2] } : { street: String(q).trim(), number: '' };
}

// Busca de endereço (Nominatim), limitada à região em volta de `near`.
// Cada resultado traz `approx: true` quando a pessoa digitou um número que o mapa não conhece:
// a posição é a da rua, e a tela pede para ajustar o pino.
async function searchAddress(q, near, fetchImpl = fetch, timeoutMs = 5000) {
  const query = String(q || '').trim().slice(0, 120);
  if (query.length < 3) return [];
  const { number } = splitNumber(query);
  const d = 0.25;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    countrycodes: 'br',
    viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    bounded: '1',
  });
  const data = await nominatim(`${config.nominatimUrl}/search?${params}`, fetchImpl, timeoutMs);
  if (!Array.isArray(data)) return [];

  // Uma rua comprida aparece em vários pedaços: fica só o pedaço mais perto de quem busca.
  const best = new Map();
  for (const item of data) {
    const pos = { lat: Number(item.lat), lng: Number(item.lon) };
    if (!validCoord(pos)) continue;
    const a = item.address || {};
    const exact = !number || (!!a.house_number && String(a.house_number).toLowerCase() === number.toLowerCase());
    const isStreet = item.category === 'highway' || item.class === 'highway';
    const result = { label: shortLabel(item, number), lat: pos.lat, lng: pos.lng, approx: !!number && !exact && isStreet };
    const key = result.label.toLowerCase();
    const dist = haversineKm(near, pos);
    const seen = best.get(key);
    if (!seen || dist < seen.dist) best.set(key, { result, dist, exact: !!number && exact });
  }
  return [...best.values()]
    .sort((x, y) => Number(y.exact) - Number(x.exact) || x.dist - y.dist)
    .slice(0, 5)
    .map((x) => x.result);
}

async function reverseAddress(lat, lng, fetchImpl = fetch, timeoutMs = 5000) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  });
  const data = await nominatim(`${config.nominatimUrl}/reverse?${params}`, fetchImpl, timeoutMs);
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

// Guarda as buscas de endereço por um dia: resposta na hora para quem repete e menos pedidos ao serviço.
function withSearchCache(geoImpl, { ttlMs = 24 * 60 * 60 * 1000, max = 2000, now = Date.now } = {}) {
  const cache = new Map();
  return {
    ...geoImpl,
    async searchAddress(q, near) {
      const key = `${String(q || '').trim().toLowerCase()}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
      const hit = cache.get(key);
      if (hit && hit.until > now()) return hit.results;
      const results = await geoImpl.searchAddress(q, near);
      if (results.length) {
        cache.delete(key);
        cache.set(key, { results, until: now() + ttlMs });
        if (cache.size > max) cache.delete(cache.keys().next().value);
      }
      return results;
    },
  };
}

module.exports = { validCoord, haversineKm, routeDistanceKm, completeRoute, withRouteCache, withSearchCache, splitNumber, searchAddress, reverseAddress };

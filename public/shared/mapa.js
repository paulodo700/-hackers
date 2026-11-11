// Mapa (Leaflet + OpenStreetMap).
/* global L */

const PIN = {
  origem: { emoji: '🧍', cls: 'pin origem' },
  destino: { emoji: '🏁', cls: 'pin destino' },
  moto: { emoji: '🏍️', cls: 'pin moto' },
  'moto-ocupada': { emoji: '🏍️', cls: 'pin moto ocupada' },
  'moto-sumida': { emoji: '🏍️', cls: 'pin moto sumida' },
  eu: { emoji: '', cls: 'pin eu' },
};

export function criarMapa(el, center, zoom = 15, { animado = true } = {}) {
  // Na central as telas trocam o tempo todo: sem animação, o mapa pode ser removido a qualquer momento.
  const map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    zoomAnimation: animado,
    fadeAnimation: animado,
    markerZoomAnimation: animado,
  }).setView([center.lat, center.lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  // O painel de baixo muda de altura conforme a etapa: o mapa acompanha e mantém os pontos à vista.
  const observer = new ResizeObserver(() => {
    if (!el.isConnected || !el.clientHeight) return;
    map.invalidateSize({ animate: false });
    if (map.pontosEmFoco) ajustar(map, map.pontosEmFoco, 60, false);
  });
  observer.observe(el);
  map.on('unload', () => observer.disconnect());
  return map;
}

function ajustar(map, points, padding, animate) {
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 16), { animate });
  } else {
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [padding, padding], maxZoom: 17, animate });
  }
}

// Remove o mapa com segurança (para qualquer movimento em andamento antes).
export function removerMapa(map) {
  try {
    map.stop();
    map.remove();
  } catch {
    /* já removido */
  }
}

export function icone(tipo) {
  const p = PIN[tipo] || PIN.origem;
  return L.divIcon({ className: '', html: `<div class="${p.cls}">${p.emoji}</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });
}

// Guarda um marcador por chave: cria, move ou remove conforme a posição informada.
export function criarCamada(map) {
  const marks = new Map();
  return {
    set(key, tipo, pos, title) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return this.remove(key);
      let m = marks.get(key);
      if (!m) {
        m = L.marker([pos.lat, pos.lng], { icon: icone(tipo), keyboard: false }).addTo(map);
        m.tipo = tipo;
        marks.set(key, m);
      } else {
        m.setLatLng([pos.lat, pos.lng]);
        if (m.tipo !== tipo) (m.setIcon(icone(tipo)), (m.tipo = tipo));
      }
      if (title) m.bindTooltip(title, { direction: 'top', offset: [0, -16] });
      return m;
    },
    remove(key) {
      const m = marks.get(key);
      if (m) (m.remove(), marks.delete(key));
    },
    keep(keys) {
      for (const key of [...marks.keys()]) if (!keys.has(key)) this.remove(key);
    },
    clear() {
      this.keep(new Set());
    },
    has: (key) => marks.has(key),
  };
}

export function enquadrar(map, points, padding = 60) {
  const valid = points.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number');
  if (!valid.length) return;
  map.pontosEmFoco = valid.map((p) => ({ lat: p.lat, lng: p.lng }));
  ajustar(map, map.pontosEmFoco, padding, undefined);
}

export function distanciaKm(a, b) {
  if (!a || !b) return null;
  return L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng)) / 1000;
}

// Posição atual do aparelho (uma vez).
export function ondeEstou(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este aparelho não tem GPS disponível'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Não foi possível obter sua localização. Ative o GPS e permita o acesso.')),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 }
    );
  });
}

// Campo de endereço com sugestões. `onPick` recebe { text, lat, lng }.
export function campoEndereco({ client, h, label, placeholder, near, onPick, onFocus }) {
  let timer;
  let seq = 0;
  const list = h('ul', { class: 'sugestoes', role: 'listbox' });
  const input = h('input', {
    type: 'search',
    placeholder,
    autocomplete: 'off',
    'aria-label': label,
    onfocus: () => onFocus && onFocus(),
    oninput: () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) return list.replaceChildren();
      // Espera a pessoa parar de digitar (o serviço de busca gratuito pede poucas consultas).
      timer = setTimeout(async () => {
        const mine = ++seq;
        const c = near();
        const qs = new URLSearchParams({ q, ...(c ? { lat: c.lat, lng: c.lng } : {}) });
        let results = [];
        try {
          results = (await client.api(`/geo/search?${qs}`)).results;
        } catch {
          results = [];
        }
        if (mine !== seq) return;
        list.replaceChildren(
          ...(results.length
            ? results.map((r) =>
                h('li', { role: 'option', tabindex: 0, onclick: () => choose(r), onkeydown: (e) => e.key === 'Enter' && choose(r) }, r.label)
              )
            : [h('li', { class: 'vazio' }, 'Nada encontrado. Toque no mapa para marcar o lugar.')])
        );
      }, 700);
    },
  });
  function choose(r) {
    input.value = r.label;
    list.replaceChildren();
    onPick({ text: r.label, lat: r.lat, lng: r.lng });
  }
  const box = h('div', { class: 'endereco' }, h('span', { class: 'rotulo' }, label), input, list);
  return {
    el: box,
    input,
    set(text) {
      input.value = text || '';
      list.replaceChildren();
    },
    ativo(on) {
      box.classList.toggle('ativo', !!on);
    },
  };
}

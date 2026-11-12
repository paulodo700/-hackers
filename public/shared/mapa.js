// Mapa (Leaflet + OpenStreetMap).
/* global L */

import { svgIcone } from '/shared/icones.js';

const PIN = {
  origem: { html: svgIcone('usuario'), cls: 'pin origem' },
  destino: { html: svgIcone('bandeira'), cls: 'pin destino' },
  moto: { html: svgIcone('moto'), cls: 'pin moto', suave: true },
  'moto-ocupada': { html: svgIcone('moto'), cls: 'pin moto ocupada', suave: true },
  'moto-sumida': { html: svgIcone('moto'), cls: 'pin moto sumida', suave: true },
  eu: { html: '', cls: 'pin eu', suave: true },
  pulso: { html: '', cls: 'pulso' },
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
    referrerPolicy: 'strict-origin-when-cross-origin', // o OpenStreetMap bloqueia pedidos sem identificação
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
  return L.divIcon({
    className: p.suave ? 'suave' : '',
    html: `<div class="${p.cls}">${p.html}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Desenho da rota no mapa. `set` recebe uma lista de [lat, lng].
export function criarRota(map) {
  let linhas = [];
  return {
    set(points) {
      this.clear();
      if (!Array.isArray(points) || points.length < 2) return;
      linhas = [
        L.polyline(points, { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }),
        L.polyline(points, { color: '#1a73e8', weight: 5, opacity: 0.95, interactive: false }),
      ].map((l) => l.addTo(map));
    },
    clear() {
      linhas.forEach((l) => l.remove());
      linhas = [];
    },
  };
}

// Minutos estimados de moto entre dois pontos (linha reta × 1,3, a 25 km/h).
export function minutosAte(a, b) {
  const d = distanciaKm(a, b);
  if (d === null) return null;
  return Math.max(1, Math.round(((d * 1.3) / 25) * 60));
}

// Guarda um marcador por chave: cria, move ou remove conforme a posição informada.
export function criarCamada(map) {
  const marks = new Map();
  return {
    set(key, tipo, pos, title) {
      if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return this.remove(key);
      let m = marks.get(key);
      if (!m) {
        m = L.marker([pos.lat, pos.lng], { icon: icone(tipo), keyboard: false, interactive: tipo !== 'pulso', zIndexOffset: tipo === 'pulso' ? -500 : 0 }).addTo(map);
        m.tipo = tipo;
        marks.set(key, m);
      } else {
        m.setLatLng([pos.lat, pos.lng]);
        if (m.tipo !== tipo) (m.setIcon(icone(tipo)), (m.tipo = tipo));
      }
      if (title) {
        // Como elemento de texto (e não HTML): nomes digitados por usuários nunca viram código.
        const label = document.createElement('span');
        label.textContent = title;
        m.unbindTooltip();
        m.bindTooltip(label, { direction: 'top', offset: [0, -16] });
      }
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
                h('li', { role: 'option', tabindex: 0, onclick: () => choose(r), onkeydown: (e) => e.key === 'Enter' && choose(r) }, r.label, r.known ? h('small', { class: 'tag ok' }, 'Local conhecido') : r.approx ? h('small', { class: 'tag warn' }, 'Número aproximado: ajuste o pino') : null)
              )
            : [h('li', { class: 'vazio' }, 'Nada encontrado. Toque no mapa para marcar o lugar.')])
        );
      }, 700);
    },
  });
  function choose(r) {
    input.value = r.label;
    list.replaceChildren();
    // Exato só quando o mapa conhece o número ou a cidade já confirmou o lugar. Aproximado pede ajuste no mapa.
    onPick({ text: r.label, lat: r.lat, lng: r.lng, precise: !!r.known || (!r.approx && !!r.label.match(/\d/)) });
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

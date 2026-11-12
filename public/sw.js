// Service worker mínimo: permite instalar como app e abre a "casca" mesmo com internet ruim.
// Nunca guarda respostas da API nem do tempo real.
const CACHE = 'mototaxi-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  // Sempre tenta a rede primeiro (versão mais nova); sem rede, usa a cópia guardada.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});

// Aviso recebido do servidor (ex.: "Seu motorista chegou"), mesmo com o app fechado.
self.addEventListener('push', (event) => {
  let dados = { title: 'Mototáxi', body: '', url: '/' };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch (e) {
    /* mensagem sem formato: mostra o padrão */
  }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: '/icon-passageiro-192.png',
      badge: '/icon-passageiro-192.png',
      tag: 'corrida',
      renotify: true,
      data: { url: dados.url || '/' },
    })
  );
});

// Tocar no aviso abre (ou traz para frente) o aplicativo.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

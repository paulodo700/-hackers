// Página inicial: mostra o nome da cidade e registra o service worker.
fetch('/api/public/config')
  .then((r) => r.json())
  .then((c) => {
    if (c && c.city_name && c.city_name !== 'Minha Cidade') {
      document.getElementById('cidade').textContent = c.city_name;
      document.title = `Mototáxi ${c.city_name}`;
    }
  })
  .catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

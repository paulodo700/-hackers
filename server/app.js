const path = require('node:path');
const express = require('express');
const { AppError } = require('./errors');
const { getSettings } = require('./db');

// Monta o servidor HTTP: API + as três telas (arquivos estáticos).
function createApp(deps) {
  const { db } = deps;
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/public/config', (req, res) => {
    const s = getSettings(db);
    res.json({ city_name: s.city_name, city_lat: s.city_lat, city_lng: s.city_lng });
  });
  app.use('/api/auth', require('./routes/auth')(deps));
  app.use('/api/rides', require('./routes/rides')(deps));
  app.use('/api/driver', require('./routes/drivers')(deps));
  app.use('/api/admin', require('./routes/admin')(deps));
  app.use('/api/geo', require('./routes/geo')(deps));
  app.use('/api', (req, res, next) => next(new AppError(404, 'Rota não encontrada')));

  // Biblioteca do mapa servida pelo próprio servidor (sem depender de CDN).
  app.use(
    '/vendor/leaflet',
    express.static(path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist'), { maxAge: '7d' })
  );
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      setHeaders(res, file) {
        // As telas mudam a cada atualização: o navegador sempre confere se há versão nova.
        if (/\.(html|js|css|webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dados inválidos' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Dados grandes demais' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno. Tente de novo.' });
  });

  return app;
}

module.exports = { createApp };

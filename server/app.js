const path = require('node:path');
const express = require('express');
const { AppError } = require('./errors');
const { getSettings } = require('./db');
const config = require('./config');

// Monta o servidor HTTP: API + as três telas (arquivos estáticos).
function createApp(deps) {
  const { db } = deps;
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Envia só o endereço do site (sem o caminho) para serviços de fora. O mapa do OpenStreetMap
    // exige essa identificação e bloqueia quem não manda.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!config.demo) res.setHeader('X-Frame-Options', 'DENY');
    // Só roda código vindo do próprio servidor: barra scripts injetados.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' ws: wss:; " +
        `${config.demo ? '' : "frame-ancestors 'none'; "}base-uri 'self'; form-action 'self'`
    );
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  // Usado pela hospedagem para saber se o servidor está de pé (e se o banco responde).
  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });

  app.get('/api/public/config', (req, res) => {
    const s = getSettings(db);
    res.json({ city_name: s.city_name, city_lat: s.city_lat, city_lng: s.city_lng, demo: config.demo });
  });
  app.use('/api/auth', require('./routes/auth')(deps));
  app.use('/api/rides', require('./routes/rides')(deps));
  app.use('/api/driver', require('./routes/drivers')(deps));
  app.use('/api/admin', require('./routes/admin')(deps));
  app.use('/api/geo', require('./routes/geo')(deps));
  app.use('/api', (req, res, next) => next(new AppError(404, 'Rota não encontrada')));

  // O endereço principal abre direto a tela do passageiro. As telas do motoqueiro (/motoqueiro/) e da
  // central (/central/) não têm link em lugar nenhum: só entra quem recebe o endereço.
  app.get('/', (req, res) => res.redirect(302, '/passageiro/'));
  app.use(['/motoqueiro', '/central'], (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // não aparecer em buscadores
    next();
  });

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

const path = require('node:path');
const express = require('express');
const { AppError } = require('./errors');
const { getSettings, publicSettings } = require('./db');
const config = require('./config');
const auth = require('./auth');

// Monta o servidor HTTP: API + as três telas (arquivos estáticos).
function createApp(deps) {
  const { db } = deps;
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Em HTTPS, o navegador passa a recusar a versão sem cadeado deste endereço.
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    // Envia só o endereço do site (sem o caminho) para serviços de fora. O mapa do OpenStreetMap
    // exige essa identificação e bloqueia quem não manda.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!config.demo) res.setHeader('X-Frame-Options', 'DENY');
    // Só roda código vindo do próprio servidor: barra scripts injetados.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' ws: wss:; " +
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

  // Confirmação de pagamento vinda do gateway: o gateway cobra o passageiro e a carteira divide sozinha.
  app.post('/api/payments/webhook', (req, res, next) => {
    const expected = config.paymentWebhookToken;
    if (!expected) return next(new AppError(503, 'Pagamentos automáticos ainda não estão ligados'));
    const got = String(req.get('x-payment-token') || '');
    const crypto = require('node:crypto');
    const ok = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    if (!ok) return next(new AppError(401, 'Não autorizado'));
    const body = req.body || {};
    if (body.status !== 'paid') return res.json({ ok: true, ignored: true });
    deps.wallet.markPaid(body.ride_id, { amount: body.amount, provider: 'gateway', ref: String(body.provider_ref || '').slice(0, 60) });
    res.json({ ok: true });
  });

  // Notificações: chave pública e cadastro do aparelho (só para quem entrou).
  app.get('/api/push/key', (req, res) => res.json({ key: deps.push.publicKey() }));
  app.post('/api/push/subscribe', auth.requireAuth(db), (req, res) => {
    deps.push.subscribe(req.user.id, req.body);
    res.status(201).json({ ok: true });
  });
  app.post('/api/push/unsubscribe', auth.requireAuth(db), (req, res) => {
    deps.push.unsubscribe(req.user.id, req.body && req.body.endpoint);
    res.json({ ok: true });
  });

  app.get('/api/public/config', (req, res) => {
    res.json({ ...publicSettings(db), demo: config.demo });
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

  // Ao instalar como aplicativo, o nome e a cor seguem a marca configurada na central.
  const APPS = {
    passageiro: { suffix: '', short: null, orientation: 'portrait' },
    motoqueiro: { suffix: ' Motoqueiro', short: 'Motoqueiro', orientation: 'portrait' },
    central: { suffix: ' Central', short: 'Central', orientation: 'any' },
  };
  app.get('/:app/manifest.webmanifest', (req, res, next) => {
    const meta = APPS[req.params.app];
    if (!meta) return next();
    const s = getSettings(db);
    res.type('application/manifest+json').setHeader('Cache-Control', 'no-cache');
    res.json({
      name: `${s.brand_name}${meta.suffix}`,
      short_name: meta.short || s.brand_name.slice(0, 12),
      id: `/${req.params.app}/`,
      start_url: `/${req.params.app}/`,
      // Cada tela é um aplicativo separado: instalados lado a lado, cada um abre só a sua parte.
      scope: `/${req.params.app}/`,
      display: 'standalone',
      orientation: meta.orientation,
      lang: 'pt-BR',
      background_color: '#151515',
      theme_color: '#151515',
      icons: [
        { src: `/icon-${req.params.app}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `/icon-${req.params.app}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    });
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

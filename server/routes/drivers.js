const express = require('express');
const auth = require('../auth');
const { KINDS, MAX_BYTES } = require('../docs');
const { createLimiter } = require('../limit');
const { AppError } = require('../errors');
const { getSettings } = require('../db');
const { requireAuth } = require('../auth');
const { localDay, dayRange, shiftDay } = require('../time');

// Rotas do motoqueiro.
module.exports = function driverRoutes({ db, rides, dispatch, drivers, docs, finance }) {
  const router = express.Router();
  router.use(requireAuth(db, 'driver'));

  const state = (id) => ({
    driver: drivers.get(id),
    ride: rides.activeRideFor({ id, role: 'driver' }),
    offer: dispatch.pendingOfferFor(id),
  });

  router.get('/state', (req, res) => res.json(state(req.user.id)));

  router.post('/online', (req, res) => {
    const body = req.body || {};
    drivers.setOnline(req.user.id, !!body.online, { lat: body.lat, lng: body.lng });
    res.json(state(req.user.id));
  });

  router.post('/location', (req, res) => {
    drivers.updateLocation(req.user.id, req.body || {});
    res.json({ ok: true });
  });

  router.post('/offers/:id/:answer', (req, res) => {
    const { answer } = req.params;
    if (answer !== 'accept' && answer !== 'decline') throw new AppError(404, 'Rota não encontrada');
    dispatch.respond(req.params.id, req.user.id, answer === 'accept');
    res.json(state(req.user.id));
  });

  router.post('/rides/:id/:action', (req, res) => {
    const { action } = req.params;
    if (!['arrive', 'start', 'complete', 'cancel'].includes(action)) throw new AppError(404, 'Rota não encontrada');
    const ride = rides.act(req.params.id, action, req.user, req.body && req.body.reason);
    res.json({ ...state(req.user.id), last: ride });
  });

  /* ----- Cadastro completo: documentos e conta bancária ----- */

  const onboarding = (id) => {
    const docStatus = docs.status(id);
    const bank = finance.driverBank(id);
    return {
      docs: docStatus,
      labels: KINDS,
      bank: finance.present(bank),
      complete: Object.values(docStatus).every(Boolean) && !!bank,
    };
  };

  router.get('/onboarding', (req, res) => res.json(onboarding(req.user.id)));

  // A foto chega como arquivo (não como texto). Limite de envios para não encher o disco.
  const uploadLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 30, message: 'Muitos envios. Tente de novo mais tarde.' });
  router.post(
    '/documents/:kind',
    uploadLimit,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], limit: MAX_BYTES }),
    (req, res) => {
      docs.save(req.user.id, req.params.kind, req.body);
      res.json(onboarding(req.user.id));
    }
  );

  // Mudar a conta bancária exige a senha: evita que alguém com o celular na mão desvie os pagamentos.
  router.put('/bank', (req, res) => {
    const body = req.body || {};
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!auth.verifyPassword(body.password, row.password_hash)) throw new AppError(401, 'Senha incorreta');
    finance.setDriverBank(req.user, body);
    res.json(onboarding(req.user.id));
  });

  /* ----- Pix e comissão ----- */

  router.get('/rides/:id/pix', async (req, res) => {
    const ride = rides.getRide(req.params.id);
    if (!ride || ride.driver_id !== req.user.id) throw new AppError(404, 'Corrida não encontrada');
    res.json(await finance.rideCharge(ride));
  });

  router.get('/settlement', (req, res) => {
    const d = db.prepare('SELECT pay_notice_at FROM drivers WHERE user_id = ?').get(req.user.id);
    res.json({
      owed: finance.owed(req.user.id),
      central_ready: !!finance.centralBank(),
      notice_at: d ? d.pay_notice_at : null,
      history: finance.history(req.user.id),
    });
  });

  router.get('/settlement/pix', async (req, res) => res.json(await finance.settlementCharge(req.user.id)));

  router.post('/settlement/notify', (req, res) => {
    finance.notifyPaid(req.user);
    res.json({ ok: true });
  });

  router.get('/history', (req, res) =>
    res.json({ rides: rides.list({ driverId: req.user.id, status: 'completed', limit: 30 }) })
  );

  router.get('/summary', (req, res) => {
    const { tz_offset_hours: tz, commission_percent: pct } = getSettings(db);
    const today = localDay(Date.now(), tz);
    const sum = (fromDay) => {
      const row = db
        .prepare(
          "SELECT COUNT(*) AS rides, COALESCE(SUM(price), 0) AS total FROM rides WHERE driver_id = ? AND status = 'completed' AND completed_at >= ?"
        )
        .get(req.user.id, dayRange(fromDay, tz).from);
      return { rides: row.rides, total: row.total, commission: Math.round(row.total * pct) / 100 };
    };
    res.json({ today: sum(today), week: sum(shiftDay(today, -6)), commission_percent: pct });
  });

  return router;
};

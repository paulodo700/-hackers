const express = require('express');
const { AppError } = require('../errors');
const { getSettings } = require('../db');
const { requireAuth } = require('../auth');
const { localDay, dayRange, shiftDay } = require('../time');

// Rotas do motoqueiro.
module.exports = function driverRoutes({ db, rides, dispatch, drivers }) {
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

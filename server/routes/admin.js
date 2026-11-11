const express = require('express');
const { AppError } = require('../errors');
const { getSettings, setSettings } = require('../db');
const { requireAuth, normalizePhone } = require('../auth');
const { validCoord } = require('../geo');
const { calcPrice } = require('../pricing');
const { ACTIVE } = require('../rides');
const { localDay, dayRange, isDay, shiftDay } = require('../time');

// Rotas da central.
module.exports = function adminRoutes({ db, rides, dispatch, drivers, geo }) {
  const router = express.Router();
  router.use(requireAuth(db, 'admin'));

  const completedBetween = db.prepare(
    `SELECT r.id, r.price, r.completed_at, r.driver_id, u.name AS driver_name
       FROM rides r LEFT JOIN users u ON u.id = r.driver_id
      WHERE r.status = 'completed' AND r.completed_at >= ? AND r.completed_at < ?`
  );

  router.get('/overview', (req, res) => {
    const { tz_offset_hours: tz } = getSettings(db);
    const { from, to } = dayRange(localDay(Date.now(), tz), tz);
    const done = completedBetween.all(from, to);
    const all = drivers.list();
    res.json({
      drivers: all,
      activeRides: rides.list({ status: [...ACTIVE, 'no_drivers'].join(','), limit: 200 }),
      stats: {
        today_rides: done.length,
        today_revenue: done.reduce((s, r) => s + r.price, 0),
        online_drivers: all.filter((d) => d.online && d.status === 'approved').length,
        pending_drivers: all.filter((d) => d.status === 'pending').length,
      },
    });
  });

  router.get('/drivers', (req, res) => res.json({ drivers: drivers.list() }));

  router.post('/drivers/:id/status', (req, res) => {
    res.json({ driver: drivers.setStatus(req.params.id, req.body && req.body.status) });
  });

  router.post('/rides/estimate', async (req, res) => {
    const { origin, dest } = req.body || {};
    if (!validCoord(origin) || !validCoord(dest)) throw new AppError(400, 'Informe partida e destino no mapa');
    const route = await geo.routeDistanceKm(origin, dest);
    res.json({ distance_km: route.km, source: route.source, price: calcPrice(route.km, getSettings(db)) });
  });

  router.post('/rides', async (req, res) => {
    const body = req.body || {};
    if (!validCoord(body.origin) || !validCoord(body.dest)) {
      throw new AppError(400, 'Informe partida e destino no mapa');
    }
    let phone = '';
    if (String(body.passenger_phone || '').trim()) {
      phone = normalizePhone(body.passenger_phone);
      if (!phone) throw new AppError(400, 'Telefone do passageiro inválido (use DDD + número)');
    }
    const driverId = body.driver_id ? Number(body.driver_id) : null;
    if (driverId) dispatch.checkAssignable(driverId);
    const route = await geo.routeDistanceKm(body.origin, body.dest);
    const ride = rides.createRide({
      passengerName: body.passenger_name,
      passengerPhone: phone,
      origin: body.origin,
      dest: body.dest,
      distanceKm: route.km,
      payment: body.payment || 'cash',
      notes: body.notes,
      source: 'central',
      driverId,
    });
    res.status(201).json({ ride });
  });

  router.get('/rides', (req, res) => {
    const { tz_offset_hours: tz } = getSettings(db);
    const filter = { status: req.query.status || undefined, limit: 200 };
    if (isDay(req.query.from)) filter.from = dayRange(req.query.from, tz).from;
    if (isDay(req.query.to)) filter.to = dayRange(req.query.to, tz).to;
    res.json({ rides: rides.list(filter) });
  });

  router.post('/rides/:id/cancel', (req, res) => {
    res.json({ ride: rides.act(req.params.id, 'cancel', req.user, req.body && req.body.reason) });
  });

  router.post('/rides/:id/retry', (req, res) => {
    const driverId = req.body && req.body.driver_id ? Number(req.body.driver_id) : null;
    if (driverId) dispatch.checkAssignable(driverId);
    res.json({ ride: rides.retry(req.params.id, driverId) });
  });

  router.get('/reports', (req, res) => {
    const { tz_offset_hours: tz, commission_percent: pct } = getSettings(db);
    const today = localDay(Date.now(), tz);
    const fromDay = isDay(req.query.from) ? req.query.from : shiftDay(today, -6);
    const toDay = isDay(req.query.to) ? req.query.to : today;
    if (fromDay > toDay) throw new AppError(400, 'A data inicial deve ser antes da final');
    const from = dayRange(fromDay, tz).from;
    const to = dayRange(toDay, tz).to;
    const done = completedBetween.all(from, to);
    const commission = (v) => Math.round(v * pct) / 100;

    const byDriver = new Map();
    const byDay = new Map();
    let revenue = 0;
    for (const r of done) {
      revenue += r.price;
      const d = byDriver.get(r.driver_id) || { driver_id: r.driver_id, name: r.driver_name || '—', rides: 0, revenue: 0 };
      d.rides += 1;
      d.revenue += r.price;
      byDriver.set(r.driver_id, d);
      const day = localDay(r.completed_at, tz);
      const e = byDay.get(day) || { day, rides: 0, revenue: 0 };
      e.rides += 1;
      e.revenue += r.price;
      byDay.set(day, e);
    }
    const cancelled = db
      .prepare("SELECT COUNT(*) AS n FROM rides WHERE status = 'cancelled' AND cancelled_at >= ? AND cancelled_at < ?")
      .get(from, to).n;

    res.json({
      from: fromDay,
      to: toDay,
      commission_percent: pct,
      totals: { rides: done.length, revenue, commission: commission(revenue), cancelled },
      byDriver: [...byDriver.values()]
        .map((d) => ({ ...d, commission: commission(d.revenue) }))
        .sort((a, b) => b.revenue - a.revenue),
      byDay: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    });
  });

  router.get('/settings', (req, res) => res.json({ settings: getSettings(db) }));

  router.put('/settings', (req, res) => {
    setSettings(db, req.body || {});
    res.json({ settings: getSettings(db) });
  });

  return router;
};

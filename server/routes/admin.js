const express = require('express');
const { AppError } = require('../errors');
const { getSettings, setSettings } = require('../db');
const { requireAuth, normalizePhone, hashPassword, verifyPassword } = require('../auth');
const { KINDS } = require('../docs');
const { validCoord, completeRoute } = require('../geo');
const { calcPrice } = require('../pricing');
const { ACTIVE } = require('../rides');
const { localDay, dayRange, isDay, shiftDay } = require('../time');

// Rotas da central.
module.exports = function adminRoutes({ db, rides, dispatch, drivers, geo, docs, finance, audit }) {
  const router = express.Router();
  router.use(requireAuth(db, 'admin'));

  const completedBetween = db.prepare(
    `SELECT r.id, r.price, r.commission, r.completed_at, r.driver_id, u.name AS driver_name
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

  // Números de cada motoqueiro: corridas concluídas, faturamento e nota média.
  router.get('/drivers/stats', (req, res) => {
    const rows = db
      .prepare(
        `SELECT driver_id AS id, COUNT(*) AS rides, COALESCE(SUM(price), 0) AS revenue,
                AVG(rating) AS rating, COUNT(rating) AS ratings, MAX(completed_at) AS last_ride
           FROM rides WHERE status = 'completed' AND driver_id IS NOT NULL GROUP BY driver_id`
      )
      .all();
    res.json({ stats: rows.map((r) => ({ ...r, rating: r.rating === null ? null : Math.round(r.rating * 10) / 10 })) });
  });

  router.get('/passengers', (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 40);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.created_at, u.blocked,
                (SELECT COUNT(*) FROM rides r WHERE r.passenger_id = u.id AND r.status = 'completed') AS rides,
                (SELECT COUNT(*) FROM rides r WHERE r.passenger_id = u.id AND r.status = 'cancelled') AS cancelled,
                (SELECT COALESCE(SUM(price), 0) FROM rides r WHERE r.passenger_id = u.id AND r.status = 'completed') AS spent,
                (SELECT MAX(created_at) FROM rides r WHERE r.passenger_id = u.id) AS last_ride
           FROM users u
          WHERE u.role = 'passenger' AND (u.name LIKE ? OR u.phone LIKE ?)
          ORDER BY u.id DESC LIMIT 300`
      )
      .all(like, like);
    const total = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'passenger'").get().n;
    res.json({ total, passengers: rows.map((r) => ({ ...r, blocked: !!r.blocked })) });
  });

  router.post('/passengers/:id/block', (req, res) => {
    const blocked = req.body && req.body.blocked ? 1 : 0;
    const info = db.prepare("UPDATE users SET blocked = ? WHERE id = ? AND role = 'passenger'").run(blocked, Number(req.params.id));
    if (info.changes !== 1) throw new AppError(404, 'Passageiro não encontrado');
    audit.log(req.user, blocked ? 'Passageiro bloqueado' : 'Passageiro desbloqueado', `#${Number(req.params.id)}`);
    res.json({ ok: true, blocked: !!blocked });
  });

  router.post('/drivers/:id/status', (req, res) => {
    const status = req.body && req.body.status;
    const id = Number(req.params.id);
    // Para aprovar, o cadastro precisa estar completo (a central pode desligar essa exigência nas configurações).
    if (status === 'approved' && getSettings(db).require_docs) {
      const missing = [];
      if (!docs.complete(id)) missing.push('os documentos');
      if (!finance.driverBank(id)) missing.push('a conta bancária');
      if (missing.length && drivers.get(id)) {
        throw new AppError(409, `Não dá para aprovar ainda: falta o motoqueiro enviar ${missing.join(' e ')}.`);
      }
    }
    const driver = drivers.setStatus(id, status);
    const names = { approved: 'aprovado', blocked: 'bloqueado', pending: 'voltou para análise' };
    audit.log(req.user, `Motoqueiro ${names[status] || status}`, driver.name);
    res.json({ driver });
  });

  // Ficha completa do motoqueiro: dados, conta, documentos e comissão em aberto.
  router.get('/drivers/:id', (req, res) => {
    const driver = drivers.get(req.params.id);
    if (!driver) throw new AppError(404, 'Motoqueiro não encontrado');
    res.json({
      driver,
      bank: finance.driverBank(driver.id),
      docs: docs.status(driver.id),
      labels: KINDS,
      owed: finance.owed(driver.id),
    });
  });

  router.get('/drivers/:id/documents/:kind', (req, res) => {
    const file = docs.read(req.params.id, req.params.kind);
    audit.log(req.user, 'Documento de motoqueiro visualizado', `${KINDS[req.params.kind] || req.params.kind} do motoqueiro #${Number(req.params.id)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.type(file.mime).send(file.data);
  });

  /* ----- Comissão e conta da central ----- */

  router.get('/settlements', (req, res) => res.json({ ...finance.overview(), central_ready: !!finance.centralBank() }));

  router.post('/settlements', (req, res) => {
    const body = req.body || {};
    res.status(201).json({ settlement: finance.settle(req.user, body.driver_id, body.note) });
  });

  router.get('/bank', (req, res) => res.json({ bank: finance.centralBank() }));

  router.put('/bank', (req, res) => {
    const body = req.body || {};
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(body.password, row.password_hash)) throw new AppError(401, 'Senha incorreta');
    res.json({ bank: finance.setCentral(req.user, body) });
  });

  router.get('/audit', (req, res) => res.json({ entries: audit.list(150) }));

  router.post('/rides/estimate', async (req, res) => {
    const { origin, dest } = req.body || {};
    if (!validCoord(origin) || !validCoord(dest)) throw new AppError(400, 'Informe partida e destino no mapa');
    const route = completeRoute(await geo.routeDistanceKm(origin, dest), origin, dest);
    res.json({
      distance_km: route.km,
      source: route.source,
      price: calcPrice(route.km, getSettings(db)),
      duration_min: route.min,
      route: route.points,
    });
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
    const route = completeRoute(await geo.routeDistanceKm(body.origin, body.dest), body.origin, body.dest);
    const ride = rides.createRide({
      passengerName: body.passenger_name,
      passengerPhone: phone,
      origin: body.origin,
      dest: body.dest,
      distanceKm: route.km,
      durationMin: route.min,
      route: route.points,
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

    // Usa a comissão gravada em cada corrida (a taxa pode ter mudado ao longo do tempo).
    const fee = (r) => (r.commission === null || r.commission === undefined ? commission(r.price) : r.commission);
    const byDriver = new Map();
    const byDay = new Map();
    let revenue = 0;
    let fees = 0;
    for (const r of done) {
      revenue += r.price;
      fees += fee(r);
      const d = byDriver.get(r.driver_id) || { driver_id: r.driver_id, name: r.driver_name || '—', rides: 0, revenue: 0, commission: 0 };
      d.rides += 1;
      d.revenue += r.price;
      d.commission += fee(r);
      byDriver.set(r.driver_id, d);
      const day = localDay(r.completed_at, tz);
      const e = byDay.get(day) || { day, rides: 0, revenue: 0 };
      e.rides += 1;
      e.revenue += r.price;
      byDay.set(day, e);
    }
    const cents = (n) => Math.round(n * 100) / 100;
    const cancelled = db
      .prepare("SELECT COUNT(*) AS n FROM rides WHERE status = 'cancelled' AND cancelled_at >= ? AND cancelled_at < ?")
      .get(from, to).n;

    res.json({
      from: fromDay,
      to: toDay,
      commission_percent: pct,
      totals: { rides: done.length, revenue, commission: cents(fees), cancelled },
      byDriver: [...byDriver.values()]
        .map((d) => ({ ...d, commission: cents(d.commission) }))
        .sort((a, b) => b.revenue - a.revenue),
      byDay: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    });
  });

  // Quem esqueceu a senha fala com a central, que define uma nova pelo telefone cadastrado.
  router.post('/users/password', (req, res) => {
    const { phone, password } = req.body || {};
    const clean = normalizePhone(phone);
    if (!clean) throw new AppError(400, 'Informe o telefone com DDD');
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      throw new AppError(400, 'A senha precisa ter pelo menos 6 caracteres');
    }
    const user = db.prepare('SELECT id, role, name FROM users WHERE phone = ?').get(clean);
    if (!user) throw new AppError(404, 'Nenhuma conta com este telefone');
    if (user.role === 'admin') throw new AppError(403, 'A senha da central é trocada em "Minha senha"');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
    audit.log(req.user, 'Senha de usuário redefinida', user.name);
    res.json({ ok: true, name: user.name, role: user.role });
  });

  router.get('/settings', (req, res) => res.json({ settings: getSettings(db) }));

  router.put('/settings', (req, res) => {
    setSettings(db, req.body || {});
    audit.log(req.user, 'Configurações alteradas', Object.keys(req.body || {}).slice(0, 12).join(', '));
    res.json({ settings: getSettings(db) });
  });

  return router;
};

const express = require('express');
const { AppError } = require('../errors');
const { getSettings } = require('../db');
const { requireAuth } = require('../auth');
const { calcPrice } = require('../pricing');
const { validCoord } = require('../geo');

// Rotas do passageiro.
module.exports = function rideRoutes({ db, rides, geo }) {
  const router = express.Router();
  router.use(requireAuth(db, 'passenger'));

  function points(body) {
    const origin = body && body.origin;
    const dest = body && body.dest;
    if (!validCoord(origin)) throw new AppError(400, 'Informe o local de partida no mapa');
    if (!validCoord(dest)) throw new AppError(400, 'Informe o destino no mapa');
    return { origin, dest };
  }

  // Só o dono enxerga a corrida; para os outros ela "não existe".
  function ownRide(req) {
    const ride = rides.getRide(req.params.id);
    if (!ride || ride.passenger_id !== req.user.id) throw new AppError(404, 'Corrida não encontrada');
    return ride;
  }

  router.post('/estimate', async (req, res) => {
    const { origin, dest } = points(req.body);
    const route = await geo.routeDistanceKm(origin, dest);
    res.json({ distance_km: route.km, source: route.source, price: calcPrice(route.km, getSettings(db)) });
  });

  router.post('/', async (req, res) => {
    const { origin, dest } = points(req.body);
    const route = await geo.routeDistanceKm(origin, dest);
    const ride = rides.createRide({
      passengerId: req.user.id,
      passengerName: req.user.name,
      passengerPhone: req.user.phone,
      origin,
      dest,
      distanceKm: route.km,
      payment: req.body.payment,
      notes: req.body.notes,
      source: 'app',
    });
    res.status(201).json({ ride });
  });

  router.get('/active', (req, res) => res.json({ ride: rides.activeRideFor(req.user) }));

  router.get('/history', (req, res) => res.json({ rides: rides.list({ passengerId: req.user.id, limit: 30 }) }));

  router.get('/:id', (req, res) => res.json({ ride: ownRide(req) }));

  router.post('/:id/cancel', (req, res) => {
    ownRide(req);
    res.json({ ride: rides.act(req.params.id, 'cancel', req.user, req.body && req.body.reason) });
  });

  router.post('/:id/rate', (req, res) => {
    ownRide(req);
    res.json({ ride: rides.rate(req.params.id, req.user.id, req.body && req.body.rating) });
  });

  return router;
};

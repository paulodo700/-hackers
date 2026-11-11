const express = require('express');
const { AppError } = require('../errors');
const { getSettings } = require('../db');
const { requireAuth } = require('../auth');
const { validCoord } = require('../geo');

module.exports = function geoRoutes({ db, geo }) {
  const router = express.Router();
  router.use(requireAuth(db));

  router.get('/search', async (req, res) => {
    const settings = getSettings(db);
    const near = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    const center = validCoord(near) && req.query.lat !== undefined
      ? near
      : { lat: settings.city_lat, lng: settings.city_lng };
    res.json({ results: await geo.searchAddress(req.query.q, center) });
  });

  router.get('/reverse', async (req, res) => {
    const p = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    if (!validCoord(p)) throw new AppError(400, 'Localização inválida');
    res.json({ label: await geo.reverseAddress(p.lat, p.lng) });
  });

  return router;
};

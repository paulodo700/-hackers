const express = require('express');
const { AppError } = require('../errors');
const { getSettings } = require('../db');
const { requireAuth } = require('../auth');
const { validCoord } = require('../geo');
const { createLimiter } = require('../limit');

module.exports = function geoRoutes({ db, geo, places }) {
  const router = express.Router();
  router.use(requireAuth(db));
  router.use(createLimiter({ windowMs: 60 * 1000, max: 60 }));

  router.get('/search', async (req, res) => {
    const settings = getSettings(db);
    const near = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    const center = validCoord(near) && req.query.lat !== undefined
      ? near
      : { lat: settings.city_lat, lng: settings.city_lng };
    // Primeiro os locais que a cidade já conhece (exatos), depois o mapa.
    const known = places.search(req.query.q, 4).map((p) => ({ label: p.name, lat: p.lat, lng: p.lng, approx: false, known: true }));
    const fromMap = await geo.searchAddress(req.query.q, center);
    const seen = new Set(known.map((k) => k.label.toLowerCase()));
    res.json({ results: [...known, ...fromMap.filter((r) => !seen.has(r.label.toLowerCase()))].slice(0, 7) });
  });

  router.get('/reverse', async (req, res) => {
    const p = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    if (!validCoord(p)) throw new AppError(400, 'Localização inválida');
    res.json({ label: await geo.reverseAddress(p.lat, p.lng) });
  });

  return router;
};

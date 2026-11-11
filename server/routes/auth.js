const express = require('express');
const { AppError } = require('../errors');
const auth = require('../auth');

const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function publicUser(u) {
  return { id: u.id, role: u.role, name: u.name, phone: u.phone };
}

module.exports = function authRoutes({ db }) {
  const router = express.Router();
  const fails = new Map(); // ip -> { count, resetAt }

  function failState(ip) {
    const now = Date.now();
    let entry = fails.get(ip);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      fails.set(ip, entry);
    }
    return entry;
  }

  router.post('/register', (req, res) => {
    const { name, phone, password, role, plate, moto_model } = req.body || {};
    if (role !== 'passenger' && role !== 'driver') throw new AppError(400, 'Tipo de cadastro inválido');
    const cleanName = String(name || '').trim().slice(0, 60);
    if (cleanName.length < 2) throw new AppError(400, 'Informe seu nome');
    const cleanPhone = auth.normalizePhone(phone);
    if (!cleanPhone) throw new AppError(400, 'Informe o telefone com DDD');
    if (typeof password !== 'string' || password.length < 6) {
      throw new AppError(400, 'A senha precisa ter pelo menos 6 caracteres');
    }
    if (password.length > 72) throw new AppError(400, 'Senha muito longa');
    const cleanPlate = String(plate || '').trim().toUpperCase().slice(0, 10);
    const cleanModel = String(moto_model || '').trim().slice(0, 40);
    if (role === 'driver' && (!cleanPlate || !cleanModel)) {
      throw new AppError(400, 'Informe a placa e o modelo da moto');
    }
    if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(cleanPhone)) {
      throw new AppError(409, 'Este telefone já está cadastrado. Faça login.');
    }
    const id = db.transaction(() => {
      const info = db
        .prepare('INSERT INTO users (role, name, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(role, cleanName, cleanPhone, auth.hashPassword(password), new Date().toISOString());
      if (role === 'driver') {
        db.prepare('INSERT INTO drivers (user_id, plate, moto_model) VALUES (?, ?, ?)').run(
          info.lastInsertRowid,
          cleanPlate,
          cleanModel
        );
      }
      return Number(info.lastInsertRowid);
    })();
    const user = { id, role, name: cleanName, phone: cleanPhone };
    res.status(201).json({ token: auth.signToken(user), user });
  });

  router.post('/login', (req, res) => {
    const entry = failState(req.ip);
    if (entry.count >= MAX_FAILS) {
      throw new AppError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    }
    const { phone, password } = req.body || {};
    const cleanPhone = auth.normalizePhone(phone);
    const row = cleanPhone ? db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone) : null;
    if (!row || !auth.verifyPassword(password, row.password_hash)) {
      entry.count += 1;
      throw new AppError(401, 'Telefone ou senha incorretos');
    }
    res.json({ token: auth.signToken(row), user: publicUser(row) });
  });

  router.get('/me', auth.requireAuth(db), (req, res) => {
    const out = { user: req.user };
    if (req.user.role === 'driver') {
      out.driver = db
        .prepare('SELECT plate, moto_model, status, online FROM drivers WHERE user_id = ?')
        .get(req.user.id);
    }
    res.json(out);
  });

  return router;
};

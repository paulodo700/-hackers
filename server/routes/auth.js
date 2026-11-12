const express = require('express');
const { AppError } = require('../errors');
const auth = require('../auth');

const { createLimiter } = require('../limit');
const { normalizePhone } = require('../auth');

function publicUser(u) {
  return { id: u.id, role: u.role, name: u.name, phone: u.phone };
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw new AppError(400, 'A senha precisa ter pelo menos 6 caracteres');
  }
  if (password.length > 72) throw new AppError(400, 'Senha muito longa');
}

module.exports = function authRoutes({ db }) {
  const router = express.Router();
  // 10 senhas erradas em 15 minutos travam o endereço; 20 cadastros por hora por endereço.
  const loginFails = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const registerLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: 'Muitos cadastros deste endereço. Tente mais tarde.' });

  router.post('/register', registerLimit, (req, res) => {
    const { name, phone, password, role, plate, moto_model } = req.body || {};
    if (role !== 'passenger' && role !== 'driver') throw new AppError(400, 'Tipo de cadastro inválido');
    const cleanName = String(name || '').trim().slice(0, 60);
    if (cleanName.length < 2) throw new AppError(400, 'Informe seu nome');
    const cleanPhone = auth.normalizePhone(phone);
    if (!cleanPhone) throw new AppError(400, 'Informe o telefone com DDD');
    checkPassword(password);
    const cleanPlate = String(plate || '').trim().toUpperCase().slice(0, 10);
    const cleanModel = String(moto_model || '').trim().slice(0, 40);
    if (role === 'driver' && (!cleanPlate || !cleanModel)) {
      throw new AppError(400, 'Informe a placa e o modelo da moto');
    }
    if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(cleanPhone)) {
      throw new AppError(409, 'Este telefone já está cadastrado. Faça login.');
    }
    const password_hash = auth.hashPassword(password);
    const id = db.transaction(() => {
      const info = db
        .prepare('INSERT INTO users (role, name, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(role, cleanName, cleanPhone, password_hash, new Date().toISOString());
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
    res.status(201).json({ token: auth.signToken({ ...user, password_hash }), user });
  });

  router.post('/login', (req, res) => {
    if (loginFails.blocked(req.ip)) {
      throw new AppError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    }
    const { phone, password } = req.body || {};
    const cleanPhone = auth.normalizePhone(phone);
    const row = cleanPhone ? db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone) : null;
    if (!row || !auth.verifyPassword(password, row.password_hash)) {
      loginFails.fail(req.ip);
      throw new AppError(401, 'Telefone ou senha incorretos');
    }
    res.json({ token: auth.signToken(row), user: publicUser(row) });
  });

  // Trocar a própria senha. Os logins antigos (outros aparelhos) deixam de valer.
  router.post('/password', auth.requireAuth(db), (req, res) => {
    const { current, password } = req.body || {};
    if (loginFails.blocked(req.ip)) throw new AppError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!auth.verifyPassword(current, row.password_hash)) {
      loginFails.fail(req.ip);
      throw new AppError(401, 'A senha atual está incorreta');
    }
    checkPassword(password);
    const password_hash = auth.hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, row.id);
    res.json({ token: auth.signToken({ ...row, password_hash }), user: publicUser(row) });
  });

  // Corrigir o próprio nome.
  // Dados do próprio perfil: nome, e-mail, contato de emergência e, para o motorista, moto e CNH.
  router.put('/profile', auth.requireAuth(db), (req, res) => {
    const body = req.body || {};
    const name = String(body.name ?? req.user.name).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name.length < 2) throw new AppError(400, 'Informe seu nome');
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 80);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'E-mail inválido');
    const emergencyName = String(body.emergency_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const emergencyPhone = String(body.emergency_phone ?? '').trim();
    let emergencyDigits = '';
    if (emergencyPhone) {
      emergencyDigits = normalizePhone(emergencyPhone) || '';
      if (!emergencyDigits) throw new AppError(400, 'Telefone de emergência inválido (use DDD + número)');
    }
    if (!emergencyName !== !emergencyDigits) throw new AppError(400, 'Preencha o nome e o telefone do contato de emergência');
    db.transaction(() => {
      db.prepare('UPDATE users SET name = ?, email = ?, emergency_name = ?, emergency_phone = ? WHERE id = ?').run(name, email, emergencyName, emergencyDigits, req.user.id);
      if (req.user.role === 'driver') {
        const plate = String(body.plate ?? '').trim().toUpperCase().slice(0, 10);
        const model = String(body.moto_model ?? '').trim().slice(0, 40);
        const cnh = String(body.cnh_expires ?? '').trim();
        if (cnh && !/^\d{4}-\d{2}-\d{2}$/.test(cnh)) throw new AppError(400, 'Validade da CNH inválida');
        if (plate && model) db.prepare('UPDATE drivers SET plate = ?, moto_model = ?, cnh_expires = ? WHERE user_id = ?').run(plate, model, cnh, req.user.id);
        else if (cnh !== undefined) db.prepare('UPDATE drivers SET cnh_expires = ? WHERE user_id = ?').run(cnh, req.user.id);
      }
    })();
    res.json({ user: { ...req.user, name, email, emergency_name: emergencyName, emergency_phone: emergencyDigits } });
  });

  router.get('/me', auth.requireAuth(db), (req, res) => {
    const full = db.prepare('SELECT email, emergency_name, emergency_phone FROM users WHERE id = ?').get(req.user.id);
    const out = { user: { ...req.user, ...full } };
    if (req.user.role === 'driver') {
      out.driver = db
        .prepare('SELECT plate, moto_model, status, online, cnh_expires FROM drivers WHERE user_id = ?')
        .get(req.user.id);
    }
    res.json(out);
  });

  return router;
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { AppError } = require('./errors');

// Deixa só os dígitos e tira o 55 do Brasil. Válido com DDD: 10 ou 11 dígitos.
function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 11) digits = digits.replace(/^0+/, '');
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

const hashPassword = (password) => bcrypt.hashSync(password, 10);
const verifyPassword = (password, hash) => bcrypt.compareSync(String(password ?? ''), hash);

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    const { id, role } = jwt.verify(String(token || ''), config.jwtSecret);
    return { id, role };
  } catch {
    return null;
  }
}

// Confere o token e busca o usuário no banco (assim conta apagada ou papel trocado valem na hora).
function userFromToken(db, token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = db.prepare('SELECT id, role, name, phone FROM users WHERE id = ?').get(payload.id);
  return user && user.role === payload.role ? user : null;
}

function requireAuth(db, ...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const user = userFromToken(db, header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!user) return next(new AppError(401, 'Faça login para continuar'));
    if (roles.length && !roles.includes(user.role)) {
      return next(new AppError(403, 'Você não tem permissão para isso'));
    }
    req.user = user;
    next();
  };
}

// Cria o primeiro acesso da central, se ainda não existir nenhum admin.
function ensureAdmin(db, { phone, password }) {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return 'exists';
  const normalized = normalizePhone(phone);
  // A senha de exemplo do .env.example não vale: precisa ser trocada.
  if (!normalized || String(password || '').length < 6 || password === 'troque-esta-senha') return 'missing';
  db.prepare(
    "INSERT INTO users (role, name, phone, password_hash, created_at) VALUES ('admin', 'Central', ?, ?, ?)"
  ).run(normalized, hashPassword(password), new Date().toISOString());
  return 'created';
}

module.exports = {
  normalizePhone,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  userFromToken,
  requireAuth,
  ensureAdmin,
};

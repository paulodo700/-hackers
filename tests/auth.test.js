const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../server/db');
const auth = require('../server/auth');

test('acesso inicial da central: exige telefone e senha de verdade, cria uma vez só', () => {
  const db = openDb(':memory:');
  assert.equal(auth.ensureAdmin(db, { phone: '', password: '' }), 'missing');
  assert.equal(auth.ensureAdmin(db, { phone: '11999990000', password: '12345' }), 'missing');
  assert.equal(auth.ensureAdmin(db, { phone: '11999990000', password: 'troque-esta-senha' }), 'missing');
  assert.equal(auth.ensureAdmin(db, { phone: '(11) 99999-0000', password: 'senha-forte-1' }), 'created');
  assert.equal(auth.ensureAdmin(db, { phone: '11888880000', password: 'outra-senha' }), 'exists');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin'").get().n, 1);
});

test('token: válido só com a assinatura certa e para usuário existente', () => {
  const db = openDb(':memory:');
  auth.ensureAdmin(db, { phone: '11999990000', password: 'senha-forte-1' });
  const admin = db.prepare('SELECT * FROM users').get();
  const token = auth.signToken(admin);
  assert.equal(auth.userFromToken(db, token).role, 'admin');
  assert.equal(auth.userFromToken(db, token + 'x'), null);
  assert.equal(auth.userFromToken(db, ''), null);
  const forged = require('jsonwebtoken').sign({ id: admin.id, role: 'admin' }, 'segredo-apenas-para-desenvolvimento');
  assert.equal(auth.userFromToken(db, forged), null);
  db.prepare('DELETE FROM users').run();
  assert.equal(auth.userFromToken(db, token), null);
  assert.equal(auth.verifyPassword('senha-forte-1', admin.password_hash), true);
  assert.equal(auth.verifyPassword('errada', admin.password_hash), false);
});

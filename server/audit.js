// Registro de atividades sensíveis: quem fez o quê e quando.
function createAudit({ db }) {
  const insert = db.prepare('INSERT INTO audit_log (at, user_id, user_name, action, detail) VALUES (?, ?, ?, ?, ?)');
  return {
    log(user, action, detail = '') {
      insert.run(new Date().toISOString(), user ? user.id : null, user ? user.name : '', action, String(detail).slice(0, 200));
    },
    list(limit = 100) {
      return db.prepare('SELECT at, user_name, action, detail FROM audit_log ORDER BY id DESC LIMIT ?').all(limit);
    },
  };
}

module.exports = { createAudit };

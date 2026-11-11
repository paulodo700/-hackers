// Documentos do motoqueiro (CNH, documento da moto e selfie). Ficam fora da pasta pública:
// só o próprio motoqueiro envia e só a central consegue ver.
const fs = require('node:fs');
const path = require('node:path');
const { AppError } = require('./errors');

const KINDS = {
  cnh: 'CNH (frente)',
  crlv: 'Documento da moto',
  selfie: 'Selfie segurando a CNH',
};
const MAX_BYTES = 6 * 1024 * 1024;

// Confere pelo conteúdo (e não pelo nome) se é mesmo uma imagem.
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

function createDocs({ db, dir }) {
  const folder = (userId) => path.join(dir, String(Number(userId)));

  function save(userId, kind, buf) {
    if (!KINDS[kind]) throw new AppError(404, 'Tipo de documento desconhecido');
    if (!Buffer.isBuffer(buf) || buf.length < 100) throw new AppError(400, 'Envie uma foto');
    if (buf.length > MAX_BYTES) throw new AppError(413, 'Foto grande demais');
    const type = sniff(buf);
    if (!type) throw new AppError(400, 'O arquivo precisa ser uma foto (JPG, PNG ou WEBP)');
    fs.mkdirSync(folder(userId), { recursive: true, mode: 0o700 });
    const old = db.prepare('SELECT file FROM driver_docs WHERE user_id = ? AND kind = ?').get(userId, kind);
    const file = `${kind}.${type.ext}`;
    if (old && old.file !== file) fs.rmSync(path.join(folder(userId), old.file), { force: true });
    fs.writeFileSync(path.join(folder(userId), file), buf, { mode: 0o600 });
    db.prepare(
      `INSERT INTO driver_docs (user_id, kind, file, mime, size, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, kind) DO UPDATE SET file = excluded.file, mime = excluded.mime, size = excluded.size, uploaded_at = excluded.uploaded_at`
    ).run(userId, kind, file, type.mime, buf.length, new Date().toISOString());
  }

  // { cnh: '2026-…' | null, crlv: …, selfie: … }
  function status(userId) {
    const rows = db.prepare('SELECT kind, uploaded_at FROM driver_docs WHERE user_id = ?').all(userId);
    const out = Object.fromEntries(Object.keys(KINDS).map((k) => [k, null]));
    for (const r of rows) if (r.kind in out) out[r.kind] = r.uploaded_at;
    return out;
  }

  const complete = (userId) => Object.values(status(userId)).every(Boolean);

  function read(userId, kind) {
    const row = db.prepare('SELECT file, mime FROM driver_docs WHERE user_id = ? AND kind = ?').get(Number(userId), kind);
    if (!row) throw new AppError(404, 'Documento não enviado');
    const full = path.join(folder(userId), path.basename(row.file));
    if (!fs.existsSync(full)) throw new AppError(404, 'Documento não encontrado');
    return { mime: row.mime, data: fs.readFileSync(full) };
  }

  return { save, status, complete, read };
}

module.exports = { createDocs, KINDS, MAX_BYTES };

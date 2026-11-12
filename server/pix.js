// Pix: validação de chaves e documentos, e geração do "Pix copia e cola" (BR Code) com QR Code.
// Não movimenta dinheiro: só monta o código que qualquer aplicativo de banco lê.
const QRCode = require('qrcode');
const { AppError } = require('./errors');

const PIX_TYPES = ['cpf', 'cnpj', 'telefone', 'email', 'aleatoria'];

const digits = (v) => String(v ?? '').replace(/\D/g, '');

function validCpf(raw) {
  const d = digits(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return (r === 10 ? 0 : r) === Number(d[len]);
  };
  return check(9) && check(10);
}

function validCnpj(raw) {
  const d = digits(raw);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const r = sum % 11;
    return (r < 2 ? 0 : 11 - r) === Number(d[len]);
  };
  return check(12) && check(13);
}

// CPF ou CNPJ do titular: devolve só os dígitos, ou lança erro.
function normalizeDoc(raw) {
  const d = digits(raw);
  if (validCpf(d) || validCnpj(d)) return d;
  throw new AppError(400, 'CPF ou CNPJ do titular inválido');
}

// Deixa a chave no formato que os bancos esperam.
function normalizeKey(type, raw) {
  const v = String(raw ?? '').trim();
  if (type === 'cpf') {
    if (!validCpf(v)) throw new AppError(400, 'Chave Pix inválida: confira o CPF');
    return digits(v);
  }
  if (type === 'cnpj') {
    if (!validCnpj(v)) throw new AppError(400, 'Chave Pix inválida: confira o CNPJ');
    return digits(v);
  }
  if (type === 'telefone') {
    let d = digits(v);
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    if (d.length !== 10 && d.length !== 11) throw new AppError(400, 'Chave Pix inválida: use o telefone com DDD');
    return `+55${d}`;
  }
  if (type === 'email') {
    const e = v.toLowerCase();
    if (e.length > 77 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AppError(400, 'Chave Pix inválida: confira o e-mail');
    return e;
  }
  if (type === 'aleatoria') {
    const k = v.toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k)) {
      throw new AppError(400, 'Chave Pix aleatória inválida: copie a chave completa do aplicativo do banco');
    }
    return k;
  }
  throw new AppError(400, 'Tipo de chave Pix inválido');
}

// Valida e limpa um conjunto de dados bancários.
function cleanBank(input) {
  const holder_name = String((input && input.holder_name) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (holder_name.length < 3) throw new AppError(400, 'Informe o nome completo do titular da conta');
  const pix_type = input && input.pix_type;
  if (!PIX_TYPES.includes(pix_type)) throw new AppError(400, 'Escolha o tipo da chave Pix');
  return {
    holder_name,
    holder_doc: normalizeDoc(input.holder_doc),
    bank_name: String(input.bank_name || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    pix_type,
    pix_key: normalizeKey(pix_type, input.pix_key),
  };
}

// CRC16-CCITT (o mesmo que os bancos conferem no fim do código Pix).
function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// Texto aceito no código: sem acentos nem símbolos.
function plain(text, max, fallback) {
  const out = String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
  return out || fallback;
}

// Monta o "Pix copia e cola" com valor fixo.
function pixCode({ key, name, city, amount, txid }) {
  if (!key) throw new AppError(409, 'Chave Pix não cadastrada');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new AppError(400, 'Valor inválido para o Pix');
  const id = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') +
    field('54', amount.toFixed(2)) +
    field('58', 'BR') +
    field('59', plain(name, 25, 'RECEBEDOR')) +
    field('60', plain(city, 15, 'BRASIL')) +
    field('62', field('05', id)) +
    '6304';
  return body + crc16(body);
}

// Código + QR Code (SVG) prontos para a tela.
async function pixCharge(info) {
  const code = pixCode(info);
  const qr = await QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { code, qr, amount: Math.round(info.amount * 100) / 100, holder: String(info.name || '') };
}

// Mostra só o fim de um documento: ***.***.***-12
function maskDoc(doc) {
  const d = digits(doc);
  return d.length >= 4 ? `${'•'.repeat(d.length - 2)}${d.slice(-2)}` : '';
}

module.exports = { PIX_TYPES, validCpf, validCnpj, normalizeDoc, normalizeKey, cleanBank, crc16, pixCode, pixCharge, maskDoc };

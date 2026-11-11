const test = require('node:test');
const assert = require('node:assert/strict');
const pix = require('../server/pix');

const status = (fn) => {
  try { fn(); } catch (err) { return err.status; }
  return 'sem erro';
};

test('CPF e CNPJ: confere os dígitos verificadores', () => {
  assert.equal(pix.validCpf('529.982.247-25'), true);
  assert.equal(pix.validCpf('52998224725'), true);
  assert.equal(pix.validCpf('529.982.247-26'), false);
  assert.equal(pix.validCpf('111.111.111-11'), false);
  assert.equal(pix.validCpf('123'), false);
  assert.equal(pix.validCnpj('11.222.333/0001-81'), true);
  assert.equal(pix.validCnpj('11.222.333/0001-82'), false);
  assert.equal(pix.validCnpj('00000000000000'), false);
});

test('chave Pix: cada tipo é validado e padronizado', () => {
  assert.equal(pix.normalizeKey('cpf', '529.982.247-25'), '52998224725');
  assert.equal(pix.normalizeKey('cnpj', '11.222.333/0001-81'), '11222333000181');
  assert.equal(pix.normalizeKey('telefone', '(63) 99999-0000'), '+5563999990000');
  assert.equal(pix.normalizeKey('telefone', '+55 63 99999-0000'), '+5563999990000');
  assert.equal(pix.normalizeKey('email', ' Joao@Email.com '), 'joao@email.com');
  assert.equal(pix.normalizeKey('aleatoria', '123E4567-E89B-12D3-A456-426614174000'), '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(status(() => pix.normalizeKey('cpf', '123.456.789-00')), 400);
  assert.equal(status(() => pix.normalizeKey('telefone', '99999')), 400);
  assert.equal(status(() => pix.normalizeKey('email', 'sem-arroba')), 400);
  assert.equal(status(() => pix.normalizeKey('aleatoria', 'abc')), 400);
  assert.equal(status(() => pix.normalizeKey('boleto', 'x')), 400);
});

test('dados bancários: limpa, valida titular e chave', () => {
  const ok = pix.cleanBank({ holder_name: '  João   da Silva ', holder_doc: '529.982.247-25', bank_name: ' Nubank ', pix_type: 'telefone', pix_key: '63 99999-0000' });
  assert.deepEqual(ok, { holder_name: 'João da Silva', holder_doc: '52998224725', bank_name: 'Nubank', pix_type: 'telefone', pix_key: '+5563999990000' });
  const bad = (extra) => status(() => pix.cleanBank({ holder_name: 'João da Silva', holder_doc: '52998224725', pix_type: 'cpf', pix_key: '52998224725', ...extra }));
  assert.equal(bad({}), 'sem erro');
  assert.equal(bad({ holder_name: 'Jo' }), 400);
  assert.equal(bad({ holder_doc: '11111111111' }), 400);
  assert.equal(bad({ pix_type: 'outro' }), 400);
  assert.equal(bad({ pix_key: '000' }), 400);
});

test('CRC16 bate com o valor de referência do padrão', () => {
  assert.equal(pix.crc16('123456789'), '29B1');
});

test('Pix copia e cola: estrutura, valor, nome sem acento e conferência final', () => {
  const code = pix.pixCode({ key: '+5563999990000', name: 'João da Sílva Conceição Albuquerque', city: 'São José do Xingu', amount: 7.5, txid: 'CORRIDA-12' });
  assert.ok(code.startsWith('000201'));
  assert.ok(code.includes('0014br.gov.bcb.pix0114+5563999990000'));
  assert.ok(code.includes('52040000'));
  assert.ok(code.includes('5303986'));
  assert.ok(code.includes('54047.50'));
  assert.ok(code.includes('5802BR'));
  assert.ok(code.includes('5925JOAO DA SILVA CONCEICAO A'));
  assert.ok(code.includes('6015SAO JOSE DO XIN'));
  assert.ok(code.includes('0509CORRIDA12'));
  // Os 4 últimos caracteres conferem com o restante do código.
  assert.equal(code.slice(-4), pix.crc16(code.slice(0, -4)));
  assert.match(code.slice(-8, -4), /^6304$/);

  assert.ok(pix.pixCode({ key: 'a@b.co', name: '', city: '', amount: 10 }).includes('5909RECEBEDOR'));
  assert.equal(status(() => pix.pixCode({ key: '', name: 'x', city: 'y', amount: 5 })), 409);
  assert.equal(status(() => pix.pixCode({ key: 'a@b.co', name: 'x', city: 'y', amount: 0 })), 400);
  assert.equal(status(() => pix.pixCode({ key: 'a@b.co', name: 'x', city: 'y', amount: NaN })), 400);
});

test('QR Code é gerado como imagem SVG', async () => {
  const charge = await pix.pixCharge({ key: 'a@b.co', name: 'Maria', city: 'Palmas', amount: 12.345 });
  assert.ok(charge.qr.includes('<svg'));
  assert.equal(charge.amount, 12.35);
  assert.equal(charge.code.slice(-4), pix.crc16(charge.code.slice(0, -4)));
  assert.equal(pix.maskDoc('52998224725'), '•••••••••25');
});

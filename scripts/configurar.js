// Configuração inicial: pergunta o telefone e a senha da central e grava o arquivo .env.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { normalizePhone } = require('../server/auth');

const envFile = path.join(__dirname, '..', '.env');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Lê linha a linha (funciona tanto digitando quanto recebendo as respostas de um arquivo).
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (question) => {
    process.stdout.write(question);
    const { value, done } = await lines.next();
    if (done) throw new Error('Entrada encerrada antes do fim.');
    return String(value).trim();
  };

  try {
    if (fs.existsSync(envFile)) {
      const again = await ask('Ja existe uma configuracao (.env). Refazer? (s/N): ');
      if (again.toLowerCase() !== 's') {
        console.log('Mantida a configuracao atual.');
        return;
      }
    }

    console.log('\n=== Acesso da central ===');
    let phone = null;
    while (!phone) {
      phone = normalizePhone(await ask('Telefone da central com DDD (so numeros): '));
      if (!phone) console.log('  Telefone invalido. Exemplo: 63999990000');
    }
    let password = '';
    while (password.length < 6 || /\s/.test(password) || password === 'troque-esta-senha') {
      password = await ask('Senha da central (minimo 6 caracteres, sem espacos): ');
      if (password.length < 6 || /\s/.test(password)) console.log('  Senha invalida. Use pelo menos 6 caracteres, sem espacos.');
    }

    const content = [
      '# Criado por scripts/configurar.js. Nao publique este arquivo.',
      'PORT=3000',
      `ADMIN_PHONE=${phone}`,
      `ADMIN_PASSWORD=${password}`,
      '# O acesso de fora chega por um tunel/proxy, que repassa o IP de quem acessa.',
      'TRUST_PROXY=1',
      '',
    ].join('\n');
    fs.writeFileSync(envFile, content, { mode: 0o600 });

    console.log('\nPronto! Configuracao salva.');
    console.log(`  Telefone da central: ${phone}`);
    console.log('  Anote a senha em lugar seguro: ainda nao existe "esqueci minha senha".');
    console.log('  Obs.: se o banco de dados ja existia, o acesso antigo da central continua valendo.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});

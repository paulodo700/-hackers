// Teste de ponta a ponta no navegador: passageiro, motoqueiro e central ao mesmo tempo.
// Uso: node tests/e2e.cjs [pasta-para-capturas]   (precisa do Playwright instalado)
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const shots = process.argv[2] || path.join(tmpdir(), 'mototaxi-e2e');
mkdirSync(shots, { recursive: true });

const server = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: path.join(mkdtempSync(path.join(tmpdir(), 'mototaxi-')), 'e2e.db'),
    JWT_SECRET: 'segredo-do-teste',
    ADMIN_PHONE: '11900000000',
    ADMIN_PASSWORD: 'central123',
    // Sem internet no teste: o cálculo de rota cai na estimativa e a busca de endereço fica vazia.
    OSRM_URL: 'http://127.0.0.1:9',
    NOMINATIM_URL: 'http://127.0.0.1:9',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('rodando') && resolve());
  server.on('exit', (code) => reject(new Error(`servidor saiu com código ${code}`)));
});

const browser = await chromium.launch();
const errors = [];
let failed = false;

async function open(name, url, options) {
  // Sem animações (capturas nítidas) e, com E2E_ESCURO=1, no tema escuro.
  const ctx = await browser.newContext({
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    colorScheme: process.env.E2E_ESCURO ? 'dark' : 'light',
    ...options,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    // Mapa (imagens) e serviços externos ficam fora do ar no teste; isso não é erro do app.
    if (m.type() === 'error' && !/tile\.openstreetmap|Failed to load resource/.test(m.text() + m.location().url)) {
      errors.push(`${name}: ${m.text()}`);
    }
  });
  await page.goto(BASE + url);
  return page;
}
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'] };
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) });
const see = (page, text) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
const tap = (page, name) => page.getByRole('button', { name, exact: true }).click();
async function clickMap(page, dx, dy) {
  const box = await page.locator('.mapa').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}

try {
  const home = await open('inicio', '/', phone);
  // O endereço principal abre direto o passageiro, sem mostrar as outras telas.
  await see(home, 'Peça sua moto em poucos toques');
  if (!home.url().endsWith('/passageiro/')) throw new Error('A raiz deveria abrir a tela do passageiro');
  if (await home.getByText(/central|motoqueiro/i).count()) throw new Error('A tela do passageiro cita as outras telas');
  await shot(home, '01-inicio');

  // Motoqueiro se cadastra e fica aguardando aprovação.
  const moto = await open('motoqueiro', '/motoqueiro/', { ...phone, geolocation: { latitude: -10.001, longitude: -48.001 } });
  await tap(moto, 'Não tem conta? Criar agora');
  await moto.getByLabel('Seu nome').fill('João da Moto');
  await moto.getByLabel('Telefone com DDD').fill('(11) 95555-4444');
  await moto.getByLabel('Modelo da moto').fill('CG 160');
  await moto.getByLabel('Placa').fill('abc1d23');
  await moto.getByLabel('Crie uma senha').fill('123456');
  await tap(moto, 'Criar conta');
  await see(moto, 'Cadastro em análise');
  await shot(moto, '02-motoqueiro-aguardando');

  // Central entra e aprova.
  const central = await open('central', '/central/', { viewport: { width: 1280, height: 820 }, permissions: ['geolocation'], geolocation: { latitude: -10, longitude: -48 } });
  await central.getByLabel('Telefone com DDD').fill('11900000000');
  await central.getByLabel('Senha').fill('central123');
  await tap(central, 'Entrar');
  await see(central, 'Corridas em andamento');
  await central.getByRole('button', { name: /Configurações/ }).click();
  await see(central, 'Preço da corrida');
  await central.getByLabel('Nome da cidade').fill('Vila Bela');
  await tap(central, 'Usar minha localização');
  await see(central, 'Centro marcado: -10.00000');
  await tap(central, 'Salvar configurações');
  await see(central, 'Configurações salvas');
  await shot(central, '03-central-configuracoes');

  // Personalização: nome, frase, aviso e chave Pix definidos pela central.
  await central.getByRole('button', { name: /Personalizar/ }).click();
  await central.getByLabel('Nome do serviço').fill('Moto Já');
  await central.getByLabel(/Frase de apresentação/).fill('A moto mais rápida da cidade');
  await central.getByLabel(/Aviso para os passageiros/).fill('Atendemos das 6h às 23h');
  await central.getByLabel(/Telefone\/WhatsApp da central/).fill('(11) 90000-0000');
  await central.getByLabel(/Chave Pix/).fill('pix@motoja.com');
  await central.getByRole('button', { name: 'Usar a cor #0a7cff' }).click();
  await tap(central, 'Salvar personalização');
  await see(central, 'Personalização salva');
  await shot(central, '03b-central-personalizar');
  await central.getByRole('button', { name: /Motoqueiros/ }).click();
  await see(central, 'João da Moto');
  await tap(central, 'Aprovar');
  await central.locator('td .tag', { hasText: 'Aprovado' }).waitFor();
  await shot(central, '04-central-motoqueiros');

  // Motoqueiro é liberado sozinho e fica online.
  await see(moto, 'Você está offline');
  await tap(moto, 'Ficar online');
  await see(moto, 'Você está online');
  await shot(moto, '05-motoqueiro-online');

  // Passageiro se cadastra e pede.
  const pass = await open('passageiro', '/passageiro/', { ...phone, geolocation: { latitude: -10, longitude: -48 } });
  await see(pass, 'A moto mais rápida da cidade'); // frase e nome definidos pela central
  await see(pass, 'Moto Já');
  await tap(pass, 'Não tem conta? Criar agora');
  await see(pass, 'Termos de uso e a Política de privacidade');
  await pass.getByLabel('Seu nome').fill('Maria Silva <img src=x>'); // nome com HTML: deve aparecer como texto
  await pass.getByLabel('Telefone com DDD').fill('11988887777');
  await pass.getByLabel('Crie uma senha').fill('123456');
  await tap(pass, 'Criar conta');
  await see(pass, 'Para onde vamos?');
  await see(pass, 'Atendemos das 6h às 23h');
  await pass.waitForFunction(() => document.querySelector('.endereco input').value !== '');
  await clickMap(pass, 70, -60);
  await pass.getByRole('button', { name: /Pedir mototáxi · R\$/ }).waitFor({ timeout: 15000 });
  await pass.getByLabel('Observação para o motoqueiro').fill('portão azul');
  await shot(pass, '06-passageiro-preco');
  await pass.getByRole('button', { name: /Pedir mototáxi · R\$/ }).click();

  // Motoqueiro recebe a oferta e aceita.
  await see(moto, 'Aceitar corrida');
  await see(moto, 'portão azul');
  await shot(moto, '07-motoqueiro-oferta');
  await tap(moto, 'Aceitar corrida');
  await see(moto, 'Vá buscar o passageiro');
  await see(pass, 'Motoqueiro a caminho');
  await see(pass, 'ABC1D23');
  await shot(pass, '08-passageiro-a-caminho');
  await central.getByRole('button', { name: /Ao vivo/ }).click();
  await see(central, 'Maria Silva');
  await central.locator('.pin.origem').first().hover();
  await central.locator('.leaflet-tooltip').first().waitFor();
  if (await central.locator('img[src="x"]').count()) throw new Error('HTML do nome do passageiro foi interpretado no mapa da central');
  await shot(central, '09-central-ao-vivo');

  await tap(moto, 'Cheguei ao local');
  await see(pass, 'Seu motoqueiro chegou!');
  await tap(moto, 'Iniciar corrida');
  await see(pass, 'Em viagem');
  await shot(moto, '10-motoqueiro-em-viagem');
  await tap(moto, 'Finalizar corrida');
  await tap(moto, 'Finalizar');
  await see(moto, 'Receba do passageiro');
  await shot(moto, '11-motoqueiro-finalizada');
  await tap(moto, 'Pronto');
  await see(moto, 'Você está online');

  await see(pass, 'Você chegou!');
  await pass.getByRole('button', { name: '5 estrelas' }).click();
  await shot(pass, '12-passageiro-avaliar');
  await tap(pass, 'Enviar avaliação');
  await see(pass, 'Obrigado!');
  await tap(pass, 'Nova corrida');
  await see(pass, 'Para onde vamos?');
  // Menu lateral do passageiro.
  await tap(pass, 'Abrir menu');
  await pass.getByRole('button', { name: 'Meu perfil' }).waitFor();
  await pass.getByRole('button', { name: 'Falar com a central' }).waitFor();
  await pass.getByRole('link', { name: 'Termos e privacidade' }).waitFor();
  await shot(pass, '13a-passageiro-menu');
  await pass.getByRole('button', { name: 'Histórico' }).click();
  await see(pass, 'Concluída');
  await shot(pass, '13-passageiro-historico');
  // Perfil: corrigir o nome.
  await tap(pass, 'Abrir menu');
  await pass.getByRole('button', { name: 'Meu perfil' }).click();
  await pass.getByLabel('Seu nome').fill('Maria Souza');
  await tap(pass, 'Salvar nome');
  await see(pass, 'Nome atualizado');
  await shot(pass, '13b-passageiro-perfil');
  await tap(pass, 'Fechar');
  await see(pass, 'Olá, Maria');

  // Central lança uma corrida para quem ligou.
  await central.getByRole('button', { name: /Nova corrida/ }).click();
  await central.getByPlaceholder('Nome de quem vai na moto').fill('Dona Ana');
  await central.getByPlaceholder('(00) 00000-0000').fill('(11) 97777-0000');
  await clickMap(central, -40, 30);
  await clickMap(central, 90, -80);
  await central.locator('.preco strong', { hasText: 'R$' }).waitFor({ timeout: 15000 });
  await shot(central, '14-central-nova-corrida');
  await tap(central, 'Lançar corrida');
  await see(central, 'Dona Ana');

  await see(moto, 'Aceitar corrida');
  await tap(moto, 'Aceitar corrida');
  await see(moto, 'Dona Ana');
  await central.locator('.item .tag', { hasText: 'Motoqueiro a caminho' }).waitFor();
  await tap(moto, 'Cheguei ao local');
  await tap(moto, 'Iniciar corrida');
  await tap(moto, 'Finalizar corrida');
  await tap(moto, 'Finalizar');
  await tap(moto, 'Pronto');
  await tap(moto, 'Abrir menu');
  await shot(moto, '15a-motoqueiro-menu');
  await moto.getByRole('button', { name: 'Ganhos' }).click();
  await moto.locator('.pagina').getByText('2 corridas').first().waitFor();
  await shot(moto, '15-motoqueiro-ganhos');

  await central.getByRole('button', { name: /Relatórios/ }).click();
  await see(central, 'Comissão a pagar');
  await central.locator('.indicador', { hasText: 'Corridas concluídas' }).getByText('2', { exact: true }).waitFor();
  await shot(central, '16-central-relatorios');
  await central.getByRole('button', { name: /Corridas/ }).click();
  await see(central, 'Dona Ana');
  await shot(central, '17-central-corridas');
  await central.getByRole('button', { name: /Passageiros/ }).click();
  await see(central, 'Maria Souza');
  await see(central, '1 passageiro cadastrado');
  await shot(central, '18-central-passageiros');
  await central.getByRole('button', { name: /Motoqueiros/ }).click();
  await see(central, 'Faturou');
  await shot(central, '19-central-motoqueiros');

  // Recarregar a página do motoqueiro mantém a sessão e o estado.
  await moto.reload();
  await see(moto, 'Você está online');

  if (errors.length) throw new Error(`Erros no console:\n${errors.join('\n')}`);
  console.log(`OK: fluxo completo passou. Capturas em ${shots}`);
} catch (err) {
  failed = true;
  console.error('FALHOU:', err.message);
  if (errors.length) console.error(errors.join('\n'));
  let i = 0;
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.screenshot({ path: path.join(shots, `falha-${i++}.png`) }).catch(() => {});
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
}

main();

// Runner da suíte: testes unitários, simulador de balanceamento e testes de ponta a ponta.
// Uso: node tests/run.mjs            (tudo)
//      node tests/run.mjs unit        (só unitários)
//      node tests/run.mjs e2e [nome]  (ponta a ponta; nome filtra por trecho do título)
// Falha (código 1) se algum teste falhar ou se houver erro/aviso de console na página.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// Mensagens de console que não são erros do jogo (driver de GPU por software)
const IGNORED_CONSOLE = [/GL Driver Message/, /GPU stall/];

function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const args = process.argv.slice(2);
const mode = args[0] || 'all';
const filter = args[1] || '';
const results = [];
const log = (s) => console.log(s);

async function runUnitTests() {
  log('\n== Unitários ==');
  const { runUnit } = await import('./unit.mjs');
  const r = await runUnit();
  results.push({ suite: 'unit', pass: r.pass, total: r.total, failures: r.failures });
}

async function runSim() {
  log('\n== Simulador de balanceamento ==');
  const { fullReport, checkTargets, LEVELS } = await import('./sim/sim.mjs');
  const report = fullReport();
  const fails = checkTargets(report);
  const { ENEMIES } = await import('../src/data/content.js');
  log('inimigo              ' + LEVELS.map((l) => `Nv${l}`.padStart(6)).join(''));
  for (const id of Object.keys(ENEMIES)) {
    log(id.padEnd(21) + LEVELS.map((l) => `${Math.round(report[id][l].rate * 100)}%`.padStart(6)).join(''));
  }
  log(fails.length ? 'FALHAS: ' + fails.join(' | ') : 'metas de balanceamento atendidas');
  results.push({ suite: 'sim', pass: fails.length ? 0 : 1, total: 1, failures: fails.length ? ['sim metas'] : [] });
}

async function runE2E(base) {
  log('\n== Ponta a ponta (Chromium headless) ==');
  const { default: tests } = await import('./e2e.mjs');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let pass = 0;
  const failures = [];
  const selected = tests.filter((t) => t.name.includes(filter));
  for (const test of selected) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
    const page = await context.newPage();
    const problems = [];
    const notes = [];
    page.on('pageerror', (e) => problems.push(`erro de página: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (IGNORED_CONSOLE.some((re) => re.test(m.text()))) return;
      problems.push(`console.${m.type()}: ${m.text()}`);
    });
    const started = Date.now();
    try {
      await test.run({ page, browser, base, report: (s) => notes.push(s) });
      if (problems.length) throw new Error(problems.join(' | '));
      pass++;
      log(`  ok   ${test.name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      for (const n of notes) log(`       · ${n}`);
    } catch (e) {
      failures.push(test.name);
      log(`  FAIL ${test.name}\n       ${String(e.message).split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  results.push({ suite: 'e2e', pass, total: selected.length, failures });
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
try {
  if (mode === 'all' || mode === 'unit') await runUnitTests();
  if (mode === 'all' || mode === 'sim') await runSim();
  if (mode === 'all' || mode === 'e2e') await runE2E(base);
} finally {
  server.close();
}

const total = results.reduce((a, r) => a + r.total, 0);
const pass = results.reduce((a, r) => a + r.pass, 0);
const failed = results.flatMap((r) => r.failures);
log(`\nResumo: ${pass}/${total} passaram.` + (failed.length ? `\nFalhas:\n - ${failed.join('\n - ')}` : ''));
process.exit(failed.length ? 1 : 0);

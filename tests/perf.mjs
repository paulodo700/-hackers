// Medição de desempenho por partes: FPS e chamadas de desenho com cada parte do cenário ligada ou desligada.
// Uso: node tests/perf.mjs [zona]   (padrão: cache). Roda no Chromium headless com renderização por software,
// então os números servem para comparar partes entre si, não para prever o desempenho em aparelho real.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const zoneId = process.argv[2] || 'cache';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(base + '/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__anelZero && window.__anelZero.zone);
await page.click('#btn-play');
await page.click('.slot-row:nth-child(1) .acts button');
for (let i = 0; i < 16; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(80); }
await page.evaluate((z) => {
  const g = window.__anelZero;
  g.flags.noEncounters = true;
  g.loadZone(z, null, null, true);
}, zoneId);
await page.waitForTimeout(800);

// Cada configuração esconde uma parte da cena. A restauração é feita antes de cada medição.
const configs = [
  'tudo ligado',
  'sem itens no chão',
  'sem bytes',
  'sem paredes',
  'sem decoração instanciada',
  'sem cenário inteiro',
  'só o jogador',
];

await page.evaluate(() => {
  const isWall = (o) => o.name === 'walls';
  const isDecorCap = (o) => o.isInstancedMesh && o.geometry.type === 'CylinderGeometry';
  const isDecorRes = (o) => o.isInstancedMesh && o.geometry.parameters && o.geometry.parameters.height === 0.18;
  window.__perfRestore = () => {
    const g = window.__anelZero;
    g.zone.group.visible = true;
    g.zone.group.traverse((o) => { o.visible = true; });
    g.entities.forEach((e) => { if (e.obj) e.obj.visible = true; });
    g.roamers.forEach((r) => { if (r.alive) r.obj.visible = true; });
  };
  window.__perfApply = (name) => {
    const g = window.__anelZero;
    if (name === 'sem itens no chão') g.entities.filter((e) => e.type === 'pickup').forEach((e) => { if (e.obj) e.obj.visible = false; });
    if (name === 'sem bytes') g.roamers.forEach((r) => { r.obj.visible = false; });
    if (name === 'sem paredes') g.zone.group.traverse((o) => { if (isWall(o)) o.visible = false; });
    if (name === 'sem decoração instanciada') g.zone.group.traverse((o) => { if (isDecorCap(o) || isDecorRes(o)) o.visible = false; });
    if (name === 'sem cenário inteiro') g.zone.group.visible = false;
    if (name === 'só o jogador') {
      g.zone.group.visible = false;
      g.entities.forEach((e) => { if (e.obj) e.obj.visible = false; });
      g.roamers.forEach((r) => { r.obj.visible = false; });
    }
  };
});

const results = [];
for (const name of configs) {
  await page.evaluate(() => window.__perfRestore());
  await page.evaluate((n) => { if (n !== 'tudo ligado') window.__perfApply(n); }, name);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => new Promise((resolve) => {
    const g = window.__anelZero;
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - start < 3000) requestAnimationFrame(tick);
      else resolve({
        fps: frames / ((performance.now() - start) / 1000),
        calls: g.renderer.info.render.calls,
        tris: g.renderer.info.render.triangles,
      });
    };
    requestAnimationFrame(tick);
  }));
  results.push({ name, ...r });
}

console.log(`Zona: ${zoneId} · 360x740 · renderização por software (chromium headless)`);
console.log('configuração'.padEnd(30) + 'FPS'.padStart(7) + 'chamadas'.padStart(11) + 'triângulos'.padStart(13));
for (const r of results) {
  console.log(r.name.padEnd(30) + r.fps.toFixed(1).padStart(7) + String(r.calls).padStart(11) + String(r.tris).padStart(13));
}
await browser.close();
server.close();

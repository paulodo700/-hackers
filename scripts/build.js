// Gera dist/vaelmor.html: um único arquivo com CSS e JS embutidos, para abrir em qualquer lugar.
// Uso: node scripts/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'vaelmor.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// CSS
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const css = fs.readFileSync(path.join(ROOT, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// JS (na ordem do documento)
let count = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(ROOT, src), 'utf8');
  if (js.includes('</script')) throw new Error(`${src} contém "</script" e quebraria o build`);
  count++;
  return `<script>\n/* ${src} */\n${js}\n</script>`;
});

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`dist/vaelmor.html gerado (${count} scripts, ${kb} KB)`);

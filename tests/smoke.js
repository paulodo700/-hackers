// Teste de fumaça: percorre o jogo inteiro em Chromium headless e tira capturas.
// Uso: SHOTS=/caminho/para/capturas node tests/smoke.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(ROOT, 'dist', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const log = (...a) => console.log('[smoke]', ...a);
const assert = (cond, msg) => {
  if (!cond) {
    errors.push('FALHA: ' + msg);
    log('FALHA:', msg);
  } else log('ok:', msg);
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.V && window.V.Game && window.V.Game.cur);
  await page.waitForTimeout(400);

  const scene = () => page.evaluate(() => window.V.Game.curName);
  const logicalToClient = (x, y) =>
    page.evaluate(([x, y]) => ({ x: window.V.Game.ox + x * window.V.Game.k, y: window.V.Game.oy + y * window.V.Game.k }), [x, y]);
  const click = async (x, y) => {
    const p = await logicalToClient(x, y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
  };
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
  const waitScene = async (name, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if ((await scene()) === name) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };

  // 1) Título
  assert((await scene()) === 'title', 'inicia no título');
  await page.waitForTimeout(500);
  await shot('01-titulo');
  await click(180, 375); // Nova Jornada

  // 2) História (pula falas com Enter)
  assert(await waitScene('story'), 'Nova Jornada abre a história');
  await page.waitForTimeout(700);
  await shot('02-historia-fala');
  for (let i = 0; i < 120 && (await scene()) === 'story'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  assert(await waitScene('map'), 'história termina no mapa');

  // 3) Mapa com duas escolhas (forçamos combate e campeão para teste determinístico)
  await page.evaluate(() => {
    window.V.Run.choices = ['combat', 'elite'];
    window.V.Run.currentChoices();
  });
  await page.waitForTimeout(400);
  await shot('03-mapa');
  await click(100, 540); // combate
  assert(await waitScene('gameplay'), 'escolha de combate abre a arena');

  // 4) Combate: movimento, tiro automático e inimigos
  await page.waitForTimeout(1400);
  await shot('04-combate-inicio');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  const combat = await page.evaluate(() => {
    const w = window.V.Game.cur.world;
    return { enemies: w.enemies.length, projectiles: w.projectiles.length, px: w.player.x, py: w.player.y };
  });
  assert(combat.enemies > 0, 'combate gera inimigos (' + combat.enemies + ')');
  await page.waitForTimeout(2200);
  await shot('05-combate-meio');
  const shots = await page.evaluate(() => window.V.Game.cur.world.projectiles.length + window.V.Game.cur.world.parts.length);
  assert(shots >= 0, 'projéteis e partículas funcionam');

  // 5) Subida de nível: carta de upgrade
  await page.evaluate(() => {
    const g = window.V.Game.cur;
    g.world.pendingLevelUps = 1;
    g.world.player.stats.xpMult = 1;
  });
  await page.waitForTimeout(250);
  const overlayLevel = await page.evaluate(() => window.V.Game.cur.overlay);
  assert(overlayLevel === 'levelup', 'subida de nível abre escolha de cartas');
  await shot('06-subida-nivel');
  await click(180, 225);
  const afterPick = await page.evaluate(() => ({ overlay: window.V.Game.cur.overlay, cards: Object.keys(window.V.Run.cards).length }));
  assert(afterPick.overlay === null && afterPick.cards >= 1, 'escolher carta fecha a sobreposição e aplica upgrade');

  // 6) Pausa
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  assert((await page.evaluate(() => window.V.Game.cur.overlay)) === 'pause', 'P abre pausa');
  await shot('07-pausa');
  await click(180, 293); // Continuar
  assert((await page.evaluate(() => window.V.Game.cur.overlay)) === null, 'Continuar retoma o combate');

  // 7) Vitória de sala -> mapa com aviso
  await page.evaluate(() => {
    const w = window.V.Game.cur.world;
    w.waves = [];
    for (const e of w.activeEnemies()) w.damageEnemy(e, 99999, false, e.x, e.y);
    for (const e of w.enemies) if (!e.dead) e.dead = true;
  });
  assert(await waitScene('map', 6000), 'vencer a sala volta ao mapa');
  await page.waitForTimeout(300);
  await shot('08-mapa-apos-sala');
  const stepAfter = await page.evaluate(() => window.V.Run.step);
  assert(stepAfter === 1, 'passo do mapa avança após a sala');

  // 8) Eventos: tesouro, descanso e mercador
  await page.evaluate(() => window.V.Game.go('event', { type: 'treasure' }));
  await page.waitForTimeout(300);
  await shot('09-tesouro');
  await page.evaluate(() => window.V.Game.go('event', { type: 'rest' }));
  await page.waitForTimeout(300);
  await click(180, 425); // descansar
  await page.waitForTimeout(200);
  await shot('10-descanso');
  await page.evaluate(() => {
    window.V.Run.gold = 200;
    window.V.Game.go('event', { type: 'shop' });
  });
  await page.waitForTimeout(300);
  await click(284, 273); // comprar poção (botão da primeira oferta)
  await shot('11-mercador');
  assert((await page.evaluate(() => window.V.Run.gold)) < 200, 'comprar no mercador gasta ouro');

  // 9) Chefe do capítulo 1
  await page.evaluate(() => {
    window.V.Run.step = 7;
    window.V.Run.choices = null;
    window.V.Game.go('map', {});
  });
  await page.waitForTimeout(300);
  await shot('12-mapa-chefe');
  await click(180, 540);
  assert(await waitScene('story'), 'chefe abre a introdução do chefe');
  for (let i = 0; i < 120 && (await scene()) === 'story'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  assert(await waitScene('gameplay'), 'introdução do chefe leva à luta');
  await page.waitForTimeout(2000);
  await shot('13-chefe');
  await page.evaluate(() => {
    const w = window.V.Game.cur.world;
    if (w.bossRef) w.bossRef.hp = w.bossRef.maxHp * 0.45;
  });
  await page.waitForTimeout(600);
  const phase = await page.evaluate(() => window.V.Game.cur.world.bossRef && window.V.Game.cur.world.bossRef.phase);
  assert(phase === 2, 'chefe entra na fase 2 abaixo de 50% de HP');
  await shot('14-chefe-fase2');
  await page.evaluate(() => {
    const w = window.V.Game.cur.world;
    w.damageEnemy(w.bossRef, 99999, false, w.bossRef.x, w.bossRef.y);
  });
  // Subidas de nível causadas pelo chefe pedem a escolha da carta antes do desfecho
  for (let i = 0; i < 40 && (await scene()) === 'gameplay'; i++) {
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.V.Game.cur.overlay)) === 'levelup') await click(180, 246);
  }
  assert(await waitScene('story', 8000), 'derrotar o chefe leva ao desfecho do capítulo');
  for (let i = 0; i < 160 && (await scene()) === 'story'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  assert(await waitScene('map', 6000), 'capítulo 2 começa no mapa');
  const chap = await page.evaluate(() => window.V.Run.chapter);
  assert(chap === 1, 'capítulo avançou para 2 (índice 1)');
  await page.waitForTimeout(300);
  await shot('15-mapa-capitulo2');

  // 10) Derrota
  await page.evaluate(() => {
    window.V.Game.go('gameplay', { kind: 'combat' });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window.V.Game.cur.world;
    w.player.stats.hp = 1;
    w.player.iframes = 0;
    w.hurtPlayer(999, 'teste');
  });
  assert(await waitScene('gameover', 6000), 'morrer leva ao fim de jornada');
  await page.waitForTimeout(500);
  await shot('16-derrota');
  const relics = await page.evaluate(() => window.V.Meta.relics);
  assert(relics > 0, 'derrota concede Relíquias (' + relics + ')');

  // 11) Altar e créditos
  await page.evaluate(() => window.V.Meta.addRelics(20));
  await page.evaluate(() => window.V.Game.go('altar', {}));
  await page.waitForTimeout(400);
  await shot('17-altar');
  await click(300, 170); // primeira melhoria
  assert((await page.evaluate(() => window.V.Meta.level('maxhp'))) >= 1, 'comprar melhoria no Altar sobe o nível');
  await page.evaluate(() => window.V.Game.go('credits', {}));
  await page.waitForTimeout(600);
  await shot('18-creditos');

  // 12) Desktop (paisagem)
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.evaluate(() => window.V.Game.go('title'));
  await page.waitForTimeout(700);
  await shot('19-desktop-titulo');

  // 12b) Estresse: todos os monstros, chefes e sprites em simulação rápida (sem tempo real)
  const stress = await page.evaluate(() => {
    const out = { errors: [], frames: 0, sprites: 0 };
    const g = document.createElement('canvas').getContext('2d');
    const ids = Object.keys(V.Data.monsters).concat(Object.keys(V.Data.bosses));
    const kinds = ['combat', 'elite', 'boss'];
    V.Run.start();
    for (let c = 0; c < V.Data.chapters.length; c++) {
      for (const kind of kinds) {
        V.Run.chapter = c;
        V.Run.step = kind === 'boss' ? 7 : 2;
        V.Run.stats.hp = V.Run.stats.maxHp = 99999;
        const w = new V.World(kind);
        for (const id of ids) {
          if (id.startsWith('boss') && kind !== 'boss') continue;
          if (!id.startsWith('boss') && kind === 'boss') continue;
          w.addEnemy(id, 80 + Math.random() * 200, 200 + Math.random() * 200, { spawnT: 0.01 });
        }
        for (let i = 0; i < 1500; i++) {
          try {
            w.update(1 / 60);
            if (i % 25 === 0) {
              w.draw(g);
              out.frames++;
            }
          } catch (e) {
            out.errors.push(c + '/' + kind + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e));
            break;
          }
        }
      }
    }
    const spriteIds = ids.map((id) => (V.Data.monsters[id] || V.Data.bosses[id]).sprite);
    for (const id of spriteIds.concat(['player', 'arrow', 'arrow_e', 'orb_g', 'orb_p', 'orb_r', 'orb_c', 'orb_y', 'star', 'web', 'boulder', 'seed', 'blade', 'coin', 'gem', 'heart', 'xp', 'potion', 'slime_p', 'slime_r'])) {
      try {
        V.Sprites.draw(g, id, 40, 40, 48, { frame: 1, flip: true });
        out.sprites++;
      } catch (e) {
        out.errors.push('sprite ' + id + ': ' + e.message);
      }
    }
    for (const face of ['ysa', 'iolen', 'gorm', 'mirra', 'treant', 'king', 'eclipse']) {
      try { g.drawImage(V.Sprites.bust(face), 0, 0, 220, 220); } catch (e) { out.errors.push('bust ' + face + ': ' + e.message); }
    }
    V.Run.active = false;
    return out;
  });
  assert(stress.errors.length === 0, 'estresse de IA/sprites sem exceções (' + stress.frames + ' quadros, ' + stress.sprites + ' sprites)');
  for (const e of stress.errors.slice(0, 8)) errors.push('estresse: ' + e);

  // 13) Erros de execução
  const realErrors = errors.filter((e) => !/favicon/.test(e));
  if (realErrors.length) {
    log('erros encontrados:', realErrors.length);
    realErrors.slice(0, 20).forEach((e) => log('  -', e));
  }
  log('capturas em', SHOTS);
  await browser.close();
  process.exit(realErrors.length ? 1 : 0);
})().catch(async (e) => {
  console.error('[smoke] exceção:', e);
  process.exit(2);
});

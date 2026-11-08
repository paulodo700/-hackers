// Testes de ponta a ponta no Chromium headless. Cada teste roda num contexto novo (localStorage isolado).
// Os testes usam o gancho window.__anelZero (somente para preparar cenários e ler o estado).

export const URL_PATH = '/index.html';

// ---------- Auxiliares ----------
export async function boot(page, base) {
  // Números aleatórios com semente fixa: os testes de combate são reproduzíveis
  await page.addInitScript(() => {
    let a = 20260101;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.goto(base + URL_PATH, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__anelZero && window.__anelZero.zone);
  await page.waitForTimeout(250);
}

// Entra num slot (novo jogo) e fecha a introdução
export async function newGame(page, base, slot = 1) {
  await boot(page, base);
  await page.click('#btn-play');
  await page.click(`.slot-row:nth-child(${slot}) .acts button`);
  await skipDialog(page);
  // Testes são determinísticos: sem glitches que perseguem o jogador
  await page.evaluate(() => { window.__anelZero.flags.noEncounters = true; });
}

export async function skipDialog(page, max = 40) {
  for (let i = 0; i < max; i++) {
    const open = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    if (!open) return;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(90);
  }
}

export async function dialogOpen(page) {
  return page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
}

export async function visible(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.classList.contains('hidden');
  }, sel);
}

export async function teleportNear(page, kind, id, dz = 1) {
  await page.evaluate(([k, i, d]) => {
    const g = window.__anelZero;
    const list = g.entities.filter((e) => (k === 'type' ? e.type === i : (e.id === i || e.enemy === i)));
    const e = list[0];
    if (!e) throw new Error(`entidade não encontrada: ${i}`);
    g.player.setTile(e.c, e.r + d);
  }, [kind, id, dz]);
  await page.waitForTimeout(120);
}

// Segura uma tecla até a condição ser verdadeira (o jogo anda por tempo de quadro, que varia em software)
export async function holdUntil(page, key, pred, maxMs = 8000) {
  await page.keyboard.down(key);
  const started = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      if (await page.evaluate(pred)) return true;
      await page.waitForTimeout(80);
    }
    return false;
  } finally {
    await page.keyboard.up(key);
  }
}

export async function state(page, fn) {
  return page.evaluate(fn);
}

// Vence uma batalha clicando no primeiro comando disponível até o botão de saída aparecer
export async function winBattle(page, max = 80) {
  for (let i = 0; i < max; i++) {
    const battleOpen = await visible(page, '#battle');
    if (!battleOpen) return true;
    const exit = await page.$('#battle-cmds button.primary');
    if (exit) { await exit.click(); await page.waitForTimeout(150); return true; }
    const btn = await page.$('#battle-cmds button:not([disabled])');
    if (btn) { await btn.click(); await page.waitForTimeout(520); } else { await page.waitForTimeout(250); }
  }
  return false;
}

// ---------- Testes ----------
export default [
  {
    name: 'título carrega sem erros e mostra os três slots ao jogar',
    async run({ page, base }) {
      await boot(page, base);
      await page.click('#btn-play');
      const rows = await page.$$eval('.slot-row', (r) => r.length);
      if (rows !== 3) throw new Error(`esperava 3 slots, achei ${rows}`);
    },
  },
  {
    name: 'novo jogo no slot 2, salvar, recarregar e continuar no mesmo slot',
    async run({ page, base }) {
      await newGame(page, base, 2);
      await page.evaluate(() => { window.__anelZero.state.gold = 123; });
      await page.evaluate(() => document.getElementById('btn-save').click());
      await page.waitForTimeout(150);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.__anelZero);
      await page.click('#btn-play');
      const label = await page.textContent('.slot-row:nth-child(2) .info');
      if (!label.includes('Jardim da Cache')) throw new Error('slot 2 não mostra a zona salva: ' + label);
      await page.click('.slot-row:nth-child(2) .acts button');
      await page.waitForTimeout(300);
      const gold = await state(page, () => window.__anelZero.state.gold);
      if (gold !== 123) throw new Error(`ouro restaurado = ${gold}`);
    },
  },
  {
    name: 'save antigo (chave única) é migrado para o slot 1',
    async run({ page, base }) {
      await boot(page, base);
      await page.evaluate(() => {
        localStorage.setItem('anel-zero-save-v1', JSON.stringify({
          level: 4, xp: 3, hp: 50, en: 20, baseHp: 60, baseEn: 30, baseAtk: 6, baseDef: 2,
          equip: { weapon: null, armor: null }, inv: {}, gold: 55, flags: {}, counters: {},
          quests: {}, codex: { zones: {}, enemies: {} }, zone: 'regs', pos: { c: 3, r: 3 },
        }));
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.__anelZero);
      await page.click('#btn-play');
      const info = await page.textContent('.slot-row:nth-child(1) .info');
      if (!info.includes('Planície')) throw new Error('slot 1 não recebeu o save antigo: ' + info);
      await page.click('.slot-row:nth-child(1) .acts button');
      await page.waitForTimeout(300);
      const s = await state(page, () => ({ v: window.__anelZero.state.version, gold: window.__anelZero.state.gold, zone: window.__anelZero.zone.id }));
      if (s.v !== 3 || s.gold !== 55 || s.zone !== 'regs') throw new Error(JSON.stringify(s));
    },
  },
  {
    name: 'slot com save corrompido aparece como vazio e não quebra o jogo',
    async run({ page, base }) {
      await boot(page, base);
      await page.evaluate(() => localStorage.setItem('anel-zero-slot-3', '{quebrado'));
      await page.click('#btn-play');
      const info = await page.textContent('.slot-row:nth-child(3) .info');
      if (!info.includes('Vazio')) throw new Error('slot corrompido deveria aparecer como vazio: ' + info);
    },
  },
  {
    name: 'portais: entrada livre troca de zona; portal trancado mostra o motivo',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('cache', null, null, true);
        const p = g.zone.portals.find((x) => x.to === 'regs');
        g.player.setTile(p.c - 1, p.r);
      });
      await holdUntil(page, 'KeyD', () => window.__anelZero.zone.id === 'regs');
      await page.waitForTimeout(500);
      const z = await state(page, () => window.__anelZero.zone.id);
      if (z !== 'regs') throw new Error('não entrou na Planície: ' + z);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('alu', null, null, true);
        const p = g.zone.portals.find((x) => x.to === 'pipeline');
        g.player.setTile(p.c - 1, p.r);
      });
      await holdUntil(page, 'KeyD', () => document.getElementById('toast').textContent.includes('Sobrecarga'));
      await page.waitForTimeout(200);
      const toast = await page.textContent('#toast');
      if (!toast.includes('Sobrecarga')) throw new Error('motivo do bloqueio ausente: ' + toast);
      const still = await state(page, () => window.__anelZero.zone.id);
      if (still !== 'alu') throw new Error('portal trancado não deveria levar: ' + still);
    },
  },
  {
    name: 'NPC inicia missão e a missão extra abre depois da principal',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await teleportNear(page, 'npc', 'sementa');
      await page.keyboard.press('KeyE');
      await skipDialog(page);
      const active = await state(page, () => window.__anelZero.state.quests.q_primeiros_reparos?.status);
      if (active !== 'active') throw new Error('missão principal não começou: ' + active);
      await teleportNear(page, 'npc', 'sementa');
      await page.keyboard.press('KeyE');
      await skipDialog(page);
      const extra = await state(page, () => window.__anelZero.state.quests.sq_cache?.status);
      if (extra !== 'active') throw new Error('missão extra não abriu: ' + extra);
    },
  },
  {
    name: 'batalha contra Sobrecarga termina em vitória e marca o chefe',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.level = 9; g.state.baseAtk = 16; g.state.en = 40;
        g.state.hp = 140; // vida cheia do nível 9 (60 + 8 × 10); subir de nível no jogo já restaura a vida
        g.loadZone('alu', null, null, true);
        g.beginBattle('sobrecarga', null);
      });
      await page.waitForTimeout(200);
      const won = await winBattle(page, 160);
      if (!won) throw new Error('batalha não terminou');
      await page.waitForTimeout(300);
      const flags = await state(page, () => Object.keys(window.__anelZero.state.flags));
      if (!flags.includes('boss_sobrecarga')) {
        const log = await page.evaluate(() => Array.from(document.querySelectorAll('#battle-log p')).map((p) => p.textContent).slice(-4).join(' / '));
        throw new Error(`chefe não marcado (flags: ${flags.join(',') || 'nenhuma'}; fim da batalha: ${log})`);
      }
    },
  },
  {
    name: 'batalha mostra intenção do inimigo antes da escolha',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => window.__anelZero.beginBattle('pulga', null));
      await page.waitForTimeout(200);
      const intent = await page.textContent('#en-intent');
      if (!intent || intent.length < 5) throw new Error('intenção vazia');
    },
  },
  {
    name: 'reparo: primeira vez mostra tutorial e depois abre direto; resolve e grava recorde',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('cache', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(150);
      const tutorial = await page.textContent('#dlg-name');
      if (tutorial !== 'Tutorial') throw new Error('tutorial não apareceu: ' + tutorial);
      await skipDialog(page, 20);
      await page.waitForTimeout(150);
      if (!(await visible(page, '#repair'))) throw new Error('reparo não abriu após o tutorial');
      // Resolve: todos os giros em zero e um clique que gira (0,0) de 3 para 0
      await page.evaluate(() => {
        const cur = window.__anelZero.repairDebug();
        for (const row of cur.puzzle.cells) for (const c of row) c.rot = 0;
        cur.puzzle.cells[0][0].rot = 3;
      });
      const box = await page.locator('#rp-canvas').boundingBox();
      const cs = box.width / 4;
      await page.mouse.click(box.x + cs / 2, box.y + cs / 2);
      await page.waitForTimeout(1200);
      if (await visible(page, '#repair')) throw new Error('reparo não fechou ao resolver');
      const best = await state(page, () => window.__anelZero.state.repairBest.cache);
      if (!best) throw new Error('recorde não gravado');
      const zoneName = await page.textContent('#zone-name');
      if (!zoneName.includes('★')) throw new Error('recorde não aparece na zona: ' + zoneName);
      // Depois do tutorial, outra zona abre o reparo direto (sem tutorial de novo)
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('regs', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(150);
      if (await visible(page, '#dialog')) throw new Error('tutorial reapareceu em outra zona');
      if (!(await visible(page, '#repair'))) throw new Error('reparo da Planície não abriu direto');
      await page.keyboard.press('Escape');
    },
  },
  {
    name: 'reparo: teclado move o cursor, Enter gira e H liga o modo difícil',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.flags.tut_repair = true;
        g.loadZone('cache', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(80);
      const moves = await state(page, () => window.__anelZero.repairDebug().moves);
      if (moves !== 1) throw new Error('Enter não girou a célula do cursor: ' + moves);
      await page.keyboard.press('KeyH');
      await page.waitForTimeout(80);
      const n = await state(page, () => window.__anelZero.repairDebug().puzzle.n);
      const hard = await state(page, () => window.__anelZero.repairDebug().hard);
      if (!hard || n !== 5) throw new Error(`modo difícil: hard=${hard} n=${n}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
      if (await visible(page, '#repair')) throw new Error('Esc não cancelou o reparo');
    },
  },
  {
    name: 'minimapa mostra só as áreas visitadas',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await holdUntil(page, 'KeyD', () => Object.keys(window.__anelZero.state.visited.cache || {}).length >= 3);
      const visitedCount = await state(page, () => Object.keys(window.__anelZero.state.visited.cache || {}).length);
      if (visitedCount < 2) throw new Error('poucas áreas visitadas: ' + visitedCount);
      const bright = await page.evaluate(() => {
        const c = document.getElementById('minimap');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) n++;
        return n;
      });
      if (bright < 1) throw new Error('minimapa não desenhou o jogador');
    },
  },
  {
    name: 'loja: compra com créditos e cobra o preço',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        window.__anelZero.state.gold = 100;
        window.__anelZero.loadZone('cache', null, null, true);
        const npc = window.__anelZero.entities.find((e) => e.id === 'lojista');
        window.__anelZero.player.setTile(npc.c - 1, npc.r);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      if (!(await visible(page, '#shop'))) throw new Error('loja não abriu');
      await page.click('#shop-body .item-row button:not([disabled])');
      await page.waitForTimeout(100);
      const gold = await state(page, () => window.__anelZero.state.gold);
      if (gold >= 100) throw new Error('ouro não foi cobrado: ' + gold);
    },
  },
  {
    name: 'bancada: cria item a partir de materiais',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.inv.fio_cobre = 4; g.state.inv.liga_ferrugem = 2;
        g.loadZone('regs', null, null, true);
        const b = g.entities.find((e) => e.type === 'bench');
        g.player.setTile(b.c, b.r + 1);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      await page.click('.tab[data-shop="craft"]');
      await page.click('#shop-body .item-row button:not([disabled])');
      await page.waitForTimeout(100);
      const kit = await state(page, () => window.__anelZero.state.inv.kit_solda || 0);
      if (kit < 1) throw new Error('item não criado');
    },
  },
  {
    name: 'árvore de habilidades gasta pontos',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => { window.__anelZero.state.skillPoints = 2; });
      await page.keyboard.press('KeyM');
      await page.click('.tab[data-tab="skills"]');
      await (await page.$$('#menu-body .skill-row button'))[0].click();
      await page.waitForTimeout(100);
      const v = await state(page, () => window.__anelZero.state.skills.vigor || 0);
      if (v !== 1) throw new Error('vigor não subiu: ' + v);
    },
  },
  {
    name: 'ajustes: volume, legendas e alto contraste são aplicados e salvos',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.keyboard.press('KeyM');
      await page.click('.tab[data-tab="config"]');
      const rows = await page.$$eval('#menu-body .setting-row', (r) => r.map((x) => x.textContent));
      const musicIdx = rows.findIndex((t) => t.includes('Volume da trilha'));
      const capIdx = rows.findIndex((t) => t.includes('Legendas'));
      const hcIdx = rows.findIndex((t) => t.includes('Alto contraste'));
      if (musicIdx < 0 || capIdx < 0 || hcIdx < 0) throw new Error('linhas de ajuste ausentes: ' + rows.join(' | '));
      await (await page.$$('#menu-body .setting-row button'))[musicIdx].click();
      await page.waitForTimeout(100);
      const vol = await state(page, () => window.__anelZero.audio().music);
      if (vol !== 0) throw new Error('volume da trilha não mudou: ' + vol);
      await (await page.$$('#menu-body .setting-row button'))[hcIdx].click();
      const hc = await page.evaluate(() => document.body.classList.contains('hc'));
      if (!hc) throw new Error('alto contraste não aplicado');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anel-zero-settings-v1')));
      if (!saved || saved.hc !== true || saved.volMusic !== 0) throw new Error('ajustes não salvos: ' + JSON.stringify(saved));
      await page.evaluate(() => document.body.classList.remove('hc'));
    },
  },
  {
    name: 'áudio: limitador impede ganho acima de 1.0 e legenda aparece no baú',
    async run({ page, base }) {
      await newGame(page, base, 1);
      const a = await state(page, () => window.__anelZero.audio());
      if (!(a.maxOut > 0 && a.maxOut <= 1)) throw new Error('teto de saída inválido: ' + a.maxOut);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('cache', null, null, true);
        const c = g.entities.find((e) => e.type === 'chest');
        g.player.setTile(c.c, c.r + 1);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(120);
      const cap = await page.textContent('#captions');
      if (!cap.includes('Baú')) throw new Error('legenda do baú ausente: ' + cap);
    },
  },
  {
    name: 'Vigia: final da paz pela escolha 1 (sem batalha)',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.loadZone('core', null, null, true);
        const v = g.entities.find((e) => e.enemy === 'vigia');
        g.player.setTile(v.c, v.r + 1);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      for (let i = 0; i < 20 && !(await visible(page, '#dlg-choices')); i++) {
        await page.keyboard.press('KeyE'); await page.waitForTimeout(110);
      }
      await page.keyboard.press('Digit1');
      await page.waitForTimeout(200);
      await skipDialog(page, 30);
      const flags = await state(page, () => Object.keys(window.__anelZero.state.flags));
      if (!flags.includes('ending_paz')) throw new Error('final da paz não registrado');
      if (flags.includes('boss_vigia') !== true) throw new Error('Vigia deveria estar resolvido');
    },
  },
  {
    name: 'Vigia: final da guerra pela escolha 2 e vitória na batalha',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.level = 14; g.state.baseAtk = 40; g.state.baseHp = 200;
        g.state.hp = 200;
        g.loadZone('core', null, null, true);
        const v = g.entities.find((e) => e.enemy === 'vigia');
        g.player.setTile(v.c, v.r + 1);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      for (let i = 0; i < 20 && !(await visible(page, '#dlg-choices')); i++) {
        await page.keyboard.press('KeyE'); await page.waitForTimeout(110);
      }
      await page.keyboard.press('Digit2');
      await page.waitForTimeout(250);
      if (!(await visible(page, '#battle'))) throw new Error('batalha da guerra não começou');
      const won = await winBattle(page, 120);
      if (!won) throw new Error('batalha da guerra não terminou');
      await page.waitForTimeout(300);
      await skipDialog(page, 30);
      const flags = await state(page, () => Object.keys(window.__anelZero.state.flags));
      if (!flags.includes('ending_guerra')) throw new Error('final da guerra não registrado: ' + flags.filter((f) => /ending|choice|vigia/.test(f)).join(','));
    },
  },
  {
    name: 'missão extra do Núcleo: falar, pegar o selo e entregar muda o final',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.flags.entered_core = true;
        g.state.quests.q_nucleo = { status: 'active' };
        g.loadZone('core', null, null, true);
        const npc = g.entities.find((e) => e.id === 'arquivista_final');
        g.player.setTile(npc.c, npc.r + 1);
      });
      await page.keyboard.press('KeyE');
      await skipDialog(page);
      const started = await state(page, () => window.__anelZero.state.quests.sq_nucleo?.status);
      if (started !== 'active') throw new Error('missão do Núcleo não começou');
      await page.evaluate(() => {
        const g = window.__anelZero;
        const c = g.entities.find((e) => e.type === 'chest' && e.id === 'core_selo');
        g.player.setTile(c.c, c.r + 1);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.player.setTile(g.entities.find((e) => e.id === 'arquivista_final').c, g.entities.find((e) => e.id === 'arquivista_final').r + 1);
      });
      await page.keyboard.press('KeyE');
      await skipDialog(page);
      const done = await state(page, () => window.__anelZero.state.quests.sq_nucleo?.status);
      if (done !== 'done') throw new Error('missão do Núcleo não concluiu: ' + done);
    },
  },
  {
    name: 'navegação por teclado: Tab/setas trocam abas e Esc fecha o menu',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(120);
      const first = await page.evaluate(() => document.activeElement && document.activeElement.textContent);
      if (!first || !first.includes('Status')) throw new Error('foco inicial errado: ' + first);
      await page.keyboard.press('ArrowRight');
      const second = await page.evaluate(() => document.activeElement.textContent);
      if (!second.includes('Inventário')) throw new Error('seta não moveu o foco: ' + second);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(120);
      const body = await page.textContent('#menu-body');
      if (body.includes('Nível')) throw new Error('Enter não trocou a aba');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      if (await visible(page, '#menu')) throw new Error('Esc não fechou o menu');
    },
  },
  {
    name: 'navegação por teclado nos slots e no título',
    async run({ page, base }) {
      await boot(page, base);
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter'); // o botão Jogar já recebe o foco ao abrir
      await page.waitForTimeout(120);
      if (!(await visible(page, '#slots'))) throw new Error('Enter não abriu os slots');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
      if (focused !== 'BUTTON') throw new Error('foco não foi para os slots');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
      if (!(await visible(page, '#title'))) throw new Error('Esc não voltou ao título');
    },
  },
  {
    name: 'celular 360 px: sem rolagem horizontal no título, no jogo e na batalha',
    async run({ browser, base }) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      try {
        await boot(page, base);
        const t = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (t > 0) throw new Error(`título com ${t}px de rolagem horizontal`);
        await page.click('#btn-play');
        await page.click('.slot-row:nth-child(1) .acts button');
        await skipDialog(page);
        const g = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (g > 0) throw new Error(`jogo com ${g}px de rolagem horizontal`);
        await page.evaluate(() => window.__anelZero.beginBattle('ruido', null));
        await page.waitForTimeout(300);
        const b = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (b > 0) throw new Error(`batalha com ${b}px de rolagem horizontal`);
      } finally {
        await ctx.close();
      }
    },
  },
  {
    name: 'rostos procedurais: Bit e as NPCs têm rosto, e a fala abre a boca',
    async run({ page, base }) {
      await newGame(page, base, 1);
      const info = await state(page, () => {
        const g = window.__anelZero;
        const npc = g.entities.find((e) => e.type === 'npc' && e.id === 'sementa');
        return { bit: !!g.player.face, npc: !!(npc && npc.obj.userData.face) };
      });
      if (!info.bit || !info.npc) throw new Error('rosto ausente: ' + JSON.stringify(info));
      await teleportNear(page, 'npc', 'sementa');
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      const talking = await state(page, () => window.__anelZero.player.talking);
      if (!talking) throw new Error('Bit não está em modo de fala durante o diálogo');
      await skipDialog(page);
    },
  },
  {
    name: 'derrota em batalha volta ao ponto seguro e perde 10% dos créditos',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.gold = 100; g.state.hp = 1;
        g.loadZone('alu', null, null, true);
        g.beginBattle('bloco', null);
      });
      await page.waitForTimeout(200);
      let label = null;
      for (let i = 0; i < 60 && !label; i++) {
        const exit = await page.$('#battle-cmds button.primary');
        if (exit) { label = await exit.textContent(); break; }
        const b = await page.$('#battle-cmds button:not([disabled])');
        if (b) await b.click();
        await page.waitForTimeout(550);
      }
      if (!label || !label.includes('Reiniciar')) throw new Error('batalha não terminou em derrota: ' + label);
      await page.click('#battle-cmds button.primary');
      await page.waitForTimeout(300);
      const s = await state(page, () => {
        const g = window.__anelZero;
        const t = g.player.tile();
        return { gold: g.state.gold, hp: g.state.hp, at: t, spawn: g.zone.spawn, open: !document.getElementById('battle').classList.contains('hidden') };
      });
      if (s.open) throw new Error('batalha continua aberta após a derrota');
      if (s.gold !== 90) throw new Error(`créditos após derrota = ${s.gold} (esperado 90)`);
      if (!(s.hp >= 1)) throw new Error('HP após derrota = ' + s.hp);
      if (s.at.c !== s.spawn.c || s.at.r !== s.spawn.r) throw new Error('não voltou ao ponto seguro: ' + JSON.stringify(s));
    },
  },
  {
    name: 'fuga funciona em inimigos comuns e é bloqueada contra chefes',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => window.__anelZero.beginBattle('sobrecarga', null));
      await page.waitForTimeout(150);
      const disabled = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#battle-cmds button')].find((x) => x.textContent === 'Fugir');
        return b ? b.disabled : null;
      });
      if (disabled !== true) throw new Error('Fugir deveria estar desabilitado contra chefe');
      await page.evaluate(() => window.__anelZero.beginBattle('pulga', null));
      await page.waitForTimeout(150);
      let closed = false;
      for (let i = 0; i < 25 && !closed; i++) {
        const flee = await page.$('#battle-cmds button:not([disabled])');
        const btn = await page.evaluateHandle(() => [...document.querySelectorAll('#battle-cmds button')].find((x) => x.textContent === 'Fugir' && !x.disabled) || null);
        const el = btn.asElement();
        if (el) await el.click(); else if (flee) await flee.click();
        await page.waitForTimeout(900);
        closed = !(await visible(page, '#battle'));
      }
      if (!closed) throw new Error('não conseguiu fugir em 25 tentativas');
    },
  },
  {
    name: 'venda na loja: vende um material e recebe o valor de venda',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.gold = 10; g.state.inv.fio_cobre = 3;
        g.loadZone('cache', null, null, true);
        const npc = g.entities.find((e) => e.id === 'lojista');
        g.player.setTile(npc.c - 1, npc.r);
      });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(200);
      await page.click('.tab[data-shop="sell"]');
      await page.locator('#shop-body .item-row', { hasText: 'Fio de Cobre' }).locator('button').click();
      await page.waitForTimeout(150);
      const s = await state(page, () => ({ gold: window.__anelZero.state.gold, fio: window.__anelZero.state.inv.fio_cobre }));
      if (s.gold !== 14) throw new Error(`ouro após venda = ${s.gold} (esperado 14: 10 + 4)`);
      if (s.fio !== 2) throw new Error('quantidade de fio não diminuiu: ' + s.fio);
    },
  },
  {
    name: 'reparo: fusível queimado não pode mais ser girado',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.flags.tut_repair = true;
        g.loadZone('alu', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const cur = window.__anelZero.repairDebug();
        for (let y = 0; y < cur.puzzle.n; y++) for (let x = 0; x < cur.puzzle.n; x++) {
          const c = cur.puzzle.cells[y][x];
          if (c.type === 'fusivel') { c.locked = true; return { x, y, n: cur.puzzle.n, rot: c.rot }; }
        }
        return null;
      });
      if (!r) throw new Error('nenhum fusível no tabuleiro da Forja');
      const box = await page.locator('#rp-canvas').boundingBox();
      const cs = box.width / r.n;
      await page.mouse.click(box.x + (r.x + 0.5) * cs, box.y + (r.y + 0.5) * cs);
      await page.waitForTimeout(150);
      const rotNow = await page.evaluate((rr) => window.__anelZero.repairDebug().puzzle.cells[rr.y][rr.x].rot, r);
      const info = await state(page, () => document.getElementById('rp-help').textContent);
      if (!info.includes('queimado')) throw new Error('aviso de fusível queimado ausente: ' + info);
      if (rotNow !== r.rot) throw new Error(`fusível queimado girou: ${r.rot} -> ${rotNow}`);
    },
  },
  {
    name: 'reparo: P pausa o cronômetro; H guarda a dificuldade para o próximo reparo',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.flags.tut_repair = true;
        g.loadZone('regs', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(200);
      await page.keyboard.press('KeyP');
      const t1 = await page.textContent('#rp-timer');
      await page.waitForTimeout(1500);
      const t2 = await page.textContent('#rp-timer');
      const help = await page.textContent('#rp-help');
      if (t1 !== t2) throw new Error(`cronômetro andou durante a pausa: ${t1} -> ${t2}`);
      if (!help.includes('PAUSADO')) throw new Error('aviso de pausa ausente: ' + help);
      await page.keyboard.press('KeyP');
      await page.keyboard.press('KeyH');
      const hard = await state(page, () => window.__anelZero.repairDebug().hard);
      if (!hard) throw new Error('modo difícil não ligou');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anel-zero-settings-v1')).repairHard);
      if (saved !== true) throw new Error('escolha de dificuldade não foi salva');
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(150);
      const next = await state(page, () => window.__anelZero.repairDebug().hard);
      if (!next) throw new Error('o próximo reparo não usou a dificuldade escolhida');
    },
  },
  {
    name: 'reparo com tempo esgotado fecha e avisa',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.evaluate(() => {
        const g = window.__anelZero;
        g.state.flags.tut_repair = true;
        g.loadZone('regs', null, null, true);
        g.interact(g.entities.find((e) => e.type === 'repair'));
      });
      await page.waitForTimeout(150);
      await page.evaluate(() => { const cur = window.__anelZero.repairDebug(); cur.startedAt -= 130000; });
      await page.waitForTimeout(1200);
      if (await visible(page, '#repair')) throw new Error('reparo não fechou com o tempo esgotado');
      const toast = await page.textContent('#toast');
      if (!toast.includes('Tempo esgotado')) throw new Error('aviso de tempo esgotado ausente: ' + toast);
    },
  },
  {
    name: 'áudio medido: efeitos e trilha produzem sinal, o pico nunca passa de 1 e volume zero silencia',
    async run({ page, base }) {
      await newGame(page, base, 1);
      const sample = (ms) => page.evaluate((m) => new Promise((resolve) => {
        let max = 0; const start = performance.now();
        const tick = () => {
          max = Math.max(max, window.__anelZero.audioPeak());
          if (performance.now() - start < m) setTimeout(tick, 25); else resolve(max);
        };
        tick();
      }), ms);
      await page.evaluate(() => window.__anelZero.playSfx('win'));
      const sfxPeak = await sample(700);
      if (!(sfxPeak > 0.01)) throw new Error('efeito não produziu sinal: ' + sfxPeak);
      await page.evaluate(() => window.__anelZero.playMusic('regs'));
      const musicPeak = await sample(1400);
      if (!(musicPeak > 0.002)) throw new Error('trilha não produziu sinal: ' + musicPeak);
      if (musicPeak > 1 || sfxPeak > 1) throw new Error('pico acima de 1');
      await page.evaluate(() => { window.__anelZero.setVolume('music', 0); window.__anelZero.setVolume('sfx', 0); });
      await page.waitForTimeout(400);
      const silent = await sample(700);
      if (silent > 0.002) throw new Error('volume zero não silenciou: ' + silent);
    },
  },
  {
    name: 'paredes têm desenho próprio por zona',
    async run({ page, base }) {
      await newGame(page, base, 1);
      const urls = await page.evaluate(() => {
        const out = {};
        for (const id of ['cache', 'regs', 'alu', 'pipeline']) {
          window.__anelZero.loadZone(id, null, null, true);
          let url = null;
          window.__anelZero.zone.group.traverse((o) => {
            if (!url && o.isInstancedMesh && o.geometry.parameters && o.geometry.parameters.height === 2.6 && o.material.map) {
              url = o.material.map.image.toDataURL();
            }
          });
          out[id] = url;
        }
        return out;
      });
      const values = Object.values(urls);
      if (values.some((v) => !v)) throw new Error('parede sem textura');
      if (new Set(values).size !== values.length) throw new Error('duas zonas têm a mesma parede');
    },
  },
  {
    name: 'dificuldade das batalhas: o ajuste cicla e muda o dano aplicado',
    async run({ page, base }) {
      await newGame(page, base, 1);
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(200);
      if (!(await visible(page, '#menu'))) throw new Error('menu não abriu com M');
      await page.click('.tab[data-tab="config"]');
      await page.waitForTimeout(150);
      const idx = await page.$$eval('#menu-body .setting-row', (r) => Array.from(r).findIndex((x) => x.textContent.includes('Dificuldade das batalhas')));
      if (idx < 0) throw new Error('linha de dificuldade ausente; linhas: ' + (await page.$$eval('#menu-body .setting-row', (r) => Array.from(r).map((x) => x.textContent).join(' | '))));
      const btn = async () => { const bs = await page.$$('#menu-body .setting-row button'); if (!bs[idx]) throw new Error(`idx ${idx} de ${bs.length} botões`); return bs[idx]; };
      await (await btn()).click();
      const first = await state(page, () => JSON.parse(localStorage.getItem('anel-zero-settings-v1')).battleDifficulty);
      if (first !== 'dificil') throw new Error('primeiro ciclo deveria ser difícil: ' + first);
      await (await btn()).click();
      const second = await state(page, () => JSON.parse(localStorage.getItem('anel-zero-settings-v1')).battleDifficulty);
      if (second !== 'facil') throw new Error('ciclo deveria voltar a fácil: ' + second);
      await page.click('#btn-close');
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__anelZero.state.hp = 200; window.__anelZero.beginBattle('bloco', null); });
      await page.waitForTimeout(200);
      await page.click('#battle-cmds button:not([disabled])');
      // Espera um golpe normal do inimigo (a intenção é sorteada; golpes pesados e reparos são ignorados)
      for (let i = 0; i < 8; i++) {
        const normal = await page.evaluate(() => /Bloco Corrompido ataca e causa \d+ de dano/.test(document.getElementById('battle-log').textContent));
        if (normal) break;
        const b = await page.$('#battle-cmds button:not([disabled])');
        if (b) await b.click();
        await page.waitForTimeout(900);
      }
      const log = await page.$$eval('#battle-log p', (ps) => Array.from(ps).map((p) => p.textContent).join(' | '));
      const m = log.match(/Bloco Corrompido ataca e causa (\d+) de dano/);
      if (!m) throw new Error(`registro ausente (aberta: ${await visible(page, '#battle')}, html: ${(await page.evaluate(() => document.getElementById('battle-log').innerHTML)).slice(0, 160)}, tests: ${await page.evaluate(() => document.querySelectorAll('#battle-log p').length)})`);
      if (Number(m[1]) > 6) throw new Error('dano no modo fácil acima do esperado: ' + m[1]);
    },
  },
  {
    name: 'FPS medido em 360 px (informativo, com renderização por software)',
    async run({ browser, base, report }) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      try {
        await newGame(page, base, 1);
        const fps = await page.evaluate(() => new Promise((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - start < 3000) requestAnimationFrame(tick);
            else resolve(frames / ((performance.now() - start) / 1000));
          };
          requestAnimationFrame(tick);
        }));
        report(`FPS médio em 360 px (swiftshader, sem GPU): ${fps.toFixed(1)}`);
        if (!(fps > 0)) throw new Error('nenhum quadro renderizado');
      } finally {
        await ctx.close();
      }
    },
  },
];

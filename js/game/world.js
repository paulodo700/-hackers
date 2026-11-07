// Mundo de combate de uma sala: ondas, colisões, projéteis, drops, chefes e desenho da arena.
(() => {
  const V = (window.V = window.V || {});
  const { R, clamp, dist } = V.Util;
  const { ARENA, CENTER } = V.Arena;
  const E = V.Entities;

  function circleRect(x, y, r, o) {
    const nx = clamp(x, o.x, o.x + o.w);
    const ny = clamp(y, o.y, o.y + o.h);
    const dx = x - nx;
    const dy = y - ny;
    return dx * dx + dy * dy < r * r;
  }

  class World {
    // kind: 'combat' | 'elite' | 'boss'
    constructor(kind) {
      const run = V.Run;
      this.run = run;
      this.kind = kind;
      this.chapter = run.chapterDef();
      this.arena = ARENA;
      this.obstacles = V.Arena.makeObstacles(this.chapter, R, V.Arena.obstacleCount(kind, R));
      this.floor = V.Sprites.floor(this.chapter.theme, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0, run.seed + run.step * 17 + run.chapter * 101);
      this.player = new E.Player(run.stats, CENTER.x, CENTER.y);
      this.enemies = [];
      this.projectiles = [];
      this.pickups = [];
      this.parts = [];
      this.floats = [];
      this.zones = [];
      this.touchCd = {};
      this.waves = kind === 'boss' ? [] : V.Arena.makeWaves(this.chapter, run.step, kind, R);
      this.waveCd = 0.9;
      this.bossSpawned = false;
      this.state = 'play';
      this.endT = 0;
      this.time = 0;
      this.shakeT = 0;
      this.shakeMag = 0;
      this.levelUps = 0;
      this.roomKills = 0;
      this.bossDown = false;
      this.totalWaves = this.waves.length;
      this.pendingLevelUps = 0;
      this.bossNotice = 0;
      this.lastDmgAt = -10;
    }

    // ---------- Utilidades de mundo (usadas por entidades e IA) ----------

    sfx(name) {
      V.Audio.sfx(name);
    }

    shake(mag) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeT = 0.2;
    }

    particles(x, y, o = {}) {
      if (o.ring) {
        this.parts.push(new E.Particle(x, y, { ring: true, color: o.color || '#fff3c4', size: o.size || 6, life: o.life || 0.35, grav: 0 }));
        return;
      }
      const n = o.count || 6;
      for (let i = 0; i < n; i++) {
        this.parts.push(new E.Particle(x, y, { color: o.color, speed: o.speed, life: o.life, size: o.size }));
      }
    }

    floatText(x, y, text, color, size) {
      this.floats.push(new E.FloatText(x, y, text, color, size));
    }

    addZone(o) {
      this.zones.push(new E.Zone(o));
    }

    spawnProjectile(o) {
      this.projectiles.push(new E.Projectile(o));
    }

    addEnemy(id, x, y, opts = {}) {
      const e = new E.Enemy(id, x, y, opts);
      this.enemies.push(e);
      return e;
    }

    // Empurra uma entidade para dentro da arena e para fora dos obstáculos.
    resolveMove(e, r) {
      const a = this.arena;
      e.x = clamp(e.x, a.x0 + r, a.x1 - r);
      e.y = clamp(e.y, a.y0 + r, a.y1 - r);
      for (const o of this.obstacles) {
        const nx = clamp(e.x, o.x, o.x + o.w);
        const ny = clamp(e.y, o.y, o.y + o.h);
        const dx = e.x - nx;
        const dy = e.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = r - d;
            e.x += (dx / d) * push;
            e.y += (dy / d) * push;
          } else {
            // Centro dentro do retângulo: empurra pelo menor lado.
            const left = e.x - o.x;
            const right = o.x + o.w - e.x;
            const top = e.y - o.y;
            const bottom = o.y + o.h - e.y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) e.x = o.x - r;
            else if (m === right) e.x = o.x + o.w + r;
            else if (m === top) e.y = o.y - r;
            else e.y = o.y + o.h + r;
          }
        }
      }
    }

    activeEnemies() {
      return this.enemies.filter((e) => !e.dead && e.spawnT <= 0);
    }

    nearestEnemy(x, y) {
      let best = null;
      let bd = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = dist(x, y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      return best;
    }

    // Disparo do jogador: leque de flechas em direção ao alvo mais próximo.
    fire(p, target) {
      const s = p.stats;
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const n = s.multishot;
      const speed = 430;
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.16;
        const ang = a + off;
        const crit = R.next() < s.critChance;
        const dmg = s.dmg * (0.92 + R.next() * 0.16) * (crit ? s.critMult : 1);
        this.projectiles.push(
          new E.Projectile({
            x: p.x,
            y: p.y - 6,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            dmg,
            from: 'player',
            crit,
            pierce: s.pierce,
            bounces: s.bounces,
            homing: s.homing,
            explode: s.explode,
            life: 1.6,
          })
        );
      }
      this.sfx('shoot');
    }

    // Dano de contato com cooldown próprio (lâminas, etc.).
    touchPlayer(x, y, r, dmg, key, cd) {
      if ((this.touchCd[key] || 0) > 0) return;
      if (dist(x, y, this.player.x, this.player.y) < r + this.player.r) {
        this.touchCd[key] = cd;
        this.hurtPlayer(dmg, 'Lâmina');
      }
    }

    hurtPlayer(dmg, label) {
      const p = this.player;
      const s = p.stats;
      if (this.state !== 'play' || p.iframes > 0) return;
      if (R.next() < s.dodge) {
        this.floatText(p.x, p.y - 30, 'Esquiva!', '#9fd3ff', 14);
        p.iframes = 0.25;
        return;
      }
      const dealt = Math.max(1, Math.round(dmg * (1 - s.armor)));
      s.hp -= dealt;
      p.iframes = 0.45;
      p.hurtFlash = 0.2;
      this.floatText(p.x, p.y - 30, '-' + dealt, '#ff6b6b', 16);
      this.particles(p.x, p.y, { color: '#ff5a5a', count: 8, speed: 120 });
      this.shake(5);
      this.sfx('hurt');
      this.lastDmgAt = this.time;
      if (s.hp <= 0) {
        s.hp = 0;
        this.state = 'lost';
        this.endT = 1.2;
        this.sfx('die');
      }
    }

    collect(pk) {
      const s = this.player.stats;
      switch (pk.kind) {
        case 'coin':
          this.run.addGold(pk.value);
          this.floatText(pk.x, pk.y - 8, '+' + pk.value, '#ffd54a', 13);
          this.sfx('coin');
          break;
        case 'gem':
          this.run.addGold(pk.value);
          this.floatText(pk.x, pk.y - 8, '+' + pk.value, '#7fd8ff', 14);
          this.sfx('gem');
          break;
        case 'xp': {
          const ups = this.run.addXp(pk.value);
          this.pendingLevelUps += ups;
          this.sfx('xp');
          break;
        }
        case 'heart':
        case 'potion': {
          const before = s.hp;
          s.hp = Math.min(s.maxHp, s.hp + pk.value);
          const got = Math.round(s.hp - before);
          this.floatText(pk.x, pk.y - 8, '+' + (got || pk.value), '#7dff9a', 14);
          this.sfx('heal');
          break;
        }
        default:
          break;
      }
    }

    // Aplica dano a um inimigo e cuida do texto, partículas e morte.
    damageEnemy(e, dmg, crit, x, y) {
      const killed = e.damage(dmg);
      this.floatText(e.x, e.y - e.size * 0.5, String(Math.round(dmg)), crit ? '#ffd166' : '#ffffff', crit ? 20 : 14);
      this.particles(x, y, { color: crit ? '#ffd166' : '#fff3c4', count: crit ? 7 : 4, speed: 110, life: 0.3 });
      if (!killed) this.sfx(crit ? 'crit' : 'hit');
      if (killed) this.kill(e);
    }

    // Explosão de área (flecha incendiária).
    explosion(x, y, r, dmg) {
      this.particles(x, y, { ring: true, color: '#ffb347', size: 6, life: 0.35 });
      for (const e of this.activeEnemies()) {
        if (dist(x, y, e.x, e.y) < r + e.r) this.damageEnemy(e, dmg, false, e.x, e.y);
      }
    }

    kill(e) {
      if (e.killed) return;
      e.killed = true;
      V.AI.onDeath(e, this);
      this.run.kills++;
      this.roomKills++;
      const s = this.player.stats;
      this.particles(e.x, e.y, { color: e.boss ? '#ffd166' : '#ffe9a8', count: e.boss ? 36 : 12, speed: e.boss ? 260 : 140 });
      this.sfx('enemyDie');

      // XP: distribuído em orbes.
      const xpN = clamp(Math.round(e.xp / 2) + 1, 1, 4);
      for (let i = 0; i < xpN; i++) {
        this.pickups.push(new E.Pickup('xp', e.x + R.range(-6, 6), e.y + R.range(-6, 6), e.xp / xpN));
      }
      // Ouro: moedas inteiras.
      const goldAmt = Math.round(e.gold * s.goldMult);
      if (goldAmt > 0) {
        const n = clamp(Math.round(goldAmt / 3) + 1, 1, 4);
        let left = goldAmt;
        for (let i = 0; i < n; i++) {
          const v = i === n - 1 ? left : Math.max(1, Math.floor(goldAmt / n));
          left -= v;
          if (v > 0) this.pickups.push(new E.Pickup('coin', e.x + R.range(-8, 8), e.y + R.range(-8, 8), v));
        }
      }
      if (!e.boss) {
        if (R.chance(0.05)) this.pickups.push(new E.Pickup('heart', e.x, e.y, 15));
        if (R.chance(e.champion ? 0.6 : 0.03)) this.pickups.push(new E.Pickup('potion', e.x, e.y, 25));
        if (R.chance(0.03)) this.pickups.push(new E.Pickup('gem', e.x, e.y, 8));
      }
      if (s.lifesteal > 0) {
        const before = s.hp;
        s.hp = Math.min(s.maxHp, s.hp + s.lifesteal);
        if (s.hp > before) this.floatText(this.player.x, this.player.y - 34, '+' + Math.round(s.hp - before), '#ff7fb0', 13);
      }
      if (e.champion) this.floatText(e.x, e.y - e.size * 0.7, 'Campeão caiu!', '#ffcf5a', 14);
      if (e.boss) this.bossDeath(e);
    }

    bossDeath(e) {
      this.bossDown = true;
      this.run.bossesKilled++;
      this.shake(10);
      this.sfx('slam');
      this.particles(e.x, e.y, { ring: true, color: '#ffd166', size: 14, life: 0.6 });
      for (const o of this.enemies) if (!o.dead && o !== e) o.dead = true;
      this.state = 'won';
      this.endT = 2.4;
    }

    bossPhase(e) {
      this.sfx('roar');
      this.shake(9);
      this.particles(e.x, e.y, { ring: true, color: '#ff7a2a', size: 12, life: 0.5 });
      this.bossNotice = 2.0;
      this.floatText(180, 200, 'FASE 2!', '#ffb347', 26);
    }

    spawnPoint() {
      const a = this.arena;
      for (let i = 0; i < 40; i++) {
        const x = R.range(a.x0 + 30, a.x1 - 30);
        const y = R.range(a.y0 + 30, a.y1 - 70);
        if (dist(x, y, this.player.x, this.player.y) < 130) continue;
        if (this.obstacles.some((o) => circleRect(x, y, 14, o))) continue;
        return { x, y };
      }
      return { x: 180, y: 200 };
    }

    spawnBoss() {
      const b = this.addEnemy(this.chapter.boss, 180, 212, { spawnT: 1.2 });
      this.bossRef = b;
      this.bossNotice = 2.4;
      this.sfx('roar');
      this.floatText(180, 260, this.bossName(b), '#ffd166', 18);
    }

    bossName(b) {
      return b.name;
    }

    update(dt) {
      if (this.state !== 'play') {
        this.endT -= dt;
        this.updateParticles(dt);
        this.updateFx(dt);
        return;
      }
      this.time += dt;
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) this.shakeMag = 0;
      }
      if (this.bossNotice > 0) this.bossNotice -= dt;
      for (const k in this.touchCd) this.touchCd[k] -= dt;

      this.player.update(dt, this);
      for (const e of this.enemies) if (!e.dead) e.update(dt, this);

      // Dano de contato com inimigos.
      const pl = this.player;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.contactCd > 0) continue;
        if (dist(e.x, e.y, pl.x, pl.y) < e.r + pl.r) {
          e.contactCd = 0.8;
          this.hurtPlayer(e.dmg, e.name);
        }
      }

      for (const z of this.zones) z.update(dt, this);
      this.zones = this.zones.filter((z) => !z.dead);

      this.updateProjectiles(dt);
      this.updateSpawn(dt);

      for (const pk of this.pickups) pk.update(dt, this);
      this.pickups = this.pickups.filter((p) => !p.dead);

      this.updateParticles(dt);
      this.updateFx(dt);
      this.enemies = this.enemies.filter((e) => !e.dead);

      if (this.kind !== 'boss' && this.waves.length === 0 && this.enemies.length === 0 && this.state === 'play') {
        this.state = 'won';
        this.endT = 0.9;
        this.sfx('roomClear');
      }
      if (this.kind === 'boss' && this.bossSpawned && !this.bossDown && this.enemies.length === 0) {
        // Segurança: chefe removido sem morrer não deve travar a sala.
        this.state = 'won';
        this.endT = 0.5;
      }
    }

    updateProjectiles(dt) {
      const a = this.arena;
      for (const p of this.projectiles) {
        if (p.dead) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.dead = true;
          continue;
        }
        // Mira teleguiada.
        if (p.homing > 0) {
          let tx = null;
          let ty = null;
          if (p.from === 'player') {
            let best = null;
            let bd = 240;
            for (const e of this.enemies) {
              if (e.dead || e.spawnT > 0 || p.hits.has(e.uid)) continue;
              const d = dist(p.x, p.y, e.x, e.y);
              if (d < bd) {
                bd = d;
                best = e;
              }
            }
            if (best) {
              tx = best.x;
              ty = best.y;
            }
          } else {
            tx = this.player.x;
            ty = this.player.y;
          }
          if (tx !== null) {
            const sp = Math.hypot(p.vx, p.vy);
            const cur = Math.atan2(p.vy, p.vx);
            const want = Math.atan2(ty - p.y, tx - p.x);
            let diff = want - cur;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turn = clamp(diff, -p.homing * 3.2 * dt, p.homing * 3.2 * dt);
            p.vx = Math.cos(cur + turn) * sp;
            p.vy = Math.sin(cur + turn) * sp;
          }
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot = Math.atan2(p.vy, p.vx);

        // Bordas da arena.
        if (p.from === 'player') {
          if (p.x < a.x0 || p.x > a.x1) {
            if (p.bounces > 0) {
              p.bounces--;
              p.vx = -p.vx;
              p.x = clamp(p.x, a.x0 + 1, a.x1 - 1);
              this.particles(p.x, p.y, { color: '#cfe8ff', count: 3, speed: 60, life: 0.2 });
            } else p.dead = true;
          }
          if (p.y < a.y0 || p.y > a.y1) {
            if (p.bounces > 0) {
              p.bounces--;
              p.vy = -p.vy;
              p.y = clamp(p.y, a.y0 + 1, a.y1 - 1);
              this.particles(p.x, p.y, { color: '#cfe8ff', count: 3, speed: 60, life: 0.2 });
            } else p.dead = true;
          }
        } else if (p.x < a.x0 - 20 || p.x > a.x1 + 20 || p.y < a.y0 - 20 || p.y > a.y1 + 20) {
          p.dead = true;
        }
        if (p.dead) continue;

        // Obstáculos.
        for (const o of this.obstacles) {
          if (!circleRect(p.x, p.y, p.r, o)) continue;
          if (p.from === 'player' && p.bounces > 0) {
            p.bounces--;
            const dl = Math.min(Math.abs(p.x - o.x), Math.abs(p.x - (o.x + o.w)));
            const dt2 = Math.min(Math.abs(p.y - o.y), Math.abs(p.y - (o.y + o.h)));
            if (dl < dt2) p.vx = -p.vx;
            else p.vy = -p.vy;
            p.x += p.vx * dt * 2;
            p.y += p.vy * dt * 2;
            this.particles(p.x, p.y, { color: '#cfe8ff', count: 3, speed: 60, life: 0.2 });
          } else {
            p.dead = true;
            this.particles(p.x, p.y, { color: '#c9b79a', count: 4, speed: 70, life: 0.25 });
          }
          break;
        }
        if (p.dead) continue;

        if (p.from === 'player') this.playerProjectileHits(p);
        else this.enemyProjectileHits(p);
      }
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    }

    playerProjectileHits(p) {
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || p.hits.has(e.uid)) continue;
        if (dist(p.x, p.y, e.x, e.y) < e.r + p.r) {
          p.hits.add(e.uid);
          this.damageEnemy(e, p.dmg, p.crit, p.x, p.y);
          if (p.explode > 0) this.explosion(p.x, p.y, 46, p.dmg * p.explode);
          if (p.pierce > 0 && p.hits.size <= p.pierce) continue;
          p.dead = true;
          return;
        }
      }
    }

    enemyProjectileHits(p) {
      const pl = this.player;
      if (dist(p.x, p.y, pl.x, pl.y) < pl.r + p.r) {
        this.hurtPlayer(p.dmg, 'Projétil');
        if (p.slow) pl.slowT = Math.max(pl.slowT, p.slow);
        p.dead = true;
      }
    }

    updateSpawn(dt) {
      if (this.kind === 'boss') {
        if (!this.bossSpawned) {
          this.waveCd -= dt;
          if (this.waveCd <= 0) {
            this.bossSpawned = true;
            this.spawnBoss();
          }
        }
        return;
      }
      if (this.waveCd > 0) {
        this.waveCd -= dt;
        return;
      }
      const living = this.enemies.some((e) => !e.dead);
      if (!living && this.waves.length) {
        const wave = this.waves.shift();
        wave.forEach((u, i) => {
          const pt = this.spawnPoint();
          this.addEnemy(u.id, pt.x, pt.y, Object.assign({}, u.opts, { spawnT: 0.55 + i * 0.09 }));
        });
        this.waveCd = 0.4;
      }
    }

    updateParticles(dt) {
      for (const p of this.parts) p.update(dt);
      this.parts = this.parts.filter((p) => !p.dead);
    }

    updateFx(dt) {
      for (const f of this.floats) f.update(dt);
      this.floats = this.floats.filter((f) => !f.dead);
    }

    // ---------- Desenho ----------

    drawArena(g) {
      const a = this.arena;
      const th = V.Sprites.THEMES[this.chapter.theme];
      // moldura de parede
      g.fillStyle = th.wall;
      V.UI.roundRect(g, a.x0 - 16, a.y0 - 16, a.x1 - a.x0 + 32, a.y1 - a.y0 + 32, 16);
      g.fill();
      g.fillStyle = th.wallTop;
      V.UI.roundRect(g, a.x0 - 12, a.y0 - 12, a.x1 - a.x0 + 24, 8, 4);
      g.fill();
      // piso
      g.save();
      V.UI.roundRect(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, 8);
      g.clip();
      g.drawImage(this.floor, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      // sombra interna (profundidade)
      const shade = g.createLinearGradient(0, a.y0, 0, a.y0 + 60);
      shade.addColorStop(0, 'rgba(0,0,0,0.35)');
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = shade;
      g.fillRect(a.x0, a.y0, a.x1 - a.x0, 60);
      const vig = g.createRadialGradient(180, 335, 120, 180, 335, 260);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vig;
      g.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      g.restore();
      // obstáculos
      for (const o of this.obstacles) {
        const img = V.Sprites.obstacle(this.chapter.theme, o.kind, o.w, o.h);
        g.drawImage(img, o.x, o.y, o.w, o.h);
      }
    }

    draw(g) {
      const sx = this.shakeT > 0 ? R.range(-this.shakeMag, this.shakeMag) : 0;
      const sy = this.shakeT > 0 ? R.range(-this.shakeMag, this.shakeMag) : 0;
      g.save();
      g.translate(sx, sy);
      this.drawArena(g);
      for (const z of this.zones) z.draw(g);
      for (const pk of this.pickups) pk.draw(g);
      const ents = this.enemies.slice().concat([this.player]).sort((a, b) => a.y - b.y);
      for (const en of ents) {
        if (en === this.player) en.draw(g);
        else en.draw(g);
      }
      for (const p of this.projectiles) p.draw(g);
      for (const p of this.parts) p.draw(g);
      for (const f of this.floats) f.draw(g);
      g.restore();
    }
  }

  V.World = World;
})();

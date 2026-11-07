// Entidades do combate: jogador, inimigos, projéteis, coletáveis, partículas, textos e zonas.
(() => {
  const V = (window.V = window.V || {});
  const { R, clamp } = V.Util;

  let uid = 1;

  class Player {
    constructor(stats, x, y) {
      this.stats = stats; // compartilhado com a run (cartas alteram diretamente)
      this.x = x;
      this.y = y;
      this.r = 12;
      this.fireCd = 0;
      this.iframes = 0;
      this.slowT = 0;
      this.dodgeFlash = 0;
      this.face = 1;
      this.walkT = 0;
      this.hurtFlash = 0;
      this.moving = false;
    }

    get hp() {
      return this.stats.hp;
    }

    update(dt, w) {
      const s = this.stats;
      const mv = V.Input.move();
      const slow = this.slowT > 0 ? 0.55 : 1;
      if (this.slowT > 0) this.slowT -= dt;
      const sp = s.moveSpeed * slow;
      const len = Math.hypot(mv.x, mv.y);
      this.moving = len > 0.05;
      if (this.moving) {
        this.x += mv.x * sp * dt;
        this.y += mv.y * sp * dt;
        if (Math.abs(mv.x) > 0.15) this.face = mv.x > 0 ? 1 : -1;
        this.walkT += dt * 9;
      }
      w.resolveMove(this, this.r);
      if (this.iframes > 0) this.iframes -= dt;
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
      if (this.dodgeFlash > 0) this.dodgeFlash -= dt;
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        const target = w.nearestEnemy(this.x, this.y);
        if (target) {
          this.fireCd = 1 / s.fireRate;
          w.fire(this, target);
        }
      }
    }

    draw(g) {
      const bob = this.moving ? Math.sin(this.walkT) * 1.2 : Math.sin(performance.now() / 420) * 0.8;
      const blink = this.iframes > 0 && Math.floor(this.iframes * 16) % 2 === 0;
      if (blink) return;
      V.Sprites.draw(g, 'player', this.x, this.y - 8 + bob, 52, {
        frame: this.moving && Math.floor(this.walkT) % 2 ? 1 : 0,
        flip: this.face < 0,
      });
      if (this.hurtFlash > 0) {
        g.save();
        g.globalAlpha = Math.min(0.6, this.hurtFlash * 2);
        g.fillStyle = '#ff3b3b';
        g.beginPath();
        g.arc(this.x, this.y - 8, 22, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }

  class Enemy {
    constructor(id, x, y, o = {}) {
      const def = V.Data.monsters[id] || V.Data.bosses[id];
      this.uid = uid++;
      this.id = id;
      this.def = def;
      this.name = def.name;
      this.sprite = def.sprite;
      this.boss = !!o.boss;
      this.champion = !!o.champion;
      this.gen = o.gen || 0;
      const hpMul = o.hpMul || 1;
      this.maxHp = Math.round(def.hp * hpMul);
      this.hp = this.maxHp;
      this.speed = def.speed * (o.speedMul || 1);
      this.dmg = (def.dmg || 12) * (o.dmgMul || 1);
      this.sizeMul = o.sizeMul || 1;
      this.dmgMul = o.dmgMul || 1;
      this.r = def.radius * this.sizeMul;
      this.size = def.size * this.sizeMul;
      this.ai = def.ai;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.xp = Math.round(def.xp * (o.xpMul || 1));
      this.gold = Math.round(def.gold * (o.goldMul || 1));
      this.t = 0;
      this.cd = {};
      this.state = 'idle';
      this.stateT = 0.6 + R.next() * 0.8;
      this.flash = 0;
      this.spawnT = o.spawnT == null ? 0.55 : o.spawnT;
      this.spawnTotal = Math.max(0.001, this.spawnT);
      this.frame = 0;
      this.frameT = 0;
      this.dead = false;
      this.face = x < 180 ? 1 : -1;
      this.slowT = 0;
      this.phase = 1;
      this.data = {};
      this.contactCd = 0;
      this.hpBar = 0;
    }

    get active() {
      return !this.dead && this.spawnT <= 0;
    }

    update(dt, w) {
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.contactCd > 0) this.contactCd -= dt;
      if (this.spawnT > 0) {
        this.spawnT -= dt;
        return;
      }
      if (this.slowT > 0) this.slowT -= dt;
      this.frameT += dt;
      if (this.frameT > 0.22) {
        this.frameT = 0;
        this.frame = 1 - this.frame;
      }
      V.AI.update(this, dt, w);
      if (Math.abs(this.vx) > 6) this.face = this.vx > 0 ? 1 : -1;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      w.resolveMove(this, this.r);
      this.hpBar = V.Util.approach(this.hpBar, this.hp / this.maxHp, dt * 1.5);
    }

    damage(amount) {
      if (this.dead || this.spawnT > 0) return false;
      this.hp -= amount;
      this.flash = 0.12;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        return true;
      }
      return false;
    }

    draw(g) {
      if (this.spawnT > 0) {
        const k = clamp(1 - this.spawnT / this.spawnTotal, 0, 1);
        g.save();
        g.globalAlpha = 0.35 + 0.65 * k;
        g.beginPath();
        g.ellipse(this.x, this.y, this.r * 1.4 * (0.5 + k * 0.5), this.r * 0.6 * (0.5 + k * 0.5), 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,220,140,0.4)';
        g.fill();
        g.restore();
        return;
      }
      const squash = this.ai === 'hop' && this.state === 'hop' ? 1.08 : 1;
      V.Sprites.draw(g, this.sprite, this.x, this.y - (this.boss ? 22 : 0), this.size * squash, {
        frame: this.frame,
        flip: this.face < 0,
        alpha: this.flash > 0 ? 0.7 : 1,
      });
      if (this.flash > 0) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.min(0.5, this.flash * 3);
        V.Sprites.draw(g, this.sprite, this.x, this.y - (this.boss ? 22 : 0), this.size, { frame: this.frame, flip: this.face < 0 });
        g.restore();
      }
      V.AI.drawExtras(this, g);
      if (this.champion) {
        g.save();
        g.strokeStyle = 'rgba(255,207,90,0.8)';
        g.lineWidth = 2;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.arc(this.x, this.y, this.r + 6, this.t, this.t + Math.PI * 2 * 0.9);
        g.stroke();
        g.restore();
      }
      if (this.slowT > 0) {
        g.save();
        g.globalAlpha = 0.5;
        g.strokeStyle = '#e8ecff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(this.x, this.y - this.size * 0.45, 6, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    }
  }

  class Projectile {
    constructor(o) {
      this.x = o.x;
      this.y = o.y;
      this.vx = o.vx;
      this.vy = o.vy;
      this.r = o.r || 6;
      this.dmg = o.dmg || 0;
      this.from = o.from || 'player';
      this.sprite = o.sprite || (this.from === 'player' ? 'arrow' : 'orb_r');
      this.size = o.size || (this.from === 'player' ? 26 : 22);
      this.life = o.life || 2.5;
      this.pierce = o.pierce || 0;
      this.bounces = o.bounces || 0;
      this.homing = o.homing || 0;
      this.explode = o.explode || 0;
      this.crit = !!o.crit;
      this.slow = o.slow || 0;
      this.hits = new Set();
      this.dead = false;
      this.rot = Math.atan2(this.vy, this.vx);
      this.spin = o.spin || 0;
    }

    draw(g) {
      if (this.sprite === 'arrow' || this.sprite === 'arrow_e') {
        V.Sprites.draw(g, this.sprite, this.x, this.y, this.size, { rot: this.rot });
        if (this.crit) {
          g.save();
          g.globalAlpha = 0.5;
          g.fillStyle = '#ffd166';
          g.beginPath();
          g.arc(this.x - Math.cos(this.rot) * 8, this.y - Math.sin(this.rot) * 8, 3, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      } else {
        V.Sprites.draw(g, this.sprite, this.x, this.y, this.size, { rot: this.spin ? this.life * this.spin : 0 });
      }
    }
  }

  class Pickup {
    constructor(kind, x, y, value) {
      this.kind = kind;
      this.x = x;
      this.y = y;
      this.value = value || 1;
      this.vx = R.range(-70, 70);
      this.vy = R.range(-90, -30);
      this.life = 14;
      this.t = R.next() * 6;
      this.magnet = false;
      this.dead = false;
    }

    update(dt, w) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const p = w.player;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (this.vy !== undefined) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy = (this.vy + 260 * dt) * 0.92;
        if (this.y > w.arena.y1 - 10) {
          this.y = w.arena.y1 - 10;
          this.vy = -this.vy * 0.3;
        }
      }
      if (d < 92 || this.magnet || w.state !== 'play') {
        this.magnet = true;
        const sp = 260 + (92 - Math.min(d, 92)) * 4;
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.x += (dx / len) * sp * dt;
        this.y += (dy / len) * sp * dt;
        if (len < 14) {
          this.dead = true;
          w.collect(this);
        }
      }
    }

    draw(g) {
      const bob = Math.sin(this.t * 5) * 1.5;
      const id = { coin: 'coin', gem: 'gem', heart: 'heart', xp: 'xp', potion: 'potion' }[this.kind];
      V.Sprites.draw(g, id, this.x, this.y + bob, this.kind === 'xp' ? 14 : 18);
    }
  }

  class Particle {
    constructor(x, y, o = {}) {
      this.x = x;
      this.y = y;
      const a = o.angle == null ? R.range(0, Math.PI * 2) : o.angle;
      const sp = o.speed == null ? R.range(40, 160) : o.speed;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
      this.life = o.life || R.range(0.3, 0.6);
      this.max = this.life;
      this.color = o.color || '#ffd77a';
      this.size = o.size || R.range(2, 4.5);
      this.grav = o.grav == null ? 180 : o.grav;
      this.drag = o.drag == null ? 0.9 : o.drag;
      this.dead = false;
      this.ring = !!o.ring;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      this.vx *= Math.pow(this.drag, dt * 60);
      this.vy = this.vy * Math.pow(this.drag, dt * 60) + this.grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(g) {
      const k = clamp(this.life / this.max, 0, 1);
      g.globalAlpha = k;
      if (this.ring) {
        g.strokeStyle = this.color;
        g.lineWidth = 2 + (1 - k) * 2;
        g.beginPath();
        g.arc(this.x, this.y, this.size * (1 + (1 - k) * 3), 0, Math.PI * 2);
        g.stroke();
      } else {
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.size * (0.5 + k * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  class FloatText {
    constructor(x, y, text, color, size) {
      this.x = x + R.range(-6, 6);
      this.y = y;
      this.text = text;
      this.color = color || '#fff';
      this.size = size || 14;
      this.life = 0.9;
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      this.y -= 38 * dt;
      if (this.life <= 0) this.dead = true;
    }

    draw(g) {
      g.globalAlpha = clamp(this.life / 0.9, 0, 1);
      V.UI.text(g, this.text, this.x, this.y, {
        size: this.size,
        align: 'center',
        weight: 'bold',
        color: this.color,
        stroke: 'rgba(10,5,20,0.85)',
        strokeW: 3,
        shadow: false,
      });
      g.globalAlpha = 1;
    }
  }

  // Zona de perigo com aviso (telegraph). Tipos:
  //  - burst: após o aviso, dano instantâneo se o jogador estiver dentro do raio.
  //  - pool: após o aviso, poça que causa dano periódico (tick) e pode lentificar.
  //  - ring: onda de choque que se expande até o raio e atinge uma vez.
  class Zone {
    constructor(o) {
      this.x = o.x;
      this.y = o.y;
      this.r = o.r;
      this.kind = o.kind || 'burst';
      this.warn = o.warn || 0;
      this.life = o.life || 0.35;
      this.dmg = o.dmg || 0;
      this.tick = o.tick || 0;
      this.slow = o.slow || 0;
      this.color = o.color || '#ff5a5a';
      this.warnTotal = this.warn;
      this.armed = this.warn <= 0;
      this.t = 0;
      this.tickT = 0;
      this.hitDone = false;
      this.curR = 0;
      this.dead = false;
      this.label = o.label || '';
    }

    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (!this.armed) {
        this.warn -= dt;
        if (this.warn <= 0) {
          this.armed = true;
          this.t = 0;
          if (this.kind === 'burst' && this.dmg) {
            if (Math.hypot(p.x - this.x, p.y - this.y) < this.r + p.r) w.hurtPlayer(this.dmg, this.label || 'Impacto');
          }
          if (this.kind === 'burst') w.shake(4);
          if (this.kind === 'ring') w.shake(3);
        }
        return;
      }
      if (this.kind === 'burst') {
        if (this.t >= this.life) this.dead = true;
        return;
      }
      if (this.kind === 'pool') {
        if (this.t >= this.life) {
          this.dead = true;
          return;
        }
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = this.tick || 0.5;
          if (Math.hypot(p.x - this.x, p.y - this.y) < this.r + p.r) {
            w.hurtPlayer(this.dmg, this.label || 'Brasa');
            if (this.slow) p.slowT = Math.max(p.slowT, this.slow);
          }
        }
        return;
      }
      if (this.kind === 'ring') {
        const k = Math.min(1, this.t / this.life);
        this.curR = this.r * k;
        if (!this.hitDone && p.iframes <= 0) {
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d <= this.curR + p.r && d >= this.curR - 18 - p.r) {
            this.hitDone = true;
            w.hurtPlayer(this.dmg, this.label || 'Onda');
          }
        }
        if (this.t >= this.life) this.dead = true;
      }
    }

    draw(g) {
      g.save();
      if (!this.armed) {
        const k = 1 - this.warn / Math.max(0.001, this.warnTotal || this.warn);
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 16);
        g.globalAlpha = 0.85;
        g.strokeStyle = this.color;
        g.lineWidth = 2.5;
        g.setLineDash([6, 5]);
        g.beginPath();
        g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 0.15 + 0.25 * pulse * (0.3 + k);
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
        g.fill();
      } else if (this.kind === 'burst') {
        const k = 1 - this.t / this.life;
        g.globalAlpha = Math.max(0, k) * 0.7;
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.r * (1 + (1 - k) * 0.25), 0, Math.PI * 2);
        g.fill();
      } else if (this.kind === 'pool') {
        const fade = Math.min(1, (this.life - this.t) / 0.5);
        g.globalAlpha = (0.35 + 0.15 * Math.sin(this.t * 10)) * fade;
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        g.fill();
      } else if (this.kind === 'ring') {
        const k = 1 - this.t / this.life;
        g.globalAlpha = 0.85 * Math.max(0, k);
        g.strokeStyle = this.color;
        g.lineWidth = 12 * Math.max(0.3, k);
        g.beginPath();
        g.arc(this.x, this.y, Math.max(1, this.curR), 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
  }

  V.Entities = { Player, Enemy, Projectile, Pickup, Particle, FloatText, Zone };
})();

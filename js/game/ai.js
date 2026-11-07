// Comportamentos de inimigos comuns e padrões de chefes (com fases).
// Cada função recebe a entidade "e", o delta "dt" e o mundo "w" (js/game/world.js).
(() => {
  const V = (window.V = window.V || {});
  const { R, clamp } = V.Util;

  function seek(e, tx, ty, sp) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * sp;
    e.vy = (dy / d) * sp;
    return d;
  }

  function dirTo(e, tx, ty) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, d };
  }

  function stop(e, k = 0) {
    e.vx *= k;
    e.vy *= k;
  }

  // Dispara um projétil inimigo em direção a (tx, ty).
  function shootAt(e, w, tx, ty, speed, o = {}) {
    const d = dirTo(e, tx, ty);
    w.spawnProjectile({
      x: e.x,
      y: e.y,
      vx: d.x * speed,
      vy: d.y * speed,
      dmg: o.dmg || e.def.projDmg * (e.dmgMul || 1),
      from: 'enemy',
      sprite: o.sprite || e.def.projectile || 'orb_r',
      size: o.size,
      life: o.life || 3.2,
      homing: o.homing || 0,
      slow: o.slow || 0,
    });
  }

  // Dispara um leque de projéteis em torno de um ângulo.
  function fan(e, w, base, count, spread, speed, o = {}) {
    for (let i = 0; i < count; i++) {
      const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
      w.spawnProjectile({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        dmg: o.dmg || 8,
        from: 'enemy',
        sprite: o.sprite || 'orb_r',
        size: o.size || 22,
        life: o.life || 3.5,
        homing: o.homing || 0,
        slow: o.slow || 0,
      });
    }
  }

  // Ponto aleatório dentro da arena, longe das bordas e de uma posição.
  function randomPointNear(w, cx, cy, minD, maxD) {
    const a = R.range(0, Math.PI * 2);
    const d = R.range(minD, maxD);
    const a2 = w.arena;
    return {
      x: clamp(cx + Math.cos(a) * d, a2.x0 + 30, a2.x1 - 30),
      y: clamp(cy + Math.sin(a) * d, a2.y0 + 30, a2.y1 - 30),
    };
  }

  // ---------- Comuns ----------

  function hop(e, dt, w) {
    const p = w.player;
    e.stateT -= dt;
    if (e.state === 'hop') {
      seek(e, p.x, p.y, e.speed * 2.5);
      if (e.stateT <= 0) {
        e.state = 'wait';
        e.stateT = R.range(0.6, 1.2);
        stop(e, 0.2);
        e.hopLand = true;
      }
    } else {
      stop(e, 0.85);
      if (e.stateT <= 0) {
        e.state = 'hop';
        e.stateT = R.range(0.3, 0.45);
      }
    }
  }

  function flutter(e, dt, w) {
    const p = w.player;
    e.data.retarget = (e.data.retarget || 0) - dt;
    if (e.data.retarget <= 0) {
      e.data.retarget = R.range(0.4, 0.8);
      e.data.ox = R.range(-90, 90);
      e.data.oy = R.range(-90, 90);
    }
    const wob = Math.sin(e.t * 9) * 40;
    seek(e, p.x + e.data.ox, p.y + e.data.oy, e.speed);
    e.vx += wob * 0.3;
  }

  function kite(e, dt, w) {
    const p = w.player;
    const d = dirTo(e, p.x, p.y).d;
    if (d < 130) seek(e, p.x, p.y, -e.speed * 1.1);
    else if (d > 210) seek(e, p.x, p.y, e.speed);
    else {
      const side = e.data.side || (e.data.side = R.pick([-1, 1]));
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.vx = (-dy / len) * e.speed * 0.7 * side;
      e.vy = (dx / len) * e.speed * 0.7 * side;
      if (R.chance(dt * 0.4)) e.data.side = -side;
    }
    e.cd.shoot = (e.cd.shoot == null ? e.def.shootCd : e.cd.shoot) - dt;
    if (e.cd.shoot <= 0 && d < 420 && !e.data.charge) {
      e.data.charge = 0.4;
    }
    if (e.data.charge) {
      e.data.charge -= dt;
      stop(e, 0.3);
      if (e.data.charge <= 0) {
        e.data.charge = 0;
        e.cd.shoot = e.def.shootCd;
        shootAt(e, w, p.x, p.y, e.def.projSpeed);
      }
    }
  }

  function charge(e, dt, w) {
    const p = w.player;
    e.stateT -= dt;
    switch (e.state) {
      case 'idle': {
        const d = dirTo(e, p.x, p.y).d;
        if (d < 260) seek(e, p.x, p.y, e.speed * 0.6);
        else stop(e, 0.9);
        if (d < 200 && e.stateT <= 0) {
          e.state = 'tele';
          e.stateT = 0.75;
          e.data.tele = true;
          e.data.dir = dirTo(e, p.x, p.y);
          w.sfx('telegraph');
        }
        break;
      }
      case 'tele': {
        stop(e, 0.5);
        const d = e.data.dir;
        e.face = d.x >= 0 ? 1 : -1;
        if (e.stateT <= 0) {
          e.state = 'dash';
          e.stateT = 0.55;
          e.data.tele = false;
          e.data.dashDir = { x: d.x, y: d.y };
          e.vx = d.x * e.speed * 5.4;
          e.vy = d.y * e.speed * 5.4;
          w.shake(3);
        }
        break;
      }
      case 'dash': {
        e.vx *= 1 - dt * 0.4;
        e.vy *= 1 - dt * 0.4;
        if (e.stateT <= 0) {
          e.state = 'idle';
          e.stateT = R.range(1.0, 1.6);
          stop(e, 0);
        }
        break;
      }
      default:
        e.state = 'idle';
    }
  }

  function support(e, dt, w) {
    const p = w.player;
    const d = dirTo(e, p.x, p.y).d;
    if (d < 150) seek(e, p.x, p.y, -e.speed);
    else if (d > 210) seek(e, p.x, p.y, e.speed * 0.8);
    else stop(e, 0.85);
    e.cd.shoot = (e.cd.shoot == null ? e.def.shootCd : e.cd.shoot) - dt;
    if (e.cd.shoot <= 0) {
      e.cd.shoot = e.def.shootCd;
      shootAt(e, w, p.x, p.y, e.def.projSpeed, { sprite: 'orb_g' });
    }
    e.cd.heal = (e.cd.heal == null ? 3 : e.cd.heal) - dt;
    if (e.cd.heal <= 0) {
      e.cd.heal = 3;
      for (const o of w.enemies) {
        if (o === e || o.dead || o.spawnT > 0) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < 120) {
          o.hp = Math.min(o.maxHp, o.hp + Math.round(o.maxHp * 0.06));
          w.particles(o.x, o.y, { color: '#8cff9a', count: 4, speed: 60 });
        }
      }
      w.particles(e.x, e.y, { color: '#8cff9a', count: 8, ring: true, size: 4 });
    }
  }

  function slam(e, dt, w) {
    const p = w.player;
    seek(e, p.x, p.y, e.speed);
    e.cd.slam = (e.cd.slam == null ? e.def.shootCd : e.cd.slam) - dt;
    if (e.cd.slam <= 0) {
      e.cd.slam = e.def.shootCd;
      w.addZone({
        kind: 'burst', x: p.x, y: p.y, r: 46, warn: 1.0, life: 0.35, dmg: e.dmg * 1.1,
        color: '#ff8a3d', label: 'Esmagamento',
      });
      w.sfx('telegraph');
    }
  }

  function web(e, dt, w) {
    const p = w.player;
    const d = dirTo(e, p.x, p.y).d;
    if (d > 110) seek(e, p.x, p.y, e.speed);
    else seek(e, p.x, p.y, -e.speed * 0.6);
    e.cd.shoot = (e.cd.shoot == null ? e.def.shootCd : e.cd.shoot) - dt;
    if (e.cd.shoot <= 0) {
      e.cd.shoot = e.def.shootCd;
      shootAt(e, w, p.x, p.y, e.def.projSpeed, { sprite: 'web', size: 26, slow: 2.0, dmg: e.def.projDmg });
    }
  }

  function blink(e, dt, w) {
    const p = w.player;
    e.cd.blink = (e.cd.blink == null ? e.def.blinkCd : e.cd.blink) - dt;
    if (e.cd.blink <= 0) {
      e.cd.blink = e.def.blinkCd;
      const q = randomPointNear(w, p.x, p.y, 70, 95);
      w.particles(e.x, e.y, { color: '#9ff3ff', count: 10, ring: false, speed: 110 });
      e.x = q.x;
      e.y = q.y;
      w.particles(e.x, e.y, { color: '#9ff3ff', count: 10, ring: true, size: 5 });
      w.sfx('blink');
      e.cd.blinkHit = 0.6;
    }
    seek(e, p.x, p.y, e.speed * (e.cd.blinkHit > 0 ? 1.8 : 1));
    if (e.cd.blinkHit > 0) e.cd.blinkHit -= dt;
  }

  function caster(e, dt, w) {
    const p = w.player;
    const d = dirTo(e, p.x, p.y).d;
    if (d < 140) seek(e, p.x, p.y, -e.speed);
    else if (d > 200) seek(e, p.x, p.y, e.speed * 0.7);
    else stop(e, 0.8);
    e.cd.shoot = (e.cd.shoot == null ? e.def.shootCd : e.cd.shoot) - dt;
    if (e.cd.shoot <= 0) {
      e.cd.shoot = e.def.shootCd;
      shootAt(e, w, p.x, p.y, e.def.projSpeed, { sprite: 'orb_p', homing: 0.9, size: 22 });
    }
  }

  // ---------- Chefes ----------

  function bossCommon(e, w) {
    const f = e.hp / e.maxHp;
    if (e.phase === 1 && f <= 0.5) {
      e.phase = 2;
      w.bossPhase(e);
    }
    return e.phase;
  }

  function treant(e, dt, w) {
    const p = w.player;
    const ph = bossCommon(e, w);
    const d = dirTo(e, p.x, p.y).d;
    if (d < 120) seek(e, p.x, p.y, -28);
    else seek(e, p.x, p.y, ph === 2 ? 34 : 22);
    e.cd.pat = (e.cd.pat == null ? 1.6 : e.cd.pat) - dt;
    if (e.cd.pat <= 0) {
      e.cd.pat = ph === 2 ? 2.0 : 2.6;
      e.data.n = (e.data.n || 0) + 1;
      const pick = e.data.n % 3;
      if (pick === 0) {
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        fan(e, w, base, ph === 2 ? 7 : 5, 0.95, 165, { dmg: 9, sprite: 'seed', size: 24 });
      } else if (pick === 1) {
        const count = ph === 2 ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const q = randomPointNear(w, p.x, p.y, 0, 90);
          w.addZone({ kind: 'burst', x: q.x, y: q.y, r: 26, warn: 0.95, life: 0.3, dmg: 14, color: '#6bbf55', label: 'Raiz' });
        }
      } else {
        w.addZone({ kind: 'ring', x: e.x, y: e.y, r: 240, warn: 0.9, life: 1.1, dmg: 15, color: '#9be36f', label: 'Abalo' });
        w.sfx('slam');
      }
    }
    if (ph === 2) {
      e.cd.summon = (e.cd.summon == null ? 9 : e.cd.summon) - dt;
      if (e.cd.summon <= 0) {
        e.cd.summon = 9;
        for (let i = 0; i < 2; i++) w.addEnemy('slime', e.x + (i ? 30 : -30), e.y + 40, { spawnT: 0.6, hpMul: 0.8 });
      }
    }
  }

  function king(e, dt, w) {
    const p = w.player;
    const ph = bossCommon(e, w);
    e.data.state = e.data.state || 'approach';
    e.stateT = (e.stateT || 0) - dt;
    switch (e.data.state) {
      case 'approach': {
        seek(e, p.x, p.y, ph === 2 ? 30 : 24);
        e.cd.pat = (e.cd.pat == null ? 1.2 : e.cd.pat) - dt;
        if (e.cd.pat <= 0) {
          e.data.pick = e.data.pick == null ? 0 : (e.data.pick + 1) % 3;
          if (e.data.pick === 0) {
            e.data.state = 'tele';
            e.stateT = 0.8;
            e.data.dir = dirTo(e, p.x, p.y);
            w.sfx('telegraph');
          } else if (e.data.pick === 1) {
            const n = ph === 2 ? 12 : 8;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + e.t * 0.3;
              w.spawnProjectile({
                x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
                dmg: 10, from: 'enemy', sprite: 'orb_r', size: 22, life: 3.2,
              });
            }
            w.shake(4);
            e.cd.pat = ph === 2 ? 1.6 : 2.2;
          } else {
            w.addZone({ kind: 'ring', x: e.x, y: e.y, r: 150, warn: 0.9, life: 0.6, dmg: 18, color: '#ff7a2a', label: 'Pisão' });
            e.cd.pat = 2.2;
          }
          if (e.data.pick !== 0) e.cd.pat = e.cd.pat || 1.6;
        }
        if (ph === 2) {
          e.cd.summon = (e.cd.summon == null ? 0 : e.cd.summon) - dt;
          if (e.cd.summon <= 0) {
            e.cd.summon = 9;
            const alive = w.enemies.filter((o) => o.data.minion === e.uid && !o.dead).length;
            if (alive < 2) {
              const m = w.addEnemy('golem', e.x, e.y + 60, { spawnT: 0.7, hpMul: 0.5, sizeMul: 0.8 });
              m.data.minion = e.uid;
            }
          }
        }
        break;
      }
      case 'tele': {
        stop(e, 0.4);
        e.face = e.data.dir.x >= 0 ? 1 : -1;
        if (e.stateT <= 0) {
          e.data.state = 'charge';
          e.stateT = 0.6;
          e.vx = e.data.dir.x * (ph === 2 ? 390 : 340);
          e.vy = e.data.dir.y * (ph === 2 ? 390 : 340);
          e.data.trailT = 0;
          w.shake(3);
        }
        break;
      }
      case 'charge': {
        e.data.trailT -= dt;
        if (e.data.trailT <= 0) {
          e.data.trailT = 0.22;
          w.addZone({ kind: 'pool', x: e.x, y: e.y, r: 24, warn: 0, life: 1.4, dmg: 7, tick: 0.45, color: '#ff7a2a', label: 'Brasa' });
        }
        if (e.stateT <= 0) {
          e.data.state = 'approach';
          e.stateT = 0;
          stop(e, 0);
          e.cd.pat = ph === 2 ? 0.9 : 1.4;
        }
        break;
      }
      default:
        e.data.state = 'approach';
    }
  }

  function eclipse(e, dt, w) {
    const p = w.player;
    const ph = bossCommon(e, w);
    const f = e.hp / e.maxHp;
    // Lâminas orbitando: dano por contato com cooldown próprio.
    const nBlades = ph === 2 ? 4 : 3;
    e.data.blades = [];
    for (let i = 0; i < nBlades; i++) {
      const a = e.t * (ph === 2 ? 2.4 : 1.8) + (i / nBlades) * Math.PI * 2;
      const r = 70 + Math.sin(e.t * 1.3 + i) * 8;
      const bx = e.x + Math.cos(a) * r;
      const by = e.y + Math.sin(a) * r;
      e.data.blades.push({ x: bx, y: by, a });
      w.touchPlayer(bx, by, 11, e.dmg * 0.8, 'blade' + i + e.uid, 0.5);
    }
    // Movimento: segue o jogador de forma tensa, recuando quando perto.
    const d = dirTo(e, p.x, p.y).d;
    if (d < 110) seek(e, p.x, p.y, -30);
    else seek(e, p.x, p.y, 20);
    e.cd.pat = (e.cd.pat == null ? 1.4 : e.cd.pat) - dt;
    if (e.cd.pat <= 0) {
      e.data.n = (e.data.n || 0) + 1;
      const k = e.data.n % 3;
      if (k === 0) {
        // Teleporta e dispara três flechas teleguiadas.
        const q = randomPointNear(w, p.x, p.y, 130, 165);
        w.particles(e.x, e.y, { color: '#ffcf5a', count: 12, speed: 140, ring: false });
        e.x = q.x;
        e.y = q.y;
        w.sfx('blink');
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        fan(e, w, base, 3, 0.5, 190, { dmg: 11, sprite: 'orb_p', size: 22, homing: 0.6 });
        e.cd.pat = ph === 2 ? 1.5 : 2.0;
      } else if (k === 1) {
        // Nova de projéteis em anel, girando a cada disparo.
        const n = ph === 2 ? 14 : 10;
        const off = e.data.n * 0.31;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          w.spawnProjectile({ x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, dmg: 10, from: 'enemy', sprite: 'orb_p', size: 22, life: 3.4 });
        }
        e.cd.pat = ph === 2 ? 1.6 : 2.1;
      } else {
        // Ataque em área ao redor do jogador.
        w.addZone({ kind: 'burst', x: p.x, y: p.y, r: 52, warn: 0.9, life: 0.3, dmg: 16, color: '#8a4fe0', label: 'Eclipse' });
        e.cd.pat = ph === 2 ? 1.3 : 1.8;
      }
    }
    // Tempestade de flechas espelhadas abaixo de 35% de HP.
    if (f <= 0.35) {
      e.cd.storm = (e.cd.storm == null ? 0.5 : e.cd.storm) - dt;
      if (e.cd.storm <= 0) {
        e.cd.storm = 0.45;
        const a = e.t * 2.2;
        for (const s of [1, -1]) {
          w.spawnProjectile({
            x: e.x, y: e.y, vx: Math.cos(a * s) * 170, vy: Math.sin(a * s) * 170,
            dmg: 8, from: 'enemy', sprite: 'arrow_e', size: 26, life: 3.2,
          });
        }
      }
    }
  }

  const AI = {
    update(e, dt, w) {
      switch (e.ai) {
        case 'hop': return hop(e, dt, w);
        case 'flutter': return flutter(e, dt, w);
        case 'kite': return kite(e, dt, w);
        case 'charge': return charge(e, dt, w);
        case 'support': return support(e, dt, w);
        case 'slam': return slam(e, dt, w);
        case 'web': return web(e, dt, w);
        case 'blink': return blink(e, dt, w);
        case 'caster': return caster(e, dt, w);
        case 'treant': return treant(e, dt, w);
        case 'king': return king(e, dt, w);
        case 'eclipse': return eclipse(e, dt, w);
        default: return seek(e, w.player.x, w.player.y, e.speed);
      }
    },

    // Efeitos extras de desenho (lâminas do Senhor do Eclipse, marca de carga do lobo).
    drawExtras(e, g) {
      if (e.ai === 'eclipse' && e.data.blades) {
        for (const b of e.data.blades) {
          V.Sprites.draw(g, 'blade', b.x, b.y, 24, { rot: b.a + Math.PI / 2 });
        }
      }
      if (e.ai === 'charge' && e.data.tele && e.data.dir) {
        g.save();
        g.globalAlpha = 0.55 + 0.25 * Math.sin(e.t * 20);
        g.strokeStyle = '#ff5a5a';
        g.lineWidth = 3;
        g.setLineDash([8, 6]);
        g.beginPath();
        g.moveTo(e.x, e.y);
        g.lineTo(e.x + e.data.dir.x * 220, e.y + e.data.dir.y * 220);
        g.stroke();
        g.restore();
      }
    },

    // Ao morrer: slimes se dividem em filhotes.
    onDeath(e, w) {
      if (e.ai === 'hop' && e.def.split && e.gen < 2) {
        for (let i = 0; i < 2; i++) {
          w.addEnemy(e.id, e.x + (i ? 10 : -10), e.y + 4, {
            gen: e.gen + 1, hpMul: 0.42, sizeMul: 0.72, spawnT: 0.25, speedMul: 1.1, xpMul: 0.5, goldMul: 0.5,
          });
        }
      }
    },
  };

  V.AI = AI;
})();

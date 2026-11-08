"""Combate em tempo real (port da luta de src/action.js e dos inimigos errantes de src/entities.js).

F ataca em arco na frente do Bit. Inimigos perseguem quando o Bit se aproxima e causam dano de contato
com cooldown; o Bit tem iframes curtos depois de levar dano.
"""

import math
import random
import zlib

from . import combat as K
from . import content as C
from . import world as W

CHASE_RANGE = 5.0
WANDER_RADIUS = 3.0
CONTACT_RANGE = 0.7
PLAYER_RAD = 0.3


class Roamer:
    def __init__(self, eid, x, z, rng):
        e = C.ENEMIES[eid]
        self.id = eid
        self.name = e["name"]
        self.x, self.z = float(x), float(z)
        self.home = (self.x, self.z)
        self.max_hp = e["hp"]
        self.hp = e["hp"]
        self.atk = e["atk"]
        self.defn = e["def"]
        self.spd = e["spd"]
        self.alive = True
        self.attack_cd = 0.0
        self.knock = (0.0, 0.0)
        self.wander = (self.x, self.z)
        self.wander_t = rng.uniform(0.5, 2.5)
        self.color = e.get("color", "#ffffff")
        self.scale = e.get("scale", 1.0)


def spawn_roamers(zone, rng, count=6):
    """Espalha inimigos da zona em células caminháveis, longe do ponto inicial."""
    if not zone.enemies:
        return []
    sx, sz = zone.spawn()
    cells = [(c, r) for r in range(zone.height) for c in range(len(zone.rows[r]))
             if zone.walkable(c, r) and zone.char(c, r) in (".", "=") and math.hypot(c - sx, r - sz) > 8]
    out = []
    for _ in range(min(count, len(cells))):
        c, r = cells.pop(rng.randrange(len(cells)))
        out.append(Roamer(zone.enemies[rng.randrange(len(zone.enemies))], c, r, rng))
    return out


def _step_towards(zone, rm, tx, tz, dist, dt):
    if dist < 1e-6:
        return
    step = rm.spd * 0.12 * dt
    dx = (tx - rm.x) / dist * step
    dz = (tz - rm.z) / dist * step
    rm.x, rm.z = W.move(zone, rm.x, rm.z, dx, dz, rad=0.3)


def update_roamers(roamers, zone, px, pz, dt, rng):
    """Move inimigos (perseguição ou passeio). Devolve os que tocaram o Bit neste quadro."""
    touching = []
    for rm in roamers:
        if not rm.alive:
            continue
        rm.attack_cd = max(0.0, rm.attack_cd - dt)
        dist = math.hypot(px - rm.x, pz - rm.z)
        if dist < CHASE_RANGE:
            _step_towards(zone, rm, px, pz, dist, dt)
        else:
            rm.wander_t -= dt
            if rm.wander_t <= 0:
                ang = rng.uniform(0, 2 * math.pi)
                rad = rng.uniform(0, WANDER_RADIUS)
                rm.wander = (rm.home[0] + math.cos(ang) * rad, rm.home[1] + math.sin(ang) * rad)
                rm.wander_t = rng.uniform(1.5, 3.5)
            wx, wz = rm.wander
            wd = math.hypot(wx - rm.x, wz - rm.z)
            _step_towards(zone, rm, wx, wz, wd, dt * 0.5)
        if math.hypot(px - rm.x, pz - rm.z) < CONTACT_RANGE:
            touching.append(rm)
    return touching


class Fight:
    """Estado da luta em tempo real na zona atual."""

    def __init__(self, zone, state, rng=None, count=6):
        self.zone = zone
        self.state = state
        self.rng = rng or random.Random(zlib.crc32(zone.id.encode()))
        self.roamers = spawn_roamers(zone, self.rng, count)
        self.swing_cd = 0.0
        self.iframes = 0.0
        self.swing_flash = 0.0
        self.facing = 0.0

    def alive_roamers(self):
        return [r for r in self.roamers if r.alive]

    def swing(self, px, pz, facing):
        """Golpe com F. Devolve eventos: ("hit", rm, dano) e ("kill", rm) para o cliente mostrar."""
        if self.swing_cd > 0:
            return []
        self.swing_cd = K.SWING["cooldown"]
        self.swing_flash = 0.15
        events = []
        for rm in self.alive_roamers():
            if not K.in_swing_arc(px, pz, facing, rm.x, rm.z):
                continue
            dmg = K.swing_damage(self.state.atk(), rm.defn, self.rng.random)
            rm.hp -= dmg
            kick = K.SWING["knockback"]
            d = math.hypot(rm.x - px, rm.z - pz) or 1.0
            rm.x, rm.z = W.move(self.zone, rm.x, rm.z, (rm.x - px) / d * kick * 0.5, (rm.z - pz) / d * kick * 0.5)
            events.append(("hit", rm, dmg))
            if rm.hp <= 0:
                rm.alive = False
                events.append(("kill", rm))
                self._reward(rm)
        return events

    def _reward(self, rm):
        e = C.ENEMIES[rm.id]
        self.state.gain_xp(e["xp"])
        self.state.gold += e["gold"]
        self.state.bump(f"kill_{rm.id}", 1)
        for drop in e.get("drops", []):
            if self.rng.random() < drop["chance"]:
                self.state.add_item(drop["item"], 1)

    def step(self, px, pz, dt):
        """Atualiza inimigos e dano de contato. Devolve eventos ("hurt", rm, dano) ou ("defeat",)."""
        self.swing_cd = max(0.0, self.swing_cd - dt)
        self.iframes = max(0.0, self.iframes - dt)
        self.swing_flash = max(0.0, self.swing_flash - dt)
        events = []
        touching = update_roamers(self.roamers, self.zone, px, pz, dt, self.rng)
        for rm in touching:
            if rm.attack_cd > 0 or self.iframes > 0:
                continue
            dmg = K.contact_damage(rm.atk, self.state.defense(), self.rng.random)
            self.state.hp -= dmg
            rm.attack_cd = K.CONTACT["cooldown"]
            self.iframes = K.CONTACT["iframes"]
            events.append(("hurt", rm, dmg))
            if self.state.hp <= 0:
                events.append(("defeat",))
                break
        return events

    def respawn_roamers(self):
        self.roamers = spawn_roamers(self.zone, self.rng)

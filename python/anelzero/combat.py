"""Regras de combate por turnos (port de src/combat.js) e da luta em tempo real (port de src/action.js)."""

import math
import random

INTENTS = {
    "normal": {"text": "Vai atacar.", "mult": 1.0},
    "pesado": {"text": "⚠ Prepara um golpe pesado!", "mult": 1.8},
    "reparar": {"text": "Vai se reparar (+15 HP).", "mult": 0.0},
}
PHASE2_ATK = 1.15
DIFFICULTY = {
    "facil": {"label": "Fácil", "dmg": 0.75, "drop": 1.25},
    "normal": {"label": "Normal", "dmg": 1.0, "drop": 1.0},
    "dificil": {"label": "Difícil", "dmg": 1.25, "drop": 0.8},
}
DIFFICULTY_ORDER = ["facil", "normal", "dificil"]

SWING = {"range": 1.9, "arc": math.pi * 0.7, "cooldown": 0.42, "knockback": 0.7}
CONTACT = {"cooldown": 1.2, "iframes": 0.25}


def _js_round(x):
    return math.floor(x + 0.5)


def dmg_from(attack, defense, mult=1.0, rng=random.random):
    base = attack * mult - defense * 0.6
    return max(1, _js_round(base * (0.9 + rng() * 0.2)))


def pick_intent(boss, e_hp, max_hp, phase2, rng=random.random):
    if phase2 and rng() < 0.4:
        return "pesado"
    if boss and e_hp < max_hp * 0.3 and rng() < 0.35:
        return "reparar"
    return "pesado" if rng() < 0.22 else "normal"


def enemy_hit(enemy_atk, player_def, intent, phase2, difficulty="normal", rng=random.random):
    mult = INTENTS[intent]["mult"] * (PHASE2_ATK if phase2 else 1.0) * DIFFICULTY[difficulty]["dmg"]
    return dmg_from(enemy_atk, player_def, mult, rng)


def should_enter_phase2(boss, e_hp, max_hp, already):
    return bool(boss) and not already and e_hp <= max_hp * 0.5


# ---- Luta em tempo real ----

def _angle_diff(a, b):
    d = a - b
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    return d


def in_swing_arc(px, pz, facing, tx, tz, rng_range=SWING["range"], arc=SWING["arc"]):
    dx, dz = tx - px, tz - pz
    d = math.hypot(dx, dz)
    if d > rng_range:
        return False
    if d < 0.6:
        return True
    target = math.atan2(dx, dz)
    return abs(_angle_diff(target, facing)) <= arc / 2


def swing_damage(attack, enemy_def, rng=random.random):
    base = attack * 1.0 - enemy_def * 0.5
    return max(1, _js_round(base * (0.9 + rng() * 0.2)))


def contact_damage(enemy_atk, player_def, rng=random.random):
    base = enemy_atk * 0.6 - player_def * 0.4
    return max(1, _js_round(base * (0.9 + rng() * 0.2)))


def swing_targets(px, pz, facing, roamers):
    return [rm for rm in roamers if rm.alive and in_swing_arc(px, pz, facing, rm.x, rm.z)]

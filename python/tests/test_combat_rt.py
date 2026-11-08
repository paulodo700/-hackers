"""Combate em tempo real: golpe em arco, morte e recompensa, dano de contato com cooldown e iframes."""

import random
import unittest

from anelzero import content as C
from anelzero import rt
from anelzero import state as S
from anelzero import world as W


def arena():
    return W.Zone("arena_teste", {
        "name": "Arena", "map": ["#########", "#.......#", "#.......#", "#.......#", "#########"],
        "markers": {}, "enemies": ["pulga"],
    })


class Swing(unittest.TestCase):
    def setUp(self):
        self.zone = arena()
        self.st = S.GameState()
        self.fight = rt.Fight(self.zone, self.st, rng=random.Random(1), count=0)

    def _target(self, x, z):
        rm = rt.Roamer("pulga", x, z, random.Random(2))
        self.fight.roamers = [rm]
        return rm

    def test_hits_monster_in_front(self):
        rm = self._target(4.0, 2.5)
        events = self.fight.swing(4.0, 2.5 - 1.0, 0.0)  # bit olhando +z, monstro à frente
        self.assertTrue(any(e[0] == "hit" for e in events))
        self.assertLess(rm.hp, rm.max_hp)

    def test_ignores_monster_behind(self):
        self._target(4.0, 1.0)
        events = self.fight.swing(4.0, 2.5, 0.0)  # monstro atrás
        self.assertEqual(events, [])

    def test_cooldown_blocks_second_swing(self):
        self._target(4.0, 3.5)
        self.fight.swing(4.0, 2.5, 0.0)
        self.assertEqual(self.fight.swing(4.0, 2.5, 0.0), [])

    def test_kill_grants_xp_gold_and_counter(self):
        rm = self._target(4.0, 3.5)
        rm.hp = 1
        xp_before, gold_before = self.st.xp, self.st.gold
        events = self.fight.swing(4.0, 2.5, 0.0)
        self.assertTrue(any(e[0] == "kill" for e in events))
        self.assertFalse(rm.alive)
        self.assertEqual(self.st.counter("kill_pulga"), 1)
        self.assertEqual(self.st.gold, gold_before + C.ENEMIES["pulga"]["gold"])
        self.assertTrue(self.st.xp > xp_before or self.st.level > 1)


class Contact(unittest.TestCase):
    def setUp(self):
        self.zone = arena()
        self.st = S.GameState()
        self.fight = rt.Fight(self.zone, self.st, rng=random.Random(3), count=0)
        self.rm = rt.Roamer("pulga", 4.0, 2.5, random.Random(4))
        self.fight.roamers = [self.rm]

    def test_contact_hurts_then_iframes_protect(self):
        hp0 = self.st.hp
        ev = self.fight.step(4.0, 2.5, 0.01)
        self.assertTrue(any(e[0] == "hurt" for e in ev))
        self.assertLess(self.st.hp, hp0)
        hp1 = self.st.hp
        self.fight.step(4.0, 2.5, 0.01)  # ainda dentro dos iframes
        self.assertEqual(self.st.hp, hp1)

    def test_roamer_cooldown_limits_damage_over_time(self):
        self.fight.step(4.0, 2.5, 0.01)
        hits = 0
        hp = self.st.hp
        for _ in range(100):  # 1 segundo de jogo
            self.fight.step(4.0, 2.5, 0.01)
            if self.st.hp < hp:
                hits += 1
                hp = self.st.hp
        self.assertLessEqual(hits, 1)

    def test_defeat_when_hp_runs_out(self):
        self.st.hp = 1
        ev = self.fight.step(4.0, 2.5, 0.01)
        self.assertTrue(any(e[0] == "defeat" for e in ev))


class Roaming(unittest.TestCase):
    def test_roamers_never_enter_walls(self):
        zone = arena()
        rng = random.Random(9)
        roamers = [rt.Roamer("pulga", 2.0, 2.0, rng)]
        for _ in range(600):
            rt.update_roamers(roamers, zone, 6.5, 2.5, 0.05, rng)
            x, z = roamers[0].x, roamers[0].z
            self.assertTrue(zone.walkable(round(x), round(z)))

    def test_spawn_avoids_start_area(self):
        zone = W.load("cache")
        out = rt.spawn_roamers(zone, random.Random(5), count=6)
        sx, sz = zone.spawn()
        for rm in out:
            self.assertGreater(((rm.x - sx) ** 2 + (rm.z - sz) ** 2) ** 0.5, 7.9)


class TouchMode(unittest.TestCase):
    """Ajuste 'batalha ao toque': contato vira evento de batalha, sem dano em tempo real."""

    def setUp(self):
        self.zone = arena()
        self.st = S.GameState()
        self.fight = rt.Fight(self.zone, self.st, rng=random.Random(3), count=0)
        self.rm = rt.Roamer("pulga", 4.0, 2.5, random.Random(4))
        self.fight.roamers = [self.rm]

    def test_contact_emits_touch_without_damage(self):
        hp0 = self.st.hp
        ev = self.fight.step(4.0, 2.5, 0.01, touch=True)
        self.assertEqual([e[0] for e in ev], ["touch"])
        self.assertIs(ev[0][1], self.rm)
        self.assertEqual(self.st.hp, hp0)

    def test_touch_cooldown_prevents_repeat(self):
        self.fight.step(4.0, 2.5, 0.01, touch=True)
        self.assertEqual(self.fight.step(4.0, 2.5, 0.01, touch=True), [])

    def test_default_mode_still_hurts(self):
        ev = self.fight.step(4.0, 2.5, 0.01)
        self.assertTrue(any(e[0] == "hurt" for e in ev))


if __name__ == "__main__":
    unittest.main()

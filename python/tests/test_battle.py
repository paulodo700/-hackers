"""Batalha por turnos: intenções, fase 2, defesa, fuga, itens, recompensas e dificuldade."""

import random
import unittest

from anelzero import battle as B
from anelzero import combat as K
from anelzero import content as C
from anelzero import state as S


class Fixed:
    """RNG que devolve sempre o mesmo valor (controla rolagens)."""

    def __init__(self, v):
        self.v = v

    def random(self):
        return self.v

    def uniform(self, a, b):
        return a + (b - a) * self.v

    def __call__(self):
        return self.v


def fresh(enemy="pulga", rng_value=0.5, difficulty="normal"):
    st = S.GameState()
    b = B.Battle(st, enemy, rng=random.Random(7), difficulty=difficulty)
    b.rng = Fixed(rng_value)
    return b


class Basics(unittest.TestCase):
    def test_starts_with_intent_and_log(self):
        b = fresh()
        self.assertIn(b.intent, K.INTENTS)
        self.assertTrue(any("bloqueia" in line for line in b.log))

    def test_main_commands_include_flee_for_normal_enemy(self):
        b = fresh("pulga")
        self.assertIn("fugir", b.commands())

    def test_boss_cannot_be_fled(self):
        b = fresh("sobrecarga")
        self.assertNotIn("fugir", b.commands())
        self.assertFalse(b.act("fugir"))

    def test_unknown_enemy_rejected(self):
        with self.assertRaises(KeyError):
            B.Battle(S.GameState(), "nao_existe")


class Turns(unittest.TestCase):
    def test_attack_reduces_enemy_hp_and_enemy_answers(self):
        b = fresh("pulga")
        hp0 = b.e_hp
        hp_player0 = b.state.hp
        b.act("atacar")
        self.assertLess(b.e_hp, hp0)
        self.assertLess(b.state.hp, hp_player0)

    def test_defend_halves_next_hit(self):
        b = fresh("pulga", 0.5)
        b.intent = "normal"
        b.act("defender")
        b2 = fresh("pulga", 0.5)
        b2.intent = "normal"
        hp0 = b2.state.hp
        b2.act("atacar")
        normal_hit = hp0 - b2.state.hp
        b3 = fresh("pulga", 0.5)
        b3.intent = "normal"
        hp3 = b3.state.hp
        b3.act("defender")
        guarded_hit = hp3 - b3.state.hp
        self.assertLess(guarded_hit, normal_hit)

    def test_skill_costs_energy(self):
        b = fresh("pulga")
        b.state.level = 5
        b.state.skills = {}
        en0 = b.state.en
        skill = next(s for s in C.SKILLS if s["cost"] > 0 and s["level"] <= 5 and s["cost"] <= en0)
        self.assertTrue(b.act("habilidades"))
        self.assertTrue(b.act(f"skill:{skill['id']}"))
        self.assertLess(b.state.en, en0)

    def test_skill_not_available_without_energy(self):
        b = fresh("pulga")
        b.state.level = 99
        b.state.en = 0
        b.act("habilidades")
        self.assertFalse(b.act("skill:rajada"))

    def test_item_heals_and_is_consumed(self):
        b = fresh("pulga")
        b.state.hp = 1
        b.act("itens")
        self.assertTrue(b.act("item:pasta_termica"))
        self.assertGreater(b.state.hp, 1)

    def test_back_returns_to_main(self):
        b = fresh("pulga")
        b.act("itens")
        b.act("voltar")
        self.assertEqual(b.menu, "main")


class Phases(unittest.TestCase):
    def test_boss_enters_phase_two_at_half_hp(self):
        b = fresh("sobrecarga", 0.5)
        b.e_hp = b.d["hp"] // 2 + 1  # um golpe leva abaixo de 50%
        b.act("atacar")
        self.assertFalse(b.over)
        self.assertTrue(b.phase2)
        self.assertTrue(any("FASE 2" in line for line in b.log))

    def test_boss_phase_two_only_once(self):
        b = fresh("sobrecarga", 0.5)
        b.e_hp = b.d["hp"] // 2 + 1
        b.act("atacar")
        logs = sum("FASE 2" in line for line in b.log)
        b.act("atacar")
        self.assertEqual(sum("FASE 2" in line for line in b.log), logs)

    def test_regular_enemy_has_no_phase_two(self):
        b = fresh("pulga", 0.5)
        b.act("atacar")
        self.assertFalse(b.phase2)


class Ending(unittest.TestCase):
    def test_victory_grants_rewards_and_flag(self):
        b = fresh("pulga", 0.5)
        b.e_hp = 1
        gold0, xp0 = b.state.gold, b.state.xp
        b.act("atacar")
        self.assertEqual(b.result, "win")
        self.assertTrue(b.over)
        self.assertEqual(b.state.gold, gold0 + C.ENEMIES["pulga"]["gold"])
        self.assertTrue(b.state.xp != xp0 or b.state.level > 1)
        self.assertEqual(b.state.counter("kill_pulga"), 1)
        self.assertTrue(b.state.enemy_discovered("pulga"))

    def test_boss_defeat_sets_boss_flag(self):
        b = fresh("sobrecarga", 0.5)
        b.e_hp = 1
        b.act("atacar")
        self.assertEqual(b.result, "win")
        self.assertTrue(b.state.has_flag("boss_sobrecarga"))

    def test_defeat_when_player_hp_runs_out(self):
        b = fresh("sobrecarga", 0.5)
        b.state.hp = 1
        b.act("atacar")
        self.assertEqual(b.result, "lose")

    def test_flee_succeeds_on_low_roll(self):
        b = fresh("pulga", 0.0)  # 0.0 < 0.55: fuga bem-sucedida
        b.act("fugir")
        self.assertEqual(b.result, "flee")

    def test_flee_failure_gives_enemy_turn(self):
        b = fresh("pulga", 0.99)
        hp0 = b.state.hp
        b.act("fugir")
        self.assertIsNone(b.result)
        self.assertLess(b.state.hp, hp0)


class Difficulty(unittest.TestCase):
    def test_hard_mode_hits_harder_than_easy(self):
        easy = fresh("sobrecarga", 0.5, "facil")
        hard = fresh("sobrecarga", 0.5, "dificil")
        easy.intent = hard.intent = "normal"
        hp_e, hp_h = easy.state.hp, hard.state.hp
        easy.act("defender")
        hard.act("defender")
        self.assertGreater(hp_h - hard.state.hp, hp_e - easy.state.hp)

    def test_unknown_difficulty_falls_back_to_normal(self):
        b = fresh("pulga", difficulty="inexistente")
        self.assertEqual(b.difficulty, "normal")


if __name__ == "__main__":
    unittest.main()

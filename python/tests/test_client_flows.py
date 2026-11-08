"""Fluxos do cliente: batalha com chefe, reparo, loja, bancada, ajustes e a abertura. Headless (xvfb-run)."""

import unittest

from anelzero import panels as P
from gamehost import HAS_DISPLAY, get_game


def _settle(g, limit=80):
    for _ in range(limit):
        if g.fade is None:
            return
        g.step(0.1)


def _reset(g, state=None):
    from anelzero import state as S
    g.fade = None
    g.fade_card.hide()
    g.battle = None
    g.repair = None
    g.shop = None
    g.dialog = None
    g.dialog_after = None
    g.menu = None
    g.start_play(state or S.new_state())
    g.fight.roamers = []


def _near(g, it):
    g.px, g.py = float(it["c"]), float(it["r"])
    g.last_cell = None


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class Battle(unittest.TestCase):
    def setUp(self):
        self.g = get_game()
        _reset(self.g)
        self.g.load_zone("alu", None)
        self.g.fight.roamers = []

    def test_boss_dialog_then_turn_battle(self):
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        _near(self.g, boss)
        self.g.do_interact()
        self.assertEqual(self.g.mode, "dialog")
        for _ in range(200):
            self.g.key_event("e", True)
            self.g.step(0.05)
            if self.g.mode == "battle":
                break
        self.assertEqual(self.g.mode, "battle")
        self.assertIsNotNone(self.g.battle)
        self.assertFalse(self.g.battle_screen.panel.np.isHidden())

    def test_attack_command_changes_hp_and_log(self):
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        _near(self.g, boss)
        self.g.start_battle(boss)
        b = self.g.battle
        log0, hp0 = len(b.log), b.e_hp
        self.g.key_event("1", True)  # 1) Atacar
        self.assertGreater(len(b.log), log0)
        self.assertLess(b.e_hp, hp0)

    def test_boss_cannot_be_fled(self):
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        self.g.start_battle(boss)
        self.assertNotIn("fugir", self.g.battle.commands())

    def test_win_hides_boss_and_flags_it(self):
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        self.g.start_battle(boss)
        self.g.battle.e_hp = 1
        self.g.battle.result = "win"
        self.g.battle._victory()
        self.g.key_event("enter", True)  # confirma o fim da batalha
        self.assertEqual(self.g.mode, "play")
        self.assertTrue(self.g.state.has_flag("boss_sobrecarga"))
        self.assertTrue(boss["defeated"])
        self.assertTrue(boss["node"].isHidden())

    def test_lose_returns_to_zone_spawn_with_half_hp(self):
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        self.g.start_battle(boss)
        b = self.g.battle
        b.state.hp = 1
        b._defeat()
        self.g.key_event("enter", True)
        self.assertEqual(self.g.mode, "play")
        self.assertGreaterEqual(self.g.state.hp, 1)
        sx, sz = self.g.zone.spawn()
        self.assertEqual((round(self.g.px), round(self.g.py)), (sx, sz))


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class Repair(unittest.TestCase):
    def setUp(self):
        self.g = get_game()
        _reset(self.g)
        self.g.load_zone("cache", None)
        self.g.fight.roamers = []

    def _repair_target(self):
        return next((it for it in self.g.interactables if it["kind"] == "repair" and not it["done"]), None)

    def test_repair_opens_and_escape_cancels(self):
        target = self._repair_target()
        if target is None:
            self.skipTest("sem trilha partida nesta zona")
        _near(self.g, target)
        self.g.do_interact()
        self.assertEqual(self.g.mode, "repair")
        self.g.key_event("escape", True)
        self.assertEqual(self.g.mode, "play")
        self.assertFalse(target["done"])

    def test_success_sets_flag_counter_and_record(self):
        target = self._repair_target()
        if target is None:
            self.skipTest("sem trilha partida nesta zona")
        _near(self.g, target)
        self.g.do_interact()
        game = self.g.repair
        game.success = True
        game.done = True
        game.moves = 3
        self.g._end_repair(cancelled=False)
        self.assertTrue(self.g.state.has_flag(f"rep_{target['m']['id']}"))
        self.assertGreaterEqual(self.g.state.counter(f"repair_{self.g.zone.id}"), 1)
        self.assertIn(game.record_key(), self.g.state.repairBest)
        self.assertTrue(target["done"])

    def test_hard_toggle_keeps_repair_open(self):
        target = self._repair_target()
        if target is None:
            self.skipTest("sem trilha partida nesta zona")
        _near(self.g, target)
        self.g.do_interact()
        self.g.key_event("h", True)
        self.assertEqual(self.g.mode, "repair")
        self.assertTrue(self.g.repair.hard)
        self.g.key_event("escape", True)


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class ShopAndBench(unittest.TestCase):
    def setUp(self):
        from anelzero import state as S
        self.g = get_game()
        _reset(self.g, S.new_state())
        self.g.state.gold = 500
        self.g.load_zone("cache", None)
        self.g.fight.roamers = []

    def test_bench_opens_craft_mode(self):
        self.g.load_zone("regs", None)  # a bancada fica na Planície de Registradores
        self.g.fight.roamers = []
        bench = next((it for it in self.g.interactables if it["kind"] == "bench"), None)
        if bench is None:
            self.skipTest("sem bancada nesta zona")
        _near(self.g, bench)
        self.g.do_interact()
        self.assertEqual(self.g.mode, "shop")
        self.assertEqual(self.g.shop.modes, ["criar"])
        self.g.key_event("escape", True)
        self.assertEqual(self.g.mode, "play")

    def test_shop_buy_with_keyboard(self):
        self.g.open_shop(bench=False)
        self.assertEqual(self.g.mode, "shop")
        gold0 = self.g.state.gold
        self.g.key_event("enter", True)  # compra o primeiro item da lista
        self.assertLess(self.g.state.gold, gold0)
        self.g.key_event("escape", True)
        self.assertEqual(self.g.mode, "play")


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class SettingsFlow(unittest.TestCase):
    def setUp(self):
        self.g = get_game()
        _reset(self.g)
        self.g.mode = "title"
        self.g.title_index = 0

    def test_title_ajustes_changes_volume_and_saves(self):
        from anelzero import settings as T
        self.g.settings.set("master", 0.8)
        self.g.open_settings("title")
        self.assertEqual(self.g.mode, "settings")
        self.g.settings_cursor = 0  # volume geral
        self.g.key_event("arrow_right", True)
        self.assertAlmostEqual(self.g.settings.get("master"), 0.9)
        self.g.key_event("escape", True)
        self.assertEqual(self.g.mode, "title")
        saved = T.Settings(T.settings_path()).load()
        self.assertAlmostEqual(saved.get("master"), 0.9)

    def test_difficulty_cycles(self):
        self.g.open_settings("play")
        idx = P.SETTINGS_ROWS.index("difficulty")
        self.g.settings_cursor = idx
        before = self.g.settings.get("difficulty")
        self.g.key_event("arrow_right", True)
        self.assertNotEqual(self.g.settings.get("difficulty"), before)
        self.g.key_event("escape", True)

    def test_shadow_toggle_switches_light(self):
        self.g.settings.set("shadows", True)
        self.g._apply_shadows()
        self.assertTrue(self.g.sun.isShadowCaster())
        self.g.settings.set("shadows", False)
        self.g._apply_shadows()
        self.assertFalse(self.g.sun.isShadowCaster())
        self.g.settings.set("shadows", True)
        self.g._apply_shadows()


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class Intro(unittest.TestCase):
    def test_intro_uses_letterbox_and_transitions_to_play(self):
        g = get_game()
        _reset(g)
        g.mode = "title"
        g.start_intro()
        self.assertEqual(g.mode, "intro")
        self.assertFalse(g.letter_top.isHidden())
        for _ in range(400):
            g.key_event("e", True)
            g.step(0.05)
            if g.mode == "play" or g.fade is not None:
                break
        _settle(g)
        self.assertEqual(g.mode, "play")
        self.assertTrue(g.letter_top.isHidden())


if __name__ == "__main__":
    unittest.main()

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


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class RoamerBattle(unittest.TestCase):
    def setUp(self):
        from anelzero import state as S
        self.g = get_game()
        _reset(self.g, S.new_state())
        self.g.load_zone("cache", None)
        self.g.fight.roamers = []
        self.g.settings.set("battle_on_contact", True)

    def tearDown(self):
        self.g.settings.set("battle_on_contact", False)

    def test_contact_opens_turn_battle_when_setting_on(self):
        from anelzero import rt
        import random
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.1, random.Random(1))
        self.g.fight.roamers = [rm]
        self.g.step(0.016)
        self.assertEqual(self.g.mode, "battle")
        self.assertEqual(self.g.battle.enemy_id, "pulga")

    def test_win_removes_roamer(self):
        from anelzero import rt
        import random
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.1, random.Random(1))
        self.g.fight.roamers = [rm]
        self.g.step(0.016)
        self.g.battle.e_hp = 1
        self.g.battle.result = "win"
        self.g.battle._victory()
        self.g._end_battle()
        self.assertFalse(rm.alive)
        self.assertEqual(self.g.mode, "play")

    def test_setting_off_keeps_real_time_combat(self):
        from anelzero import rt
        import random
        self.g.settings.set("battle_on_contact", False)
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.1, random.Random(1))
        self.g.fight.roamers = [rm]
        self.g.step(0.016)
        self.assertEqual(self.g.mode, "play")


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class RepairMouse(unittest.TestCase):
    def setUp(self):
        from anelzero import state as S
        self.g = get_game()
        _reset(self.g, S.new_state())
        self.g.load_zone("cache", None)
        self.g.fight.roamers = []

    def test_click_on_cell_rotates_it(self):
        from anelzero import panels as P
        from anelzero import repair as R
        import random
        self.g.repair_target = None
        self.g.start_repair({"m": {"id": "rp_teste"}, "node": None, "done": False})
        g = self.g.repair
        n, size = g.puzzle.n, self.g.repair_screen.size
        cell = (1, 2)
        cell_w = size * 2 / n
        ax = -size + (cell[0] + 0.5) * cell_w
        ay = size - (cell[1] + 0.5) * cell_w
        self.assertEqual(P.cell_at(ax, ay, n, size), cell)
        before = g.puzzle.cells[cell[1]][cell[0]].rot
        got = self.g.repair_click(ax, ay)
        self.assertEqual(got, cell)
        if g.puzzle.cells[cell[1]][cell[0]].type != "cruzamento":
            self.assertEqual(g.puzzle.cells[cell[1]][cell[0]].rot, (before + 1) % 4)
        self.g._end_repair(cancelled=True)

    def test_click_outside_grid_does_nothing(self):
        self.g.start_repair({"m": {"id": "rp_teste"}, "node": None, "done": False})
        moves = self.g.repair.moves
        self.assertIsNone(self.g.repair_click(1.6, 0.0))
        self.assertEqual(self.g.repair.moves, moves)
        self.g._end_repair(cancelled=True)


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class IconRendering(unittest.TestCase):
    def test_item_enemy_and_skill_icons_are_written_as_png(self):
        import os
        g = get_game()
        self.assertIsNotNone(g.icons)
        self.assertTrue(g.icons.available)
        for kind, ident in (("item", "pasta_termica"), ("enemy", "pulga"), ("skill", "golpe")):
            with self.subTest(kind=kind, ident=ident):
                path = g.icon_for(kind, ident)
                self.assertIsNotNone(path)
                self.assertTrue(path.endswith(".png"))
                # O modelo tem de aparecer: o centro da imagem é visivelmente diferente do canto (fundo)
                from panda3d.core import Filename, PNMImage
                img = PNMImage()
                img.read(Filename.from_os_specific(path))
                def mean(x0, y0, x1, y1):
                    tot, n = 0.0, 0
                    for y in range(y0, y1, 4):
                        for x in range(x0, x1, 4):
                            tot += img.getRed(x, y) + img.getGreen(x, y) + img.getBlue(x, y)
                            n += 3
                    return tot / n
                w, h = img.getXSize(), img.getYSize()
                center = mean(w // 4, h // 4, 3 * w // 4, 3 * h // 4)
                corner = mean(0, 0, w // 8, h // 8)
                self.assertGreater(abs(center - corner), 0.05, "ícone sem modelo visível")


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class IconsInBattle(unittest.TestCase):
    def setUp(self):
        from anelzero import state as S
        self.g = get_game()
        _reset(self.g, S.new_state())
        self.g.load_zone("cache", None)
        self.g.fight.roamers = []

    def test_battle_item_submenu_uses_icons(self):
        from anelzero import rt
        import random
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.1, random.Random(1))
        self.g.start_roamer_battle(rm)
        self.g.battle.act("itens")
        self.g._refresh_battle()
        rows = self.g.battle_screen.cmds.rows
        has_icon = [slot.node is not None for _text, slot in rows if _text.node.getText()]
        self.assertTrue(any(has_icon), "nenhum item da batalha ganhou ícone")
        self.g.battle = None
        self.g.battle_screen.hide()
        self.g.mode = "play"

    def test_roamer_has_world_icon_card(self):
        from anelzero import rt
        import random
        rm = rt.Roamer("pulga", self.g.px + 2, self.g.py + 2, random.Random(1))
        self.g.fight.roamers = [rm]
        self.g._add_roamer_node(rm)
        root, _bar = self.g.roamer_nodes[id(rm)]
        self.assertFalse(root.find("**/roamer-icon").isEmpty())
        self.g.fight.roamers = []


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class LiveTextScale(unittest.TestCase):
    def test_text_scale_changes_without_restart(self):
        from anelzero import textscale
        from anelzero import panels as P
        g = get_game()
        _reset(g)
        g.mode = "title"
        g.open_settings("play")
        g.settings.set("text_scale", 1.0)
        textscale.apply(1.0)
        before = g.hud.getScale()[0]
        g.settings_cursor = P.SETTINGS_ROWS.index("text_scale")
        g.key_event("arrow_right", True)
        after = g.hud.getScale()[0]
        self.assertGreater(after, before)
        g.key_event("escape", True)
        g.settings.set("text_scale", 1.0)
        textscale.apply(1.0)


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class LayersScreenFlow(unittest.TestCase):
    def test_open_navigate_and_close(self):
        from anelzero import layers as LY
        g = get_game()
        _reset(g)
        g.mode = "title"
        g.open_layers("title")
        self.assertEqual(g.mode, "layers")
        self.assertEqual(g.layer_index, 0)
        g.key_event("arrow_right", True)
        g.key_event("arrow_right", True)
        self.assertEqual(g.layer_index, 2)
        g.key_event("arrow_left", True)
        self.assertEqual(g.layer_index, 1)
        self.assertEqual(LY.LAYERS[g.layer_index]["id"], "metal_m1")
        g.key_event("escape", True)
        self.assertEqual(g.mode, "title")

    def test_wraps_around(self):
        from anelzero import layers as LY
        g = get_game()
        _reset(g)
        g.open_layers("title")
        g.layer_index = len(LY.LAYERS) - 1
        g.key_event("arrow_right", True)
        self.assertEqual(g.layer_index, 0)
        g.key_event("escape", True)

    def test_opens_from_play_with_m(self):
        g = get_game()
        _reset(g)
        g.key_event("m", True)
        self.assertEqual(g.mode, "layers")
        g.key_event("escape", True)
        self.assertEqual(g.mode, "play")


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class LayersKeyBinding(unittest.TestCase):
    def test_m_key_is_bound_to_layers(self):
        import panda3d.core as core  # noqa: F401
        g = get_game()
        _reset(g)
        g.messenger.send("m")  # o evento de teclado passa pelo mesmo caminho que o jogador usa
        self.assertEqual(g.mode, "layers")
        g.messenger.send("escape")
        self.assertEqual(g.mode, "play")

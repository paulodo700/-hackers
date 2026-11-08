"""Teste headless do cliente Panda3D: simula teclas e confirma coleta, portal, salvamento, diálogo,
combate e menu. Precisa de um display: rode com  xvfb-run -a python3 -m unittest discover -s tests

O Panda3D só aceita um ShowBase por processo, por isso há uma única instância para todos os testes.
"""

import os
import random
import tempfile
import unittest

HAS_DISPLAY = bool(os.environ.get("DISPLAY"))
_TMP = None
GAME = None


def setUpModule():
    global _TMP, GAME
    if not HAS_DISPLAY:
        return
    _TMP = tempfile.TemporaryDirectory()
    os.environ["ANELZERO_SAVE_DIR"] = _TMP.name
    from anelzero.client import Game
    GAME = Game()


def tearDownModule():
    if GAME is not None:
        GAME.destroy()  # não usar userExit: ele encerra o processo inteiro
    if _TMP is not None:
        _TMP.cleanup()


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class ClientHeadless(unittest.TestCase):
    def setUp(self):
        from anelzero import state as S
        self.g = GAME
        self.g.start_play(S.new_state())
        self.g.fight.roamers = []
        self.g.msg_left = 0

    def _go(self, c, r):
        self.g.px, self.g.py = float(c), float(r)
        self.g.last_cell = None

    def test_title_to_intro_to_play(self):
        from anelzero import state as S
        self.g.mode = "title"
        self.g.key_event("enter", True)  # "Novo jogo"
        self.assertEqual(self.g.mode, "intro")
        for _ in range(400):
            self.g.key_event("e", True)
            self.g.step(0.05)
            if self.g.mode == "play":
                break
        self.assertEqual(self.g.mode, "play")
        self.assertIsNotNone(self.g.state)
        self.assertIsInstance(self.g.state, S.GameState)

    def test_walking_key_moves_player(self):
        self.g.key_event("d", True)
        x0 = self.g.px
        for _ in range(10):
            self.g.step(0.05)
        self.g.key_event("d", False)
        self.assertGreater(self.g.px, x0)

    def test_collect_pickup_on_walk_over(self):
        pk = next(iter(self.g.pickups.items()))
        (c, r), (node, key, item) = pk
        before = self.g.state.inv.get(item, 0) if item else 0
        self._go(c, r)
        self.g.step(0.016)
        self.assertTrue(self.g.state.has_flag(key))
        self.assertNotIn((c, r), self.g.pickups)
        if item:
            self.assertEqual(self.g.state.inv.get(item, 0), before + 1)

    def test_portal_changes_zone(self):
        portals = self.g.zone.portals()
        self.assertTrue(portals)
        c, r, m = portals[0]
        self._go(c, r)
        self.g.step(0.016)
        self.assertEqual(self.g.zone.id, m["to"])
        self.assertEqual(self.g.state.zone, m["to"])

    def test_save_writes_slot_and_loads_back(self):
        from anelzero import state as S
        self.g.state.gold = 777
        self.g.px, self.g.py = 3.0, 4.0
        self.g.do_save()
        back = self.g.slots.load(self.g.slot)
        self.assertIsNotNone(back)
        self.assertEqual(back.gold, 777)
        self.assertEqual(back.pos, [3.0, 4.0])
        self.assertIsInstance(back, S.GameState)

    def test_npc_dialog_opens_and_closes(self):
        npc = next(it for it in self.g.interactables if it["kind"] == "npc")
        self._go(npc["c"], npc["r"])
        self.g.do_interact()
        self.assertEqual(self.g.mode, "dialog")
        for _ in range(400):
            self.g.key_event("e", True)
            self.g.step(0.05)
            if self.g.mode == "play":
                break
        self.assertEqual(self.g.mode, "play")

    def test_attack_hits_roamer_in_front(self):
        from anelzero import rt
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.8, random.Random(1))
        self.g.fight.roamers = [rm]
        self.g.facing = 0.0  # olhando para +y
        self.g.do_attack()
        self.assertLess(rm.hp, rm.max_hp)

    def test_menu_opens_and_closes(self):
        self.g.key_event("tab", True)
        self.assertEqual(self.g.mode, "menu")
        self.g.key_event("escape", True)
        self.assertEqual(self.g.mode, "play")

    def test_minimap_follows_player(self):
        self._go(self.g.px + 3, self.g.py)
        self.g.step(0.016)
        self.assertTrue(self.g.zone is not None)
        self.assertTrue(self.g.state.is_visited(self.g.zone.id, round(self.g.px), round(self.g.py)))


if __name__ == "__main__":
    unittest.main()

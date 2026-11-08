"""Ferramentas do personagem: fabricação, efeitos, reparo persistente e custo."""

import unittest

from anelzero import content as C
from anelzero import state as S
from anelzero import tools as T
from anelzero import world as W


def rich(state):
    state.inv.update({"fio_cobre": 9, "liga_ferrugem": 9, "cristal_silicio": 9})
    return state


class Crafting(unittest.TestCase):
    def test_craft_consumes_materials_once(self):
        st = rich(S.GameState())
        self.assertTrue(T.craft(st, "reforco_nucleo"))
        self.assertEqual(st.inv["fio_cobre"], 6)
        self.assertFalse(T.craft(st, "reforco_nucleo"))

    def test_craft_needs_materials(self):
        st = S.GameState()
        st.inv = {}
        self.assertFalse(T.craft(st, "reparo_cache"))
        self.assertFalse(T.owned(st, "reparo_cache"))

    def test_unknown_tool_rejected(self):
        self.assertFalse(T.craft(rich(S.GameState()), "nao_existe"))


class Effects(unittest.TestCase):
    def test_reforco_adds_attack_and_defense_once(self):
        st = rich(S.GameState())
        T.craft(st, "reforco_nucleo")
        atk, df = st.atk(), st.defense()
        msg, changed = T.use(st, "reforco_nucleo")
        self.assertFalse(changed)
        self.assertEqual(st.atk(), atk + 1)
        self.assertEqual(st.defense(), df + 1)
        msg2, _ = T.use(st, "reforco_nucleo")
        self.assertIn("já", msg2)
        self.assertEqual(st.atk(), atk + 1)

    def test_ajuste_raises_max_energy_and_refills(self):
        st = rich(S.GameState())
        T.craft(st, "ajuste_energia")
        st.en = 1
        mx = st.max_en()
        T.use(st, "ajuste_energia")
        self.assertEqual(st.max_en(), mx + 5)
        self.assertEqual(st.en, st.max_en())

    def test_use_without_crafting_is_refused(self):
        msg, changed = T.use(rich(S.GameState()), "reforco_nucleo")
        self.assertIn("fabricou", msg)
        self.assertFalse(changed)


class CacheRepair(unittest.TestCase):
    def setUp(self):
        self.zone = W.load(C.LAYER_ZONE_IDS["llc"])
        self.st = rich(S.GameState())
        T.craft(self.st, "reparo_cache")

    def test_repair_opens_nearest_wall_and_persists(self):
        # parede com caminho livre à esquerda: o jogador fica nesse caminho, ao lado da parede
        # a parede tem de ser a única mais próxima da posição (sem empate com outra parede)
        def unique_nearest(c, r):
            pos = (c - 1, r)
            d = [(abs(x - pos[0]) + abs(y - pos[1]), x, y) for y in range(self.zone.height)
                 for x in range(self.zone.width) if self.zone.char(x, y) == "#"
                 and abs(x - pos[0]) + abs(y - pos[1]) <= 3]
            d.sort()
            return len(d) >= 1 and (len(d) == 1 or d[1][0] > d[0][0]) and (d[0][1], d[0][2]) == (c, r)
        c, r = next((c, r) for r in range(1, self.zone.height - 1) for c in range(4, 28)
                    if self.zone.char(c, r) == "#" and self.zone.char(c - 1, r) == "."
                    and unique_nearest(c, r))
        msg, changed = T.use(self.st, "reparo_cache", self.zone, (c - 1, r))
        self.assertTrue(changed)
        self.assertNotEqual(self.zone.char(c, r), "#")
        # uma zona recarregada volta com o reparo aplicado
        fresh = W.load(C.LAYER_ZONE_IDS["llc"])
        self.assertEqual(fresh.char(c, r), "#")
        T.apply_repairs(fresh, self.st)
        self.assertNotEqual(fresh.char(c, r), "#")

    def test_repair_outside_layer_zone_refused(self):
        cache = W.load("cache")
        msg, changed = T.use(self.st, "reparo_cache", cache, (5, 5))
        self.assertFalse(changed)

    def test_repair_far_from_walls_refused(self):
        msg, changed = T.use(self.st, "reparo_cache", self.zone, (-50, -50))
        self.assertFalse(changed)


class Labels(unittest.TestCase):
    def test_every_tool_has_name_and_cost(self):
        for tid in T.TOOLS:
            self.assertIn(T.TOOLS[tid]["name"], T.craft_label(tid))


if __name__ == "__main__":
    unittest.main()


class ToolIcons(unittest.TestCase):
    def test_every_tool_has_a_model_and_icon_spec(self):
        from anelzero import models as MD
        from anelzero import icons as I
        for tid in T.TOOLS:
            self.assertIsNotNone(MD.tool_node(tid))
        self.assertEqual(len([s for s in I.all_icon_specs() if s[0] == "tool"]), len(T.TOOLS))

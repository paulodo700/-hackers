"""Menus (status, inventário, habilidades, missões, viagem) e minimapa."""

import unittest

from anelzero import content as C
from anelzero import menu as M
from anelzero import state as S
from anelzero import world as W


class Tabs(unittest.TestCase):
    def test_tabs_cycle(self):
        m = M.Menu(S.GameState(), "cache")
        self.assertEqual(m.tab_name, "Status")
        m.next_tab()
        self.assertEqual(m.tab_name, "Inventário")
        for _ in range(len(M.TABS) - 1):
            m.next_tab()
        self.assertEqual(m.tab_name, "Status")

    def test_cursor_wraps(self):
        m = M.Menu(S.GameState(), "cache")
        m.move(-1)
        self.assertEqual(m.cursor[0], len(m.rows()) - 1)


class Inventory(unittest.TestCase):
    def test_use_consumable_from_menu(self):
        st = S.GameState()
        st.hp = 1
        m = M.Menu(st, "cache")
        m.next_tab()
        idx = next(i for i, r in enumerate(m.rows()) if r["id"] == "pasta_termica")
        m.cursor[1] = idx
        m.activate()
        self.assertGreater(st.hp, 1)
        self.assertIn("Usou", m.message)

    def test_sell_adds_gold(self):
        st = S.GameState()
        m = M.Menu(st, "cache")
        m.next_tab()
        m.cursor[1] = next(i for i, r in enumerate(m.rows()) if r["id"] == "pasta_termica")
        gold = st.gold
        m.sell()
        self.assertGreater(st.gold, gold)

    def test_empty_inventory_row(self):
        st = S.GameState()
        st.inv = {}
        m = M.Menu(st, "cache")
        m.next_tab()
        self.assertEqual(m.rows()[0]["id"], None)


    def test_key_items_cannot_be_sold(self):
        st = S.GameState()
        st.add_item("capacitor", 1)
        m = M.Menu(st, "cache")
        m.next_tab()
        m.cursor[1] = next(i for i, r in enumerate(m.rows()) if r["id"] == "capacitor")
        self.assertIn("não pode", m.sell())


class Skills(unittest.TestCase):
    def test_spend_point_from_menu(self):
        st = S.GameState()
        st.skillPoints = 1
        m = M.Menu(st, "cache")
        m.next_tab(2)
        node = C.SKILL_TREE[0]["id"]
        m.cursor[2] = next(i for i, r in enumerate(m.rows()) if r["id"] == node)
        m.activate()
        self.assertEqual(st.skill_level(node), 1)


class Travel(unittest.TestCase):
    def test_unvisited_zones_are_hidden(self):
        m = M.Menu(S.GameState(), "cache")
        m.next_tab(4)
        rows = m.rows()
        self.assertTrue(any(r["label"].startswith("???") for r in rows))
        self.assertFalse(any(r["id"] == "core" for r in rows))

    def test_visited_zone_is_a_destination(self):
        st = S.GameState()
        st.mark_visited("regs", 3, 3)
        m = M.Menu(st, "cache")
        m.next_tab(4)
        m.cursor[4] = next(i for i, r in enumerate(m.rows()) if r["id"] == "regs")
        self.assertEqual(m.activate(), "VIAGEM:regs")


class Minimap(unittest.TestCase):
    def test_reveal_and_grid_shape(self):
        zone = W.load("cache")
        st = S.GameState()
        sx, sz = zone.spawn()
        W.reveal(zone, st, sx, sz, radius=3)
        rows = W.minimap_grid(zone, st, sx, sz, radius=6)
        self.assertEqual(len(rows), 13)
        self.assertEqual(len(rows[0]), 13)
        self.assertEqual(rows[6][6], "@")
        self.assertIn("?", rows[0])  # área longe do jogador continua oculta

    def test_visited_cells_show_terrain(self):
        zone = W.Zone("m", {"map": ["#####", "#...#", "#####"], "markers": {}})
        st = S.GameState()
        W.reveal(zone, st, 2, 1, radius=2)
        row = W.minimap_grid(zone, st, 2, 1, radius=2)[2]
        self.assertIn("#", row)


if __name__ == "__main__":
    unittest.main()

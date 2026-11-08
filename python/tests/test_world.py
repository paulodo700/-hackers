"""Cada zona precisa ser jogável: itens, baús, NPCs e portais alcançáveis a partir do ponto inicial."""

import unittest

from anelzero import world as W
from anelzero import content as C


class ZoneConnectivity(unittest.TestCase):
    def test_every_zone_has_spawn_and_is_walkable_from_it(self):
        for zid in W.all_zone_ids():
            with self.subTest(zone=zid):
                z = W.load(zid)
                start = z.spawn()
                self.assertTrue(z.walkable(*start), f"{zid}: ponto inicial bloqueado")
                self.assertGreater(len(z.reachable(start)), 50, f"{zid}: área alcançável pequena demais")

    def test_pickups_and_markers_are_reachable(self):
        for zid in W.all_zone_ids():
            z = W.load(zid)
            reach = z.reachable(z.spawn())
            for ch, m in z.markers_def.items():
                if m.get("type") == "portal":
                    continue
                for c, r in z.cells_of(ch):
                    with self.subTest(zone=zid, marker=ch, cell=(c, r)):
                        # Ao lado de um marcador basta uma célula alcançável (pilares podem cercar a célula)
                        near = any((c + dc, r + dr) in reach for dc in (-1, 0, 1) for dr in (-1, 0, 1))
                        self.assertTrue(near, f"{zid}: marcador {ch} em {(c, r)} inacessível")

    def test_portal_destinations_exist_and_arrival_is_walkable(self):
        for zid in W.all_zone_ids():
            z = W.load(zid)
            for c, r, m in z.portals():
                dest_id = m["to"]
                with self.subTest(zone=zid, portal=(c, r), to=dest_id):
                    self.assertIn(dest_id, C.ZONES)
                    dest = W.load(dest_id)
                    arrival = dest.arrival_from(zid)
                    self.assertTrue(dest.walkable(*arrival))


class GridBasics(unittest.TestCase):
    def test_outside_grid_counts_as_wall(self):
        z = W.load("cache")
        self.assertFalse(z.walkable(-1, 0))
        self.assertFalse(z.walkable(z.width + 5, 2))
        self.assertEqual(z.char(-1, -1), W.WALL)

    def test_reachable_stops_at_walls(self):
        z = W.Zone("x", {"map": ["#####", "#.#.#", "#.#.#", "#####"], "markers": {}})
        reach = z.reachable((1, 1))
        self.assertIn((1, 2), reach)
        self.assertNotIn((3, 1), reach)  # o corredor da direita é isolado por paredes


if __name__ == "__main__":
    unittest.main()

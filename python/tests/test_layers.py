"""Camadas do processador: formato, determinismo, códigos válidos e variedade entre as camadas."""

import unittest

from anelzero import layers as L


class Layers(unittest.TestCase):
    def test_ten_layers_with_unique_ids(self):
        self.assertEqual(len(L.LAYERS), 10)
        ids = [l["id"] for l in L.LAYERS]
        self.assertEqual(len(set(ids)), 10)

    def test_every_layer_is_a_square_grid(self):
        for layer in L.LAYERS:
            with self.subTest(layer=layer["id"]):
                rows = L.layer_rows(layer["id"])
                self.assertEqual(len(rows), L.SIZE)
                self.assertTrue(all(len(r) == L.SIZE for r in rows))

    def test_only_known_codes(self):
        for layer in L.LAYERS:
            for row in L.layer_rows(layer["id"]):
                self.assertTrue(set(row) <= set(L.PALETTE), layer["id"])

    def test_deterministic(self):
        for layer in L.LAYERS:
            self.assertEqual(L.layer_rows(layer["id"]), L.layer_rows(layer["id"]))

    def test_layers_are_visually_different(self):
        grids = {l["id"]: tuple(L.layer_rows(l["id"])) for l in L.LAYERS}
        self.assertEqual(len(set(grids.values())), 10)

    def test_unknown_layer_rejected(self):
        with self.assertRaises(KeyError):
            L.layer_rows("nao_existe")


if __name__ == "__main__":
    unittest.main()


class Legend(unittest.TestCase):
    def test_every_used_code_has_a_name(self):
        for code, name in L.legend():
            with self.subTest(code=code):
                self.assertNotEqual(name, code, f"código {code} sem nome na legenda")

    def test_legend_lists_each_code_once(self):
        codes = [c for c, _ in L.legend()]
        self.assertEqual(len(codes), len(set(codes)))

    def test_layer_image_size(self):
        img = L.layer_image("dissipador", cell=4)
        self.assertEqual((img.getXSize(), img.getYSize()), (L.SIZE * 4, L.SIZE * 4))


class LayerZone(unittest.TestCase):
    """A zona construída a partir da camada de cache passa pelas mesmas regras das outras zonas."""

    @classmethod
    def setUpClass(cls):
        from anelzero import content as C
        cls.zone = C.ZONES[C.LAYER_ZONE_IDS["llc"]]
        cls.rows = cls.zone["map"]

    def test_is_registered_zone_with_map_and_theme(self):
        self.assertEqual(self.zone["layer"], "llc")
        self.assertEqual(len(self.rows), L.SIZE)
        self.assertTrue(self.zone["theme"].get("trace"))

    def test_spawn_and_portal_reachable(self):
        from anelzero import world as W
        z = W.load(self.zone["id"])
        reach = z.reachable(z.spawn())
        self.assertGreater(len(reach), 200)
        for c, r, m in z.portals():
            self.assertIn((c, r), reach)

    def test_items_reachable(self):
        from anelzero import world as W
        z = W.load(self.zone["id"])
        reach = z.reachable(z.spawn())
        for c, r, m in z.pickups():
            self.assertIn((c, r), reach)

    def test_portal_goes_back_to_cache(self):
        from anelzero import world as W
        z = W.load(self.zone["id"])
        self.assertTrue(all(m["to"] == "cache" for _c, _r, m in z.portals()))

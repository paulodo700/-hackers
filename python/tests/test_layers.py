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

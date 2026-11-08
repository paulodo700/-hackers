"""O gerador em Python tem de produzir exatamente os mapas gerados pela versão JavaScript."""

import json
import pathlib
import unittest

from anelzero.mapgen import generate_map, Mulberry32

DATA = pathlib.Path(__file__).resolve().parent.parent / "anelzero" / "data"


class MapgenParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.zones = json.loads((DATA / "zones.json").read_text(encoding="utf-8"))["ZONES"]

    def test_mulberry32_matches_javascript_sequence(self):
        # Valores calculados pela implementação JavaScript de mulberry32(1)
        rnd = Mulberry32(1)
        expected = [0.62707394058816135, 0.0027357211802154779, 0.52744703995995224]
        for want in expected:
            self.assertAlmostEqual(rnd(), want, places=12)

    def test_generated_zones_match_javascript_maps_exactly(self):
        checked = 0
        for zid, z in self.zones.items():
            if not z.get("gen"):
                continue  # o Núcleo é uma arena fixa
            gen = z["gen"]
            rows = generate_map(gen["seed"], gen["cols"], gen["rows"], z["markers"], gen["extras"])
            self.assertEqual(rows, z["map"], f"mapa de {zid} difere da versão JavaScript")
            checked += 1
        self.assertEqual(checked, 6)

    def test_same_seed_same_map(self):
        z = self.zones["cache"]
        g = z["gen"]
        a = generate_map(g["seed"], g["cols"], g["rows"], z["markers"], g["extras"])
        b = generate_map(g["seed"], g["cols"], g["rows"], z["markers"], g["extras"])
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()

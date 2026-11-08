"""Especificação dos ícones: formas por tipo, paleta por zona, caminhos do cache."""

import pathlib
import tempfile
import unittest

from anelzero import content as C
from anelzero import icons as I


class Shapes(unittest.TestCase):
    def test_every_item_has_a_known_shape(self):
        for item_id in C.ITEMS:
            with self.subTest(item=item_id):
                self.assertIn(I.item_shape(item_id), {"blade", "plate", "capsule", "chip", "cluster"})

    def test_weapons_are_blades(self):
        weapon = next(i for i, v in C.ITEMS.items() if v["slot"] == "weapon")
        self.assertEqual(I.item_shape(weapon), "blade")

    def test_unknown_item_raises(self):
        with self.assertRaises(KeyError):
            I.item_shape("nao_existe")


class Palette(unittest.TestCase):
    def test_palette_per_zone_differs(self):
        self.assertNotEqual(I.zone_palette("cache")["accent"], I.zone_palette("regs")["accent"])

    def test_tint_moves_toward_zone_accent(self):
        base = "#000000"
        tinted_color = I.tinted(base, "cache", 0.5)
        self.assertNotEqual(tinted_color, base)

    def test_mix_endpoints(self):
        self.assertEqual(I.mix_hex("#102030", "#ffffff", 0), "#102030")
        self.assertEqual(I.mix_hex("#102030", "#ffffff", 1), "#ffffff")

    def test_neutral_zone_is_not_tinted(self):
        self.assertEqual(I.tinted("#336699", None), "#336699")


class Paths(unittest.TestCase):
    def test_zone_icons_are_separate_files(self):
        root = pathlib.Path(tempfile.gettempdir()) / "x"
        a = I.icon_file("item", "capacitor", "cache", root)
        b = I.icon_file("item", "capacitor", "regs", root)
        self.assertNotEqual(a, b)
        self.assertEqual(a.suffix, ".png")

    def test_unknown_zone_uses_neutral_folder(self):
        p = I.icon_file("enemy", "pulga", "zona_inexistente", pathlib.Path("/tmp/icons"))
        self.assertEqual(p.parent.name, I.NEUTRAL_ZONE)

    def test_invalid_kind_rejected(self):
        with self.assertRaises(ValueError):
            I.icon_file("planta", "x")

    def test_spec_covers_items_enemies_and_skills(self):
        specs = I.all_icon_specs()
        self.assertEqual(len([s for s in specs if s[0] == "item"]), len(C.ITEMS))
        self.assertEqual(len([s for s in specs if s[0] == "enemy"]), len(C.ENEMIES))
        self.assertEqual(len([s for s in specs if s[0] == "skill"]), len(C.SKILLS))


if __name__ == "__main__":
    unittest.main()


class SkillStyle(unittest.TestCase):
    def test_every_skill_has_color_and_shape(self):
        for skill in C.SKILLS:
            with self.subTest(skill=skill["id"]):
                color, shape = I.skill_style(skill["id"])
                self.assertTrue(color.startswith("#") and len(color) == 7)
                self.assertIn(shape, {"diamond", "cone", "cross", "spike"})

    def test_skills_are_visually_distinct(self):
        styles = {I.skill_style(s["id"]) for s in C.SKILLS}
        self.assertEqual(len(styles), len(C.SKILLS))

    def test_unknown_skill_rejected(self):
        with self.assertRaises(KeyError):
            I.skill_style("nao_existe")


class TalentStyle(unittest.TestCase):
    def test_every_talent_has_style_and_they_differ(self):
        styles = {I.talent_style(t["id"]) for t in C.SKILL_TREE}
        self.assertEqual(len(styles), len(C.SKILL_TREE))
        for t in C.SKILL_TREE:
            self.assertIn(I.talent_style(t["id"])[1], {"cube", "prism", "spike", "plate", "ring"})

    def test_talents_are_in_icon_spec(self):
        talents = [s for s in I.all_icon_specs() if s[0] == "talent"]
        self.assertEqual(len(talents), len(C.SKILL_TREE))

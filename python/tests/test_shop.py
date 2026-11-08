"""Loja (comprar e vender) e bancada (criar com receitas)."""

import unittest

from anelzero import content as C
from anelzero import shop as SH
from anelzero import state as S


class Buying(unittest.TestCase):
    def test_buy_spends_gold_and_adds_item(self):
        st = S.GameState()
        st.gold = 1000
        sh = SH.Shop(st, "comprar")
        target = sh.rows()[0]["id"]
        n0 = st.inv.get(target, 0)
        price = C.SHOP[target]
        sh.activate()
        self.assertEqual(st.inv.get(target, 0), n0 + 1)
        self.assertEqual(st.gold, 1000 - price)

    def test_cannot_buy_without_gold(self):
        st = S.GameState()
        st.gold = 0
        sh = SH.Shop(st, "comprar")
        sh.activate()
        self.assertIn("insuficiente", sh.message)


class Selling(unittest.TestCase):
    def test_sell_gives_gold(self):
        st = S.GameState()
        sh = SH.Shop(st, "vender")
        idx = next(i for i, r in enumerate(sh.rows()) if r["id"] == "pasta_termica")
        sh.cursor = idx
        gold = st.gold
        sh.activate()
        self.assertGreater(st.gold, gold)

    def test_key_items_listed_as_not_sellable(self):
        st = S.GameState()
        st.add_item("capacitor", 1)
        sh = SH.Shop(st, "vender")
        row = next(r for r in sh.rows() if r["id"] == "capacitor")
        self.assertIn("não vende", row["label"])


class Crafting(unittest.TestCase):
    def test_bench_only_offers_craft(self):
        sh = SH.Shop(S.GameState(), bench=True)
        self.assertEqual(sh.modes, ["criar"])

    def test_craft_consumes_materials_and_creates_item(self):
        st = S.GameState()
        recipe = next(r for r in C.RECIPES if all(st.inv.get(i, 0) >= 0 for i in r["need"]))
        for item, n in recipe["need"].items():
            st.inv[item] = st.inv.get(item, 0) + n
        before = st.inv.get(recipe["id"], 0)
        mats_before = {i: st.inv.get(i, 0) for i in recipe["need"]}
        sh = SH.Shop(st, bench=True)
        sh.cursor = next(i for i, r in enumerate(sh.rows()) if r["id"] == recipe["id"])
        sh.activate()
        self.assertEqual(st.inv.get(recipe["id"], 0), before + recipe.get("qty", 1))
        for item, n in recipe["need"].items():
            self.assertEqual(st.inv.get(item, 0), mats_before[item] - n)

    def test_craft_without_materials_fails(self):
        st = S.GameState()
        st.inv = {}
        sh = SH.Shop(st, bench=True)
        sh.activate()
        self.assertIn("Faltam", sh.message)


if __name__ == "__main__":
    unittest.main()

"""Loja do lojista e bancada de criação (port das regras de compra, venda e receitas).

Lógica pura sobre GameState. Cada modo (comprar, vender, criar) devolve linhas que o cliente desenha.
"""

from . import content as C


class Shop:
    MODES = ["comprar", "vender", "criar"]

    def __init__(self, state, mode="comprar", bench=False):
        self.state = state
        self.modes = ["criar"] if bench else ["comprar", "vender"]
        self.mode = self.modes[0] if mode not in self.modes else mode
        self.cursor = 0
        self.message = ""

    def rows(self):
        if self.mode == "comprar":
            return [{"id": i, "label": f"{C.ITEMS[i]['name']}  {price} de ouro",
                     "detail": C.ITEMS[i].get("desc", "")}
                    for i, price in C.SHOP.items() if i in C.ITEMS]
        if self.mode == "vender":
            out = []
            for i, n in sorted(self.state.inv.items()):
                price = self.state.sell_price(i)
                name = C.ITEMS.get(i, {}).get("name", i)
                if price:
                    out.append({"id": i, "label": f"{name} x{n}  vende por {price}", "detail": ""})
                else:
                    out.append({"id": i, "label": f"{name} x{n}  (não vende)", "detail": ""})
            return out or [{"id": None, "label": "Nada para vender.", "detail": ""}]
        return [{"id": r["id"], "label": self._recipe_label(r), "detail": C.ITEMS.get(r["id"], {}).get("desc", "")}
                for r in C.RECIPES]

    def _recipe_label(self, r):
        need = ", ".join(f"{C.ITEMS.get(i, {}).get('name', i)} {n}" for i, n in r["need"].items())
        ok = "pronto" if self.state.can_craft(r) else "falta material"
        return f"{C.ITEMS.get(r['id'], {}).get('name', r['id'])}: {need}  [{ok}]"

    def move(self, delta):
        rows = self.rows()
        if rows:
            self.cursor = (self.cursor + delta) % len(rows)

    def switch_mode(self):
        if len(self.modes) > 1:
            self.mode = self.modes[(self.modes.index(self.mode) + 1) % len(self.modes)]
            self.cursor = 0
            self.message = ""

    def activate(self):
        """Enter: compra, cria ou (no modo vender) vende o item selecionado."""
        rows = self.rows()
        row = rows[self.cursor % len(rows)] if rows else None
        if not row or row["id"] is None:
            self.message = "Nada a fazer."
            return self.message
        if self.mode == "comprar":
            ok = self.state.buy(row["id"])
            self.message = (f"Comprou {C.ITEMS[row['id']]['name']}." if ok
                            else "Ouro insuficiente.")
        elif self.mode == "vender":
            price = self.state.sell(row["id"])
            self.message = f"Vendeu por {price} de ouro." if price else "Este item não pode ser vendido."
        else:
            recipe = next((r for r in C.RECIPES if r["id"] == row["id"]), None)
            if recipe is None:
                self.message = "Receita inexistente."
            elif self.state.craft(recipe):
                self.message = f"Criou {C.ITEMS[recipe['id']]['name']}."
            else:
                self.message = "Faltam materiais."
        self.cursor = min(self.cursor, max(0, len(self.rows()) - 1))
        return self.message

    def header(self):
        gold = f"Ouro {self.state.gold}"
        return f"{'  |  '.join(('[' + m + ']') if m == self.mode else m for m in self.modes)}   {gold}"

"""Menus do jogador (Tab): status, inventário, habilidades, missões e viagem rápida.

Lógica pura sobre GameState. O cliente desenha as linhas que esta classe devolve e envia as teclas.
"""

from . import content as C
from . import world as W
from .state import xp_for_level

TABS = ["Status", "Inventário", "Habilidades", "Missões", "Viagem"]


class Menu:
    def __init__(self, state, current_zone):
        self.state = state
        self.current_zone = current_zone
        self.tab = 0
        self.cursor = [0] * len(TABS)
        self.message = ""

    @property
    def tab_name(self):
        return TABS[self.tab]

    def next_tab(self, step=1):
        self.tab = (self.tab + step) % len(TABS)
        self.message = ""

    def move(self, delta):
        rows = self.rows()
        if rows:
            self.cursor[self.tab] = (self.cursor[self.tab] + delta) % len(rows)

    def selected(self):
        rows = self.rows()
        if not rows:
            return None
        return rows[self.cursor[self.tab] % len(rows)]

    # ---- Linhas de cada aba ----
    def rows(self):
        if self.tab == 0:
            st = self.state
            return [
                {"label": f"Nível {st.level}", "detail": f"XP {st.xp}/{xp_for_level(st.level)}", "id": None},
                {"label": f"HP {st.hp}/{st.max_hp()}", "detail": f"EN {st.en}/{st.max_en()}", "id": None},
                {"label": f"Ataque {st.atk()}", "detail": f"Defesa {st.defense()}", "id": None},
                {"label": f"Ouro {st.gold}", "detail": f"Pontos de habilidade {st.skillPoints}", "id": None},
            ]
        if self.tab == 1:
            out = []
            for item_id, n in sorted(self.state.inv.items()):
                it = C.ITEMS.get(item_id, {})
                out.append({"label": f"{it.get('name', item_id)} x{n}",
                            "detail": self._item_hint(item_id), "id": item_id})
            return out or [{"label": "Inventário vazio", "detail": "", "id": None}]
        if self.tab == 2:
            return [{"label": f"{n['name']} {self.state.skill_level(n['id'])}/{n['max']}",
                     "detail": n.get("desc", ""), "id": n["id"]} for n in C.SKILL_TREE]
        if self.tab == 3:
            out = []
            for qid in C.QUEST_ORDER:
                q = C.QUESTS[qid]
                status = self.state.quest_status(qid)
                tag = {"none": "[ ]", "active": "[>]", "done": "[x]"}[status]
                out.append({"label": f"{tag} {q['title']}", "detail": q.get("intro", ""), "id": qid})
            return out
        # Viagem: zonas visitadas (a inicial sempre) e a zona atual fica marcada
        out = []
        for zid in C.ZONES:
            visited = zid == C.START_ZONE or bool(self.state.visited.get(zid))
            name = C.ZONES[zid].get("name", zid)
            if not visited:
                out.append({"label": "??? (não visitada)", "detail": "", "id": None})
            else:
                here = " (você está aqui)" if zid == self.current_zone else ""
                out.append({"label": name + here, "detail": "", "id": zid})
        return out

    def _item_hint(self, item_id):
        it = C.ITEMS.get(item_id, {})
        if it.get("slot") == "consumable":
            return "Enter: usar"
        if it.get("slot") in ("weapon", "armor"):
            return "Enter: equipar | V: vender"
        return "V: vender" if self.state.sell_price(item_id) else it.get("desc", "")

    # ---- Ações (Enter e V) ----
    def activate(self):
        """Enter: usa, equipa, gasta ponto de habilidade ou escolhe destino de viagem."""
        row = self.selected()
        if not row or row["id"] is None:
            self.message = "Nada a fazer aqui."
            return self.message
        if self.tab == 1:
            it = C.ITEMS.get(row["id"], {})
            if it.get("slot") == "consumable":
                res = self.state.use_consumable(row["id"])
                self.message = f"Usou {it.get('name')}. {res}"
            elif it.get("slot") in ("weapon", "armor"):
                ok = self.state.equip_item(row["id"])
                self.message = f"Equipou {it.get('name')}." if ok else "Não foi possível equipar."
            else:
                self.message = "Este item não pode ser usado."
        elif self.tab == 2:
            ok = self.state.spend_skill_point(row["id"])
            self.message = "Habilidade aprimorada." if ok else "Sem pontos ou já no máximo."
        elif self.tab == 4:
            self.message = f"VIAGEM:{row['id']}"
        else:
            self.message = "Nada a fazer aqui."
        self._clamp_cursor()
        return self.message

    def sell(self):
        """V: vende o item selecionado no inventário."""
        row = self.selected()
        if self.tab != 1 or not row or row["id"] is None:
            self.message = "Só dá para vender itens do inventário."
            return self.message
        price = self.state.sell(row["id"])
        self.message = f"Vendeu por {price} de ouro." if price else "Este item não pode ser vendido."
        self._clamp_cursor()
        return self.message

    def _clamp_cursor(self):
        rows = self.rows()
        if rows:
            self.cursor[self.tab] = min(self.cursor[self.tab], len(rows) - 1)


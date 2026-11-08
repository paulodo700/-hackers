"""Batalha por turnos (port de src/battle.js, sem interface).

Ataque, Habilidades, Itens, Defender e Fugir. O inimigo mostra a intenção do próximo golpe.
Chefes ganham fase 2 ao cair a 50% de vida, não podem ser fugidos e podem se reparar quando estão baixos.
A dificuldade (fácil, normal, difícil) muda o dano recebido e a chance de drops.
"""

import random

from . import combat as K
from . import content as C

FLEE_CHANCE = 0.55
GUARD_FACTOR = 0.45
REPAIR_AMOUNT = 15


class Battle:
    def __init__(self, state, enemy_id, rng=None, difficulty="normal"):
        if enemy_id not in C.ENEMIES:
            raise KeyError(enemy_id)
        self.state = state
        self.enemy_id = enemy_id
        self.d = C.ENEMIES[enemy_id]
        self.rng = rng or random.Random()
        self.difficulty = difficulty if difficulty in K.DIFFICULTY else "normal"
        self.e_hp = self.d["hp"]
        self.menu = "main"          # "main", "skills" ou "items"
        self.guard = False
        self.over = False
        self.result = None          # "win", "lose" ou "flee"
        self.phase2 = False
        self.intent = self._pick_intent()
        self.log = []
        self.rewards = {"xp": 0, "gold": 0, "drops": [], "levels": 0, "quests": []}
        self._note(f"{self.d['name']} bloqueia o caminho!")
        if self.d.get("boss"):
            self._note(f"Chefe: {self.d['name']}. Ao cair a 50% de vida, entra na fase 2.")

    # ---- Consultas ----
    @property
    def name(self):
        return self.d["name"]

    def diff(self):
        return K.DIFFICULTY[self.difficulty]

    def intent_text(self):
        return K.INTENTS[self.intent]["text"]

    def can_flee(self):
        return not self.d.get("boss")

    def skills(self):
        out = []
        for s in C.SKILLS:
            ok = self.state.level >= s["level"]
            cost = self.state.skill_cost(s)
            out.append({"id": s["id"], "name": s["name"], "cost": cost, "level": s["level"],
                        "available": ok and self.state.en >= cost and not self.over})
        return out

    def items(self):
        return [{"id": i, "name": C.ITEMS[i]["name"], "n": n}
                for i, n in sorted(self.state.inv.items())
                if C.ITEMS.get(i, {}).get("slot") == "consumable"]

    def commands(self):
        """Comandos da tela atual, na ordem em que aparecem."""
        if self.over:
            return []
        if self.menu == "skills":
            return [f"skill:{s['id']}" for s in self.skills() if s["available"]] + ["voltar"]
        if self.menu == "items":
            return [f"item:{i['id']}" for i in self.items()] + ["voltar"]
        cmds = ["atacar", "habilidades", "itens", "defender"]
        cmds.append("fugir" if self.can_flee() else None)
        return [c for c in cmds if c]

    # ---- Ações do jogador ----
    def act(self, command):
        """Executa um comando. Devolve False se o comando não é válido agora."""
        if self.over:
            return False
        if command == "voltar":
            self.menu = "main"
            return True
        if command == "habilidades":
            self.menu = "skills"
            return True
        if command == "itens":
            self.menu = "items"
            return True
        if command == "atacar":
            return self._player_attack()
        if command == "defender":
            return self._player_defend()
        if command == "fugir":
            return self._player_flee()
        if command.startswith("skill:"):
            return self._player_skill(command.split(":", 1)[1])
        if command.startswith("item:"):
            return self._player_item(command.split(":", 1)[1])
        return False

    def _player_attack(self):
        self.menu = "main"
        d = K.dmg_from(self.state.atk(), self.d["def"], 1, self.rng.random)
        self._note(f"Você ataca e causa {d} de dano.")
        return self._after_player(d)

    def _player_skill(self, sid):
        skill = next((s for s in C.SKILLS if s["id"] == sid), None)
        if skill is None or skill["id"] not in [s["id"] for s in self.skills() if s["available"]]:
            return False
        self.menu = "main"
        self.state.en -= self.state.skill_cost(skill)
        if skill.get("heal"):
            before = self.state.hp
            self.state.hp = min(self.state.max_hp(), self.state.hp + skill["heal"])
            self._note(f"{skill['name']}: você recupera {self.state.hp - before} HP.")
            return self._after_player(0)
        defn = self.d["def"] * (1 - skill.get("pierce", 0))
        d = K.dmg_from(self.state.atk(), defn, skill["mult"], self.rng.random)
        self._note(f"{skill['name']} causa {d} de dano!")
        return self._after_player(d)

    def _player_item(self, item_id):
        if not self.state.has_item(item_id):
            return False
        self.menu = "main"
        res = self.state.use_consumable(item_id)
        if res is None:
            return False
        self._note(f"Você usa {C.ITEMS[item_id]['name']}: {res}.")
        return self._after_player(0, enemy_turn=True)

    def _player_defend(self):
        self.menu = "main"
        self.guard = True
        self.state.en = min(self.state.max_en(), self.state.en + 5)
        self._note("Você se protege. O próximo golpe será reduzido.")
        return self._after_player(0)

    def _player_flee(self):
        self.menu = "main"
        if not self.can_flee():
            return False
        if self.rng.random() < FLEE_CHANCE:
            self._note("Você escapa pelas trilhas!")
            self.result = "flee"
            self.over = True
            return True
        self._note("Não conseguiu fugir!")
        self._enemy_turn()
        return True

    # ---- Turnos ----
    def _after_player(self, damage, enemy_turn=True):
        if damage:
            self.e_hp -= damage
        if self.e_hp <= 0:
            self.e_hp = 0
            self._victory()
            return True
        if K.should_enter_phase2(bool(self.d.get("boss")), self.e_hp, self.d["hp"], self.phase2):
            self.phase2 = True
            self._note(f"{self.d['name']} entra na FASE 2! Ataque aumentado.")
        if enemy_turn and not self.over:
            self._enemy_turn()
        return True

    def _enemy_turn(self):
        if self.over:
            return
        e = self.d
        if self.intent == "reparar":
            heal = min(REPAIR_AMOUNT, e["hp"] - self.e_hp)
            self.e_hp += heal
            self._note(f"{e['name']} se repara (+{heal} de vida).")
        else:
            mult = K.INTENTS[self.intent]["mult"] * (K.PHASE2_ATK if self.phase2 else 1) * self.diff()["dmg"]
            d = K.dmg_from(e["atk"], self.state.defense(), mult, self.rng.random)
            if self.guard:
                d = max(1, round(d * GUARD_FACTOR))
                self.guard = False
            self.state.hp -= d
            heavy = self.intent == "pesado"
            self._note(f"{e['name']} acerta um golpe pesado: {d} de dano!" if heavy
                       else f"{e['name']} ataca e causa {d} de dano.")
            self.state.clamp_vitals()
            if self.state.hp <= 0:
                self._defeat()
                return
        self.intent = self._pick_intent()

    def _pick_intent(self):
        return K.pick_intent(bool(self.d.get("boss")), self.e_hp, self.d["hp"], self.phase2, self.rng.random)

    def _victory(self):
        e = self.d
        self.over = True
        self.result = "win"
        self._note(f"{e['name']} foi derrotado!")
        self.rewards["xp"] = e["xp"]
        self.rewards["gold"] = e["gold"]
        self.rewards["levels"] = self.state.gain_xp(e["xp"])
        self.state.gold += e["gold"]
        self._note(f"+{e['xp']} XP, +{e['gold']} créditos.")
        if self.rewards["levels"]:
            self._note(f"Nível {self.state.level}! Vitalidade e energia restauradas.")
        for dr in e.get("drops", []):
            if self.rng.random() < dr["chance"] * self.diff()["drop"]:
                self.state.add_item(dr["item"], 1)
                self.rewards["drops"].append(dr["item"])
                self._note(f"Encontrado: {C.ITEMS[dr['item']]['name']}.")
        self.state.bump(f"kill_{self.enemy_id}", 1)
        if e.get("boss"):
            self.state.set_flag(f"boss_{self.enemy_id}")
        self.state.discover_enemy(self.enemy_id)
        self.rewards["quests"] = self.state.check_quests()

    def _defeat(self):
        self.over = True
        self.result = "lose"
        self._note("Seus sistemas caíram...")

    def _note(self, text):
        self.log.append(text)

    def hp_ratio(self):
        return max(0.0, self.e_hp / self.d["hp"])


def start(state, enemy_id, rng=None, difficulty="normal"):
    b = Battle(state, enemy_id, rng, difficulty)
    b.state.discover_enemy(enemy_id)
    return b

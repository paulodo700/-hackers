"""Estado do jogo (port de src/state.js): atributos, inventário, missões, diálogos e salvamento em slots."""

import copy
import datetime
import json
import math
import os
import pathlib

from . import content as C

SAVE_VERSION = 3
SLOT_COUNT = 3


def xp_for_level(lvl):
    return math.floor(40 * (lvl ** 1.5) + 0.5)


def _fresh():
    return {
        "version": SAVE_VERSION,
        "level": 1, "xp": 0, "skillPoints": 0, "skills": {},
        "baseHp": 60, "hp": 60, "baseEn": 30, "en": 30,
        "baseAtk": 6, "baseDef": 2,
        "equip": {"weapon": None, "armor": None},
        "inv": {"pasta_termica": 2, "capsula_energia": 1},
        "gold": 0,
        "flags": {}, "counters": {},
        "quests": {},
        "codex": {"zones": {}, "enemies": {}},
        "repairBest": {}, "visited": {},
        "savedAt": None,
        "zone": C.START_ZONE, "pos": None, "playTime": 0,
    }


class GameState:
    def __init__(self, data=None):
        self.d = _fresh()
        if data is not None:
            self.d.update(data)

    # ---- Acesso direto aos campos (leitura e escrita) ----
    def __getattr__(self, name):
        d = self.__dict__.get("d")
        if d is not None and name in d:
            return d[name]
        raise AttributeError(name)

    def __setattr__(self, name, value):
        if name == "d":
            object.__setattr__(self, name, value)
        else:
            self.d[name] = value

    # ---- Habilidades ----
    def skill_level(self, sid):
        return self.skills.get(sid, 0)

    def spend_skill_point(self, sid):
        node = next((n for n in C.SKILL_TREE if n["id"] == sid), None)
        if node is None or self.skillPoints <= 0 or self.skill_level(sid) >= node["max"]:
            return False
        self.skillPoints -= 1
        self.skills[sid] = self.skill_level(sid) + 1
        self.clamp_vitals()
        return True

    def skill_cost(self, skill):
        return max(0, skill["cost"] - self.skill_level("eficiencia"))

    # ---- Atributos derivados ----
    def max_hp(self):
        armor = C.ITEMS.get(self.equip["armor"]) or {}
        return self.baseHp + (self.level - 1) * 10 + self.skill_level("vigor") * 10 + armor.get("maxHp", 0)

    def max_en(self):
        return self.baseEn + (self.level - 1) * 5 + self.skill_level("fonte") * 8

    def atk(self):
        weapon = C.ITEMS.get(self.equip["weapon"]) or {}
        return self.baseAtk + (self.level - 1) * 2 + self.skill_level("lamina") * 2 + weapon.get("atk", 0)

    def defense(self):
        armor = C.ITEMS.get(self.equip["armor"]) or {}
        return self.baseDef + math.floor((self.level - 1) * 0.8) + self.skill_level("couraca") + armor.get("def", 0)

    def clamp_vitals(self):
        self.hp = max(0, min(self.hp, self.max_hp()))
        self.en = max(0, min(self.en, self.max_en()))

    # ---- Inventário ----
    def add_item(self, item_id, n=1):
        if item_id not in C.ITEMS or n <= 0:
            return 0
        self.inv[item_id] = self.inv.get(item_id, 0) + n
        self.bump(f"collect_{item_id}", n)
        return n

    def remove_item(self, item_id, n=1):
        if not self.inv.get(item_id):
            return False
        self.inv[item_id] -= n
        if self.inv[item_id] <= 0:
            del self.inv[item_id]
        return True

    def has_item(self, item_id):
        return self.inv.get(item_id, 0) > 0

    def use_consumable(self, item_id):
        it = C.ITEMS.get(item_id)
        if not it or it["slot"] != "consumable" or not self.has_item(item_id):
            return None
        parts = []
        if it.get("heal"):
            before = self.hp
            self.hp = min(self.max_hp(), self.hp + it["heal"])
            parts.append(f"+{self.hp - before} HP")
        if it.get("restoreEn"):
            before = self.en
            self.en = min(self.max_en(), self.en + it["restoreEn"])
            parts.append(f"+{self.en - before} EN")
        self.remove_item(item_id, 1)
        return " ".join(parts) or "Nada aconteceu."

    def equip_item(self, item_id):
        it = C.ITEMS.get(item_id)
        if not it or not self.has_item(item_id) or it["slot"] not in ("weapon", "armor"):
            return False
        prev = self.equip[it["slot"]]
        if prev:
            self.add_item(prev, 1)
        self.equip[it["slot"]] = item_id
        self.remove_item(item_id, 1)
        self.clamp_vitals()
        return True

    # ---- Loja e criação ----
    def buy(self, item_id):
        price = C.SHOP.get(item_id)
        if price is None or self.gold < price:
            return False
        self.gold -= price
        self.add_item(item_id, 1)
        return True

    def sell_price(self, item_id):
        it = C.ITEMS.get(item_id)
        if not it or it["slot"] == "key":
            return 0
        return C.RARITY[it["rarity"]]["sell"]

    def sell(self, item_id):
        price = self.sell_price(item_id)
        if not price or not self.has_item(item_id):
            return 0
        self.remove_item(item_id, 1)
        self.gold += price
        return price

    def can_craft(self, recipe):
        return all(self.inv.get(i, 0) >= n for i, n in recipe["need"].items())

    def craft(self, recipe):
        if not self.can_craft(recipe):
            return False
        for i, n in recipe["need"].items():
            self.remove_item(i, n)
        self.add_item(recipe["id"], recipe.get("qty", 1))
        return True

    # ---- Flags e contadores ----
    def set_flag(self, key):
        self.flags[key] = True

    def has_flag(self, key):
        return bool(self.flags.get(key))

    def bump(self, key, n=1):
        self.counters[key] = self.counters.get(key, 0) + n

    def counter(self, key):
        return self.counters.get(key, 0)

    def meets(self, cond):
        if not cond:
            return True
        if isinstance(cond, str):
            return self.has_flag(cond)
        if "count" in cond:
            return self.counter(cond["count"]) >= cond["n"]
        return False

    def scene_matches(self, w):
        if not w:
            return True
        if "quest" in w:
            if w.get("done"):
                ok = self.quest_status(w["quest"]) == "done"
            else:
                ok = self.quest_stage(w["quest"]) == w.get("stage")
            if not ok:
                return False
        if "flag" in w and not self.has_flag(w["flag"]):
            return False
        if "gate" in w and self.quest_stage(w["gate"]["quest"]) < w["gate"]["minStage"]:
            return False
        return True

    # ---- Missões ----
    def quest_status(self, qid):
        return self.quests.get(qid, {}).get("status", "none")

    def stage_satisfied(self, stage):
        if "flag" in stage:
            return self.has_flag(stage["flag"])
        if "count" in stage:
            return self.counter(stage["count"]) >= stage["n"]
        if "kill" in stage:
            return self.counter(f"kill_{stage['kill']}") >= stage["n"]
        return False

    def quest_stage(self, qid):
        q = C.QUESTS[qid]
        status = self.quest_status(qid)
        if status == "none":
            return 0
        if status == "done":
            return len(q["stages"])
        for i, s in enumerate(q["stages"]):
            if not self.stage_satisfied(s):
                return i
        return len(q["stages"])

    def start_quest(self, qid):
        if self.quest_status(qid) != "none":
            return False
        self.quests[qid] = {"status": "active"}
        return True

    def active_quest(self):
        return next((q for q in C.QUEST_ORDER if self.quest_status(q) == "active"), None)

    def check_quests(self):
        done = []
        for qid in C.QUEST_ORDER:
            if self.quest_status(qid) != "active":
                continue
            q = C.QUESTS[qid]
            if all(self.stage_satisfied(s) for s in q["stages"]):
                self.quests[qid] = {"status": "done"}
                reward = q["reward"]
                if reward.get("gold"):
                    self.gold += reward["gold"]
                for item, n in reward.get("items", []):
                    self.add_item(item, n)
                if reward.get("xp"):
                    self.gain_xp(reward["xp"])
                done.append({"id": qid, "reward": reward})
        return done

    # ---- Diálogos, ações e baús ----
    def apply_action(self, action):
        if "set" in action:
            self.set_flag(action["set"])
        if "start" in action:
            self.start_quest(action["start"])
        if "give" in action:
            item, n = action["give"]
            self.add_item(item, n)

    def npc_scene(self, npc_id):
        """Primeira cena do NPC cuja condição vale agora (None se o NPC não tem nada a dizer)."""
        npc = C.NPCS.get(npc_id)
        if npc is None:
            return None
        return next((sc for sc in npc["scenes"] if self.scene_matches(sc.get("when"))), None)

    def talk(self, npc_id):
        """Fala com o NPC: devolve nome, cor e falas da cena, aplicando suas ações."""
        npc = C.NPCS.get(npc_id)
        scene = self.npc_scene(npc_id)
        if npc is None or scene is None:
            return None
        for action in scene.get("actions", []):
            self.apply_action(action)
        self.check_quests()
        return {"npc": npc_id, "name": npc["name"], "color": npc["color"], "lines": scene["lines"]}

    def open_chest(self, chest_id, zone_id=None, c=None, r=None):
        """Abre um baú. Baús nomeados usam CHEST_LOOT; baús extras sorteiam da lista da zona de forma fixa."""
        key = f"chest_{chest_id}"
        if self.has_flag(key):
            return None
        self.set_flag(key)
        gained = []
        if chest_id in C.CHEST_LOOT:
            gained = [(item, n) for item, n in C.CHEST_LOOT[chest_id]]
        elif zone_id is not None and C.ZONE_LOOT.get(zone_id):
            pool = C.ZONE_LOOT[zone_id]
            idx = (c * 31 + r * 17 + len(zone_id)) % len(pool)
            gained = [(pool[idx], 1)]
        for item, n in gained:
            self.add_item(item, n)
        return gained

    # ---- Experiência ----
    def gain_xp(self, n):
        self.xp += n
        ups = 0
        while self.xp >= xp_for_level(self.level):
            self.xp -= xp_for_level(self.level)
            self.level += 1
            self.skillPoints += 1
            ups += 1
            self.hp = self.max_hp()
            self.en = self.max_en()
        return ups

    # ---- Recordes e códex ----
    def record_repair_score(self, key, score):
        prev = self.repairBest.get(key, 0)
        if score > prev:
            self.repairBest[key] = score
            return True
        return False

    def discover_enemy(self, enemy_id):
        self.codex.setdefault("enemies", {})[enemy_id] = True

    def enemy_discovered(self, enemy_id):
        return bool(self.codex.get("enemies", {}).get(enemy_id))

    def mark_visited(self, zone_id, c, r):
        self.visited.setdefault(zone_id, {})[f"{c},{r}"] = 1

    def is_visited(self, zone_id, c, r):
        return bool(self.visited.get(zone_id, {}).get(f"{c},{r}"))


# ---- Salvamento em slots (arquivos JSON no diretório do usuário) ----

def migrate(data):
    """Migra saves de qualquer versão para a versão 3 (mesma regra de src/state.js)."""
    out = _fresh()
    out.update(data)
    v = data.get("version", 1)
    if v < 2:
        out["skills"] = {}
        out["repairBest"] = {}
        out["skillPoints"] = max(0, out.get("level", 1) - 1)
    if v < 3:
        out["visited"] = {}
    out["version"] = SAVE_VERSION
    return out


def default_save_dir():
    env = os.environ.get("ANELZERO_SAVE_DIR")
    return pathlib.Path(env) if env else pathlib.Path.home() / ".anelzero" / "saves"


class SaveSlots:
    def __init__(self, directory=None):
        self.dir = pathlib.Path(directory) if directory else default_save_dir()
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, n):
        return self.dir / f"slot-{n}.json"

    def read(self, n):
        try:
            data = json.loads(self._path(n).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    def info(self, n):
        data = self.read(n)
        if data is None:
            return None
        return {"zone": data.get("zone", C.START_ZONE), "level": data.get("level", 1),
                "gold": data.get("gold", 0), "savedAt": data.get("savedAt")}

    def load(self, n):
        data = self.read(n)
        return GameState(migrate(data)) if data is not None else None

    def save(self, n, state):
        state.savedAt = datetime.datetime.now().isoformat(timespec="seconds")
        self._path(n).write_text(json.dumps(state.d, ensure_ascii=False, indent=2), encoding="utf-8")
        return True

    def delete(self, n):
        try:
            self._path(n).unlink()
        except FileNotFoundError:
            pass

    def migrate_legacy(self, legacy_path):
        """Copia um save antigo (formato único) para o slot 1, se ele estiver vazio."""
        if self._path(1).exists():
            return False
        legacy = pathlib.Path(legacy_path)
        try:
            data = json.loads(legacy.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        if not isinstance(data, dict):
            return False
        self._path(1).write_text(json.dumps(migrate(data), ensure_ascii=False, indent=2), encoding="utf-8")
        return True


def new_state():
    return GameState()


def clone(state):
    return GameState(copy.deepcopy(state.d))

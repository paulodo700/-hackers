"""Dados do jogo, carregados dos JSON exportados da versão JavaScript (tools/export_data.mjs)."""

import json
import pathlib

_DATA = pathlib.Path(__file__).resolve().parent / "data"


def _load(name):
    return json.loads((_DATA / name).read_text(encoding="utf-8"))


_content = _load("content.json")
_loot = _load("loot.json")
_zones = _load("zones.json")

RARITY = _content["RARITY"]
ITEMS = _content["ITEMS"]
ENEMIES = _content["ENEMIES"]
SKILLS = _content["SKILLS"]
SKILL_TREE = _content["SKILL_TREE"]
RECIPES = _content["RECIPES"]
SHOP = _content["SHOP"]
QUESTS = _content["QUESTS"]
QUEST_ORDER = _content["QUEST_ORDER"]
NPCS = _content["NPCS"]
CODEX = _content["CODEX"]
INTRO_TEXT = _content["INTRO_TEXT"]
VIGIA_CHOICE = _content["VIGIA_CHOICE"]
VIGIA_CHOICES = _content["VIGIA_CHOICES"]
ENDINGS = _content["ENDINGS"]
ENDING_RESUME = _content["ENDING_RESUME"]

CHEST_LOOT = _loot["CHEST_LOOT"]
ZONE_LOOT = _loot["ZONE_LOOT"]

ZONES = _zones["ZONES"]
START_ZONE = _zones["START_ZONE"]

# Zonas construídas a partir das camadas do processador (mesma grade da tela de camadas)
from . import layers as _layers  # noqa: E402
LAYER_ZONE_IDS = {}
for _lid in ("llc",):
    _entry = _layers.zone_entry(_lid, ZONES["cache"])
    ZONES[_entry["id"]] = _entry
    LAYER_ZONE_IDS[_lid] = _entry["id"]


def ending_lines(kind, flags):
    """Texto do final conforme a missão extra do Núcleo foi cumprida (port de endingLines)."""
    base = list(ENDINGS[kind])
    selo = bool(flags.get("sq_nucleo_done"))
    if kind == "paz" and selo:
        base.insert(len(base) - 1, {"s": "Vigia", "t": "Os selos que você trouxe são as minhas próprias chaves. Eu guardo uma cópia sua no anel."})
    if kind == "paz" and not selo:
        base.insert(len(base) - 1, {"s": "Vigia", "t": "Você voltou sem ouvir a minha voz. A paz existe, mas ainda está incompleta."})
    if kind == "guerra" and selo:
        base.insert(1, {"s": "Bit", "t": "O selo dizia que você queria ser ouvido. Eu vou lembrar disso."})
    if kind == "guerra" and not selo:
        base.insert(1, {"s": "Narrador", "t": "Sem ouvir o Vigia, o novo núcleo nasce surdo. Nenhum selo ecoa nas trilhas."})
    return base

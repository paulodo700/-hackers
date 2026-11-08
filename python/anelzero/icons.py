"""Ícones 3D dos itens, inimigos e habilidades: especificação, paleta por zona e caminhos do cache.

Os ícones são modelos 3D renderizados offscreen pelo Panda3D (ver icon_render.py) e salvos como PNG em
~/.anelzero/cache/icons/<zona>/<tipo>_<id>.png. Esta parte não depende de janela, então é testável.
"""

import pathlib

from . import content as C
from . import settings as T

KINDS = ("item", "enemy", "skill", "talent")
NEUTRAL_ZONE = "neutra"
ICON_SIZE = 160
ICON_VERSION = 2  # sobe quando os modelos mudam (invalida o cache antigo)
SHAPE_BY_SLOT = {"weapon": "blade", "armor": "plate", "consumable": "capsule", "key": "chip", "material": "cluster"}


# Cor e forma de cada habilidade: a forma traduz o papel (golpe, golpe forte, cura, golpe que ignora defesa)
SKILL_STYLE = {
    "golpe": ("#7dfff0", "diamond"),
    "rajada": ("#ffd166", "cone"),
    "reparo": ("#b6ff6a", "cross"),
    "curto": ("#ff6b8a", "spike"),
}


# Cor e forma de cada talento da árvore (aba Habilidades do menu)
TALENT_STYLE = {
    "vigor": ("#ff6b8a", "cube"),
    "fonte": ("#ffd166", "prism"),
    "lamina": ("#7dfff0", "spike"),
    "couraca": ("#9ab8ff", "plate"),
    "eficiencia": ("#b6ff6a", "ring"),
}


def talent_style(talent_id):
    if talent_id not in TALENT_STYLE:
        raise KeyError(talent_id)
    return TALENT_STYLE[talent_id]


def skill_style(skill_id):
    if skill_id not in SKILL_STYLE:
        raise KeyError(skill_id)
    return SKILL_STYLE[skill_id]


def cache_root():
    return T.home_dir() / "cache" / "icons"


def icon_file(kind, ident, zone_id=None, root=None):
    if kind not in KINDS:
        raise ValueError(f"tipo de ícone desconhecido: {kind}")
    base = pathlib.Path(root) if root else cache_root()
    zone = zone_id if zone_id in C.ZONES else NEUTRAL_ZONE
    return base / zone / f"{kind}_{ident}_v{ICON_VERSION}.png"


def item_shape(item_id):
    it = C.ITEMS.get(item_id)
    if it is None:
        raise KeyError(item_id)
    return SHAPE_BY_SLOT.get(it["slot"], "cluster")


def item_color(item_id):
    return C.ITEMS[item_id]["color"]


def enemy_color(enemy_id):
    return C.ENEMIES[enemy_id]["color"]


def enemy_is_boss(enemy_id):
    return bool(C.ENEMIES[enemy_id].get("boss"))


def mix_hex(a, b, t):
    """Mistura duas cores #rrggbb (t = 0 usa a, t = 1 usa b)."""
    a, b = a.lstrip("#"), b.lstrip("#")
    out = []
    for i in (0, 2, 4):
        va, vb = int(a[i:i + 2], 16), int(b[i:i + 2], 16)
        out.append(round(va * (1 - t) + vb * t))
    return "#%02x%02x%02x" % tuple(out)


def zone_palette(zone_id):
    """Paleta de um ícone: a cor da zona tinge o modelo e forma o fundo."""
    th = C.ZONES.get(zone_id, {}).get("theme", {})
    accent = th.get("accent", "#ffffff")
    fog = th.get("fog", "#0a0f12")
    return {"accent": accent, "background": mix_hex(fog, "#000000", 0.2), "rim": mix_hex(accent, "#ffffff", 0.3)}


def tinted(color, zone_id, k=0.22):
    """Cor do modelo, puxada para a cor de destaque da zona."""
    accent = zone_palette(zone_id)["accent"]
    return mix_hex(color, accent, k if zone_id in C.ZONES else 0.0)


def all_icon_specs():
    """Lista (tipo, id) de todos os ícones do jogo: itens, inimigos e habilidades."""
    out = [("item", i) for i in C.ITEMS]
    out += [("enemy", e) for e in C.ENEMIES]
    out += [("skill", s["id"]) for s in C.SKILLS]
    out += [("talent", t["id"]) for t in C.SKILL_TREE]
    return out

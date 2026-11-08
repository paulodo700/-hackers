"""Modelos 3D próprios de cada item e de cada inimigo, feitos com formas procedurais (sem arquivos de terceiros).

Cada item tem uma construção própria (lâmina com canal e guarda, escudo com rebites, cápsula com tampas,
placa de circuito com trilhas e chip, e assim por diante). Cada inimigo tem uma silhueta própria.
Os modelos ficam centrados na origem, com altura de cerca de 1 unidade, e são usados pelo mundo e pelos ícones.
"""

import math
import random

from panda3d.core import NodePath

from . import content as C
from . import scene as SC

DARK = 0.45
LIGHT = 0.35


def _shade(rgb, k):
    return tuple(max(0.0, min(1.0, v * k)) for v in rgb)


def _palette(color_hex):
    base = SC.hex_rgba(color_hex)
    rgb = base[:3]
    return {
        "base": base,
        "dark": _shade(rgb, 0.55) + (1.0,),
        "light": SC.mix(rgb, (1, 1, 1), LIGHT) + (1.0,),
        "steel": (0.72, 0.76, 0.80, 1.0),
        "steel_dark": (0.36, 0.40, 0.44, 1.0),
        "eye": (0.04, 0.05, 0.07, 1.0),
        "glow": SC.mix(rgb, (1, 1, 1), 0.6) + (1.0,),
    }


# ---- Itens ----

def _fio_cobre(m, p):
    # bobina: tubo em hélice (esferas encadeadas) em torno de um núcleo de ferrite
    m.cone(0, 0, 0.0, 0.95, 0.1, 0.1, p["dark"], sides=10)
    turns, steps = 4.5, 60
    for k in range(steps + 1):
        t = k / steps
        a = 2 * math.pi * turns * t
        r = 0.27 + 0.03 * math.sin(a * 3)
        m.sphere(math.cos(a) * r, math.sin(a) * r, 0.1 + t * 0.75, 0.05, p["base"] if k % 2 else p["light"],
                 rings=3, sides=6)
    m.cone(0, 0, 0.9, 0.98, 0.14, 0.14, p["steel"], sides=10)  # terminal

def _cristal_silicio(m, p):
    m.cone(0, 0, 0.0, 0.55, 0.32, 0.32, p["base"], sides=6)
    m.cone(0, 0, 0.55, 1.05, 0.32, 0.02, p["light"], sides=6)
    m.cone(0, 0, -0.1, 0.0, 0.2, 0.32, p["dark"], sides=6)


def _liga_ferrugem(m, p):
    # lingote com chanfros e marcas de fundição
    m.cone(0, 0, 0.0, 0.42, 0.46, 0.36, p["base"], sides=4)
    m.cone(0, 0, 0.42, 0.5, 0.36, 0.3, p["light"], sides=4)
    m.cone(0, 0, 0.5, 0.56, 0.3, 0.22, p["light"], sides=4)  # chanfro superior
    for i, dx in enumerate((-0.2, 0.0, 0.2)):  # marcas de fundição
        m.box(dx - 0.03, -0.37, 0.12, dx + 0.03, -0.39, 0.3 + i * 0.02, p["dark"])
    for dx in (-0.16, 0.16):
        m.sphere(dx, 0.0, 0.58, 0.05, p["steel"], rings=3, sides=6)

def _escudo_reforcado(m, p):
    m.cone(0, 0, 0.0, 0.14, 0.5, 0.5, p["base"], sides=16)
    m.cone(0, 0, 0.14, 0.2, 0.42, 0.42, p["dark"], sides=16)
    m.sphere(0, 0, 0.22, 0.14, p["steel"], rings=4, sides=8)
    for i in range(10):
        a = 2 * math.pi * i / 10
        m.sphere(math.cos(a) * 0.38, math.sin(a) * 0.38, 0.16, 0.035, p["steel_dark"], rings=2, sides=5)


def _lamina_fusivel(m, p):
    m.box(-0.07, -0.02, 0.22, 0.07, 0.02, 1.25, p["steel"])  # lâmina
    m.box(-0.015, -0.03, 0.3, 0.015, 0.03, 1.1, p["dark"])   # canal de fusível
    m.box(-0.35, -0.04, 0.16, 0.35, 0.04, 0.24, p["base"])   # guarda
    m.cone(0, 0, 0.0, 0.2, 0.04, 0.04, p["steel_dark"], sides=8)  # cabo
    m.sphere(0, 0, -0.02, 0.07, p["base"], rings=3, sides=6)  # pomo


def _lamina_solda(m, p):
    m.box(-0.12, -0.02, 0.2, 0.12, 0.02, 1.2, p["steel"])
    for i in range(7):  # serrilha da borda
        z = 0.3 + i * 0.12
        m.cone(0.12, 0, z, z + 0.06, 0.06, 0.0, p["light"], sides=3)
    m.box(-0.3, -0.04, 0.14, 0.3, 0.04, 0.22, p["base"])
    m.cone(0, 0, 0.0, 0.16, 0.05, 0.05, p["steel_dark"], sides=8)


def _pinca_ressonante(m, p):
    # duas mandíbulas curvas que se fecham sobre um pivô comum
    for side in (-1, 1):
        for k in range(6):  # mandíbula em arco, feita de segmentos
            t = k / 5
            a = side * (0.5 - 0.5 * t)
            m.sphere(math.sin(a) * 0.12 * side + side * 0.06, 0.0, 0.25 + t * 0.85,
                     0.055 - 0.01 * t, p["steel"] if side > 0 else p["steel_dark"], rings=3, sides=6)
        m.sphere(side * 0.14, 0.0, 1.12, 0.05, p["light"], rings=3, sides=6)  # ponta
    m.cone(0, 0, 0.14, 0.36, 0.1, 0.1, p["base"], sides=12)  # pivô
    m.sphere(0, 0, 0.25, 0.1, p["glow"], rings=3, sides=8)
    m.box(-0.02, -0.02, 0.0, 0.02, 0.02, 0.14, p["dark"])  # haste de apoio

def _lamina_ferrugem(m, p):
    m.box(-0.07, -0.02, 0.2, 0.07, 0.02, 1.15, p["base"])
    for i in range(6):  # pontas irregulares na borda
        z = 0.35 + i * 0.13
        m.cone(0.07 if i % 2 == 0 else -0.07, 0, z, z + 0.1, 0.07, 0.0,
               p["light"] if i % 2 else p["dark"], sides=3)
    m.box(-0.28, -0.04, 0.14, 0.28, 0.04, 0.22, p["dark"])
    m.cone(0, 0, 0.0, 0.18, 0.05, 0.05, p["steel_dark"], sides=8)


def _escudo_dissipador(m, p):
    m.cone(0, 0, 0.0, 0.12, 0.48, 0.48, p["base"], sides=12)
    for i in range(8):  # aletas radiais
        a = 2 * math.pi * i / 8
        m.box(math.cos(a) * 0.3 - 0.03, math.sin(a) * 0.3 - 0.03, 0.12,
              math.cos(a) * 0.5 + 0.03, math.sin(a) * 0.5 + 0.03, 0.42, p["light"])
    m.sphere(0, 0, 0.14, 0.13, p["steel"], rings=4, sides=8)


def _dissipador_omega(m, p):
    # pilha de discos (aletas) com núcleo central
    for i in range(7):
        r = 0.46 - abs(i - 3) * 0.04
        m.cone(0, 0, i * 0.13, i * 0.13 + 0.07, r, r, p["base"] if i % 2 else p["light"], sides=14)
    m.cone(0, 0, -0.02, 0.98, 0.1, 0.1, p["steel"], sides=10)
    m.sphere(0, 0, 0.98, 0.1, p["glow"], rings=3, sides=6)


def _pasta_termica(m, p):
    m.cone(0, 0, 0.0, 0.75, 0.18, 0.18, p["base"], sides=12)
    m.cone(0, 0, 0.75, 0.82, 0.18, 0.1, p["steel"], sides=12)
    m.cone(0, 0, 0.82, 1.0, 0.1, 0.03, p["steel_dark"], sides=10)
    m.box(-0.19, -0.19, 0.12, 0.19, 0.19, 0.22, p["light"])  # faixa do rótulo


def _capsula_energia(m, p):
    m.cone(0, 0, 0.25, 0.75, 0.2, 0.2, p["base"], sides=14)
    m.sphere(0, 0, 0.25, 0.2, p["base"], rings=4, sides=10)
    m.sphere(0, 0, 0.75, 0.2, p["light"], rings=4, sides=10)
    m.cone(0, 0, 0.42, 0.58, 0.205, 0.205, p["glow"], sides=14)  # faixa de energia


def _kit_solda(m, p):
    m.box(-0.42, -0.26, 0.0, 0.42, 0.26, 0.42, p["base"])
    m.box(-0.42, -0.26, 0.38, 0.42, 0.26, 0.42, p["dark"])  # tampa
    m.box(-0.2, -0.26, 0.5, 0.2, 0.26, 0.56, p["steel"])    # alça
    m.box(-0.06, -0.27, 0.2, 0.06, -0.3, 0.3, p["steel"])   # trava
    m.sphere(0.3, 0.2, 0.45, 0.04, p["glow"], rings=2, sides=5)


def _capacitor_filtro(m, p):
    m.cone(0, 0, 0.0, 0.9, 0.22, 0.22, p["dark"], sides=14)
    m.cone(0, 0, 0.9, 0.96, 0.22, 0.2, p["steel"], sides=14)
    m.box(-0.22, -0.05, 0.1, 0.22, 0.05, 0.75, p["base"])  # faixa colorida
    m.sphere(0, 0, 0.98, 0.08, p["steel_dark"], rings=3, sides=6)


def _chave_forja(m, p):
    m.box(-0.05, -0.02, 0.0, 0.05, 0.02, 1.0, p["steel"])  # haste
    m.cone(0, 0, 0.9, 1.1, 0.24, 0.24, p["base"], sides=12)  # cabeça (anel)
    m.cone(0, 0, 0.92, 1.08, 0.12, 0.12, p["dark"], sides=12)  # furo
    for i, z in enumerate((0.1, 0.22, 0.34)):  # dentes
        m.box(0.05, -0.02, z, 0.2 - i * 0.03, 0.02, z + 0.05, p["steel"])


def _fragmento_memoria(m, p):
    m.cone(0, 0, 0.5, 1.1, 0.42, 0.0, p["base"], sides=4, caps=False)
    m.cone(0, 0, -0.1, 0.5, 0.0, 0.42, p["dark"], sides=4, caps=False)
    m.sphere(0, 0, 0.5, 0.1, p["glow"], rings=3, sides=6)


def _selo_vigia(m, p):
    m.cone(0, 0, 0.0, 0.14, 0.46, 0.46, p["base"], sides=14)
    m.cone(0, 0, 0.14, 0.18, 0.36, 0.36, p["dark"], sides=14)
    m.sphere(0, 0, 0.2, 0.2, p["glow"], rings=4, sides=8)
    m.sphere(0, 0, 0.36, 0.08, p["eye"], rings=2, sides=5)


def _trilha_mestra(m, p):
    m.box(-0.5, -0.4, 0.0, 0.5, 0.4, 0.07, p["dark"])  # placa
    for i in range(6):  # trilhas
        m.box(-0.45, -0.37 + i * 0.12, 0.07, 0.45, -0.33 + i * 0.12, 0.09, p["light"])
    m.box(-0.14, -0.14, 0.07, 0.14, 0.14, 0.2, p["steel"])  # chip
    for i in range(4):  # pinos do chip
        m.box(-0.2 + i * 0.13, 0.14, 0.07, -0.17 + i * 0.13, 0.18, 0.12, p["steel_dark"])


def _material_default(m, p):
    m.box(-0.3, -0.3, 0.0, 0.3, 0.3, 0.5, p["base"])


ITEM_BUILDERS = {
    "fio_cobre": _fio_cobre,
    "cristal_silicio": _cristal_silicio,
    "liga_ferrugem": _liga_ferrugem,
    "escudo_reforcado": _escudo_reforcado,
    "lamina_fusivel": _lamina_fusivel,
    "pasta_termica": _pasta_termica,
    "capsula_energia": _capsula_energia,
    "kit_solda": _kit_solda,
    "capacitor_filtro": _capacitor_filtro,
    "lamina_solda": _lamina_solda,
    "pinca_ressonante": _pinca_ressonante,
    "lamina_ferrugem": _lamina_ferrugem,
    "escudo_dissipador": _escudo_dissipador,
    "dissipador_omega": _dissipador_omega,
    "chave_forja": _chave_forja,
    "fragmento_memoria": _fragmento_memoria,
    "selo_vigia": _selo_vigia,
    "trilha_mestra": _trilha_mestra,
}


def item_node(item_id, color_hex=None):
    """Modelo 3D próprio do item (centrado na origem)."""
    if item_id not in C.ITEMS:
        raise KeyError(item_id)
    p = _palette(color_hex or C.ITEMS[item_id]["color"])
    m = SC.Mesh()
    ITEM_BUILDERS.get(item_id, _material_default)(m, p)
    return m.node(f"item-{item_id}")


# ---- Inimigos ----

def _pulga(m, p):
    m.sphere(0, 0, 0.42, 0.26, p["base"], rings=5, sides=8)
    m.sphere(0, 0.18, 0.5, 0.14, p["light"], rings=4, sides=8)  # cabeça
    for dx in (-0.12, 0.12):
        m.sphere(dx, 0.26, 0.56, 0.05, p["eye"], rings=2, sides=5)
    for side in (-1, 1):
        for k in range(3):  # patas
            m.cone(side * 0.18, -0.08 + k * 0.1, 0.0, 0.4 - k * 0.05, 0.02, 0.025, p["dark"], sides=4)
    m.cone(0, -0.22, 0.4, 0.8, 0.05, 0.0, p["dark"], sides=4)  # cauda pontuda


def _ruido(m, p):
    rng = random.Random(7)
    for _ in range(9):
        m.sphere(rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0.5 + rng.uniform(-0.25, 0.25),
                 rng.uniform(0.09, 0.16), p["base"] if rng.random() < 0.6 else p["light"], rings=3, sides=6)
    for i in range(8):
        a = 2 * math.pi * i / 8
        m.cone(math.cos(a) * 0.2, math.sin(a) * 0.2, 0.5, 0.5 + math.cos(a * 2) * 0.1 + 0.2,
               0.03, 0.0, p["glow"], sides=3)  # estática


def _bloco(m, p):
    m.box(-0.36, -0.36, 0.0, 0.36, 0.36, 0.72, p["base"])
    m.box(0.1, -0.36, 0.0, 0.36, -0.37, 0.72, p["dark"])  # rachadura frontal
    m.box(-0.36, -0.1, 0.36, -0.37, 0.1, 0.72, p["dark"])
    m.box(0.28, 0.36, 0.72, 0.46, 0.46, 0.84, p["light"])  # pedaço solto
    m.sphere(-0.12, -0.37, 0.42, 0.05, p["eye"], rings=2, sides=5)
    m.sphere(0.12, -0.37, 0.42, 0.05, p["eye"], rings=2, sides=5)


def _verme(m, p):
    for i in range(6):  # segmentos que sobem em curva
        t = i / 5
        r = 0.2 - 0.02 * i
        m.sphere(math.sin(t * 2.2) * 0.2, 0.0, 0.2 + t * 0.7, r, p["base"] if i % 2 else p["dark"],
                 rings=4, sides=8)
    m.sphere(math.sin(2.2) * 0.2, 0.05, 0.98, 0.2, p["light"], rings=4, sides=8)  # cabeça
    m.sphere(math.sin(2.2) * 0.2 - 0.08, 0.2, 1.02, 0.05, p["eye"], rings=2, sides=5)
    m.sphere(math.sin(2.2) * 0.2 + 0.08, 0.2, 1.02, 0.05, p["eye"], rings=2, sides=5)


def _espectro(m, p):
    m.sphere(0, 0, 0.7, 0.26, p["base"], rings=5, sides=10)
    for i, (r, z) in enumerate(((0.22, 0.45), (0.16, 0.25), (0.1, 0.1))):  # cauda que afina
        m.cone(0, 0, z - 0.2, z, r, r * 0.8, p["dark"] if i % 2 else p["base"], sides=10)
    m.sphere(-0.1, 0.22, 0.74, 0.05, p["glow"], rings=2, sides=5)  # olhos brilhantes
    m.sphere(0.1, 0.22, 0.74, 0.05, p["glow"], rings=2, sides=5)


def _larva(m, p):
    for i in range(4):  # segmentos gordos em fila
        m.sphere(-0.36 + i * 0.24, 0, 0.26, 0.24 - abs(i - 1.5) * 0.02, p["base"] if i % 2 else p["light"],
                 rings=5, sides=9)
    m.sphere(0.56, 0, 0.3, 0.18, p["light"], rings=4, sides=8)  # cabeça
    m.sphere(0.62, 0.1, 0.36, 0.04, p["eye"], rings=2, sides=5)
    m.sphere(0.62, -0.1, 0.36, 0.04, p["eye"], rings=2, sides=5)


def _sentinela(m, p):
    m.cone(0, 0, 0.0, 0.12, 0.42, 0.36, p["dark"], sides=8)  # base larga
    m.cone(0, 0, 0.12, 1.0, 0.26, 0.2, p["base"], sides=8)  # torre
    m.cone(0, 0, 1.0, 1.1, 0.2, 0.2, p["light"], sides=8)
    m.sphere(0, 0, 1.2, 0.2, p["steel"], rings=4, sides=8)  # olho
    m.sphere(0, 0.16, 1.22, 0.08, p["glow"], rings=3, sides=6)
    for i in range(4):  # antenas
        a = i * math.pi / 2
        m.cone(math.cos(a) * 0.22, math.sin(a) * 0.22, 1.1, 1.36, 0.02, 0.0, p["steel"], sides=3)


def _sobrecarga(m, p):
    m.sphere(0, 0, 0.6, 0.42, p["base"], rings=8, sides=12)  # núcleo
    m.sphere(0, 0, 0.6, 0.26, p["glow"], rings=6, sides=10)
    for i in range(8):  # espinhos
        a = 2 * math.pi * i / 8
        m.cone(math.cos(a) * 0.4, math.sin(a) * 0.4, 0.6, 0.6, 0.1, 0.0, p["dark"], sides=4, caps=False)
    m.cone(0, 0, 0.0, 0.2, 0.16, 0.22, p["steel_dark"], sides=10)  # base


def _ferrugem_titan(m, p):
    m.box(-0.45, -0.3, 0.45, 0.45, 0.3, 1.2, p["base"])  # tronco
    m.box(-0.3, -0.28, 1.2, 0.3, 0.28, 1.45, p["dark"])  # cabeça
    m.box(-0.22, -0.3, 1.3, 0.22, -0.32, 1.38, p["glow"])  # visor
    for side in (-1, 1):
        m.cone(side * 0.62, 0.0, 0.45, 1.05, 0.14, 0.1, p["light"], sides=8)  # braços
        m.sphere(side * 0.62, 0.0, 0.5, 0.18, p["steel_dark"], rings=3, sides=8)
        m.box(side * 0.5 - 0.1, -0.3, 0.0, side * 0.5 + 0.1, 0.3, 0.45, p["steel"])  # pernas
    for i in range(5):  # placas de ferrugem
        m.box(-0.45 + i * 0.22, -0.31, 0.6 + (i % 2) * 0.2, -0.36 + i * 0.22, -0.34, 0.75 + (i % 2) * 0.2,
              p["dark"])


def _vigia_enemy(m, p):
    # o chefe Vigia usa o mesmo modelo da abertura
    pass


ENEMY_BUILDERS = {
    "pulga": _pulga,
    "ruido": _ruido,
    "bloco": _bloco,
    "verme": _verme,
    "espectro": _espectro,
    "larva": _larva,
    "sentinela": _sentinela,
    "sobrecarga": _sobrecarga,
    "ferrugem_titan": _ferrugem_titan,
}


def enemy_node(enemy_id, color_hex=None, scale=1.0):
    """Modelo 3D próprio do inimigo (centrado na origem, altura de cerca de 1 unidade × escala)."""
    if enemy_id not in C.ENEMIES:
        raise KeyError(enemy_id)
    if enemy_id == "vigia":
        root = NodePath(f"enemy-{enemy_id}")
        SC.vigia_mesh().reparentTo(root)
        root.setScale(scale)
        return root
    p = _palette(color_hex or C.ENEMIES[enemy_id]["color"])
    m = SC.Mesh()
    ENEMY_BUILDERS[enemy_id](m, p)
    root = NodePath(f"enemy-{enemy_id}")
    m.node(f"enemy-body-{enemy_id}").reparentTo(root)
    root.setScale(scale)
    return root


# ---- Ativos de cenário (originais, desenhados em código) ----

def _moinho(m, p):
    """Moinho de torre: torre cônica com janela, cúpula e quatro pás treliçadas (em nó separado)."""
    m.cone(0, 0, 0.0, 1.1, 0.42, 0.26, p["base"], sides=10)
    m.cone(0, 0, 1.1, 1.3, 0.3, 0.1, p["dark"], sides=10)  # cúpula
    m.box(-0.07, -0.3, 0.45, 0.07, -0.26, 0.7, p["eye"])   # porta
    m.box(-0.05, -0.27, 0.8, 0.05, -0.21, 0.95, p["glow"])  # janela iluminada


def _zepelim(m, p):
    """Zepelim: envelope alongado com barbatanas na cauda e gôndola sob o casco."""
    m.sphere(0, 0, 1.2, 0.5, p["base"], rings=8, sides=14)
    for k in range(3):  # barbatanas da cauda
        a = k * 2.094
        m.box(-0.1, -0.05, 1.2, -0.05, 0.02, 1.2, p["dark"])
        m.cone(-0.42, 0.0, 1.2, 1.2, 0.02, 0.22 + 0.0 * a, p["dark"], sides=3, caps=False)
    m.box(-0.14, -0.08, 0.66, 0.14, 0.08, 0.86, p["dark"])  # gôndola
    m.box(-0.1, -0.1, 0.86, 0.1, 0.1, 0.9, p["light"])     # cabine iluminada


def _entulho(m, p):
    """Entulho: pilha de blocos irregulares e fragmentos soltos ao redor."""
    rng = random.Random(42)
    for _ in range(9):
        x, y = rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)
        s = rng.uniform(0.07, 0.17)
        m.box(x - s, y - s, 0.0, x + s, y + s, s * 1.4 + rng.uniform(0, 0.06),
              p["base"] if rng.random() < 0.6 else p["dark"])
    for _ in range(4):
        m.sphere(rng.uniform(-0.45, 0.45), rng.uniform(-0.45, 0.45), 0.03, 0.04, p["light"], rings=2, sides=5)


def _figura(m, p):
    """Figura humana simples: cabeça, tronco, braços e pernas."""
    m.sphere(0, 0, 0.92, 0.1, p["light"], rings=4, sides=8)            # cabeça
    m.box(-0.13, -0.07, 0.5, 0.13, 0.07, 0.82, p["base"])              # tronco
    m.box(-0.2, -0.05, 0.52, -0.13, 0.05, 0.8, p["dark"])              # braço esq.
    m.box(0.13, -0.05, 0.52, 0.2, 0.05, 0.8, p["dark"])                # braço dir.
    m.box(-0.11, -0.06, 0.0, -0.02, 0.06, 0.5, p["eye"])               # perna esq.
    m.box(0.02, -0.06, 0.0, 0.11, 0.06, 0.5, p["eye"])                 # perna dir.


PROP_BUILDERS = {"moinho": _moinho, "zepelim": _zepelim, "entulho": _entulho, "figura": _figura}


def prop_node(model, color_hex=None):
    """Adereço decorativo do cenário (centrado no chão, na origem)."""
    if model not in PROP_BUILDERS:
        raise KeyError(model)
    color = color_hex or {"moinho": "#c9d6c0", "zepelim": "#b99a6a", "entulho": "#8a8f88",
                          "figura": "#d8d2c0"}[model]
    p = _palette(color)
    m = SC.Mesh()
    PROP_BUILDERS[model](m, p)
    return m.node(f"prop-{model}")

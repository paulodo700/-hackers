"""Construção visual com Panda3D: malhas, céu em gradiente, sombras de contato, entidades, partículas e minimapa.

Cada zona vira uma única malha (piso e paredes expostas), para manter poucas chamadas de desenho.
Sombras são manchas escuras sob cada objeto (sombra de contato), não mapas de sombra em tempo real.
"""

import math
import random

from panda3d.core import (
    CardMaker, Geom, GeomNode, GeomTriangles, GeomVertexData, GeomVertexFormat, GeomVertexWriter,
    NodePath, PNMImage, Texture, TransparencyAttrib,
)

from . import world as W


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _noise(c, r, salt=0):
    """Ruído determinístico por célula (textura procedural estável entre execuções)."""
    x = (c * 374761393 + r * 668265263 + salt * 2246822519) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFF) / 65535.0


class Mesh:
    """Acumula quadriláteros e gera um único GeomNode."""

    def __init__(self):
        self.verts, self.normals, self.colors, self.tris = [], [], [], []

    def quad(self, pts, normal, col):
        a, b, c = pts[0], pts[1], pts[2]
        e1 = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        e2 = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        cr = _cross(e1, e2)
        if cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2] < 0:
            pts = [pts[0], pts[3], pts[2], pts[1]]
        base = len(self.verts)
        for p in pts:
            self.verts.append(p)
            self.normals.append(normal)
            self.colors.append(col)
        self.tris.append((base, base + 1, base + 2))
        self.tris.append((base, base + 2, base + 3))

    def box(self, x0, y0, z0, x1, y1, z1, col):
        self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1), col)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1), col)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0), col)
        self.quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0), col)
        self.quad([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0), col)
        self.quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0), col)

    def disc(self, cx, cy, z, r, col, segments=14):
        """Disco plano (usado nas sombras): centro transparente só na borda."""
        edge = (col[0], col[1], col[2], 0.0)
        base = len(self.verts)
        self.verts.append((cx, cy, z))
        self.normals.append((0, 0, 1))
        self.colors.append(col)
        for i in range(segments):
            a = 2 * math.pi * i / segments
            self.verts.append((cx + math.cos(a) * r, cy + math.sin(a) * r, z))
            self.normals.append((0, 0, 1))
            self.colors.append(edge)
        for i in range(segments):
            self.tris.append((base, base + 1 + i, base + 1 + (i + 1) % segments))

    def node(self, name):
        fmt = GeomVertexFormat.getV3n3c4()
        vd = GeomVertexData(name, fmt, Geom.UHStatic)
        vd.setNumRows(len(self.verts))
        vw = GeomVertexWriter(vd, "vertex")
        nw = GeomVertexWriter(vd, "normal")
        cw = GeomVertexWriter(vd, "color")
        for p, n, c in zip(self.verts, self.normals, self.colors):
            vw.addData3(*p)
            nw.addData3(*n)
            cw.addData4(*c)
        prim = GeomTriangles(Geom.UHStatic)
        for a, b, c in self.tris:
            prim.addVertices(a, b, c)
        geom = Geom(vd)
        geom.addPrimitive(prim)
        gn = GeomNode(name)
        gn.addGeom(geom)
        np = NodePath(gn)
        np.setTransparency(TransparencyAttrib.MAlpha)
        return np


def build_zone_mesh(zone):
    """Piso texturizado, trilhas luminosas e paredes com faces expostas. Uma malha só."""
    th = zone.theme
    ground = hex_rgba(th.get("ground", "#222222"))
    trace = hex_rgba(th.get("trace", "#66aaff"))
    accent = hex_rgba(th.get("accent", "#ffffff"))
    wall_base = mix(ground[:3], (0, 0, 0), 0.25) + (1.0,)
    mesh = Mesh()
    for r in range(zone.height):
        for c in range(zone.width):
            if zone.walkable(c, r):
                k = 0.86 + 0.2 * _noise(c, r, 1)
                col = tuple(v * k for v in ground[:3]) + (1.0,)
                mesh.quad([(c - .5, r - .5, 0), (c + .5, r - .5, 0), (c + .5, r + .5, 0), (c - .5, r + .5, 0)],
                          (0, 0, 1), col)
    # Trilhas de circuito: faixa luminosa no piso, com brilho pulsante no centro
    for c, r in zone.cells_of("="):
        mesh.quad([(c - .5, r - .5, .01), (c + .5, r - .5, .01), (c + .5, r + .5, .01), (c - .5, r + .5, .01)],
                  (0, 0, 1), mix(ground[:3], trace[:3], 0.55) + (1.0,))
        mesh.quad([(c - .15, r - .15, .02), (c + .15, r - .15, .02), (c + .15, r + .15, .02), (c - .15, r + .15, .02)],
                  (0, 0, 1), accent)
    # Poças: pequenos discos brilhantes
    for c, r in zone.cells_of("~"):
        mesh.disc(c, r, 0.015, 0.45, trace)
    h = 1.0
    for r in range(zone.height):
        for c in range(zone.width):
            if zone.walkable(c, r) or zone.char(c, r) != W.WALL:
                continue
            k = 0.8 + 0.4 * _noise(c, r, 2)
            top = tuple(v * k for v in wall_base[:3]) + (1.0,)
            mesh.quad([(c - .5, r - .5, h), (c + .5, r - .5, h), (c + .5, r + .5, h), (c - .5, r + .5, h)],
                      (0, 0, 1), top)
            # Circuito gravado no topo da parede (linha de traço)
            if _noise(c, r, 3) < 0.35:
                mesh.quad([(c - .4, r - .03, h + .01), (c + .4, r - .03, h + .01), (c + .4, r + .03, h + .01),
                           (c - .4, r + .03, h + .01)], (0, 0, 1), mix(top[:3], trace[:3], 0.6) + (1.0,))
            side = tuple(v * 0.7 for v in top[:3]) + (1.0,)
            if zone.walkable(c, r - 1):
                mesh.quad([(c - .5, r - .5, 0), (c + .5, r - .5, 0), (c + .5, r - .5, h), (c - .5, r - .5, h)],
                          (0, -1, 0), side)
            if zone.walkable(c, r + 1):
                mesh.quad([(c - .5, r + .5, 0), (c + .5, r + .5, 0), (c + .5, r + .5, h), (c - .5, r + .5, h)],
                          (0, 1, 0), side)
            if zone.walkable(c - 1, r):
                mesh.quad([(c - .5, r - .5, 0), (c - .5, r + .5, 0), (c - .5, r + .5, h), (c - .5, r - .5, h)],
                          (-1, 0, 0), side)
            if zone.walkable(c + 1, r):
                mesh.quad([(c + .5, r - .5, 0), (c + .5, r + .5, 0), (c + .5, r + .5, h), (c + .5, r - .5, h)],
                          (1, 0, 0), side)
    return mesh.node(f"zone-{zone.id}")


def sky_backdrop(top_hex, bottom_hex):
    """Céu em gradiente: um plano grande preso à câmera, desenhado antes do resto.
    As bordas de baixo usam a cor do horizonte e as de cima a cor do zênite; a GPU interpola."""
    # Zênite escuro e horizonte claro: o degradê precisa de contraste para aparecer na tela
    top = mix(hex_rgba(top_hex)[:3], (0, 0, 0), 0.8) + (1.0,)
    bottom = mix(hex_rgba(bottom_hex)[:3], (0.6, 0.95, 1.0), 0.35) + (1.0,)
    mesh = Mesh()
    pts = [(-80, 60, -40), (80, 60, -40), (80, 60, 60), (-80, 60, 60)]
    cols = [bottom, bottom, top, top]
    base = len(mesh.verts)
    for p, c in zip(pts, cols):
        mesh.verts.append(p)
        mesh.normals.append((0, -1, 0))
        mesh.colors.append(c)
    mesh.tris += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    np = mesh.node("sky")
    np.setBin("background", 0)
    np.setDepthWrite(False)
    np.setDepthTest(False)
    np.setLightOff()
    return np


def blob_shadow(parent, radius, x=0.0, y=0.0):
    """Mancha de sombra embaixo de uma entidade."""
    mesh = Mesh()
    mesh.disc(0, 0, 0.02, radius, (0.0, 0.0, 0.0, 0.45))
    np = mesh.node("shadow")
    np.reparentTo(parent)
    np.setPos(x, y, 0)
    np.setLightOff()
    return np


def roamer_mesh(color_hex, scale):
    """Inimigo simples: bloco colorido com dois olhos."""
    c = hex_rgba(color_hex)
    dark = mix(c[:3], (0, 0, 0), 0.4) + (1.0,)
    s = 0.32 * scale
    mesh = Mesh()
    mesh.box(-s, -s, 0, s, s, 2 * s, c)
    mesh.box(-s * .5, -s - .01, s * 1.2, -s * .1, -s - .02, s * 1.45, (0.05, 0.05, 0.08, 1))
    mesh.box(s * .1, -s - .01, s * 1.2, s * .5, -s - .02, s * 1.45, (0.05, 0.05, 0.08, 1))
    return mesh.node("roamer"), dark


def hp_bar(parent, height, ratio):
    """Barra de vida acima do inimigo (vermelha de fundo, verde por cima)."""
    bg = Mesh()
    bg.box(-.4, -.02, height, .4, .02, height + .08, (0.25, 0.05, 0.05, 1))
    back = bg.node("hpbg")
    back.reparentTo(parent)
    fg = Mesh()
    w = max(0.0, min(1.0, ratio)) * 0.8
    fg.box(-.4, -.03, height, -.4 + w, .03, height + .09, (0.4, 1.0, 0.4, 1))
    front = fg.node("hpfg")
    front.reparentTo(parent)
    return front


def npc_mesh(color_hex):
    c = hex_rgba(color_hex)
    mesh = Mesh()
    mesh.box(-.2, -.2, 0, .2, .2, .75, mix(c[:3], (0, 0, 0), 0.2) + (1.0,))
    mesh.box(-.13, -.21, .6, .13, -.22, .72, (0.08, 0.1, 0.12, 1))
    mesh.box(-.1, -.2, .8, .1, .2, 1.0, c)  # cabeça
    return mesh.node("npc")


def chest_mesh(glow_hex, opened=False):
    c = hex_rgba(glow_hex)
    mesh = Mesh()
    body = (0.35, 0.22, 0.12, 1.0) if not opened else (0.2, 0.14, 0.08, 1.0)
    mesh.box(-.24, -.18, 0, .24, .18, .3, body)
    if not opened:
        mesh.box(-.05, -.19, .14, .05, -.2, .24, c)
    return mesh.node("chest")


def repair_mesh(color_hex):
    c = hex_rgba(color_hex)
    mesh = Mesh()
    for i in range(4):
        a = i * math.pi / 2
        mesh.box(math.cos(a) * .3 - .07, math.sin(a) * .3 - .07, 0, math.cos(a) * .3 + .07, math.sin(a) * .3 + .07, .5, c)
    return mesh.node("repair")


def vigia_mesh():
    """O Vigia: figura alta encapuzada, com anel de luz em volta."""
    mesh = Mesh()
    mesh.box(-.35, -.35, 0, .35, .35, 1.6, (0.46, 0.52, 0.64, 1))
    mesh.box(-.22, -.36, 1.3, .22, -.37, 1.55, (0.05, 0.06, 0.09, 1))
    mesh.box(-.2, -.2, 1.6, .2, .2, 2.0, (0.46, 0.52, 0.64, 1))
    for i in range(8):
        a = 2 * math.pi * i / 8
        x, y = math.cos(a) * 0.9, math.sin(a) * 0.9
        mesh.box(x - .07, y - .07, 0.1, x + .07, y + .07, 0.4, (0.4, 1.0, 0.95, 1))
    return mesh.node("vigia")


def burst(parent, pos, color_hex, count=14, rng=None):
    """Partículas em explosão: pequenos cubos que se espalham. Devolve a lista de (np, vel, vida)."""
    rng = rng or random
    c = hex_rgba(color_hex)
    out = []
    for _ in range(count):
        m = Mesh()
        s = rng.uniform(0.04, 0.09)
        m.box(-s, -s, -s, s, s, s, c)
        np = m.node("particle")
        np.reparentTo(parent)
        np.setPos(*pos)
        vel = (rng.uniform(-2, 2), rng.uniform(-2, 2), rng.uniform(1.5, 4))
        out.append((np, vel, rng.uniform(0.4, 0.8)))
    return out


def minimap_image(rows, size=6):
    """Textura do minimapa a partir das linhas de world.minimap_grid."""
    colors = {"#": (0.25, 0.4, 0.5), ".": (0.1, 0.2, 0.14), "?": (0.04, 0.05, 0.06), " ": (0.02, 0.03, 0.04),
              "@": (0.4, 1.0, 1.0), "*": (1.0, 0.85, 0.25), "C": (0.8, 0.5, 0.2), "N": (0.5, 1.0, 0.6),
              "R": (1.0, 0.4, 0.8), "P": (0.7, 0.6, 1.0), "B": (1.0, 0.2, 0.2), "K": (1.0, 0.8, 0.5)}
    h = len(rows)
    w = len(rows[0]) if rows else 1
    img = PNMImage(w * size, h * size, 4)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            r, g, b = colors.get(ch, (0.1, 0.2, 0.14))
            for dy in range(size):
                for dx in range(size):
                    img.setXel(x * size + dx, y * size + dy, r, g, b)
                    img.setAlpha(x * size + dx, y * size + dy, 0.9)
    tex = Texture("minimap")
    tex.load(img)
    tex.setMagfilter(Texture.FTNearest)
    tex.setMinfilter(Texture.FTNearest)
    return tex


def fullscreen_card(color, alpha):
    """Painel escuro translúcido para caixas de diálogo e menus."""
    cm = CardMaker("panel")
    cm.setFrame(-1.0, 1.0, -1.0, 1.0)
    np = NodePath(cm.generate())
    np.setColor(color[0], color[1], color[2], alpha)
    np.setTransparency(TransparencyAttrib.MAlpha)
    return np

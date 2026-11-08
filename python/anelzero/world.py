"""Modelo de mundo (port da lógica de grade de src/world.js): zonas, marcadores, portais e alcance.

A grade é uma lista de linhas de texto. '#' é parede e qualquer outro caractere é caminhável.
Marcadores (pickups, baús, NPCs, reparos, portais) ficam em células e não bloqueiam o caminho.
"""

from collections import deque

from . import content as C

WALL = "#"
SPAWN = "S"


class Zone:
    def __init__(self, zid, data=None):
        data = data or C.ZONES[zid]
        self.id = zid
        self.name = data.get("name", zid)
        self.rows = list(data["map"])
        self.height = len(self.rows)
        self.width = max((len(r) for r in self.rows), default=0)
        self.markers_def = data.get("markers", {})
        self.enemies = list(data.get("enemies", []))
        self.encounter = data.get("encounter", 0.0)
        self.theme = data.get("theme", {})
        self.music = data.get("music")
        self.decor = data.get("decor")

    # ---- Consultas de célula ----
    def inside(self, c, r):
        return 0 <= r < self.height and 0 <= c < len(self.rows[r])

    def char(self, c, r):
        return self.rows[r][c] if self.inside(c, r) else WALL

    def walkable(self, c, r):
        return self.inside(c, r) and self.rows[r][c] != WALL

    def cells_of(self, ch):
        out = []
        for r, row in enumerate(self.rows):
            for c, cell in enumerate(row):
                if cell == ch:
                    out.append((c, r))
        return out

    def marker_at(self, c, r):
        """Definição do marcador em (c, r), ou None."""
        return self.markers_def.get(self.char(c, r))

    def pickups(self):
        return [(c, r, self.markers_def[self.char(c, r)])
                for r in range(self.height) for c in range(len(self.rows[r]))
                if self.markers_def.get(self.char(c, r), {}).get("type") == "pickup"]

    def portals(self):
        return [(c, r, self.markers_def[ch]) for ch in self.markers_def
                if self.markers_def[ch].get("type") == "portal"
                for c, r in self.cells_of(ch)]

    def spawn(self):
        cells = self.cells_of(SPAWN)
        if cells:
            return cells[0]
        return next(((c, r) for r in range(self.height) for c in range(len(self.rows[r]))
                     if self.walkable(c, r)), (1, 1))

    def arrival_from(self, from_zone_id):
        """Ponto de chegada ao vir de outra zona: o portal de volta, senão o ponto inicial."""
        for c, r, m in self.portals():
            if m.get("to") == from_zone_id:
                for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    if self.walkable(c + dc, r + dr) and self.char(c + dc, r + dr) not in (SPAWN,):
                        return (c + dc, r + dr)
                return (c, r)
        return self.spawn()

    # ---- Alcance ----
    def reachable(self, start):
        """Células caminháveis alcançáveis a partir de start (quatro direções)."""
        if not self.walkable(*start):
            return set()
        seen = {start}
        queue = deque([start])
        while queue:
            c, r = queue.popleft()
            for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c + dc, r + dr)
                if n not in seen and self.walkable(*n):
                    seen.add(n)
                    queue.append(n)
        return seen

    def can_walk(self, a, b):
        return b in self.reachable(a)


def load(zid):
    return Zone(zid)


def all_zone_ids():
    return list(C.ZONES.keys())


# ---- Movimento contínuo com colisão (células são quadrados centrados em inteiros) ----

import math as _math


def blocked(zone, x, z, rad=0.3):
    """True se um círculo de raio rad em (x, z) toca alguma parede."""
    c0 = _math.floor(x - rad + 0.5)
    c1 = _math.floor(x + rad + 0.5)
    r0 = _math.floor(z - rad + 0.5)
    r1 = _math.floor(z + rad + 0.5)
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            if zone.char(c, r) != WALL:
                continue
            # Interseção entre o círculo e o quadrado da parede [c-0.5, c+0.5] x [r-0.5, r+0.5]
            nx = min(max(x, c - 0.5), c + 0.5)
            nz = min(max(z, r - 0.5), r + 0.5)
            if (x - nx) ** 2 + (z - nz) ** 2 < rad * rad:
                return True
    return False


def move(zone, x, z, dx, dz, rad=0.3):
    """Desloca eixo a eixo (desliza ao longo das paredes). Devolve a nova posição."""
    if not blocked(zone, x + dx, z, rad):
        x += dx
    if not blocked(zone, x, z + dz, rad):
        z += dz
    return x, z


# ---- Minimapa e revelação de áreas (para o cliente desenhar) ----

def reveal(zone, state, cx, cz, radius=4):
    """Marca as células em volta de (cx, cz) como visitadas no estado do jogo."""
    c0, r0 = round(cx), round(cz)
    for r in range(r0 - radius, r0 + radius + 1):
        for c in range(c0 - radius, c0 + radius + 1):
            if zone.inside(c, r) and (c - cx) ** 2 + (r - cz) ** 2 <= radius * radius:
                state.mark_visited(zone.id, c, r)


def minimap_grid(zone, state, cx, cz, radius=12):
    """Linhas de caracteres centradas no jogador: '#' parede, '.' piso, '?' não visitado,
    '@' jogador, letras para marcadores (pickups '*', baús 'C', NPCs 'N', reparos 'R', portais 'P')."""
    kinds = {"pickup": "*", "chest": "C", "npc": "N", "repair": "R", "portal": "P", "boss": "B", "bench": "K"}
    c0, r0 = round(cx), round(cz)
    rows = []
    for r in range(r0 - radius, r0 + radius + 1):
        line = []
        for c in range(c0 - radius, c0 + radius + 1):
            if not zone.inside(c, r):
                line.append(" ")
            elif (c, r) == (c0, r0):
                line.append("@")
            elif not state.is_visited(zone.id, c, r):
                line.append("?")
            else:
                m = zone.marker_at(c, r)
                if m and m.get("type") in kinds:
                    line.append(kinds[m["type"]])
                else:
                    line.append(zone.char(c, r) if zone.char(c, r) == WALL else ".")
        rows.append("".join(line))
    return rows

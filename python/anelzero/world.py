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

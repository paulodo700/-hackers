"""Gerador determinístico de mapas extensos (port de src/mapgen.js).

Mesma semente = mesmo mapa. A sequência de sorteios e a ordem das chaves seguem o JavaScript
exatamente, e um teste compara os mapas gerados com os da versão JavaScript, caractere por caractere.
"""

import math

_M32 = 0xFFFFFFFF


def _imul(a, b):
    return ((a & _M32) * (b & _M32)) & _M32


class Mulberry32:
    """Gerador pseudoaleatório igual ao mulberry32 do JavaScript (valores em [0, 1))."""

    def __init__(self, seed):
        self.a = seed & _M32

    def __call__(self):
        self.a = (self.a + 0x6D2B79F5) & _M32
        t = self.a
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ (t + _imul(t ^ (t >> 7), t | 61))) & _M32
        return ((t ^ (t >> 14)) & _M32) / 4294967296


def _js_round(x):
    return math.floor(x + 0.5)


def generate_map(seed, cols, rows, markers=None, extras=None):
    """Gera as linhas do mapa. markers: {char: def}; extras: {char: quantidade} (padrão 1)."""
    markers = markers or {}
    extras = extras or {}
    rnd = Mulberry32(seed)
    grid = [["#"] * cols for _ in range(rows)]

    def get(c, r):
        return grid[r][c] if 0 <= c < cols and 0 <= r < rows else "#"

    def set_(c, r, ch):
        grid[r][c] = ch

    # ---- Salas ----
    rooms = []
    target = max(6, _js_round((cols * rows) / 120))
    attempt = 0
    while attempt < 6000 and len(rooms) < target:
        attempt += 1
        w = 6 + int(rnd() * 7)
        h = 5 + int(rnd() * 5)
        x = 1 + int(rnd() * (cols - w - 2))
        y = 1 + int(rnd() * (rows - h - 2))
        overlaps = any(
            x < o["x"] + o["w"] + 2 and x + w + 2 > o["x"] and y < o["y"] + o["h"] + 2 and y + h + 2 > o["y"]
            for o in rooms
        )
        if overlaps:
            continue
        rooms.append({"x": x, "y": y, "w": w, "h": h})
    rooms.sort(key=lambda room: room["x"])  # sort do Python é estável, como o do JavaScript
    for room in rooms:
        for r in range(room["y"], room["y"] + room["h"]):
            for c in range(room["x"], room["x"] + room["w"]):
                set_(c, r, ".")

    # ---- Corredores ----
    def center(room):
        return (math.floor(room["x"] + room["w"] / 2), math.floor(room["y"] + room["h"] / 2))

    def corridor(a, b):
        ax, ay = center(a)
        bx, by = center(b)
        for c in range(min(ax, bx), max(ax, bx) + 1):
            if get(c, ay) == "#":
                set_(c, ay, ".")
        for r in range(min(ay, by), max(ay, by) + 1):
            if get(bx, r) == "#":
                set_(bx, r, ".")

    for i in range(len(rooms) - 1):
        corridor(rooms[i], rooms[i + 1])
    for i in range(len(rooms)):
        if rnd() < 0.25:
            j = int(rnd() * len(rooms))
            if j != i:
                corridor(rooms[i], rooms[j])

    # ---- Trilhas e poças ----
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "." and rnd() < 0.12:
                set_(c, r, "=")
    for idx, room in enumerate(rooms):
        if idx == 0 or rnd() > 0.3:
            continue
        px = room["x"] + 2 + int(rnd() * max(1, room["w"] - 5))
        py = room["y"] + 2 + int(rnd() * max(1, room["h"] - 5))
        for dr in range(2):
            for dc in range(2):
                if get(px + dc, py + dr) in (".", "="):
                    set_(px + dc, py + dr, "~")

    # ---- Objetos ----
    def interior(room):
        out = []
        for r in range(room["y"] + 1, room["y"] + room["h"] - 1):
            for c in range(room["x"] + 1, room["x"] + room["w"] - 1):
                if grid[r][c] in (".", "="):
                    out.append((c, r))
        return out

    first = rooms[0]
    last = rooms[-1]
    taken = set()

    def near_taken(c, r, d=2):
        return any((c + dc, r + dr) in taken for dr in range(-d, d + 1) for dc in range(-d, d + 1))

    def place(ch, c, r):
        set_(c, r, ch)
        taken.add((c, r))

    spawn_cells = interior(first)
    sc, sr = spawn_cells[len(spawn_cells) // 2] if spawn_cells else center(first)
    place("S", sc, sr)
    if "B" in markers:
        b = next(((c, r) for c, r in interior(first) if abs(c - sc) + abs(r - sr) >= 3 and not near_taken(c, r, 1)), None)
        if b:
            place("B", b[0], b[1])
    if "A" in markers:
        cand = [(c, r) for c, r in interior(last) if not near_taken(c, r, 2)]
        a = cand[len(cand) // 2] if cand else center(last)
        place("A", a[0], a[1])

    others = [ch for ch in markers if ch not in ("A", "B", "S")
              and markers[ch].get("type") not in ("portal", "spawn")]
    pool = rooms[1:]
    for ch in others:
        count = extras.get(ch, 1)
        for _ in range(count):
            placed = False
            tries = 0
            while tries < 400 and not placed:
                tries += 1
                room = pool[int(rnd() * len(pool))]
                cells = interior(room)
                if not cells:
                    continue
                c, r = cells[int(rnd() * len(cells))]
                d = 1 if markers[ch].get("type") == "pickup" else 2
                if near_taken(c, r, d):
                    continue
                place(ch, c, r)
                placed = True

    # ---- Pilares soltos ----
    for room in rooms[1:]:
        for r in range(room["y"] + 2, room["y"] + room["h"] - 2):
            for c in range(room["x"] + 2, room["x"] + room["w"] - 2):
                if grid[r][c] != "." or near_taken(c, r, 2) or rnd() > 0.06:
                    continue
                adjacent_pillar = any(
                    get(c + dc, r + dr) == "#" for dr in (-1, 0, 1) for dc in (-1, 0, 1)
                )
                if not adjacent_pillar:
                    set_(c, r, "#")

    return ["".join(row) for row in grid]

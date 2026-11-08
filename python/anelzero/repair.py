"""Minijogo de reparo (port das regras de src/repair.js, sem interface).

Gire os segmentos até ligar a fonte (0,0) ao destino (n-1, n-1).
Máscaras de conexão: N=1, E=2, S=4, O=8. Girar troca a máscara em 90 graus.
  - reto, curva, T e ponta giram normalmente;
  - cruzamento liga as quatro direções e não gira;
  - fusível gira, mas queima ao ser energizado e trava para sempre.
Pontuação: menos giros e menos tempo rendem mais pontos; o tempo restante conta se houver limite.
"""

N, E, S, W = 1, 2, 4, 8
CROSS = N | E | S | W
DIRS = [(0, -1, N, S), (1, 0, E, W), (0, 1, S, N), (-1, 0, W, E)]
ROTATE = "rotate"
CROSSING = "crossing"
LOCKED = "locked"


def rot_mask(m, r):
    out = m
    for _ in range(r):
        out = ((out << 1) | (out >> 3)) & 15
    return out


def type_of(mask):
    if mask == CROSS:
        return "cruzamento"
    bits = sum(1 for b in (N, E, S, W) if mask & b)
    if bits == 1:
        return "ponta"
    if bits == 3:
        return "T"
    if mask in (N | S, E | W):
        return "reto"
    return "curva"


def random_path(n, rng):
    """Caminho auto-evitante de (0,0) até (n-1, n-1), guiado para o destino com ruído controlado."""
    target = (n - 1, n - 1)
    for _ in range(300):
        path = [(0, 0)]
        seen = {(0, 0)}
        x, y = 0, 0
        ok = False
        for _step in range(n * n * 2):
            if (x, y) == target:
                ok = True
                break
            opts = [(x + dx, y + dy) for dx, dy, _b, _o in DIRS
                    if 0 <= x + dx < n and 0 <= y + dy < n and (x + dx, y + dy) not in seen]
            if not opts:
                break
            opts.sort(key=lambda p: abs(p[0] - target[0]) + abs(p[1] - target[1]) + (rng() - 0.5) * 2.5)
            nx, ny = opts[0]
            seen.add((nx, ny))
            path.append((nx, ny))
            x, y = nx, ny
        if ok:
            return path
    # Caminho de reserva: primeira linha e última coluna
    return [(i, 0) for i in range(n)] + [(n - 1, j) for j in range(1, n)]


class Cell:
    __slots__ = ("type", "base", "rot", "locked")

    def __init__(self):
        self.type = "vazio"
        self.base = 0
        self.rot = 0
        self.locked = False


def build_puzzle(n, rng, fuses):
    cells = [[Cell() for _ in range(n)] for _ in range(n)]
    path = random_path(n, rng)
    for i, (x, y) in enumerate(path):
        m = 0
        if i > 0:
            px, py = path[i - 1]
            for dx, dy, bit, opp in DIRS:
                if x - px == dx and y - py == dy:
                    m |= opp
        if i < len(path) - 1:
            nx, ny = path[i + 1]
            for dx, dy, bit, opp in DIRS:
                if nx - x == dx and ny - y == dy:
                    m |= bit
        cells[y][x].base = m
        cells[y][x].type = type_of(m)
    straights = [(x, y) for x, y in path[1:-1] if cells[y][x].type == "reto"]
    for _ in range(fuses):
        if not straights:
            break
        x, y = straights.pop(int(rng() * len(straights)))
        cells[y][x].type = "fusivel"
    for y in range(n):
        for x in range(n):
            c = cells[y][x]
            if c.type != "vazio" or c.base:
                continue
            r = rng()
            if r < 0.2:
                c.base, c.type = CROSS, "cruzamento"
            elif r < 0.5:
                c.base, c.type = E | W, "reto"
            elif r < 0.8:
                c.base, c.type = N | E | S, "T"
    for y in range(n):
        for x in range(n):
            if cells[y][x].type != "cruzamento":
                cells[y][x].rot = int(rng() * 4)
    p = Puzzle(n, cells)
    if p.solved():
        c = cells[0][0]
        if c.type != "cruzamento":
            c.rot = (c.rot + 1) % 4
    return p


class Puzzle:
    def __init__(self, n, cells):
        self.n = n
        self.cells = cells

    def mask(self, x, y):
        c = self.cells[y][x]
        return rot_mask(c.base, c.rot)

    def powered(self):
        """Células energizadas a partir da fonte."""
        on = {(0, 0)}
        queue = [(0, 0)]
        while queue:
            x, y = queue.pop(0)
            m = self.mask(x, y)
            for dx, dy, bit, opp in DIRS:
                if not (m & bit):
                    continue
                nx, ny = x + dx, y + dy
                if not (0 <= nx < self.n and 0 <= ny < self.n):
                    continue
                if not (self.mask(nx, ny) & opp):
                    continue
                if (nx, ny) not in on:
                    on.add((nx, ny))
                    queue.append((nx, ny))
        return on

    def lock_fuses(self, on):
        burned = 0
        for x, y in on:
            c = self.cells[y][x]
            if c.type == "fusivel" and not c.locked:
                c.locked = True
                burned += 1
        return burned

    def solved(self):
        return (self.n - 1, self.n - 1) in self.powered()


def score(moves, elapsed, time_limit=0):
    s = max(0, 1000 - moves * 15 - round(elapsed * 3))
    if time_limit:
        s += round(max(0.0, time_limit - elapsed) * 5)
    return round(s)


class RepairGame:
    """Uma partida de reparo. O tempo decorrido é passado de fora (quadro a quadro), o que facilita pausa e testes."""

    def __init__(self, size=4, fuses=1, time_limit=0, hard=False, rng=None, zone_key="geral"):
        self.base_size = size
        self.base_fuses = fuses
        self.time_limit = time_limit
        self.zone_key = zone_key
        self.hard = bool(hard)
        self.rng = rng or (lambda: 0.5)
        self.moves = 0
        self.elapsed = 0.0
        self.paused = False
        self.done = False
        self.success = False
        self.timed_out = False
        self.feedback = ""
        self.cursor = [0, 0]
        self.puzzle = self._new_puzzle()

    def _new_puzzle(self):
        size = min(7, self.base_size + 1) if self.hard else self.base_size
        fuses = self.base_fuses + 1 if self.hard else self.base_fuses
        return build_puzzle(size, self.rng, fuses)

    def record_key(self):
        return f"{self.zone_key}-hard" if self.hard else self.zone_key

    def toggle_hard(self):
        if self.done:
            return False
        self.hard = not self.hard
        self.puzzle = self._new_puzzle()
        self.moves = 0
        self.elapsed = 0.0
        self.cursor = [0, 0]
        self.feedback = "Modo difícil: quebra-cabeça novo." if self.hard else "Modo normal: quebra-cabeça novo."
        return True

    def toggle_pause(self):
        if self.done or not self.time_limit:
            return False
        self.paused = not self.paused
        self.feedback = "PAUSADO. Pressione P para continuar." if self.paused else "Reparo retomado."
        return True

    def tick(self, dt):
        """Avança o cronômetro (não avança com pausa). Marca o tempo esgotado."""
        if self.done or self.paused or not self.time_limit:
            return
        self.elapsed += dt
        if self.elapsed >= self.time_limit:
            self.elapsed = self.time_limit
            self.done = True
            self.timed_out = True
            self.feedback = "Tempo esgotado."

    def time_left(self):
        if not self.time_limit:
            return None
        return max(0.0, self.time_limit - self.elapsed)

    def score_now(self):
        return score(self.moves, self.elapsed, self.time_limit)

    def move_cursor(self, dx, dy):
        n = self.puzzle.n
        self.cursor[0] = max(0, min(n - 1, self.cursor[0] + dx))
        self.cursor[1] = max(0, min(n - 1, self.cursor[1] + dy))

    def rotate(self, x, y):
        """Clique ou Enter numa célula. Devolve ROTATE, CROSSING, LOCKED ou None (sem efeito)."""
        if self.done or self.paused:
            return None
        if not (0 <= x < self.puzzle.n and 0 <= y < self.puzzle.n):
            return None
        c = self.puzzle.cells[y][x]
        if c.type == "cruzamento":
            self.feedback = "Cruzamento: encaixe fixo, não gira."
            return CROSSING
        if c.locked:
            self.feedback = "Fusível queimado: não pode mais ser girado."
            return LOCKED
        c.rot = (c.rot + 1) % 4
        self.moves += 1
        burned = self.puzzle.lock_fuses(self.puzzle.powered())
        if burned:
            self.feedback = "Fusível queimado!"
        if self.puzzle.solved() and not self.done:
            self.done = True
            self.success = True
            self.feedback = "Circuito restaurado!"
        return ROTATE

    def rotate_cursor(self):
        return self.rotate(self.cursor[0], self.cursor[1])

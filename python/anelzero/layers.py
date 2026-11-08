"""Camadas do processador como mapas próprios do jogo (originais, sem marcas nem arte de terceiros).

Cada camada é uma grade de códigos gerada de forma determinística (mesma semente, mesmo mapa):
  H  dissipador (tampa metálica)      B  barramento / trilha de sinal   T  pino ou esfera de solda
  C  banco de cache                   L  bloco de lógica               E  unidade de execução
  M  controlador de memória           P  gerenciamento de energia      I  interposer / TSV
  G  vazio (substrato)                R  anel do barramento (ring bus)
"""

from . import mapgen as MG

SIZE = 32

LAYERS = [
    {"id": "dissipador", "name": "Camada 1 · Dissipador térmico", "seed": 101, "kind": "heat"},
    {"id": "metal_m1", "name": "Camada 2 · Metal superior M1 (fiação)", "seed": 102, "kind": "wiring"},
    {"id": "metal_m2", "name": "Camada 3 · Metal intermediário M2 (roteamento)", "seed": 103, "kind": "routing"},
    {"id": "llc", "name": "Camada 4 · Cache de último nível (LLC) e anel", "seed": 104, "kind": "cache"},
    {"id": "predicao", "name": "Camada 5 · Núcleo: predição de desvio", "seed": 105, "kind": "frontend"},
    {"id": "execucao", "name": "Camada 6 · Núcleo: unidades de execução", "seed": 106, "kind": "execution"},
    {"id": "memoria", "name": "Camada 7 · Controlador de memória e gráficos", "seed": 107, "kind": "memory"},
    {"id": "energia", "name": "Camada 8 · Gerenciamento de energia", "seed": 108, "kind": "power"},
    {"id": "interposer", "name": "Camada 9 · Interposer e TSVs", "seed": 109, "kind": "interposer"},
    {"id": "substrato", "name": "Camada 10 · Substrato e esferas BGA", "seed": 110, "kind": "substrate"},
]

PALETTE = {
    "H": (0.78, 0.55, 0.42), "B": (0.45, 0.85, 0.75), "T": (0.85, 0.85, 0.6),
    "C": (0.25, 0.4, 0.55), "L": (0.35, 0.6, 0.35), "E": (0.6, 0.45, 0.2),
    "M": (0.55, 0.3, 0.6), "P": (0.8, 0.35, 0.25), "I": (0.3, 0.3, 0.7),
    "G": (0.05, 0.12, 0.1), "R": (0.9, 0.7, 0.2),
}


def _blank(size):
    return [["G"] * size for _ in range(size)]


def _rect(g, x, y, w, h, code):
    for r in range(y, y + h):
        for c in range(x, x + w):
            if 0 <= r < len(g) and 0 <= c < len(g):
                g[r][c] = code


def _ring(g, margin, code):
    n = len(g)
    for i in range(margin, n - margin):
        g[margin][i] = g[n - 1 - margin][i] = code
        g[i][margin] = g[i][n - 1 - margin] = code


def _layer_grid(layer):
    """Gera a grade da camada a partir da semente e do tipo."""
    rnd = MG.Mulberry32(layer["seed"])
    g = _blank(SIZE)
    kind = layer["kind"]
    if kind == "heat":
        _rect(g, 2, 2, SIZE - 4, SIZE - 4, "H")
        _rect(g, 6, 6, SIZE - 12, SIZE - 12, "H")
    elif kind in ("wiring", "routing"):
        step = 3 if kind == "wiring" else 4
        for i in range(0, SIZE, step):
            for j in range(SIZE):
                if rnd() < 0.8:
                    g[i][j] = "B"
                if rnd() < 0.8:
                    g[j][i] = "B"
        for _ in range(10):
            x, y = int(rnd() * (SIZE - 6)), int(rnd() * (SIZE - 6))
            _rect(g, x, y, 5, 5, "L")
        for k in range(0, SIZE, 2):
            g[0][k] = g[SIZE - 1][k] = "T"
            g[k][0] = g[k][SIZE - 1] = "T"
    elif kind == "cache":
        _ring(g, 2, "R")
        for by in range(4):
            for bx in range(3):
                _rect(g, 4 + bx * 8, 4 + by * 7, 6, 5, "C")
    elif kind == "frontend":
        _rect(g, 3, 3, 10, 6, "L")
        _rect(g, 15, 3, 6, 6, "L")
        _rect(g, 4, 12, 9, 7, "M")
        _rect(g, 16, 12, 12, 8, "E")
        _rect(g, 4, 22, 12, 6, "C")
        _rect(g, 19, 23, 8, 5, "B")
    elif kind == "execution":
        for i in range(4):
            _rect(g, 3, 3 + i * 7, 10, 5, "E")
            _rect(g, 17, 3 + i * 7, 11, 5, "E")
        _rect(g, 13, 13, 4, 14, "L")
    elif kind == "memory":
        _rect(g, 2, 2, 12, 10, "M")
        _rect(g, 16, 2, 14, 10, "M")
        _rect(g, 2, 14, 28, 8, "L")
        _rect(g, 2, 24, 10, 6, "P")
        _rect(g, 14, 24, 16, 6, "P")
    elif kind == "power":
        for i in range(6):
            _rect(g, 3 + i * 4, 3, 3, 5, "P")
            _rect(g, 3 + i * 4, 24, 3, 5, "P")
        _rect(g, 6, 12, 20, 8, "L")
    elif kind == "interposer":
        for i in range(0, SIZE, 3):
            for j in range(0, SIZE, 3):
                g[i][j] = "I"
        _rect(g, 9, 9, 14, 14, "L")
    elif kind == "substrate":
        for i in range(2, SIZE - 2, 2):
            for j in range(2, SIZE - 2, 2):
                if i in (2, SIZE - 3) or j in (2, SIZE - 3):
                    g[i][j] = "T"
        _rect(g, 12, 12, 8, 8, "I")
    return ["".join(row) for row in g]


def layer_rows(layer_id):
    layer = next((l for l in LAYERS if l["id"] == layer_id), None)
    if layer is None:
        raise KeyError(layer_id)
    return _layer_grid(layer)


def render_png(path, cell=12):
    """Desenha todas as camadas numa folha (para conferir visualmente)."""
    from panda3d.core import Filename, PNMImage
    cols = 5
    rows_n = (len(LAYERS) + cols - 1) // cols
    W, H = cols * SIZE * cell, rows_n * SIZE * cell
    img = PNMImage(W, H, 3)
    img.fill(0.1, 0.1, 0.12)
    for idx, layer in enumerate(LAYERS):
        rows = _layer_grid(layer)
        ox, oy = (idx % cols) * SIZE * cell, (idx // cols) * SIZE * cell
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                r, g, b = PALETTE[ch]
                for dy in range(cell - 1):
                    for dx in range(cell - 1):
                        img.setXel(ox + x * cell + dx, oy + y * cell + dy, r, g, b)
    img.write(Filename.from_os_specific(str(path)))
    return path

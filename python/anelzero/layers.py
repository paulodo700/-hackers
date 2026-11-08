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
    "x": (0.18, 0.28, 0.36), "c": (0.1, 0.18, 0.3), "d": (0.12, 0.14, 0.16),
    "h": (0.95, 0.8, 0.62), "v": (0.95, 0.95, 0.95), "t": (0.95, 0.75, 0.3),
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


def _grid_fill(g, x, y, w, h, fn):
    """Preenche um retângulo célula a célula com fn(i, j) -> código."""
    for j in range(h):
        for i in range(w):
            r, c = y + j, x + i
            if 0 <= r < len(g) and 0 <= c < len(g):
                g[r][c] = fn(i, j)


def _pins(g, side, count, code="T"):
    n = len(g)
    for k in range(count):
        t = 2 + k * (n - 4) // max(1, count - 1)
        if side == "top":
            g[0][t] = code
        elif side == "bottom":
            g[n - 1][t] = code
        elif side == "left":
            g[t][0] = code
        else:
            g[t][n - 1] = code


def _sram(g, x, y, w, h):
    """Banco de memória: células de bit em grade, com linhas de palavra."""
    _grid_fill(g, x, y, w, h, lambda i, j: "c" if (i % 2 == 0 and j % 2 == 0) else "C")


def _alu(g, x, y, w, h):
    _grid_fill(g, x, y, w, h, lambda i, j: "E" if (i + j) % 3 else "d")


def _regfile(g, x, y, w, h):
    _grid_fill(g, x, y, w, h, lambda i, j: "c" if (i % 3 == 1 and j % 3 == 1) else "L")


def _layer_grid(layer):
    """Gera a grade da camada a partir da semente e do tipo (com subestruturas em cada bloco)."""
    rnd = MG.Mulberry32(layer["seed"])
    g = _blank(SIZE)
    kind = layer["kind"]
    if kind == "heat":
        _rect(g, 1, 1, SIZE - 2, SIZE - 2, "H")
        _ring(g, 3, "R")  # aro de fixação
        _rect(g, 6, 6, SIZE - 12, SIZE - 12, "h")  # tampa polida
        for k in range(0, SIZE - 12, 3):  # estrias de usinagem
            g[6 + k][7:SIZE - 7] = ["h"] * (SIZE - 14)
    elif kind in ("wiring", "routing"):
        step = 3 if kind == "wiring" else 4
        for i in range(0, SIZE, step):
            for j in range(SIZE):
                if rnd() < 0.85:
                    g[i][j] = "B"
                if rnd() < 0.85:
                    g[j][i] = "B"
        for _ in range(12):  # blocos de lógica com trilhas saindo
            x, y = int(rnd() * (SIZE - 7)), int(rnd() * (SIZE - 7))
            _grid_fill(g, x, y, 6, 6, lambda i, j: "d" if (i in (0, 5) or j in (0, 5)) else "L")
        for i in range(SIZE):  # vias nos cruzamentos
            for j in range(SIZE):
                if g[i][j] == "B" and rnd() < 0.12:
                    g[i][j] = "v"
        _pins(g, "top", 16)
        _pins(g, "bottom", 16)
        _pins(g, "left", 16)
        _pins(g, "right", 16)
    elif kind == "cache":
        _ring(g, 1, "R")
        for by in range(4):
            for bx in range(3):
                x, y = 3 + bx * 9, 3 + by * 7
                _grid_fill(g, x, y, 7, 5, lambda i, j: "d" if (i in (0, 6) or j in (0, 4)) else "x")
                _sram(g, x + 1, y + 1, 5, 3)
        for k in range(SIZE):  # barramento de anel por dentro da borda
            if g[2][k] == "G":
                g[2][k] = "B"
        _pins(g, "top", 12)
        _pins(g, "bottom", 12)
    elif kind == "frontend":
        _grid_fill(g, 2, 2, 13, 7, lambda i, j: "L" if (i + j) % 2 else "d")  # predição de desvio
        _grid_fill(g, 17, 2, 13, 7, lambda i, j: "L")  # decodificador
        _grid_fill(g, 2, 11, 10, 8, lambda i, j: "M" if (i % 3 and j % 2) else "d")  # TLB
        _regfile(g, 14, 11, 16, 8)
        _grid_fill(g, 2, 21, 28, 5, lambda i, j: "C" if (i % 4) else "c")  # cache de instruções
        _pins(g, "bottom", 12)
    elif kind == "execution":
        for i in range(4):
            _alu(g, 2, 2 + i * 7, 13, 5)
            _alu(g, 17, 2 + i * 7, 13, 5)
        _regfile(g, 14, 13, 4, 16)
        _pins(g, "left", 10)
        _pins(g, "right", 10)
    elif kind == "memory":
        _grid_fill(g, 2, 2, 12, 9, lambda i, j: "M" if (i % 3 and j % 2) else "d")  # controlador DRAM
        _grid_fill(g, 16, 2, 14, 9, lambda i, j: "E" if ((i * j) % 7) else "L")  # gráficos
        _grid_fill(g, 2, 13, 28, 7, lambda i, j: "L" if (i % 6) else "B")  # filas de dados
        _grid_fill(g, 2, 22, 10, 6, lambda i, j: "P" if (i + j) % 2 else "d")  # PHY
        _grid_fill(g, 14, 22, 16, 6, lambda i, j: "P" if (i % 4) else "d")  # regulador
        _pins(g, "bottom", 14)
    elif kind == "power":
        for i in range(6):
            _grid_fill(g, 2 + i * 5, 2, 3, 6, lambda a, b: "P" if (a + b) % 2 else "P")  # fase
            _grid_fill(g, 2 + i * 5, 23, 3, 6, lambda a, b: "P" if (a + b) % 2 else "P")
        _grid_fill(g, 6, 11, 20, 9, lambda i, j: "L" if (i + j) % 4 else "d")  # controle
        for k in range(SIZE):  # trilhas de alimentação
            if k % 4 == 0:
                g[15][k] = g[16][k] = "B" if g[15][k] == "G" else g[15][k]
        _pins(g, "top", 12)
    elif kind == "interposer":
        for i in range(0, SIZE, 3):
            for j in range(0, SIZE, 3):
                g[i][j] = "I"  # TSVs
        _grid_fill(g, 9, 9, 14, 14, lambda i, j: "d" if (i in (0, 13) or j in (0, 13)) else "L")
        _grid_fill(g, 12, 12, 8, 8, lambda i, j: "x")  # ponte de silício
        for k in range(SIZE):
            if g[15][k] == "G":
                g[15][k] = "B"
    elif kind == "substrate":
        for i in range(2, SIZE - 2, 2):
            for j in range(2, SIZE - 2, 2):
                if i in (2, SIZE - 3) or j in (2, SIZE - 3):
                    g[i][j] = "T"  # esferas da borda
                elif (i + j) % 8 == 0:
                    g[i][j] = "t"  # esferas internas de força
        _grid_fill(g, 12, 12, 8, 8, lambda i, j: "I")  # die montado sobre o substrato
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

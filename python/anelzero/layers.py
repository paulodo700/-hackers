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
    {"id": "dissipador", "name": "Camada 1 - Dissipador térmico", "seed": 101, "kind": "heat"},
    {"id": "metal_m1", "name": "Camada 2 - Metal superior M1 (fiação)", "seed": 102, "kind": "wiring"},
    {"id": "metal_m2", "name": "Camada 3 - Metal intermediário M2 (roteamento)", "seed": 103, "kind": "routing"},
    {"id": "llc", "name": "Camada 4 - Cache de último nível (LLC) e anel", "seed": 104, "kind": "cache"},
    {"id": "predicao", "name": "Camada 5 - Núcleo: predição de desvio", "seed": 105, "kind": "frontend"},
    {"id": "execucao", "name": "Camada 6 - Núcleo: unidades de execução", "seed": 106, "kind": "execution"},
    {"id": "memoria", "name": "Camada 7 - Controlador de memória e gráficos", "seed": 107, "kind": "memory"},
    {"id": "energia", "name": "Camada 8 - Gerenciamento de energia", "seed": 108, "kind": "power"},
    {"id": "interposer", "name": "Camada 9 - Interposer e TSVs", "seed": 109, "kind": "interposer"},
    {"id": "substrato", "name": "Camada 10 - Substrato e esferas BGA", "seed": 110, "kind": "substrate"},
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


CODE_NAMES = {
    "H": "dissipador (metal)", "h": "tampa polida", "R": "aro / anel do barramento",
    "B": "trilha de sinal", "v": "via entre camadas", "T": "pino ou esfera de solda",
    "t": "esfera de força", "C": "célula de cache", "c": "célula de bit", "x": "banco de cache",
    "L": "bloco de lógica", "d": "bloco escuro", "E": "unidade de execução", "M": "controlador de memória",
    "P": "gerenciamento de energia", "I": "TSV / ponte de silício", "G": "substrato vazio",
}


def legend():
    """Lista (código, nome) de todos os códigos usados nas camadas, na ordem da paleta."""
    used = set()
    for layer in LAYERS:
        for row in _layer_grid(layer):
            used |= set(row)
    return [(code, CODE_NAMES.get(code, code)) for code in PALETTE if code in used]


def layer_image(layer_id, cell=10):
    """Imagem (PNMImage) de uma camada, para a tela de camadas."""
    from panda3d.core import PNMImage
    layer = next((l for l in LAYERS if l["id"] == layer_id), None)
    if layer is None:
        raise KeyError(layer_id)
    rows = _layer_grid(layer)
    img = PNMImage(SIZE * cell, SIZE * cell, 3)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            r, g, b = PALETTE[ch]
            for dy in range(cell - 1):
                for dx in range(cell - 1):
                    img.setXel(x * cell + dx, y * cell + dy, r, g, b)
    return img



# ---- Zona jogável a partir de uma camada ----

WALL_CODES = {"x", "c", "C", "d", "R"}   # bancos de cache, bits e anel: bloqueiam
FLOOR_CODES = {"G", "B", "v"}            # substrato entre os blocos, trilhas e vias: andam


def _layer_zone_map(layer_id, wall_codes=None, floor_codes=None):
    """Mapa jogável: paredes '#', caminhos '.', trilhas '=' (cores da zona)."""
    walls = set(wall_codes) if wall_codes is not None else WALL_CODES
    floors = set(floor_codes) if floor_codes is not None else FLOOR_CODES
    rows = layer_rows(layer_id)
    out = []
    for row in rows:
        line = []
        for ch in row:
            if ch in walls:
                line.append("#")
            elif ch == "B":
                line.append("=")
            elif ch in floors:
                line.append(".")
            else:
                line.append("#")
        out.append("".join(line))
    return out


def _bfs(rows, start):
    seen = {start}
    queue = [start]
    while queue:
        c, r = queue.pop(0)
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in seen or not (0 <= n[1] < len(rows) and 0 <= n[0] < len(rows[0])):
                continue
            if rows[n[1]][n[0]] in ".=":
                seen.add(n)
                queue.append(n)
    return seen


def zone_entry(layer_id, base_zone, zone_id=None, name=None, wall_codes=None, floor_codes=None,
               theme=None, tall=False, props=None):
    """Entrada de zona (mesmo formato de zones.json) construída a partir de uma camada do processador.

    base_zone: zona de referência (tema, inimigos e música). Paredes, caminhos, spawn, itens e a
    passagem de volta ficam na grade da camada, então o mapa é o desenho da camada.
    """
    zone_id = zone_id or f"camada_{layer_id}"
    rows = _layer_zone_map(layer_id, wall_codes, floor_codes)
    h, w = len(rows), len(rows[0])
    # ponto inicial: caminho alcançável mais próximo do centro da parte de baixo
    floor = [(c, r) for r in range(h) for c in range(w) if rows[r][c] in ".="]
    target = (w // 2, h - 4)
    spawn = min(floor, key=lambda p: abs(p[0] - target[0]) + abs(p[1] - target[1]))
    reach = sorted(_bfs(rows, spawn), key=lambda p: abs(p[0] - spawn[0]) + abs(p[1] - spawn[1]))
    grid = [list(r) for r in rows]
    gc, gr = spawn
    grid[gr][gc] = "S"
    # passagem de volta para a zona de cache: caminho mais distante, que ainda está alcançável
    portal = reach[-1]
    grid[portal[1]][portal[0]] = "A"
    # itens espalhados pela área alcançável (espaçados por distância mínima)
    placed = []
    markers = {"S": {"type": "spawn"}, "A": {"type": "portal", "to": "cache"}}
    item_chars = [("k", "capacitor"), ("f", "fio_cobre"), ("l", "liga_ferrugem"), ("q", "cristal_silicio")]
    for k, (ch, item) in enumerate(item_chars):
        for c, r in reach[len(reach) // 4:]:
            if grid[r][c] != "." or any(abs(c - pc) + abs(r - pr) < 6 for pc, pr in placed):
                continue
            grid[r][c] = ch
            placed.append((c, r))
            markers[ch] = {"type": "pickup", "item": item}
            break
    # um baú extra num caminho alcançável
    for c, r in reach[len(reach) // 2:]:
        if grid[r][c] == ".":
            grid[r][c] = "x"
            markers["x"] = {"type": "chest", "extra": True}
            break
    # adereços: pontos alcançáveis espaçados, cada um com um modelo decorativo
    props_out = []
    if props:
        spots = [p for p in reach if p not in placed and grid[p[1]][p[0]] == "."]
        step = max(1, len(spots) // (len(props) + 1))
        for k, pr in enumerate(props):
            if k * step < len(spots):
                c, r = spots[k * step]
                props_out.append({"model": pr["model"], "c": c, "r": r, "rot": pr.get("rot", 0)})
    base = base_zone or {}
    return {
        "tall": tall,
        "props": props_out,
        "id": zone_id,
        "name": name or f"Camada: {next(l['name'] for l in LAYERS if l['id'] == layer_id)}",
        "music": base.get("music", "wind"),
        "encounter": base.get("encounter", 0.02),
        "theme": dict(theme or base.get("theme", {})),
        "enemies": list(base.get("enemies", [])),
        "decor": base.get("decor", "pins"),
        "markers": markers,
        "map": ["".join(r) for r in grid],
        "layer": layer_id,
    }

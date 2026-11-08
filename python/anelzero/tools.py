"""Ferramentas do personagem para melhorar o processador (lógica pura, sem janela).

Cada ferramenta é fabricada na bancada com materiais do jogo e usada no menu (aba Ferramentas).
Os reparos ficam gravados no save, por zona, e são reaplicados ao carregar a zona.
"""

TOOLS = {
    "reparo_cache": {
        "name": "Reparador de Cache",
        "cost": {"liga_ferrugem": 2, "fio_cobre": 1},
        "desc": "Restaura um bloco de cache danificado perto de você, abrindo passagem.",
        "reusable": True,
    },
    "reforco_nucleo": {
        "name": "Reforço de Núcleo",
        "cost": {"fio_cobre": 3, "liga_ferrugem": 1},
        "desc": "Reforça o núcleo do processador: +1 de ataque e +1 de defesa, uma vez.",
        "reusable": False,
    },
    "ajuste_energia": {
        "name": "Ajuste de Energia",
        "cost": {"cristal_silicio": 2, "fio_cobre": 1},
        "desc": "Calibra a fonte de energia: +5 de energia máxima, uma vez, e recarrega a energia.",
        "reusable": False,
    },
}
REPAIR_RADIUS = 3.0


def owned(state, tool_id):
    return bool(state.flags.get(f"tool_{tool_id}"))


def can_craft(state, tool_id):
    cost = TOOLS[tool_id]["cost"]
    return all(state.inv.get(item, 0) >= n for item, n in cost.items())


def craft(state, tool_id):
    """Fabrica a ferramenta (uma vez). Consome os materiais. Devolve True se fabricou."""
    if tool_id not in TOOLS or owned(state, tool_id) or not can_craft(state, tool_id):
        return False
    for item, n in TOOLS[tool_id]["cost"].items():
        state.remove_item(item, n)
    state.flags[f"tool_{tool_id}"] = True
    state.bump(f"crafted_{tool_id}", 1)
    return True


def repair_key(zone_id, c, r):
    return f"rep_{zone_id}_{c}_{r}"


def nearest_wall(zone, px, py, radius=REPAIR_RADIUS):
    """Célula de parede mais próxima do jogador, dentro do raio (ou None)."""
    best, best_d = None, radius
    for r in range(zone.height):
        for c in range(len(zone.rows[r])):
            if zone.rows[r][c] != "#":
                continue
            d = ((c - px) ** 2 + (r - py) ** 2) ** 0.5
            if d <= best_d:
                best, best_d = (c, r), d
    return best


def apply_repairs(zone, state):
    """Aplica ao mapa os reparos já feitos nesta zona (chamado ao carregar a zona)."""
    prefix = f"rep_{zone.id}_"
    for key, done in state.flags.items():
        if done and key.startswith(prefix):
            c, r = (int(v) for v in key[len(prefix):].split("_"))
            row = list(zone.rows[r])
            row[c] = "."
            zone.rows[r] = "".join(row)


def use(state, tool_id, zone=None, pos=None):
    """Usa uma ferramenta. Devolve (mensagem, zona_mudou)."""
    if tool_id not in TOOLS:
        return "Ferramenta desconhecida.", False
    if not owned(state, tool_id):
        return "Você ainda não fabricou esta ferramenta. Fabrique na bancada K.", False
    if tool_id == "reforco_nucleo":
        if state.flags.get("reforco_feito"):
            return "O núcleo já está reforçado.", False
        state.flags["reforco_feito"] = True
        state.baseAtk += 1
        state.baseDef += 1
        return "Núcleo reforçado: +1 de ataque e +1 de defesa.", False
    if tool_id == "ajuste_energia":
        if state.flags.get("energia_ajustada"):
            return "A fonte já foi ajustada.", False
        state.flags["energia_ajustada"] = True
        state.baseEn += 5
        state.en = state.max_en()
        return "Fonte ajustada: +5 de energia máxima.", False
    if tool_id == "reparo_cache":
        if zone is None or pos is None:
            return "Use o reparador dentro de uma zona da camada.", False
        if not zone.id.startswith("camada_"):
            return "Não há cache danificado para reparar aqui.", False
        cell = nearest_wall(zone, pos[0], pos[1])
        if cell is None:
            return "Nenhum bloco danificado por perto.", False
        c, r = cell
        state.flags[repair_key(zone.id, c, r)] = True
        state.bump("repairs_cache", 1)
        row = list(zone.rows[r])
        row[c] = "."
        zone.rows[r] = "".join(row)  # o mapa muda na hora; o save guarda o reparo
        return "Bloco de cache restaurado: caminho aberto.", True
    return "", False


def craft_label(tool_id):
    t = TOOLS[tool_id]
    cost = ", ".join(f"{n}x {i}" for i, n in t["cost"].items())
    return f"{t['name']} ({cost})"

"""Tamanho do texto ao vivo: todo texto de tela registra a escala base; aplicar() reescala todos de uma vez.

Assim, mudar o tamanho nos ajustes não exige reiniciar o jogo.
"""

_registry = []
_current = [1.0]


def current():
    return _current[0]


def register(node, raw_scale):
    """Registra um texto com sua escala base (sem o multiplicador) e já o aplica."""
    _registry.append((node, raw_scale))
    node.setScale(raw_scale * _current[0])
    return node


def apply(multiplier):
    """Muda o multiplicador de todos os textos registrados (inclusive os já criados)."""
    _current[0] = float(multiplier)
    alive = []
    for node, raw in _registry:
        if node.isEmpty():
            continue  # texto já destruído: esquece
        node.setScale(raw * _current[0])
        alive.append((node, raw))
    _registry[:] = alive


def count():
    return len(_registry)

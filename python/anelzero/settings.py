"""Ajustes do jogador: volumes, legendas, tamanho do texto, dificuldade das batalhas e movimento reduzido.

Salvos em JSON em ~/.anelzero/settings.json (mude a pasta com ANELZERO_HOME). Valores inválidos
ou um arquivo corrompido voltam ao padrão; nada disso impede o jogo de abrir.
"""

import json
import os
import pathlib

from . import combat as K

DEFAULTS = {
    "master": 0.8,
    "music": 0.6,
    "sfx": 0.8,
    "captions": True,
    "text_scale": 1.0,
    "difficulty": "normal",
    "shadows": True,
    "reduced_motion": False,
    "battle_on_contact": False,
}
TEXT_SCALES = [0.85, 1.0, 1.25, 1.5]


def home_dir():
    env = os.environ.get("ANELZERO_HOME")
    return pathlib.Path(env) if env else pathlib.Path.home() / ".anelzero"


def settings_path():
    return home_dir() / "settings.json"


def _clamp01(v):
    return max(0.0, min(1.0, float(v)))


def sanitize(raw):
    """Devolve um dicionário com todas as chaves e valores válidos, a partir de dados possivelmente ruins."""
    out = dict(DEFAULTS)
    if not isinstance(raw, dict):
        return out
    for key in ("master", "music", "sfx"):
        if key in raw:
            try:
                out[key] = _clamp01(raw[key])
            except (TypeError, ValueError):
                pass
    for key in ("captions", "shadows", "reduced_motion", "battle_on_contact"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    if raw.get("text_scale") in TEXT_SCALES:
        out["text_scale"] = raw["text_scale"]
    if raw.get("difficulty") in K.DIFFICULTY_ORDER:
        out["difficulty"] = raw["difficulty"]
    return out


class Settings:
    def __init__(self, path=None):
        self.path = pathlib.Path(path) if path else settings_path()
        self.data = dict(DEFAULTS)

    def load(self):
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raw = None
        self.data = sanitize(raw)
        return self

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, key):
        return self.data[key]

    def set(self, key, value):
        if key not in DEFAULTS:
            raise KeyError(key)
        self.data = sanitize({**self.data, key: value})

    def cycle(self, key, options):
        """Avança para a próxima opção de uma lista (usado em menus de escolha)."""
        cur = self.data[key]
        i = options.index(cur) if cur in options else -1
        self.set(key, options[(i + 1) % len(options)])
        return self.data[key]

    def volume(self, channel):
        """Volume efetivo de um canal: master vezes o canal."""
        return self.data["master"] * self.data[channel]

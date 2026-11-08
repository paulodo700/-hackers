"""Efeitos sonoros originais, sintetizados em Python (sem arquivos de terceiros).

generate() escreve um WAV por efeito numa pasta de cache (~/.anelzero/sfx). play() usa o carregador do
Panda3D com o volume dos ajustes. Sem dispositivo de áudio o jogo segue sem som, sem erro.
"""

import math
import pathlib
import random
import struct
import wave

from . import settings as T

RATE = 22050
EFFECTS = ["passo", "golpe", "pesado", "coleta", "reparo", "cura", "ui", "vitoria", "derrota", "dano"]


def _env(i, n, attack=0.005, release=0.2):
    t = i / RATE
    total = n / RATE
    a = min(1.0, t / attack) if attack else 1.0
    r = min(1.0, max(0.0, (total - t) / release)) if release else 1.0
    return a * r


def _tone(freq, dur, wave_kind="sine", sweep=0.0, vol=0.5):
    n = int(RATE * dur)
    out = []
    phase = 0.0
    for i in range(n):
        f = freq + sweep * (i / max(1, n))
        phase += 2 * math.pi * f / RATE
        if wave_kind == "square":
            s = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_kind == "saw":
            s = 2 * ((phase / (2 * math.pi)) % 1.0) - 1.0
        else:
            s = math.sin(phase)
        out.append(s * _env(i, n) * vol)
    return out


def _noise(dur, vol=0.4, seed=1):
    rng = random.Random(seed)
    n = int(RATE * dur)
    return [(rng.random() * 2 - 1) * _env(i, n, attack=0.001, release=dur * 0.6) * vol for i, _ in enumerate(range(n))]


def _mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    return out


def _seq(*tracks):
    out = []
    for t in tracks:
        out += t
    return out


def _silence(dur):
    return [0.0] * int(RATE * dur)


def synth(name):
    """Forma de onda (lista de amostras em -1..1) de um efeito."""
    if name == "passo":
        return _mix(_noise(0.05, 0.25, seed=3), _tone(120, 0.06, "sine", -40, 0.3))
    if name == "golpe":
        return _mix(_tone(520, 0.14, "square", -360, 0.35), _noise(0.1, 0.3, seed=5))
    if name == "pesado":
        return _mix(_tone(90, 0.35, "saw", -50, 0.45), _noise(0.25, 0.35, seed=7))
    if name == "coleta":
        return _seq(_tone(660, 0.07, vol=0.4), _tone(880, 0.07, vol=0.4), _tone(1320, 0.12, vol=0.4))
    if name == "reparo":
        return _mix(_tone(440, 0.4, vol=0.25), _tone(554, 0.4, vol=0.25), _tone(660, 0.4, vol=0.25))
    if name == "cura":
        return _seq(_tone(523, 0.12, vol=0.35), _tone(659, 0.12, vol=0.35), _tone(784, 0.2, vol=0.35))
    if name == "ui":
        return _tone(980, 0.04, "square", vol=0.2)
    if name == "vitoria":
        return _seq(_tone(523, 0.12, vol=0.35), _tone(659, 0.12, vol=0.35), _tone(784, 0.12, vol=0.35),
                    _tone(1046, 0.35, vol=0.35))
    if name == "derrota":
        return _seq(_tone(392, 0.18, "saw", vol=0.3), _tone(330, 0.18, "saw", vol=0.3),
                    _tone(262, 0.4, "saw", -60, vol=0.3))
    if name == "dano":
        return _mix(_tone(180, 0.22, "square", -120, 0.3), _noise(0.12, 0.2, seed=9))
    raise KeyError(name)


def write_wav(path, samples):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(frames)
    return path


def sfx_dir():
    return T.home_dir() / "sfx"


def generate(directory=None):
    """Escreve os efeitos que faltarem. Devolve {nome: caminho}."""
    d = pathlib.Path(directory) if directory else sfx_dir()
    out = {}
    for name in EFFECTS:
        path = d / f"{name}.wav"
        if not path.exists():
            write_wav(path, synth(name))
        out[name] = path
    return out


class SoundBank:
    """Reproduz os efeitos pelo carregador do Panda3D, com volume dos ajustes."""

    def __init__(self, loader, settings):
        self.settings = settings
        self.sounds = {}
        try:
            paths = generate()
            for name, path in paths.items():
                self.sounds[name] = loader.loadSfx(str(path))
        except Exception:  # sem áudio ou sem permissão de escrita: o jogo segue mudo
            self.sounds = {}

    def play(self, name):
        snd = self.sounds.get(name)
        if snd is None:
            return False
        snd.setVolume(self.settings.volume("sfx"))
        snd.play()
        return True

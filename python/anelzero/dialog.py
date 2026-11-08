"""Caixa de diálogo: texto com efeito de digitação, avanço com E e escolhas numeradas (1 a 3).

Lógica pura, sem Panda3D, para poder ser testada. O cliente só desenha o que esta classe devolve.
"""

CHARS_PER_SECOND = 40.0


class Typewriter:
    def __init__(self, text, cps=CHARS_PER_SECOND):
        self.text = text
        self.cps = cps
        self.t = 0.0

    def update(self, dt):
        self.t += dt

    def shown(self):
        return self.text[:int(self.t * self.cps)]

    def done(self):
        return int(self.t * self.cps) >= len(self.text)

    def finish(self):
        self.t = len(self.text) / self.cps


class Dialog:
    """Sequência de falas, com escolhas opcionais na última fala.

    lines: [{"s": quem fala, "t": texto}, ...]
    choices: [{"label": ..., "value": ...}, ...] (até 3; mostradas como 1, 2, 3)
    """

    def __init__(self, lines, choices=None, title=None, color=None):
        if not lines:
            raise ValueError("diálogo sem falas")
        self.lines = lines
        self.choices = (choices or [])[:3]
        self.title = title
        self.color = color
        self.index = 0
        self.typer = Typewriter(lines[0]["t"])
        self.chosen = None
        self.closed = False

    @property
    def line(self):
        return self.lines[self.index]

    def update(self, dt):
        if not self.closed:
            self.typer.update(dt)

    def advance(self):
        """Tecla E: completa a digitação; se já estiver completa, passa para a próxima fala."""
        if self.closed:
            return
        if not self.typer.done():
            self.typer.finish()
            return
        if self.index + 1 < len(self.lines):
            self.index += 1
            self.typer = Typewriter(self.lines[self.index]["t"])
        elif not self.choices:
            self.closed = True

    def waiting_choice(self):
        return self.typer.done() and self.index == len(self.lines) - 1 and bool(self.choices) and not self.closed

    def choose(self, n):
        """Escolha pelo número (1 a 3). Devolve o value escolhido ou None se inválida."""
        if not self.waiting_choice():
            return None
        if not (1 <= n <= len(self.choices)):
            return None
        self.chosen = self.choices[n - 1]["value"]
        self.closed = True
        return self.chosen

    def shown_text(self):
        return self.typer.shown()

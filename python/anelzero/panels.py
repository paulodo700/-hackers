"""Telas 2D do cliente Panda3D: batalha, reparo, loja e bancada, e ajustes.

Cada tela recebe um modelo de lógica (battle.Battle, repair.RepairGame, shop.Shop ou settings.Settings)
e só desenha o estado dele. Nenhuma regra de jogo vive aqui.
"""

import textwrap

from direct.gui.OnscreenText import OnscreenText
from direct.showbase.ShowBaseGlobal import aspect2d
from panda3d.core import LineSegs, NodePath, TextNode, TransparencyAttrib

from . import content as C
from . import repair as R
from . import settings as T
from . import textscale
from . import scene as SC

BAR_CELLS = 16


def bar(ratio):
    """Barra de vida em ASCII (a fonte padrão não tem blocos Unicode)."""
    filled = round(max(0.0, min(1.0, ratio)) * BAR_CELLS)
    return "#" * filled + "-" * (BAR_CELLS - filled)


def wrap(text, width=64):
    """Quebra linhas em Python (o wordwrap da fonte desalinha textos longos)."""
    out = []
    for para in str(text).split("\n"):
        out += textwrap.wrap(para, width) or [""]
    return "\n".join(out)


class Text:
    """Texto de tela no espaço corrigido pela proporção (aspect2d), com o tamanho escolhido nos ajustes.

    O primeiro argumento é ignorado: mantido para não mudar as chamadas das telas.
    """

    def __init__(self, _parent, text="", x=0.0, y=0.0, scale=0.05, align=TextNode.ALeft, color=(1, 1, 1, 1),
                 scale_mult=1.0, width=None):
        self.width = width
        self.node = OnscreenText(text=self._fit(text), pos=(x, y), scale=scale, align=align,
                                 fg=color, shadow=(0, 0, 0, 1), mayChange=True, parent=aspect2d)
        textscale.register(self.node, scale)  # tamanho do texto ao vivo (ajustes)

    def _fit(self, text):
        return wrap(text, self.width) if self.width else str(text)

    def set(self, text):
        self.node.setText(self._fit(text))

    def show(self):
        self.node.show()

    def hide(self):
        self.node.hide()


class Panel:
    """Retângulo escuro translúcido de fundo (cobre a tela inteira ou parte dela)."""

    def __init__(self, parent, x=0.0, y=0.0, w=1.0, h=1.0, alpha=0.82):
        self.np = SC.fullscreen_card((0.02, 0.04, 0.05), alpha)
        self.np.reparentTo(parent)
        self.np.setPos(x, 0, y)
        self.np.setScale(w, 1, h)

    def show(self):
        self.np.show()

    def hide(self):
        self.np.hide()


class BattleScreen:
    def __init__(self, parent, ar, scale_mult=1.0):
        self.panel = Panel(parent, 0, 0, ar, 1.0, alpha=1.0)  # opaco: o mundo não vaza para a batalha
        self.name = Text(parent, "", -ar + 0.1, 0.9, 0.07, color=(1, 0.85, 0.5, 1), scale_mult=scale_mult)
        self.intent = Text(parent, "", -ar + 0.1, 0.8, 0.045, color=(1, 0.6, 0.5, 1), scale_mult=scale_mult)
        self.enemy_hp = Text(parent, "", -ar + 0.1, 0.72, 0.045, color=(0.6, 1, 0.6, 1), scale_mult=scale_mult)
        self.player = Text(parent, "", ar - 0.1, 0.9, 0.045, align=TextNode.ARight, color=(0.7, 1, 1, 1),
                           scale_mult=scale_mult)
        self.log = Text(parent, "", -ar + 0.1, 0.55, 0.04, color=(0.95, 0.95, 0.9, 1), scale_mult=scale_mult,
                        width=70)
        self.cmds = ListView(-ar + 0.1, -0.25, row_h=0.1, icon=0.045, scale=0.05, width=60)
        self.help = Text(parent, "", -ar + 0.1, -0.92, 0.035, color=(0.6, 0.7, 0.7, 1), scale_mult=scale_mult)
        self.diff = Text(parent, "", ar - 0.1, -0.92, 0.035, align=TextNode.ARight, color=(0.9, 0.8, 0.5, 1),
                         scale_mult=scale_mult)
        self._all = [self.name, self.intent, self.enemy_hp, self.player, self.log, self.cmds, self.help, self.diff]
        self.portrait = IconSlot(ar - 0.45, 0.42, 0.22)

    def show(self):
        self.panel.show()
        for t in self._all:
            t.show()

    def hide(self):
        self.panel.hide()
        for t in self._all:
            t.hide()
        self.cmds.hide()
        self.portrait.hide()

    def render(self, battle, cursor, difficulty_label, icon_for=None):
        self.name.set(battle.name)
        self.intent.set(battle.intent_text() if not battle.over else "")
        self.enemy_hp.set(f"{battle.name}  {bar(battle.hp_ratio())}  {battle.e_hp}/{battle.d['hp']}")
        st = battle.state
        self.player.set(f"Bit  HP {bar(st.hp / max(1, st.max_hp()))} {st.hp}/{st.max_hp()}\n"
                        f"EN {st.en}/{st.max_en()}")
        self.log.set("\n".join(battle.log[-6:]))
        cmds = battle.commands()
        labels = {"atacar": "Atacar", "habilidades": "Habilidades", "itens": "Itens", "defender": "Defender",
                  "fugir": "Fugir", "voltar": "Voltar"}
        names, icons = [], []
        for cmd in cmds:
            label = labels.get(cmd)
            icon = None
            if label is None and cmd.startswith("skill:"):
                sid = cmd.split(":", 1)[1]
                s = next(x for x in battle.skills() if x["id"] == sid)
                label = f"{s['name']} ({s['cost']} EN)"
            elif label is None and cmd.startswith("item:"):
                iid = cmd.split(":", 1)[1]
                it = next(x for x in battle.items() if x["id"] == iid)
                label = f"{it['name']} x{it['n']}"
                icon = icon_for("item", iid) if icon_for else None
            names.append(label or cmd)
            icons.append(icon)
        if battle.over:
            self.cmds.render(["Enter continua"], 0, [None])
        else:
            numbered = [f"{i + 1}) {n}" for i, n in enumerate(names)]
            self.cmds.render(numbered, cursor % max(1, len(cmds)), icons)
        self.help.set("Setas escolhem | 1-9 escolhem direto | Enter confirma")
        self.diff.set(f"Dificuldade: {difficulty_label}")


class RepairScreen:
    """Painel do reparo: a grade desenhada com linhas e os textos de giros, pontos e tempo."""

    def __init__(self, parent, ar, scale_mult=1.0):
        self.panel = Panel(parent, 0, 0, ar, 1.0, alpha=0.9)
        self.grid_root = aspect2d.attachNewNode("repair-grid")
        self.size = 0.9
        self.title = Text(parent, "", -ar + 0.1, 0.9, 0.06, color=(0.6, 1, 0.95, 1), scale_mult=scale_mult)
        self.info = Text(parent, "", ar - 0.1, 0.9, 0.045, align=TextNode.ARight, color=(1, 0.95, 0.6, 1),
                         scale_mult=scale_mult)
        self.help = Text(parent, "", -ar + 0.1, -0.92, 0.04, color=(0.7, 0.85, 0.85, 1), scale_mult=scale_mult,
                         width=76)
        self.cursor_node = None
        self.ar = ar
        self._all = [self.title, self.info, self.help]

    def show(self):
        self.panel.show()
        self.grid_root.show()
        for t in self._all:
            t.show()

    def hide(self):
        self.panel.hide()
        self.grid_root.hide()
        for t in self._all:
            t.hide()

    def render(self, game, title, best_text="-"):
        self.grid_root.node().removeAllChildren()
        self.title.set(title)
        n = game.puzzle.n
        cell = self.size * 2 / n
        x0, y0 = -self.size, self.size
        on = game.puzzle.powered()
        seg = LineSegs("repair")
        seg.setThickness(5)
        for y in range(n):
            for x in range(n):
                c = game.puzzle.cells[y][x]
                m = game.puzzle.mask(x, y)
                lit = (x, y) in on
                cx = x0 + (x + 0.5) * cell
                cy = y0 - (y + 0.5) * cell
                color = (1, 0.82, 0.4, 1) if lit else (0.12, 0.9, 0.82, 1)
                if c.type == "fusivel":
                    color = (1, 0.35, 0.4, 1) if c.locked else (1, 0.6, 0.42, 1)
                seg.setColor(*color)
                half = cell * 0.5 - 0.02
                ends = {R.N: (cx, cy + half), R.E: (cx + half, cy), R.S: (cx, cy - half), R.W: (cx - half, cy)}
                for bit, (ex, ey) in ends.items():
                    if m & bit:
                        seg.moveTo(cx, 0, cy)
                        seg.drawTo(ex, 0, ey)
                if c.type == "cruzamento":
                    seg.setColor(0.6, 0.9, 1, 1)
                    s = cell * 0.14
                    seg.moveTo(cx - s, 0, cy - s)
                    seg.drawTo(cx + s, 0, cy - s)
                    seg.drawTo(cx + s, 0, cy + s)
                    seg.drawTo(cx - s, 0, cy + s)
                    seg.drawTo(cx - s, 0, cy - s)
        # Fonte (verde) e destino (magenta)
        for (x, y), col in (((0, 0), (0.49, 0.99, 0.6, 1)), ((n - 1, n - 1), (1, 0.24, 0.65, 1))):
            cx = x0 + (x + 0.5) * cell
            cy = y0 - (y + 0.5) * cell
            seg.setColor(*col)
            s = cell * 0.12
            seg.moveTo(cx - s, 0, cy)
            seg.drawTo(cx + s, 0, cy)
            seg.moveTo(cx, 0, cy - s)
            seg.drawTo(cx, 0, cy + s)
        # Moldura das células
        seg.setColor(0.12, 0.45, 0.42, 0.6)
        for i in range(n + 1):
            seg.moveTo(x0 + i * cell, 0, y0)
            seg.drawTo(x0 + i * cell, 0, y0 - self.size * 2)
            seg.moveTo(x0, 0, y0 - i * cell)
            seg.drawTo(x0 + self.size * 2, 0, y0 - i * cell)
        # Cursor do teclado
        cx0 = x0 + game.cursor[0] * cell
        cy0 = y0 - game.cursor[1] * cell
        seg.setColor(1, 1, 1, 1)
        seg.moveTo(cx0 + 0.01, 0, cy0 - 0.01)
        seg.drawTo(cx0 + cell - 0.01, 0, cy0 - 0.01)
        seg.drawTo(cx0 + cell - 0.01, 0, cy0 - cell + 0.01)
        seg.drawTo(cx0 + 0.01, 0, cy0 - cell + 0.01)
        seg.drawTo(cx0 + 0.01, 0, cy0 - 0.01)
        np = NodePath(seg.create())
        np.reparentTo(self.grid_root)
        np.setTransparency(TransparencyAttrib.MAlpha)
        np.setPos(0.0, 0, 0.0)
        left = game.time_left()
        timer = f"  Tempo: {int(left) + (1 if left and left % 1 else 0)}s" if left is not None else ""
        pause = "  [PAUSADO]" if game.paused else ""
        self.info.set(f"Giros: {game.moves}   Pontos: {game.score_now()}{timer}{pause}\n"
                      f"Recorde: {best_text}")
        self.help.set(game.feedback or "Clique ou Enter gira. Fusíveis (F) queimam. Cruzamentos não giram.")



class ShopScreen:
    def __init__(self, parent, ar, scale_mult=1.0):
        self.panel = Panel(parent, 0, 0, ar, 1.0, alpha=0.9)
        self.header = Text(parent, "", -ar + 0.1, 0.9, 0.055, color=(1, 0.9, 0.5, 1), scale_mult=scale_mult)
        self.rows = ListView(-ar + 0.1, 0.75, row_h=0.085, icon=0.04, scale=0.04, width=86)
        self.detail = Text(parent, "", -ar + 0.1, -0.5, 0.04, color=(0.7, 0.9, 0.9, 1), scale_mult=scale_mult,
                           width=86)
        self.help = Text(parent, "", -ar + 0.1, -0.92, 0.035, color=(0.6, 0.7, 0.7, 1), scale_mult=scale_mult)
        self._all = [self.header, self.rows, self.detail, self.help]
        self.preview = IconSlot(ar - 0.45, 0.42, 0.22)

    def show(self):
        self.panel.show()
        for t in self._all:
            t.show()

    def hide(self):
        self.panel.hide()
        for t in self._all:
            t.hide()
        self.preview.hide()

    def render(self, shop, title, icon_for=None):
        self.header.set(f"{title}   {shop.header()}")
        rows = shop.rows()
        icons = [icon_for("item", r["id"]) if (icon_for and r["id"]) else None for r in rows]
        self.rows.render([r["label"] for r in rows], shop.cursor, icons)
        detail = rows[shop.cursor]["detail"] if rows else ""
        self.detail.set(detail)
        self.help.set((shop.message + "   " if shop.message else "")
                      + "Setas escolhem | Enter confirma | Tab troca modo | Esc fecha")


SETTINGS_ROWS = ["master", "music", "sfx", "captions", "text_scale", "difficulty", "shadows", "reduced_motion",
                 "battle_on_contact"]
SETTINGS_LABELS = {
    "master": "Volume geral", "music": "Música", "sfx": "Efeitos", "captions": "Legendas",
    "text_scale": "Tamanho do texto", "difficulty": "Dificuldade das batalhas", "shadows": "Sombras",
    "reduced_motion": "Movimento reduzido",
    "battle_on_contact": "Inimigos errantes: batalha",
}


DIFF_LABEL = {"facil": "Fácil", "normal": "Normal", "dificil": "Difícil"}


def settings_value_text(settings, key):
    v = settings.get(key)
    if key in ("master", "music", "sfx"):
        return f"{round(v * 100)}%"
    if isinstance(v, bool):
        return "ligado" if v else "desligado"
    if key == "difficulty":
        return DIFF_LABEL.get(v, v)
    return f"x{v}"


class SettingsScreen:
    def __init__(self, parent, ar, scale_mult=1.0):
        self.panel = Panel(parent, 0, 0, ar, 1.0, alpha=0.9)
        self.title = Text(parent, "Ajustes", -ar + 0.1, 0.9, 0.07, color=(0.6, 1, 0.95, 1), scale_mult=scale_mult)
        self.rows = Text(parent, "", -ar + 0.1, 0.7, 0.05, color=(1, 1, 1, 1), scale_mult=scale_mult)
        self.help = Text(parent, "", -ar + 0.1, -0.9, 0.035, color=(0.7, 0.8, 0.8, 1), scale_mult=scale_mult)
        self._all = [self.title, self.rows, self.help]

    def show(self):
        self.panel.show()
        for t in self._all:
            t.show()

    def hide(self):
        self.panel.hide()
        for t in self._all:
            t.hide()

    def render(self, settings, cursor):
        lines = []
        for i, key in enumerate(SETTINGS_ROWS):
            mark = ">" if i == cursor else " "
            lines.append(f"{mark} {SETTINGS_LABELS[key]:<26} {settings_value_text(settings, key)}")
        self.rows.set("\n".join(lines))
        self.help.set("Setas escolhem e mudam | Enter alterna | Esc salva e volta")


class IconSlot:
    """Imagem de ícone que aparece só quando há um caminho válido (sem ícone, o texto segue sozinho)."""

    def __init__(self, x, y, size):
        self.x, self.y, self.size = x, y, size
        self.node = None
        self.path = None

    def set(self, path):
        from direct.gui.OnscreenImage import OnscreenImage
        if path == self.path:
            return
        self.path = path
        if self.node is not None:
            self.node.destroy()
            self.node = None
        if path:
            self.node = OnscreenImage(image=path, pos=(self.x, 0, self.y), scale=self.size)
            self.node.setTransparency(TransparencyAttrib.MAlpha)

    def hide(self):
        self.set(None)


class ListView:
    """Lista de linhas com ícone à esquerda. Reaproveita os nós entre quadros."""

    def __init__(self, x, y, row_h=0.09, icon=0.04, scale=0.045, width=60, scale_mult=1.0):
        self.x, self.y, self.row_h = x, y, row_h
        self.icon, self.scale, self.width, self.scale_mult = icon, scale, width, scale_mult
        self.rows = []

    def _row(self, i):
        while len(self.rows) <= i:
            k = len(self.rows)
            ty = self.y - k * self.row_h
            text = Text(None, "", self.x + self.icon * 2.6, ty, self.scale, scale_mult=self.scale_mult,
                        width=self.width)
            slot = IconSlot(self.x + self.icon, ty + self.icon * 0.2, self.icon)
            self.rows.append((text, slot))
        return self.rows[i]

    def render(self, labels, cursor, icon_paths):
        for i, label in enumerate(labels):
            text, slot = self._row(i)
            mark = ">" if i == cursor else " "
            text.set(f"{mark} {label}")
            text.show()
            slot.set(icon_paths[i] if i < len(icon_paths) else None)
        for text, slot in self.rows[len(labels):]:
            text.hide()
            slot.hide()

    def show(self):
        """As linhas aparecem de novo na próxima render(); aqui só garante o estado visível."""
        for text, slot in self.rows:
            text.show()

    def hide(self):
        for text, slot in self.rows:
            text.hide()
            slot.hide()


def cell_at(ax, ay, n, size):
    """Célula (coluna, linha) sob um ponto em coordenadas aspect2d, ou None fora da grade do reparo.

    A grade ocupa x em [-size, size] e y em [-size, size] (topo = +size), dividida em n x n células.
    """
    x0, y0 = -size, size
    cell = size * 2 / n
    col = int((ax - x0) // cell)
    row = int((y0 - ay) // cell)
    if ax < x0 or ay > y0 or ax >= x0 + size * 2 or ay <= y0 - size * 2:
        return None
    if not (0 <= col < n and 0 <= row < n):
        return None
    return col, row

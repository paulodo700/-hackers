"""Renderização dos ícones 3D: cada modelo é desenhado num buffer offscreen e salvo como PNG no cache.

Usa um único buffer e uma única câmera (criar buffers a cada ícone é lento). Se o Panda3D não conseguir
criar o buffer (sem OpenGL, por exemplo), IconRenderer.available fica False e o jogo usa só texto.
"""

from panda3d.core import (
    AmbientLight, DirectionalLight, Filename, GraphicsOutput, NodePath, Texture,
)

from . import icons as I
from . import scene as SC


def _item_node(item_id, color):
    from . import models
    return models.item_node(item_id, color)


def _enemy_node(enemy_id, zone_id):
    from . import models
    color = I.tinted(I.C.ENEMIES[enemy_id]["color"], zone_id)
    scale = 1.3 if I.enemy_is_boss(enemy_id) else 1.0
    root = NodePath(f"enemy-{enemy_id}")
    models.enemy_node(enemy_id, color, scale).reparentTo(root)
    return root


def _talent_node(talent_id):
    color, shape = I.talent_style(talent_id)
    c = SC.hex_rgba(color)
    light = SC.mix(c[:3], (1, 1, 1), 0.35) + (1.0,)
    holder = NodePath(f"talent-holder-{talent_id}")
    mesh = SC.Mesh()
    if shape == "cube":
        mesh.box(-.3, -.3, -.3, .3, .3, .3, c)
    elif shape == "prism":  # bloco alto
        mesh.box(-.2, -.2, -.45, .2, .2, .45, c)
        mesh.box(-.2, -.2, .45, .2, .2, .5, light)
    elif shape == "plate":  # placa com uma faixa clara
        mesh.box(-.45, -.1, -.3, .45, .1, .3, c)
        mesh.box(-.45, -.1, .3, .45, .1, .36, light)
    elif shape == "ring":  # anel formado por oito blocos
        import math
        for i in range(8):
            a = 2 * math.pi * i / 8
            mesh.box(math.cos(a) * .35 - .07, math.sin(a) * .35 - .07, -.07,
                     math.cos(a) * .35 + .07, math.sin(a) * .35 + .07, .07, c)
    else:  # spike
        for ang in (0, 60, 120):
            m = SC.Mesh()
            m.box(-.07, -.07, -.45, .07, .07, .45, c)
            spike = m.node("spike")
            spike.setHpr(ang, 0, 25)
            spike.reparentTo(holder)
    if shape in ("cube", "prism", "plate", "ring"):
        mesh.node(f"talent-{talent_id}").reparentTo(holder)
    holder.setPos(0, 0, 0.6)
    return holder


def _skill_node(skill_id):
    color, shape = I.skill_style(skill_id)
    c = SC.hex_rgba(color)
    dark = SC.mix(c[:3], (0, 0, 0), 0.4) + (1.0,)
    mesh = SC.Mesh()
    if shape == "diamond":
        mesh.box(-.3, -.3, -.3, .3, .3, .3, c)
        node = mesh.node(f"skill-{skill_id}")
        node.setHpr(45, 35, 0)
    elif shape == "cone":  # pirâmide escalonada, apontando para cima
        for i, (w, z0, z1) in enumerate([(.7, 0, .25), (.5, .25, .5), (.3, .5, .75), (.12, .75, .95)]):
            mesh.box(-w / 2, -w / 2, z0 - .3, w / 2, w / 2, z1 - .3, c if i % 2 == 0 else dark)
        node = mesh.node(f"skill-{skill_id}")
    elif shape == "cross":  # cruz de cura
        mesh.box(-.11, -.11, -.4, .11, .11, .4, c)
        mesh.box(-.4, -.11, -.11, .4, .11, .11, c)
        mesh.box(-.11, -.11, -.4, .11, .11, .4, c)
        node = mesh.node(f"skill-{skill_id}")
    else:  # spike: três espinhos
        holder = NodePath(f"skill-holder-{skill_id}")
        for ang in (0, 60, 120):
            m = SC.Mesh()
            m.box(-.07, -.07, -.45, .07, .07, .45, c)
            spike = m.node("spike")
            spike.setHpr(ang, 0, 25)
            spike.reparentTo(holder)
        holder.setPos(0, 0, 0.6)
        return holder
    holder = NodePath(f"skill-holder-{skill_id}")
    node.reparentTo(holder)
    holder.setPos(0, 0, 0.6)
    return holder


FRAME_SIZE = 1.0  # maior dimensão do modelo dentro do quadro do ícone


def fit_to_frame(node):
    """Centraliza o modelo na origem e escala para que a maior dimensão caiba em FRAME_SIZE."""
    lo, hi = node.getTightBounds()
    if lo is None:
        return
    size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, 1e-6)
    k = FRAME_SIZE / size
    center = (lo + hi) * 0.5
    node.setScale(k)
    node.setPos(-center.x * k, -center.y * k, -center.z * k + 0.0)


class IconRenderer:
    def __init__(self, base, size=I.ICON_SIZE):
        self.base = base
        self.size = size
        self.available = False
        self.root = NodePath("icon-scene")
        self._loaded = {}
        try:
            self.buf = base.win.makeTextureBuffer("anelzero-icons", size, size)
            if self.buf is None:
                return
            self.buf.setClearColorActive(True)
            # Copia o resultado para a RAM para poder salvar o PNG
            self.tex = Texture("anelzero-icon")
            self.buf.addRenderTexture(self.tex, GraphicsOutput.RTMCopyRam, GraphicsOutput.RTPColor)
            self.cam = base.makeCamera(self.buf, scene=self.root)
            # A câmera do ícone precisa viver na cena dos ícones, não sob a câmera do jogo (que se move)
            self.cam.reparentTo(self.root)
            lens = self.cam.node().getLens()
            lens.setFov(34)
            self.cam.setPos(2.3, -3.0, 2.0)
            self.cam.lookAt(0, 0, 0)
            amb = AmbientLight("icon-amb")
            amb.setColor((0.5, 0.55, 0.6, 1))
            self.root.setLight(self.root.attachNewNode(amb))
            sun = DirectionalLight("icon-sun")
            sun.setColor((0.9, 0.92, 1, 1))
            sun_np = self.root.attachNewNode(sun)
            sun_np.setHpr(-35, -45, 0)
            self.root.setLight(sun_np)
            self.available = True
        except Exception:  # sem OpenGL disponível: o jogo segue só com texto
            self.available = False

    def _build(self, kind, ident, zone_id):
        if kind == "item":
            return _item_node(ident, I.tinted(I.item_color(ident), zone_id))
        if kind == "enemy":
            return _enemy_node(ident, zone_id)
        if kind == "talent":
            return _talent_node(ident)
        return _skill_node(ident)

    def ensure(self, kind, ident, zone_id=None):
        """Caminho do PNG do ícone, renderizando se ainda não existir. None se não der para renderizar."""
        path = I.icon_file(kind, ident, zone_id)
        if path in self._loaded:
            return self._loaded[path]
        if not path.exists():
            if not self.available:
                return None
            path.parent.mkdir(parents=True, exist_ok=True)
            self._render(kind, ident, zone_id, path)
        self._loaded[path] = str(path)
        return self._loaded[path]

    def _render(self, kind, ident, zone_id, path):
        pal = I.zone_palette(zone_id if zone_id in I.C.ZONES else None)
        bg = SC.hex_rgba(pal["background"])
        self.buf.setClearColor(bg)
        node = self._build(kind, ident, zone_id)
        node.reparentTo(self.root)
        fit_to_frame(node)
        for _ in range(2):
            self.base.graphicsEngine.renderFrame()
        self.tex.write(Filename.from_os_specific(str(path)))
        node.removeNode()

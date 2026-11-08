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
    shape = I.item_shape(item_id)
    mesh = SC.Mesh()
    c = SC.hex_rgba(color)
    dark = SC.mix(c[:3], (0, 0, 0), 0.35) + (1.0,)
    light = SC.mix(c[:3], (1, 1, 1), 0.35) + (1.0,)
    if shape == "blade":
        mesh.box(-.07, -.07, -0.5, .07, .07, 1.3, c)
        mesh.box(-.3, -.09, -0.2, .3, .09, -0.05, dark)  # guarda
    elif shape == "plate":
        mesh.box(-.5, -.38, 0, .5, .38, .9, c)
        mesh.box(-.5, -.4, .75, .5, .4, .9, light)
    elif shape == "capsule":
        for i, (w, z0, z1) in enumerate([(.36, 0, .25), (.42, .25, .55), (.36, .55, .85)]):
            mesh.box(-w / 2, -w / 2, z0, w / 2, w / 2, z1, c if i != 1 else light)
        mesh.box(-.1, -.1, .85, .1, .1, 1.05, dark)
    elif shape == "chip":
        mesh.box(-.6, -.6, 0, .6, .6, .14, c)
        for dx in (-.4, 0, .4):
            for dy in (-.4, .4):
                mesh.box(dx - .05, dy - .05, .14, dx + .05, dy + .05, .22, light)
    else:  # cluster: materiais
        mesh.box(-.3, -.3, 0, .3, .3, .5, c)
        mesh.box(.05, -.4, 0, .45, -.05, .35, light)
        mesh.box(-.45, .05, 0, -.1, .4, .3, dark)
    return mesh.node(f"item-{item_id}")


def _enemy_node(enemy_id, zone_id):
    e = I.C.ENEMIES[enemy_id]
    color = I.tinted(e["color"], zone_id)
    scale = e.get("scale", 1.0) * (1.4 if I.enemy_is_boss(enemy_id) else 1.0)
    body, _dark = SC.roamer_mesh(color, scale)
    root = NodePath(f"enemy-{enemy_id}")
    body.reparentTo(root)
    return root


def _skill_node(skill_id):
    mesh = SC.Mesh()
    mesh.box(-.3, -.3, -.3, .3, .3, .3, SC.hex_rgba("#7dfff0"))
    node = mesh.node(f"skill-{skill_id}")
    node.setHpr(45, 35, 0)
    holder = NodePath(f"skill-holder-{skill_id}")
    node.reparentTo(holder)
    holder.setPos(0, 0, 0.6)
    return holder


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
            self.cam.lookAt(0, 0, 0.6)
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
        for _ in range(2):
            self.base.graphicsEngine.renderFrame()
        self.tex.write(Filename.from_os_specific(str(path)))
        node.removeNode()

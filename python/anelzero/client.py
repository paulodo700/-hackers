"""Cliente 3D em Panda3D: renderiza as zonas, movimenta o Bit, coleta itens e troca de zona pelos portais.

Controles: WASD ou setas (mover), F5 (salvar), Esc (salvar e sair).
Opção --shot ARQUIVO: renderiza alguns quadros, salva uma captura de tela e encerra (para verificação).
"""

import math

from panda3d.core import loadPrcFileData

loadPrcFileData("", "window-title Anel Zero - Dentro do Processador\n"
                    "win-size 1280 720\n"
                    "audio-library-name null\n"
                    "sync-video 0\n")

from direct.showbase.ShowBase import ShowBase  # noqa: E402
from direct.gui.OnscreenText import OnscreenText  # noqa: E402
from panda3d.core import (  # noqa: E402
    AmbientLight, ClockObject, DirectionalLight, Geom, GeomNode, GeomTriangles, GeomVertexData,
    GeomVertexFormat, GeomVertexWriter, NodePath, TextNode, Vec3,
)

from . import content as C  # noqa: E402
from . import state as S  # noqa: E402
from . import world as W  # noqa: E402

SPEED = 4.2
MSG_TIME = 2.5


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


class Mesh:
    """Acumula quadriláteros e gera um único GeomNode (poucas chamadas de desenho)."""

    def __init__(self):
        self.verts = []
        self.normals = []
        self.colors = []
        self.tris = []

    def quad(self, pts, normal, col):
        # Ordena os vértices para que a face fique virada para a normal (orientação CCW de frente)
        a, b, c = pts[0], pts[1], pts[2]
        e1 = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        e2 = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        cr = _cross(e1, e2)
        if cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2] < 0:
            pts = [pts[0], pts[3], pts[2], pts[1]]
        base = len(self.verts)
        for p in pts:
            self.verts.append(p)
            self.normals.append(normal)
            self.colors.append(col)
        self.tris.append((base, base + 1, base + 2))
        self.tris.append((base, base + 2, base + 3))

    def box(self, x0, y0, z0, x1, y1, z1, col):
        self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1), col)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1), col)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0), col)
        self.quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0), col)
        self.quad([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0), col)
        self.quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0), col)

    def node(self, name):
        fmt = GeomVertexFormat.getV3n3c4()
        vd = GeomVertexData(name, fmt, Geom.UHStatic)
        vd.setNumRows(len(self.verts))
        vw = GeomVertexWriter(vd, "vertex")
        nw = GeomVertexWriter(vd, "normal")
        cw = GeomVertexWriter(vd, "color")
        for p, n, c in zip(self.verts, self.normals, self.colors):
            vw.addData3(*p)
            nw.addData3(*n)
            cw.addData4(*c)
        prim = GeomTriangles(Geom.UHStatic)
        for a, b, c in self.tris:
            prim.addVertices(a, b, c)
        geom = Geom(vd)
        geom.addPrimitive(prim)
        gn = GeomNode(name)
        gn.addGeom(geom)
        return NodePath(gn)


def build_zone_mesh(zone):
    """Piso e paredes (só faces expostas, uma malha só). Devolve (NodePath, cor de fundo)."""
    th = zone.theme
    ground = hex_rgba(th.get("ground", "#222222"))
    trace = hex_rgba(th.get("trace", "#66aaff"))
    trace = tuple(ground[i] * 0.5 + trace[i] * 0.5 for i in range(3)) + (1.0,)
    wall_col = tuple(v * 0.8 for v in ground[:3]) + (1.0,)
    mesh = Mesh()
    # Piso: uma faixa por linha, com a cor alternando de leve para dar textura
    for r in range(zone.height):
        for c in range(zone.width):
            if zone.walkable(c, r):
                k = 0.9 + 0.1 * (((c * 7 + r * 13) % 5) / 4)
                col = tuple(v * k for v in ground[:3]) + (1.0,)
                mesh.quad([(c - .5, r - .5, 0), (c + .5, r - .5, 0), (c + .5, r + .5, 0), (c - .5, r + .5, 0)],
                          (0, 0, 1), col)
    # Trilhas (cor de rastro) sobre o piso
    for c, r in zone.cells_of("="):
        mesh.quad([(c - .5, r - .5, .01), (c + .5, r - .5, .01), (c + .5, r + .5, .01), (c - .5, r + .5, .01)],
                  (0, 0, 1), trace)
    # Paredes: topo e lados expostos
    h = 1.0
    for r in range(zone.height):
        for c in range(zone.width):
            if zone.walkable(c, r) or zone.char(c, r) != W.WALL:
                continue
            mesh.quad([(c - .5, r - .5, h), (c + .5, r - .5, h), (c + .5, r + .5, h), (c - .5, r + .5, h)],
                      (0, 0, 1), wall_col)
            if zone.walkable(c, r - 1):
                mesh.quad([(c - .5, r - .5, 0), (c + .5, r - .5, 0), (c + .5, r - .5, h), (c - .5, r - .5, h)],
                          (0, -1, 0), wall_col)
            if zone.walkable(c, r + 1):
                mesh.quad([(c - .5, r + .5, 0), (c + .5, r + .5, 0), (c + .5, r + .5, h), (c - .5, r + .5, h)],
                          (0, 1, 0), wall_col)
            if zone.walkable(c - 1, r):
                mesh.quad([(c - .5, r - .5, 0), (c - .5, r + .5, 0), (c - .5, r + .5, h), (c - .5, r - .5, h)],
                          (-1, 0, 0), wall_col)
            if zone.walkable(c + 1, r):
                mesh.quad([(c + .5, r - .5, 0), (c + .5, r + .5, 0), (c + .5, r + .5, h), (c + .5, r - .5, h)],
                          (1, 0, 0), wall_col)
    return mesh.node(f"zone-{zone.id}"), hex_rgba(th.get("sky", "#0b0f14"))


class Game(ShowBase):
    def __init__(self, slot=1, shot=None, frames=40, new_game=False, start_pos=None):
        super().__init__()
        self.disableMouse()
        self.camLens.setFov(68)
        self.slots = S.SaveSlots()
        self.slot = slot
        self.shot = shot
        self.shot_frames = frames
        self.frame_count = 0
        self.keys = {"w": False, "a": False, "s": False, "d": False}
        self.msg_left = 0.0
        self.state = None
        self.zone = None
        self.zone_root = None
        self.pickup_nodes = {}
        self.hud = OnscreenText(text="", pos=(-1.32, 0.92), scale=0.048, align=TextNode.ALeft,
                                fg=(0.9, 1, 0.9, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.msg = OnscreenText(text="", pos=(0, -0.85), scale=0.055, align=TextNode.ACenter,
                                fg=(1, 0.95, 0.6, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self._setup_lights()
        self._setup_player()
        self._setup_input()

        loaded = None if new_game else self.slots.load(slot)
        self.state = loaded if loaded is not None else S.new_state()
        if start_pos is not None:
            self.state.pos = list(start_pos)
        self.load_zone(self.state.zone, self._saved_pos())
        self.taskMgr.add(self.update, "update")

    # ---- Montagem ----
    def _setup_lights(self):
        self.setBackgroundColor(0.05, 0.08, 0.1, 1)
        amb = AmbientLight("amb")
        amb.setColor((0.45, 0.5, 0.55, 1))
        self.render.setLight(self.render.attachNewNode(amb))
        sun = DirectionalLight("sun")
        sun.setColor((0.9, 0.95, 1, 1))
        sun_np = self.render.attachNewNode(sun)
        sun_np.setHpr(25, -55, 0)
        self.render.setLight(sun_np)

    def _setup_player(self):
        mesh = Mesh()
        mesh.box(-.22, -.22, 0, .22, .22, .9, (0.2, 0.9, 1, 1))
        mesh.box(-.14, -.23, .6, .14, -.24, .75, (0.05, 0.1, 0.15, 1))  # visor
        self.player = mesh.node("bit")
        self.player.reparentTo(self.render)
        self.px, self.py = 0.0, 0.0

    def _setup_input(self):
        for key in ("w", "a", "s", "d", "arrow_up", "arrow_down", "arrow_left", "arrow_right"):
            self.accept(key, self._set_key, [key, True])
            self.accept(key + "-up", self._set_key, [key, False])
        self.accept("f5", self.save_game)
        self.accept("escape", self.quit_game)

    def _set_key(self, key, value):
        alias = {"arrow_up": "w", "arrow_down": "s", "arrow_left": "a", "arrow_right": "d"}
        self.keys[alias.get(key, key)] = value

    # ---- Zonas ----
    def _saved_pos(self):
        p = self.state.pos
        return tuple(p) if p else None

    def load_zone(self, zid, pos=None):
        if self.zone_root is not None:
            self.zone_root.removeNode()
        self.zone = W.load(zid)
        self.state.zone = zid
        self.zone_root = self.render.attachNewNode("zone")
        mesh_np, sky = build_zone_mesh(self.zone)
        mesh_np.reparentTo(self.zone_root)
        self.setBackgroundColor(*sky[:3], 1)
        self._build_pickups()
        if pos is None:
            pos = self.zone.spawn()
        self.px, self.py = float(pos[0]), float(pos[1])
        self.say(self.zone.name)

    def _build_pickups(self):
        self.pickup_nodes = {}
        for c, r, m in self.zone.pickups():
            key = f"pk_{self.zone.id}_{c}_{r}"
            if self.state.has_flag(key):
                continue
            mesh = Mesh()
            mesh.box(-.14, -.14, 0, .14, .14, .32, (1, 0.85, 0.25, 1))
            np = mesh.node("pickup")
            np.reparentTo(self.zone_root)
            np.setPos(c, r, 0.1)
            self.pickup_nodes[(c, r)] = (np, key, m.get("item"))

    def say(self, text, seconds=MSG_TIME):
        self.msg.setText(text)
        self.msg_left = seconds

    # ---- Ações ----
    def save_game(self):
        self.state.pos = [round(self.px, 3), round(self.py, 3)]
        self.slots.save(self.slot, self.state)
        self.say("Jogo salvo.")

    def quit_game(self):
        self.save_game()
        self.userExit()

    def _collect(self):
        cell = (round(self.px), round(self.py))
        hit = self.pickup_nodes.get(cell)
        if not hit:
            return
        np, key, item = hit
        if abs(self.px - cell[0]) > 0.7 or abs(self.py - cell[1]) > 0.7:
            return
        self.state.set_flag(key)
        got = self.state.add_item(item, 1) if item else 0
        np.removeNode()
        del self.pickup_nodes[cell]
        name = C.ITEMS.get(item, {}).get("name", item) if item else "item"
        self.say(f"+ {name}" if got else "Nada aqui.")

    def _portal(self):
        cell = (round(self.px), round(self.py))
        for c, r, m in self.zone.portals():
            if (c, r) == cell and m.get("to") in C.ZONES:
                origin = self.zone.id
                self.load_zone(m["to"], W.load(m["to"]).arrival_from(origin))
                return

    # ---- Quadro ----
    def update(self, task):
        dt = min(ClockObject.getGlobalClock().getDt(), 0.05)
        dx = (self.keys["d"] - self.keys["a"])
        dy = (self.keys["w"] - self.keys["s"])
        if dx or dy:
            n = (dx * dx + dy * dy) ** 0.5
            step = SPEED * dt
            self.px, self.py = W.move(self.zone, self.px, self.py, dx / n * step, dy / n * step)
        self.player.setPos(self.px, self.py, 0)
        if dx or dy:
            self.player.setH(math.degrees(math.atan2(-dx, dy)))
        self._collect()
        self._portal()
        cam = Vec3(self.px, self.py - 6.0, 6.5)
        self.camera.setPos(cam)
        self.camera.lookAt(self.px, self.py + 0.5, 0.6)

        if self.msg_left > 0:
            self.msg_left -= dt
            if self.msg_left <= 0:
                self.msg.setText("")
        left = len(self.pickup_nodes)
        self.hud.setText(
            f"{self.zone.name}\n"
            f"Nível {self.state.level}   HP {self.state.hp}/{self.state.max_hp()}   "
            f"EN {self.state.en}/{self.state.max_en()}   Gold {self.state.gold}\n"
            f"Itens restantes aqui: {left}   [WASD mover | F5 salvar | Esc sair]"
        )
        self.frame_count += 1
        if self.shot and self.frame_count >= self.shot_frames:
            self.graphicsEngine.renderFrame()
            self.win.saveScreenshot(self.shot)
            self.userExit()
        return task.cont


def run(slot=1, shot=None, frames=40, new_game=False, start_pos=None):
    game = Game(slot=slot, shot=shot, frames=frames, new_game=new_game, start_pos=start_pos)
    game.run()

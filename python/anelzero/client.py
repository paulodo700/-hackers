"""Cliente 3D em Panda3D: título, abertura com o Vigia, exploração, diálogos, combate em tempo real e menus.

Controles no jogo:  WASD ou setas mover | E falar, abrir baú ou reparar | F atacar | Tab menu | F5 salvar | Esc salvar e sair
Diálogos: E avança (a primeira vez completa o texto); 1 a 3 escolhem quando houver escolhas.
Menus: Tab ou setas esquerda/direita trocam de aba, setas escolhem, Enter usa/equipa/gasta ponto/viaja, V vende, Esc fecha.

--shot ARQUIVO: pula o título, renderiza alguns quadros, salva uma captura e encerra (verificação).
"""

import math

from panda3d.core import loadPrcFileData

loadPrcFileData("", "window-title Anel Zero - Dentro do Processador\n"
                    "win-size 1280 720\n"
                    "audio-library-name null\n"
                    "sync-video 0\n")

from direct.showbase.ShowBase import ShowBase  # noqa: E402
from direct.gui.OnscreenImage import OnscreenImage  # noqa: E402
from direct.gui.OnscreenText import OnscreenText  # noqa: E402
from panda3d.core import (  # noqa: E402
    AmbientLight, ClockObject, DirectionalLight, Point2, Point3, TextNode, TransparencyAttrib,
)

from . import content as C  # noqa: E402
from . import dialog as D  # noqa: E402
from . import menu as M  # noqa: E402
from . import rt  # noqa: E402
from . import scene as SC  # noqa: E402
from . import state as S  # noqa: E402
from . import world as W  # noqa: E402

SPEED = 4.2
INTERACT_RANGE = 1.3
PICKUP_RANGE = 0.7
ROAMER_RESPAWN_S = 30.0
MOVE_KEYS = {"w": "w", "arrow_up": "w", "s": "s", "arrow_down": "s",
             "a": "a", "arrow_left": "a", "d": "d", "arrow_right": "d"}
CHOICE_KEYS = {"1": 1, "2": 2, "3": 3}


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
        self.mode = "title"
        self.title_index = 0
        self.state = S.new_state()
        self.zone = None
        self.zone_root = None
        self.fight = None
        self.dialog = None
        self.dialog_after = None
        self.menu = None
        self.pickups = {}
        self.interactables = []
        self.roamer_nodes = {}
        self.particles = []
        self.floaters = []
        self.msg_left = 0.0
        self.facing = 0.0
        self.hurt_flash = 0.0
        self.respawn_timer = 0.0
        self.last_cell = None
        self.time = 0.0
        self.px, self.py = 0.0, 0.0
        self._build_scene_base()
        self._build_hud()
        self._bind_keys()
        self.taskMgr.add(self._task, "update")

        if shot:
            loaded = self.slots.load(slot)
            self.start_play(loaded or S.new_state(), start_pos)
        elif new_game:
            self.start_intro()

    # ---- Montagem ----
    def _build_scene_base(self):
        self.setBackgroundColor(0.03, 0.04, 0.06, 1)
        amb = AmbientLight("amb")
        amb.setColor((0.45, 0.5, 0.55, 1))
        self.render.setLight(self.render.attachNewNode(amb))
        sun = DirectionalLight("sun")
        sun.setColor((0.9, 0.95, 1, 1))
        sun_np = self.render.attachNewNode(sun)
        sun_np.setHpr(25, -55, 0)
        self.render.setLight(sun_np)
        self.sky = None
        self._set_sky("#0b0f14", "#122410")

        mesh = SC.Mesh()
        mesh.box(-.22, -.22, 0, .22, .22, .9, (0.2, 0.9, 1, 1))
        mesh.box(-.14, .23, .6, .14, .24, .75, (0.05, 0.1, 0.15, 1))  # visor na frente (+y)
        self.player = mesh.node("bit")
        self.player.reparentTo(self.render)
        self.player_shadow = SC.blob_shadow(self.render, 0.32)
        self.player.hide()
        self.player_shadow.hide()

        self.vigia = SC.vigia_mesh()
        self.vigia.reparentTo(self.render)
        self.vigia.hide()
        self.hub_angle = 0.0

    def _set_sky(self, top, bottom):
        if self.sky is not None:
            self.sky.removeNode()
        self.sky = SC.sky_backdrop(top, bottom)
        self.sky.reparentTo(self.camera)

    def _build_hud(self):
        ar = self.getAspectRatio()
        self.hud = OnscreenText(text="", pos=(-ar + 0.05, 0.9), scale=0.045, align=TextNode.ALeft,
                                fg=(0.9, 1, 0.9, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.msg = OnscreenText(text="", pos=(0, 0.72), scale=0.06, align=TextNode.ACenter,
                                fg=(1, 0.95, 0.6, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.prompt = OnscreenText(text="", pos=(0, -0.62), scale=0.05, align=TextNode.ACenter,
                                   fg=(0.7, 1, 1, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.floor_hint = OnscreenText(text="", pos=(-ar + 0.05, -0.93), scale=0.035, align=TextNode.ALeft,
                                       fg=(0.7, 0.8, 0.75, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.minimap_img = OnscreenImage(image=SC.minimap_image([" " * 25] * 25),
                                         pos=(ar - 0.3, 0, 0.45), scale=0.26)
        self.minimap_img.setTransparency(TransparencyAttrib.MAlpha)
        self.minimap_img.hide()
        self.flash = SC.fullscreen_card((0.9, 0.1, 0.1), 0.0)
        self.flash.reparentTo(self.render2d)
        self.flash.hide()
        # Painel de diálogo e de menu (fundo escuro translúcido)
        self.panel = SC.fullscreen_card((0.02, 0.04, 0.05), 0.82)
        self.panel.reparentTo(self.render2d)
        self.panel.hide()
        self.dlg_speaker = OnscreenText(text="", pos=(-ar + 0.12, -0.42), scale=0.05, align=TextNode.ALeft,
                                        fg=(1, 0.9, 0.5, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.dlg_text = OnscreenText(text="", pos=(-ar + 0.12, -0.52), scale=0.05, align=TextNode.ALeft,
                                     fg=(1, 1, 1, 1), shadow=(0, 0, 0, 1), mayChange=True, wordwrap=38)
        self.dlg_speaker.hide()
        self.dlg_text.hide()
        self.menu_text = OnscreenText(text="", pos=(-ar + 0.12, 0.8), scale=0.045, align=TextNode.ALeft,
                                      fg=(0.95, 1, 0.95, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.menu_text.hide()
        self.title_big = OnscreenText(text="ANEL ZERO", pos=(-ar + 0.12, 0.45), scale=0.2, align=TextNode.ALeft,
                                      fg=(0.6, 1, 0.95, 1), shadow=(0, 0.3, 0.3, 1), mayChange=True)
        self.title_sub = OnscreenText(text="Dentro do Processador", pos=(-ar + 0.14, 0.25), scale=0.07,
                                      align=TextNode.ALeft, fg=(0.8, 0.9, 0.9, 1), mayChange=True)
        self.title_menu = OnscreenText(text="", pos=(-ar + 0.14, -0.2), scale=0.07, align=TextNode.ALeft,
                                       fg=(1, 1, 1, 1), shadow=(0, 0, 0, 1), mayChange=True)
        self.title_hint = OnscreenText(text="Setas escolhem | Enter confirma", pos=(-ar + 0.14, -0.85), scale=0.04,
                                       align=TextNode.ALeft, fg=(0.6, 0.7, 0.7, 1), mayChange=True)
        self._show_title(True)
        self._refresh_title()

    def _show_title(self, on):
        for node in (self.title_big, self.title_sub, self.title_menu, self.title_hint):
            if on:
                node.show()
            else:
                node.hide()
        if on:
            self.vigia.show()
        else:
            self.vigia.hide()

    def _bind_keys(self):
        names = ["w", "a", "s", "d", "arrow_up", "arrow_down", "arrow_left", "arrow_right",
                 "e", "f", "v", "tab", "escape", "enter", "space", "f5", "1", "2", "3"]
        for name in names:
            self.accept(name, self.key_event, [name, True])
            self.accept(name + "-up", self.key_event, [name, False])

    # ---- Entrada ----
    def key_event(self, name, down):
        if name in MOVE_KEYS:
            self.keys[MOVE_KEYS[name]] = down
        if not down:
            return
        if self.mode == "title":
            self._title_key(name)
        elif self.mode in ("intro", "dialog"):
            self._dialog_key(name)
        elif self.mode == "menu":
            self._menu_key(name)
        elif self.mode == "play":
            self._play_key(name)

    def title_options(self):
        opts = ["Novo jogo"]
        if self.slots.info(self.slot):
            opts.append("Continuar")
        opts.append("Sair")
        return opts

    def _title_key(self, name):
        options = self.title_options()
        if name in ("arrow_up", "w"):
            self.title_index = (self.title_index - 1) % len(options)
        elif name in ("arrow_down", "s"):
            self.title_index = (self.title_index + 1) % len(options)
        elif name in ("enter", "space", "e"):
            choice = options[self.title_index]
            if choice == "Novo jogo":
                self.start_intro()
            elif choice == "Continuar":
                self.start_play(self.slots.load(self.slot) or S.new_state())
            elif choice == "Sair":
                self.userExit()
        elif name == "escape":
            self.userExit()
        self._refresh_title()

    def _refresh_title(self):
        opts = self.title_options()
        self.title_index = min(self.title_index, len(opts) - 1)
        self.title_menu.setText("\n".join(("> " if i == self.title_index else "  ") + o
                                          for i, o in enumerate(opts)))

    def _dialog_key(self, name):
        if name in ("e", "enter", "space"):
            self.dialog.advance()
            if self.dialog.closed:
                self._end_dialog()
        elif name in CHOICE_KEYS and self.dialog.waiting_choice():
            if self.dialog.choose(CHOICE_KEYS[name]) is not None:
                self._end_dialog()

    def _menu_key(self, name):
        if name == "escape":
            self.close_menu()
            return
        if name == "tab" or name in ("arrow_right", "d"):
            self.menu.next_tab(1)
        elif name in ("arrow_left", "a"):
            self.menu.next_tab(-1)
        elif name in ("arrow_up", "w"):
            self.menu.move(-1)
        elif name in ("arrow_down", "s"):
            self.menu.move(1)
        elif name == "enter":
            msg = self.menu.activate()
            if msg.startswith("VIAGEM:"):
                self.fast_travel(msg.split(":", 1)[1])
                return
        elif name == "v":
            self.menu.sell()
        self._refresh_menu()

    def _play_key(self, name):
        if name == "e":
            self.do_interact()
        elif name == "f":
            self.do_attack()
        elif name == "tab":
            self.open_menu()
        elif name == "f5":
            self.do_save()
        elif name == "escape":
            self.quit_game()

    # ---- Modos ----
    def start_intro(self):
        self.state = S.new_state()
        self.mode = "intro"
        self._show_title(False)
        self.vigia.show()
        self.player.hide()
        self.player_shadow.hide()
        self.open_dialog(C.INTRO_TEXT, title="Abertura", color="#7dfff0",
                         after=lambda _value=None: self.start_play(self.state, None))

    def start_play(self, state, pos=None):
        self.state = state
        self.mode = "play"
        self._show_title(False)
        self.player.show()
        self.player_shadow.show()
        self.minimap_img.show()
        self.load_zone(self.state.zone, pos if pos is not None else self._saved_pos())

    def _saved_pos(self):
        p = self.state.pos
        return tuple(p) if p else None

    def open_dialog(self, lines, title=None, color=None, choices=None, after=None):
        self.dialog = D.Dialog(lines, choices=choices, title=title, color=color)
        self.dialog_after = after
        if self.mode == "play":
            self.mode = "dialog"
        self.panel.show()
        self.dlg_speaker.show()
        self.dlg_text.show()
        self.prompt.setText("")
        self._refresh_dialog()

    def _end_dialog(self):
        after = self.dialog_after
        value = self.dialog.chosen
        self.dialog = None
        self.dialog_after = None
        self.panel.hide()
        self.dlg_speaker.hide()
        self.dlg_text.hide()
        if self.mode == "dialog":
            self.mode = "play"
        if after is not None:
            after(value)
        self._announce(self.state.check_quests())

    def open_menu(self):
        if self.mode != "play":
            return
        self.menu = M.Menu(self.state, self.zone.id)
        self.mode = "menu"
        self.menu_text.show()
        self.panel.setScale(0.66, 1, 0.92)
        self.panel.setPos(-self.getAspectRatio() + 0.66, 0, 0)
        self.panel.show()
        self._refresh_menu()

    def close_menu(self):
        self.mode = "play"
        self.menu = None
        self.menu_text.hide()
        self.panel.hide()
        self.panel.setScale(self.getAspectRatio(), 1, 0.34)
        self.panel.setPos(0, 0, -0.66)

    def _refresh_menu(self):
        if self.menu is None:
            return
        tabs = " | ".join(("[" + t + "]") if i == self.menu.tab else t for i, t in enumerate(M.TABS))
        lines = [tabs, ""]
        for i, row in enumerate(self.menu.rows()):
            mark = ">" if i == self.menu.cursor[self.menu.tab] else " "
            lines.append(f"{mark} {row['label']}   {row['detail']}")
        if self.menu.message:
            lines += ["", self.menu.message]
        lines += ["", "Tab ou setas trocam aba | Enter usar | V vender | Esc fechar"]
        self.menu_text.setText("\n".join(lines))

    def fast_travel(self, zid):
        self.close_menu()
        if zid == self.zone.id:
            self.say("Você já está aqui.")
            return
        self.load_zone(zid, None)
        self.say(f"Viagem para {C.ZONES[zid].get('name', zid)}.", 2.5)

    # ---- Zonas ----
    def load_zone(self, zid, pos=None):
        if self.zone_root is not None:
            self.zone_root.removeNode()
        self.zone = W.load(zid)
        self.state.zone = zid
        th = self.zone.theme
        self._set_sky(th.get("sky", "#0b0f14"), th.get("fog", "#0d1a09"))
        self.setBackgroundColor(*SC.hex_rgba(th.get("fog", "#0d1a09"))[:3], 1)
        self.zone_root = self.render.attachNewNode("zone")
        SC.build_zone_mesh(self.zone).reparentTo(self.zone_root)
        if pos is None:
            pos = self.zone.spawn()
        self.px, self.py = float(pos[0]), float(pos[1])
        self.fight = rt.Fight(self.zone, self.state)
        self.roamer_nodes = {}
        self.particles = []
        self._build_entities()
        self.last_cell = None
        W.reveal(self.zone, self.state, self.px, self.py, radius=4)
        self.say(self.zone.name, 2.5)

    def _build_entities(self):
        self.pickups = {}
        self.interactables = []
        for c, r, m in self.zone.pickups():
            key = f"pk_{self.zone.id}_{c}_{r}"
            if self.state.has_flag(key):
                continue
            mesh = SC.Mesh()
            mesh.box(-.14, -.14, 0, .14, .14, .32, (1, 0.85, 0.25, 1))
            node = mesh.node("pickup")
            node.reparentTo(self.zone_root)
            node.setPos(c, r, 0.1)
            SC.blob_shadow(node, 0.2)
            self.pickups[(c, r)] = (node, key, m.get("item"))
        for ch, m in self.zone.markers_def.items():
            kind = m.get("type")
            for c, r in self.zone.cells_of(ch):
                if kind == "npc" and m.get("id") in C.NPCS:
                    node = SC.npc_mesh(C.NPCS[m["id"]]["color"])
                    self._place(node, c, r)
                    self.interactables.append({"kind": "npc", "c": c, "r": r, "m": m, "node": node})
                elif kind == "chest":
                    cid = m.get("id") or f"x_{self.zone.id}_{c}_{r}"
                    opened = self.state.has_flag(f"chest_{cid}")
                    node = SC.chest_mesh("#ffd166", opened)
                    self._place(node, c, r)
                    self.interactables.append({"kind": "chest", "c": c, "r": r, "m": dict(m, id=cid),
                                               "node": node, "opened": opened})
                elif kind == "repair":
                    done = self.state.has_flag(f"rep_{m.get('id')}")
                    node = SC.repair_mesh("#b6ff6a" if not done else "#445544")
                    self._place(node, c, r)
                    self.interactables.append({"kind": "repair", "c": c, "r": r, "m": m, "node": node,
                                               "done": done})
        for rm in self.fight.roamers:
            self._add_roamer_node(rm)

    def _place(self, node, c, r):
        node.reparentTo(self.zone_root)
        node.setPos(c, r, 0)
        SC.blob_shadow(node, 0.35)

    def _add_roamer_node(self, rm):
        root = self.zone_root.attachNewNode("roamer")
        body, _dark = SC.roamer_mesh(rm.color, rm.scale)
        body.reparentTo(root)
        SC.blob_shadow(root, 0.35 * rm.scale)
        bar = SC.hp_bar(root, 1.25 * rm.scale, 1.0)
        self.roamer_nodes[id(rm)] = (root, bar)

    # ---- Ações ----
    def say(self, text, seconds=2.2):
        self.msg.setText(text)
        self.msg_left = seconds

    def _announce(self, done):
        for q in done:
            self.say(f"Missão concluída: {C.QUESTS[q['id']]['title']}", 3.5)

    def nearest_interactable(self):
        best, best_d = None, INTERACT_RANGE
        for it in self.interactables:
            d = math.hypot(it["c"] - self.px, it["r"] - self.py)
            if d <= best_d:
                best, best_d = it, d
        return best

    def do_interact(self):
        if self.mode != "play":
            return
        it = self.nearest_interactable()
        if it is None:
            self.say("Nada por perto.", 1.5)
            return
        if it["kind"] == "npc":
            res = self.state.talk(it["m"]["id"])
            if res is None:
                self.say(f"{C.NPCS[it['m']['id']]['name']} não tem nada a dizer agora.", 2.0)
            else:
                self.open_dialog(res["lines"], title=res["name"], color=res["color"])
                self._announce(self.state.check_quests())
        elif it["kind"] == "chest":
            got = self.state.open_chest(it["m"]["id"], self.zone.id, it["c"], it["r"])
            if got is None:
                self.say("O baú já foi aberto.", 1.5)
            else:
                names = ", ".join(f"{C.ITEMS.get(i, {}).get('name', i)} x{n}" for i, n in got)
                self.say(f"Baú aberto: {names}", 3.0)
                it["node"].removeNode()
                it["node"] = SC.chest_mesh("#ffd166", True)
                self._place(it["node"], it["c"], it["r"])
                it["opened"] = True
                self._announce(self.state.check_quests())
        elif it["kind"] == "repair":
            if it["done"]:
                self.say("Esta trilha já está reparada.", 1.5)
            else:
                self.state.set_flag(f"rep_{it['m'].get('id')}")
                self.state.bump(f"repair_{self.zone.id}", 1)
                it["done"] = True
                self.say("Trilha reparada.", 2.0)
                self._announce(self.state.check_quests())

    def do_attack(self):
        if self.mode != "play" or self.fight is None:
            return
        events = self.fight.swing(self.px, self.py, self.facing)
        if events:
            self._handle_fight_events(events)

    def _handle_fight_events(self, events):
        for ev in events:
            if ev[0] == "hit":
                _, rm, dmg = ev
                self._burst((rm.x, rm.z, 0.6), rm.color, 8)
                self._float(f"-{dmg}", (rm.x, rm.z, 1.4), (1, 0.95, 0.4, 1))
            elif ev[0] == "kill":
                _, rm = ev
                self._burst((rm.x, rm.z, 0.5), rm.color, 22)
                self.say(f"{rm.name} derrotado!", 2.0)
                self._announce(self.state.check_quests())
            elif ev[0] == "hurt":
                _, rm, dmg = ev
                self.hurt_flash = 0.35
                self._float(f"-{dmg}", (self.px, self.py, 1.4), (1, 0.3, 0.3, 1))
            elif ev[0] == "defeat":
                self.state.hp = max(1, self.state.max_hp() // 2)
                self.say("Você caiu. Voltou ao início da zona.", 3.0)
                sx, sz = self.zone.spawn()
                self.px, self.py = float(sx), float(sz)
                self.fight.iframes = 2.0

    def _burst(self, pos, color, count):
        self.particles += [[np, vel, life, life] for np, vel, life in SC.burst(self.render, pos, color, count)]

    def _float(self, text, pos, color):
        t = OnscreenText(text=text, pos=(0, 0), scale=0.06, align=TextNode.ACenter, fg=color,
                         shadow=(0, 0, 0, 1), mayChange=True)
        self.floaters.append([t, pos, 0.9])

    def _project(self, pos):
        p3 = self.cam.getRelativePoint(self.render, Point3(*pos))
        p2 = Point2()
        if not self.camLens.project(p3, p2):
            return None
        return (p2.x * self.getAspectRatio(), p2.y)

    def _collect(self):
        cell = (round(self.px), round(self.py))
        hit = self.pickups.get(cell)
        if not hit:
            return
        if abs(self.px - cell[0]) > PICKUP_RANGE or abs(self.py - cell[1]) > PICKUP_RANGE:
            return
        node, key, item = hit
        self.state.set_flag(key)
        got = self.state.add_item(item, 1) if item else 0
        node.removeNode()
        del self.pickups[cell]
        name = C.ITEMS.get(item, {}).get("name", item) if item else "item"
        self.say(f"+ {name}" if got else "Nada aqui.", 1.6)
        self._announce(self.state.check_quests())

    def _portal(self):
        cell = (round(self.px), round(self.py))
        for c, r, m in self.zone.portals():
            if (c, r) == cell and m.get("to") in C.ZONES:
                dest = m["to"]
                self.load_zone(dest, W.load(dest).arrival_from(self.zone.id))
                return

    def do_save(self):
        self.state.pos = [round(self.px, 3), round(self.py, 3)]
        self.slots.save(self.slot, self.state)
        self.say("Jogo salvo.", 1.5)
        return True

    def quit_game(self):
        if self.mode == "play":
            self.do_save()
        self.userExit()

    # ---- Quadro ----
    def step(self, dt):
        self.time += dt
        if self.mode == "title":
            self._update_hub(dt)
            return
        if self.mode in ("intro", "dialog"):
            if self.dialog is not None:
                self.dialog.update(dt)
                self._refresh_dialog()
            if self.mode == "intro":
                self._update_hub(dt)
            return
        if self.mode == "menu":
            return
        self._update_play(dt)

    def _update_hub(self, dt):
        self.hub_angle += dt * 18
        a = math.radians(self.hub_angle)
        self.camera.setPos(math.cos(a) * 5.0, math.sin(a) * 5.0, 2.4)
        self.camera.lookAt(0, 0, 1.0)
        self.vigia.setH(self.hub_angle * 0.5)

    def _refresh_dialog(self):
        d = self.dialog
        self.dlg_speaker.setText(d.line["s"])
        self.dlg_speaker.setFg((*SC.hex_rgba(d.color or "#ffe08a")[:3], 1))
        text = d.shown_text()
        if d.waiting_choice():
            text += "\n" + "\n".join(f"{i + 1}) {c['label']}" for i, c in enumerate(d.choices))
        elif d.typer.done():
            text += "   [E]"
        self.dlg_text.setText(text)

    def _update_play(self, dt):
        dx = self.keys["d"] - self.keys["a"]
        dy = self.keys["w"] - self.keys["s"]
        if dx or dy:
            n = math.hypot(dx, dy)
            step = SPEED * dt
            self.px, self.py = W.move(self.zone, self.px, self.py, dx / n * step, dy / n * step)
            self.facing = math.atan2(dx, dy)
        self.player.setPos(self.px, self.py, 0)
        self.player.setH(math.degrees(math.atan2(-math.sin(self.facing), math.cos(self.facing))))
        self.player_shadow.setPos(self.px, self.py, 0)

        cell = (round(self.px), round(self.py))
        if cell != self.last_cell:
            self.last_cell = cell
            W.reveal(self.zone, self.state, self.px, self.py, radius=4)
            self._refresh_minimap()
        self._collect()
        self._portal()

        for node, _key, _item in self.pickups.values():
            node.setH(self.time * 120)
        events = self.fight.step(self.px, self.py, dt)
        if events:
            self._handle_fight_events(events)
        self._sync_roamers()
        if not self.fight.alive_roamers():
            self.respawn_timer += dt
            if self.respawn_timer >= ROAMER_RESPAWN_S:
                self.respawn_timer = 0.0
                self.fight.respawn_roamers()
                for rm in self.fight.roamers:
                    self._add_roamer_node(rm)

        self._update_fx(dt)
        self._update_prompt()
        self.camera.setPos(self.px, self.py - 6.0, 6.5)
        self.camera.lookAt(self.px, self.py + 0.5, 0.6)
        self._update_hud(dt)

    def _sync_roamers(self):
        for rm in self.fight.roamers:
            entry = self.roamer_nodes.get(id(rm))
            if entry is None:
                continue
            root, bar = entry
            if not rm.alive:
                root.hide()
                continue
            root.setPos(rm.x, rm.z, 0)
            bar.setScale(max(0.01, rm.hp / rm.max_hp), 1, 1)

    def _update_fx(self, dt):
        alive = []
        for p in self.particles:
            np, vel, life, total = p
            life -= dt
            if life <= 0:
                np.removeNode()
                continue
            vz = vel[2] - 6.0 * dt
            p[1] = (vel[0], vel[1], vz)
            p[2] = life
            np.setPos(np.getX() + vel[0] * dt, np.getY() + vel[1] * dt, np.getZ() + vz * dt)
            np.setScale(max(0.2, life / total))
            alive.append(p)
        self.particles = alive

        keep = []
        for f in self.floaters:
            t, pos, life = f
            life -= dt
            pos = (pos[0], pos[1], pos[2] + dt * 1.2)
            f[1] = pos
            f[2] = life
            if life <= 0:
                t.destroy()
                continue
            scr = self._project(pos)
            if scr is None:
                t.hide()
            else:
                t.show()
                t.setPos(scr[0], scr[1])
            keep.append(f)
        self.floaters = keep

        self.hurt_flash = max(0.0, self.hurt_flash - dt)
        if self.hurt_flash > 0:
            self.flash.setColor(0.9, 0.1, 0.1, self.hurt_flash * 0.8)
            self.flash.show()
        else:
            self.flash.hide()

    def _update_prompt(self):
        it = self.nearest_interactable()
        if it is None:
            self.prompt.setText("")
            return
        if it["kind"] == "npc":
            label = f"Falar com {C.NPCS[it['m']['id']]['name']}"
        elif it["kind"] == "chest":
            label = "Baú já aberto" if it.get("opened") else "Abrir baú"
        else:
            label = "Trilha já reparada" if it["done"] else "Reparar trilha"
        self.prompt.setText(f"[E] {label}")

    def _refresh_minimap(self):
        rows = W.minimap_grid(self.zone, self.state, self.px, self.py, radius=12)
        self.minimap_img.setImage(SC.minimap_image(rows, size=6))

    def _update_hud(self, dt):
        st = self.state
        self.hud.setText(
            f"{self.zone.name}\n"
            f"Nível {st.level}   HP {st.hp}/{st.max_hp()}   EN {st.en}/{st.max_en()}   Ouro {st.gold}")
        self.floor_hint.setText("WASD mover | F atacar | E interagir | Tab menu | F5 salvar | Esc sair")
        if self.msg_left > 0:
            self.msg_left -= dt
            if self.msg_left <= 0:
                self.msg.setText("")

    def _task(self, task):
        dt = min(ClockObject.getGlobalClock().getDt(), 0.05)
        self.step(dt)
        self.frame_count += 1
        if self.shot and self.frame_count >= self.shot_frames:
            self.graphicsEngine.renderFrame()
            self.win.saveScreenshot(self.shot)
            self.userExit()
        return task.cont


def run(slot=1, shot=None, frames=40, new_game=False, start_pos=None):
    game = Game(slot=slot, shot=shot, frames=frames, new_game=new_game, start_pos=start_pos)
    game.run()

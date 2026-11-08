"""Cliente 3D em Panda3D: título, abertura com o Vigia, exploração, diálogos, batalha por turnos,
combate em tempo real, reparo, loja, bancada, menus e ajustes.

Controles no jogo:  WASD ou setas mover | E falar, abrir baú, reparar, enfrentar chefe ou usar bancada/loja
                    F atacar (tempo real) | Tab menu | O ajustes | F5 salvar | Esc salvar e sair
Diálogos: E avança (a primeira vez completa o texto); 1 a 3 escolhem quando houver escolhas.
Batalha: setas ou 1 a 9 escolhem, Enter confirma. Reparo: setas movem, Enter gira, H difícil, P pausa, Esc cancela.
Loja: setas, Enter compra/vende/cria, Tab troca modo, Esc fecha. Menus: Tab troca aba, V vende, Esc fecha.
Ajustes: setas escolhem e mudam, Enter alterna, Esc salva e volta.

--shot ARQUIVO: pula o título, renderiza alguns quadros, salva uma captura e encerra (verificação).
"""

import math
import random
from pathlib import Path

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

from . import audio as A  # noqa: E402
from . import battle as B  # noqa: E402
from . import combat as K  # noqa: E402
from . import content as C  # noqa: E402
from . import dialog as D  # noqa: E402
from . import icon_render as IR  # noqa: E402
from . import layers as LY  # noqa: E402
from . import menu as M  # noqa: E402
from . import panels as P  # noqa: E402
from . import repair as R  # noqa: E402
from . import rt  # noqa: E402
from . import scene as SC  # noqa: E402
from . import settings as T  # noqa: E402
from . import textscale  # noqa: E402
from . import shop as SH  # noqa: E402
from . import state as S  # noqa: E402
from . import world as W  # noqa: E402

SPEED = 4.2
INTRO_DOLLY_S = 6.0
CAM_BACK = 6.0      # distância atrás do Bit (medida: deixa o céu com degradê no topo da tela)
CAM_HEIGHT = 2.0   # altura da câmera
CAM_AIM_AHEAD = 4.0  # o ponto de mira fica à frente do Bit
CAM_AIM_HEIGHT = 0.9
INTRO_FAR = 6.0
INTRO_NEAR = 4.4
INTRO_BIT_X = 1.3  # posição do Bit ao lado do Vigia (que fica na origem)
INTERACT_RANGE = 1.3
PICKUP_RANGE = 0.7
ROAMER_RESPAWN_S = 30.0
STEP_DISTANCE = 0.9
FADE_TIME = 0.8
REPAIR_TIME_LIMIT = 120
MOVE_KEYS = {"w": "w", "arrow_up": "w", "s": "s", "arrow_down": "s",
             "a": "a", "arrow_left": "a", "d": "d", "arrow_right": "d"}
CHOICE_KEYS = {"1": 1, "2": 2, "3": 3}
# Legendas sonoras: texto curto mostrado quando o efeito toca (só com a opção Legendas ligada)
SOUND_CAPTIONS = {"golpe": "[golpe]", "pesado": "[golpe pesado]", "dano": "[dano]", "coleta": "[item]",
                  "reparo": "[reparo]", "cura": "[cura]", "vitoria": "[vitória]", "derrota": "[derrota]"}
DIGIT_KEYS = {str(i): i for i in range(1, 10)}
CONFIRM_KEYS = ("enter", "space", "e")
BOSS_HALF_SIZE = 0.5


def _cmd_sound(cmd):
    """Efeito sonoro de um comando de batalha."""
    if cmd == "atacar":
        return "golpe"
    if cmd.startswith("skill:"):
        sid = cmd.split(":", 1)[1]
        skill = next((s for s in C.SKILLS if s["id"] == sid), {})
        return "pesado" if skill.get("mult", 1) >= 2 else "golpe"
    if cmd.startswith("item:"):
        return "cura"
    return "ui"


class Game(ShowBase):
    def __init__(self, slot=1, shot=None, frames=40, new_game=False, start_pos=None):
        super().__init__()
        self.disableMouse()
        self.camLens.setFov(68)
        self.settings = T.Settings().load()
        self.tm = self.settings.get("text_scale")
        textscale.apply(self.tm)
        self.sfx = A.SoundBank(self.loader, self.settings)
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
        self.battle = None
        self.battle_cursor = 0
        self.battle_target = None
        self.repair = None
        self.repair_target = None
        self.shop = None
        self.shop_target = None
        self.settings_cursor = 0
        self.settings_return = "title"
        self.fade = None
        self.pickups = {}
        self.interactables = []
        self.roamer_nodes = {}
        self.particles = []
        self.floaters = []
        self.msg_left = 0.0
        self.facing = 0.0
        self.hurt_flash = 0.0
        self.respawn_timer = 0.0
        self.step_dist = 0.0
        self.last_cell = None
        self.time = 0.0
        self.hud_on = None
        self.px, self.py = 0.0, 0.0
        self._build_scene_base()
        self._build_hud()
        self._build_screens()
        self._apply_shadows()
        try:
            self.icons = IR.IconRenderer(self)
        except Exception:  # sem OpenGL: o jogo segue só com texto
            self.icons = None
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
        amb.setColor((0.42, 0.47, 0.52, 1))
        self.render.setLight(self.render.attachNewNode(amb))
        self.sun = DirectionalLight("sun")
        self.sun.setColor((0.95, 0.97, 1, 1))
        self.sun_np = self.render.attachNewNode(self.sun)
        self.sun_np.setHpr(25, -55, 0)
        self.render.setLight(self.sun_np)
        self.sky = None
        self._set_sky("#0b0f14", "#122410")

        from . import assets as AS
        bit = AS.load_model(self.loader, "bit")
        if bit is not None:  # modelo do Blender, se existir
            self.player = bit
            self.player.reparentTo(self.render)
        else:  # fallback procedural
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

    def _apply_shadows(self):
        """Sombra projetada da luz direcional (um único mapa de sombra). Desligada nos ajustes ou sem suporte."""
        if self.settings.get("shadows"):
            self.sun.setShadowCaster(True, 1024, 1024)
            lens = self.sun.getLens()
            lens.setFilmSize(34, 34)
            lens.setNearFar(1, 60)
            self.render.setShaderAuto()
        else:
            self.sun.setShadowCaster(False)
            self.render.setShaderOff()

    def _set_sky(self, top, bottom):
        if self.sky is not None:
            self.sky.removeNode()
        self.sky = SC.sky_backdrop(top, bottom)
        self.sky.reparentTo(self.camera)

    def _ot(self, text, x, y, scale, align=TextNode.ALeft, color=(1, 1, 1, 1), wordwrap=None, parent=None):
        """Texto de tela no tamanho escolhido nos ajustes."""
        kw = {"text": text, "pos": (x, y), "scale": scale, "align": align, "fg": color,
              "shadow": (0, 0, 0, 1), "mayChange": True}
        if wordwrap:
            kw["wordwrap"] = wordwrap
        if parent is not None:
            kw["parent"] = parent
        node = OnscreenText(**kw)
        textscale.register(node, scale)  # tamanho do texto ao vivo (ajustes)
        return node

    def _build_hud(self):
        ar = self.getAspectRatio()
        self.hud = self._ot("", -ar + 0.05, 0.9, 0.045, color=(0.9, 1, 0.9, 1))
        self.msg = self._ot("", 0, 0.72, 0.06, align=TextNode.ACenter, color=(1, 0.95, 0.6, 1))
        self.prompt = self._ot("", 0, -0.62, 0.05, align=TextNode.ACenter, color=(0.7, 1, 1, 1))
        self.floor_hint = self._ot("", -ar + 0.05, -0.93, 0.035, color=(0.7, 0.8, 0.75, 1))
        self.minimap_img = OnscreenImage(image=SC.minimap_image([" " * 25] * 25),
                                         pos=(ar - 0.3, 0, 0.45), scale=0.26)
        self.minimap_img.setTransparency(TransparencyAttrib.MAlpha)
        self.minimap_img.hide()
        self.flash = SC.fullscreen_card((0.9, 0.1, 0.1), 0.0)
        self.flash.reparentTo(self.render2d)
        self.flash.hide()
        # Faixas de cinema (abertura) e cortina preta (transições)
        self.letter_top = SC.fullscreen_card((0, 0, 0), 1.0)
        self.letter_top.reparentTo(self.render2d)
        self.letter_top.setPos(0, 0, 0.84)
        self.letter_top.setScale(ar, 1, 0.16)
        self.letter_top.hide()
        self.fade_card = SC.fullscreen_card((0, 0, 0), 0.0)
        self.fade_card.reparentTo(self.render2d)
        self.fade_card.setBin("fixed", 100)
        self.fade_card.hide()
        # Painel de diálogo (faixa inferior) e de menu (coluna da esquerda)
        self.panel = SC.fullscreen_card((0.02, 0.04, 0.05), 0.82)
        self.panel.reparentTo(self.render2d)
        self.panel.hide()
        self.dlg_speaker = self._ot("", -ar + 0.12, -0.42, 0.05, color=(1, 0.9, 0.5, 1))
        self.dlg_text = self._ot("", -ar + 0.12, -0.52, 0.05, color=(1, 1, 1, 1), wordwrap=38)
        self.dlg_speaker.hide()
        self.dlg_text.hide()
        self.menu_text = self._ot("", -ar + 0.12, 0.8, 0.045, color=(0.95, 1, 0.95, 1))
        self.menu_text.hide()
        self.menu_list = P.ListView(-ar + 0.12, 0.66, row_h=0.11, icon=0.05, scale=0.042, width=44,
                                    scale_mult=self.tm)
        self.menu_list.hide()
        self.menu_preview = P.IconSlot(-0.3, 0.5, 0.2)
        self.menu_detail = self._ot("", -0.62, 0.12, 0.04, color=(0.9, 1, 0.95, 1), wordwrap=34)
        self.menu_detail.hide()
        self.menu_footer = self._ot("", -ar + 0.12, -0.86, 0.04, color=(0.7, 0.85, 0.85, 1), wordwrap=60)
        self.menu_footer.hide()
        self.icons = None
        self.title_big = self._ot("ANEL ZERO", -ar + 0.12, 0.45, 0.2, color=(0.6, 1, 0.95, 1))
        self.title_sub = self._ot("Dentro do Processador", -ar + 0.14, 0.25, 0.07, color=(0.8, 0.9, 0.9, 1))
        self.title_menu = self._ot("", -ar + 0.14, -0.2, 0.07, color=(1, 1, 1, 1))
        self.title_hint = self._ot("Setas escolhem | Enter confirma", -ar + 0.14, -0.85, 0.04,
                                   color=(0.6, 0.7, 0.7, 1))
        self._show_title(True)
        self._refresh_title()

    def _build_screens(self):
        ar = self.getAspectRatio()
        self.layers_screen = P.LayersScreen(self.render2d, ar, self.tm)
        self.layers_screen.hide()
        self.layer_index = 0
        self.layers_return = "title"
        self.battle_screen = P.BattleScreen(self.render2d, ar, self.tm)
        self.repair_screen = P.RepairScreen(self.render2d, ar, self.tm)
        self.shop_screen = P.ShopScreen(self.render2d, ar, self.tm)
        self.settings_screen = P.SettingsScreen(self.render2d, ar, self.tm)
        for screen in (self.battle_screen, self.repair_screen, self.shop_screen, self.settings_screen):
            screen.hide()

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
        self.accept("mouse1", self.on_mouse_click)
        names = ["w", "a", "s", "d", "arrow_up", "arrow_down", "arrow_left", "arrow_right",
                 "e", "f", "v", "tab", "escape", "enter", "space", "f5", "o", "h", "p", "m"]
        names += list(DIGIT_KEYS)
        for name in names:
            self.accept(name, self.key_event, [name, True])
            self.accept(name + "-up", self.key_event, [name, False])

    # ---- Entrada ----
    def key_event(self, name, down):
        if name in MOVE_KEYS:
            self.keys[MOVE_KEYS[name]] = down
        if not down or self.fade is not None:
            return
        handler = {
            "title": self._title_key,
            "intro": self._dialog_key,
            "dialog": self._dialog_key,
            "menu": self._menu_key,
            "play": self._play_key,
            "battle": self._battle_key,
            "repair": self._repair_key,
            "shop": self._shop_key,
            "settings": self._settings_key,
            "layers": self._layers_key,
        }.get(self.mode)
        if handler is not None:
            handler(name)

    def title_options(self):
        opts = ["Novo jogo"]
        if self.slots.info(self.slot):
            opts.append("Continuar")
        opts += ["Camadas", "Ajustes", "Sair"]
        return opts

    def _title_key(self, name):
        options = self.title_options()
        if name in ("arrow_up", "w"):
            self.title_index = (self.title_index - 1) % len(options)
            self.sound("ui")
        elif name in ("arrow_down", "s"):
            self.title_index = (self.title_index + 1) % len(options)
            self.sound("ui")
        elif name in CONFIRM_KEYS:
            choice = options[self.title_index]
            if choice == "Novo jogo":
                self.start_intro()
            elif choice == "Continuar":
                self.start_play(self.slots.load(self.slot) or S.new_state())
            elif choice == "Ajustes":
                self.open_settings("title")
                return
            elif choice == "Camadas":
                self.open_layers("title")
                return
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
        if name in CONFIRM_KEYS:
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
            self.sound("coleta" if msg and not msg.startswith(("VIAGEM", "FERRAMENTA")) else "ui")
            if msg.startswith("VIAGEM:"):
                self.fast_travel(msg.split(":", 1)[1])
                return
            if msg.startswith("FERRAMENTA:"):
                self.use_tool(msg.split(":", 1)[1])
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
        elif name == "o":
            self.open_settings("play")
        elif name == "m":
            self.open_layers("play")
        elif name == "f5":
            self.do_save()
        elif name == "escape":
            self.quit_game()

    def _battle_key(self, name):
        b = self.battle
        if b is None:
            return
        cmds = b.commands()
        if b.over:
            if name in CONFIRM_KEYS:
                self._end_battle()
            return
        if name in ("arrow_up", "w"):
            self.battle_cursor = (self.battle_cursor - 1) % max(1, len(cmds))
            self.sound("ui")
        elif name in ("arrow_down", "s"):
            self.battle_cursor = (self.battle_cursor + 1) % max(1, len(cmds))
            self.sound("ui")
        elif name in CONFIRM_KEYS:
            self._battle_run(self.battle_cursor)
        elif name in DIGIT_KEYS:
            idx = DIGIT_KEYS[name] - 1
            if idx < len(cmds):
                self.battle_cursor = idx
                self._battle_run(idx)
        self._refresh_battle()

    def _battle_run(self, idx):
        b = self.battle
        cmds = b.commands()
        if not cmds or idx >= len(cmds):
            return
        cmd = cmds[idx]
        hp_before = self.state.hp
        menu_before = b.menu
        if not b.act(cmd):
            self.say("Não é possível agora.", 1.4)
            return
        self.sound(_cmd_sound(cmd))
        if self.state.hp < hp_before:
            self.sound("dano")
        if b.menu != menu_before:
            self.battle_cursor = 0
        elif self.battle_cursor >= len(b.commands()):
            self.battle_cursor = max(0, len(b.commands()) - 1)
        if b.over:
            self.sound("vitoria" if b.result == "win" else "derrota")
            self.battle_cursor = 0

    def on_mouse_click(self):
        """Clique do mouse: no reparo, gira a célula sob o cursor."""
        mw = self.mouseWatcherNode
        if self.mode != "repair" or not mw.hasMouse():
            return
        ax = mw.getMouseX() * self.getAspectRatio()
        ay = mw.getMouseY()
        self.repair_click(ax, ay)

    def repair_click(self, ax, ay):
        """Gira a célula que está em (ax, ay) no espaço da tela (aspect2d). Devolve a célula ou None."""
        g = self.repair
        if g is None or self.mode != "repair":
            return None
        cell = P.cell_at(ax, ay, g.puzzle.n, self.repair_screen.size)
        if cell is None:
            return None
        g.cursor = [cell[0], cell[1]]
        res = g.rotate(*cell)
        if res == R.ROTATE:
            self.sound("ui")
        elif res is not None:
            self.sound("dano")
        if g.done:
            self._end_repair(cancelled=False)
        else:
            self._refresh_repair()
        return cell

    def _repair_key(self, name):
        g = self.repair
        if g is None:
            return
        if name in ("arrow_up", "w"):
            g.move_cursor(0, -1)
        elif name in ("arrow_down", "s"):
            g.move_cursor(0, 1)
        elif name in ("arrow_left", "a"):
            g.move_cursor(-1, 0)
        elif name in ("arrow_right", "d"):
            g.move_cursor(1, 0)
        elif name in CONFIRM_KEYS:
            res = g.rotate_cursor()
            if res == R.ROTATE:
                self.sound("ui")
            elif res is not None:
                self.sound("dano")
        elif name == "h":
            g.toggle_hard()
        elif name == "p":
            g.toggle_pause()
        elif name == "escape":
            self._end_repair(cancelled=True)
            return
        if g.done:
            self._end_repair(cancelled=False)
            return
        self._refresh_repair()

    def _shop_key(self, name):
        sh = self.shop
        if sh is None:
            return
        if name == "escape":
            self.close_shop()
            return
        if name in ("arrow_up", "w"):
            sh.move(-1)
        elif name in ("arrow_down", "s"):
            sh.move(1)
        elif name in CONFIRM_KEYS:
            msg = sh.activate()
            self.sound("coleta" if "Comprou" in msg or "Criou" in msg or "Vendeu" in msg else "ui")
        elif name == "tab":
            sh.switch_mode()
        self._refresh_shop()

    def _settings_key(self, name):
        rows = P.SETTINGS_ROWS
        key = rows[self.settings_cursor]
        if name == "escape":
            self.close_settings()
            return
        if name in ("arrow_up", "w"):
            self.settings_cursor = (self.settings_cursor - 1) % len(rows)
        elif name in ("arrow_down", "s"):
            self.settings_cursor = (self.settings_cursor + 1) % len(rows)
        elif name in ("arrow_left", "a"):
            self._adjust_setting(key, -1)
        elif name in ("arrow_right", "d") or name in CONFIRM_KEYS:
            self._adjust_setting(key, 1)
        self._refresh_settings()

    def _adjust_setting(self, key, step):
        st = self.settings
        if key in ("master", "music", "sfx"):
            st.set(key, round(st.get(key) + 0.1 * step, 2))
            self.sound("ui")
        elif key in ("captions", "shadows", "reduced_motion", "battle_on_contact"):
            st.set(key, not st.get(key))
            if key == "shadows":
                self._apply_shadows()
        elif key == "text_scale":
            opts = T.TEXT_SCALES
            cur = opts.index(st.get("text_scale"))
            st.set("text_scale", opts[(cur + step) % len(opts)])
            self.tm = st.get("text_scale")
            textscale.apply(self.tm)  # aplica já, sem reiniciar
        elif key == "difficulty":
            order = K.DIFFICULTY_ORDER
            cur = order.index(st.get("difficulty"))
            st.set("difficulty", order[(cur + step) % len(order)])

    def open_settings(self, return_to):
        self.settings_return = return_to
        self.settings_cursor = 0
        self.mode = "settings"
        if return_to == "title":
            self._show_title(False)
        self.settings_screen.show()
        self._refresh_settings()

    def close_settings(self):
        self.settings.save()
        self.settings_screen.hide()
        if self.settings_return == "title":
            self.mode = "title"
            self._show_title(True)
            self._refresh_title()
        else:
            self.mode = "play"

    # ---- Modos ----
    def start_intro(self):
        self.state = S.new_state()
        self.mode = "intro"
        self.intro_t = 0.0
        if self.zone_root is not None:
            self.zone_root.hide()  # a abertura mostra só o Vigia, sem a zona de uma partida anterior
        self.sfx.play_music()
        self._show_title(False)
        self.vigia.show()
        # O Bit aparece ao lado do Vigia, virado para a câmera (a visor fica na frente, em +y)
        self.player.setPos(INTRO_BIT_X, 0, 0)
        self.player.setH(180)
        self.player.setScale(1)
        self.player.show()
        self.player_shadow.setPos(INTRO_BIT_X, 0, 0)
        self.player_shadow.show()
        self.letter_top.show()
        self.open_dialog(C.INTRO_TEXT, title="Abertura", color="#7dfff0",
                         after=lambda _value=None: self.begin_transition(
                             lambda: self.start_play(self.state, None)))

    def begin_transition(self, then):
        """Escurece a tela, executa 'then' (troca de zona ou de modo) e clareia.
        Não reinicia uma transição em andamento (senão o portal sob o jogador a manteria para sempre)."""
        if self.fade is not None:
            return
        self.fade = {"t": 0.0, "phase": "out", "then": then}
        self.fade_card.setColor(0, 0, 0, 0)
        self.fade_card.show()

    def _update_fade(self, dt):
        f = self.fade
        if f is None:
            return
        f["t"] += dt
        if f["phase"] == "out":
            alpha = min(1.0, f["t"] / FADE_TIME)
            self.fade_card.setColor(0, 0, 0, alpha)
            if f["t"] >= FADE_TIME:
                f["then"]()
                f["phase"] = "in"
                f["t"] = 0.0
        else:
            alpha = max(0.0, 1.0 - f["t"] / FADE_TIME)
            self.fade_card.setColor(0, 0, 0, alpha)
            if f["t"] >= FADE_TIME:
                self.fade = None
                self.fade_card.hide()

    def start_play(self, state, pos=None):
        self.state = state
        self.mode = "play"
        self.sfx.stop_music()
        self.player.setScale(1)
        self.sun.setColor((0.95, 0.97, 1, 1))
        if self.zone_root is not None:
            self.zone_root.show()
        self._show_title(False)
        self.letter_top.hide()
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

    def icon_for(self, kind, ident):
        """Caminho do ícone 3D (renderizado na primeira vez). None sem OpenGL ou sem ícone."""
        if self.icons is None or not self.icons.available or ident is None:
            return None
        zone = self.zone.id if self.zone is not None else None
        try:
            return self.icons.ensure(kind, ident, zone)
        except Exception:
            return None

    def open_menu(self):
        if self.mode != "play":
            return
        self.menu = M.Menu(self.state, self.zone.id)
        self.mode = "menu"
        self.menu_text.show()
        self.menu_footer.show()
        self.panel.setScale(0.95, 1, 0.92)
        self.panel.setPos(-self.getAspectRatio() + 0.95, 0, 0)
        self.panel.show()
        self._refresh_menu()

    def close_menu(self):
        self.mode = "play"
        self.menu = None
        self.menu_text.hide()
        self.menu_list.hide()
        self.menu_preview.hide()
        self.menu_detail.hide()
        self.menu_footer.hide()
        self.panel.hide()
        self.panel.setScale(self.getAspectRatio(), 1, 0.34)
        self.panel.setPos(0, 0, -0.66)

    def _refresh_menu(self):
        if self.menu is None:
            return
        tabs = " | ".join(("[" + t + "]") if i == self.menu.tab else t for i, t in enumerate(M.TABS))
        rows = self.menu.rows()
        cursor = self.menu.cursor[self.menu.tab]
        kind = {1: "item", 2: "talent", 5: "tool"}.get(self.menu.tab)
        icon_paths = [self.icon_for(kind, r["id"]) if kind else None for r in rows]
        # Cabeçalho e rodapé em texto; a lista com ícones fica ao lado
        self.menu_text.setText(tabs)
        footer = (self.menu.message + "\n" if self.menu.message else "")
        self.menu_footer.setText(footer + "Tab ou setas trocam aba | Enter usar | V vender | Esc fechar")
        self.menu_list.render([r["label"] for r in rows], cursor, icon_paths)
        sel = rows[cursor] if rows else None
        sel_icon = icon_paths[cursor] if rows else None
        self.menu_preview.set(sel_icon)
        detail = sel["detail"] if sel else ""
        self.menu_detail.setText(detail)
        self.menu_detail.show()

    def use_tool(self, tool_id):
        """Usa uma ferramenta do personagem no mundo (reparo precisa da posição do Bit)."""
        from . import tools as TL
        msg, changed = TL.use(self.state, tool_id, self.zone, (self.px, self.py))
        self.say(msg, 3.0)
        if changed:
            zid = self.zone.id
            self.load_zone(zid, (self.px, self.py))
            self.say(msg, 3.0)
        self._refresh_menu()

    def fast_travel(self, zid):
        self.close_menu()
        if zid == self.zone.id:
            self.say("Você já está aqui.")
            return
        self.begin_transition(lambda: self.load_zone(zid, None))
        self.say(f"Viagem para {C.ZONES[zid].get('name', zid)}.", 2.5)

    # ---- Batalha por turnos ----
    def start_battle(self, boss_entity):
        enemy = boss_entity["m"]["id"]
        self.battle_target = boss_entity
        self.battle = B.Battle(self.state, enemy, rng=random.Random(self.time_seed()),
                               difficulty=self.settings.get("difficulty"))
        self.battle.state.discover_enemy(enemy)
        self.battle_cursor = 0
        self.mode = "battle"
        self.panel.hide()
        self.battle_screen.show()
        self._refresh_battle()

    def start_roamer_battle(self, rm):
        """Contato com um inimigo errante (ajuste 'batalha ao toque'): abre a batalha por turnos."""
        entry = self.roamer_nodes.get(id(rm))
        target = {"m": {"id": rm.id}, "node": entry[0] if entry else None, "defeated": False, "roamer": rm}
        self.say(f"{rm.name} bloqueia o caminho!", 2.0)
        self.start_battle(target)

    def time_seed(self):
        return int(self.time * 1000) + self.state.level * 7919

    def _refresh_battle(self):
        if self.battle is None:
            return
        self.battle_screen.portrait.set(self.icon_for("enemy", self.battle.enemy_id))
        self.battle_screen.render(self.battle, self.battle_cursor,
                                  P.DIFF_LABEL.get(self.settings.get("difficulty"), "Normal"),
                                  icon_for=self.icon_for)

    def _end_battle(self):
        b = self.battle
        target = self.battle_target
        result = b.result
        self.battle = None
        self.battle_screen.hide()
        self.mode = "play"
        if result == "win" and target is not None:
            if target.get("node") is not None:
                target["node"].hide()
            target["defeated"] = True
            rm = target.get("roamer")
            if rm is not None:
                rm.alive = False
            self.say(f"{b.name} foi derrotado!", 3.0)
        elif result == "flee" and target is not None and target.get("roamer") is not None:
            self.say("Você escapou.", 2.0)
        elif result == "lose":
            self.state.hp = max(1, self.state.max_hp() // 2)
            sx, sz = self.zone.spawn()
            self.px, self.py = float(sx), float(sz)
            self.say("Você caiu. Voltou ao início da zona.", 3.0)
        self._announce(self.state.check_quests())

    # ---- Reparo ----
    def start_repair(self, target):
        seed = self.time_seed()
        self.repair_target = target
        self.repair = R.RepairGame(size=4, fuses=1, time_limit=REPAIR_TIME_LIMIT, hard=False,
                                   rng=random.Random(seed).random, zone_key=self.zone.id)
        self.mode = "repair"
        self.panel.hide()
        self.repair_screen.show()
        self._refresh_repair()

    def _refresh_repair(self):
        g = self.repair
        if g is None:
            return
        best = self.state.repairBest.get(g.record_key())
        self.repair_screen.render(g, "Reparo de Trilha" + (" (difícil)" if g.hard else ""),
                                  str(best) if best else "sem recorde")

    def _end_repair(self, cancelled):
        g = self.repair
        target = self.repair_target
        self.repair = None
        self.repair_target = None
        self.repair_screen.hide()
        self.mode = "play"
        if cancelled or g is None:
            self.say("Reparo cancelado.", 1.5)
            return
        if g.success:
            new_record = self.state.record_repair_score(g.record_key(), g.score_now())
            self.state.set_flag(f"rep_{target['m'].get('id')}")
            self.state.bump(f"repair_{self.zone.id}", 1)
            target["done"] = True
            target["node"].setColor(0.4, 0.5, 0.4, 1)
            self.sound("reparo")
            self.say("Trilha reparada!" + (" Novo recorde!" if new_record else ""), 3.0)
            self._announce(self.state.check_quests())
        elif g.timed_out:
            self.sound("derrota")
            self.say("Tempo esgotado. Tente de novo.", 2.5)

    # ---- Loja e bancada ----
    def open_shop(self, bench=False, target=None):
        self.shop = SH.Shop(self.state, "criar" if bench else "comprar", bench=bench)
        self.shop_target = target
        self.mode = "shop"
        self.panel.hide()
        self.shop_screen.show()
        self._refresh_shop()

    def close_shop(self):
        self.shop = None
        self.mode = "play"
        self.shop_screen.hide()

    def _refresh_shop(self):
        if self.shop is None:
            return
        rows = self.shop.rows()
        row = rows[self.shop.cursor] if rows else None
        self.shop_screen.preview.set(self.icon_for("item", row["id"]) if row and row["id"] else None)
        title = "Bancada de criação" if self.shop.modes == ["criar"] else "Lojista"
        self.shop_screen.render(self.shop, title, icon_for=self.icon_for)

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
        from . import tools as TL
        TL.apply_repairs(self.zone, self.state)  # reparos de cache já feitos continuam abertos
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
                elif kind == "boss" and m.get("id") in C.ENEMIES:
                    defeated = self.state.has_flag(f"boss_{m['id']}")
                    e = C.ENEMIES[m["id"]]
                    from . import models
                    body = models.enemy_node(m["id"], e["color"], 1.3)
                    node = self.zone_root.attachNewNode("boss")
                    body.reparentTo(node)
                    SC.blob_shadow(node, 0.5)
                    node.setPos(c, r, 0)
                    if defeated:
                        node.hide()
                    self.interactables.append({"kind": "boss", "c": c, "r": r, "m": m, "node": node,
                                               "defeated": defeated})
                elif kind == "bench":
                    mesh = SC.Mesh()
                    mesh.box(-.4, -.25, 0, .4, .25, .45, (0.25, 0.3, 0.32, 1))
                    mesh.box(-.3, -.2, .45, .3, .2, .5, (0.5, 0.95, 0.9, 1))
                    node = mesh.node("bench")
                    self._place(node, c, r)
                    self.interactables.append({"kind": "bench", "c": c, "r": r, "m": m, "node": node})
        for pr in self.zone.props:
            from . import models as MD
            node = MD.prop_node(pr["model"])
            node.reparentTo(self.zone_root)
            node.setPos(pr["c"], pr["r"], 0)
            node.setH(pr.get("rot", 0))
        for rm in self.fight.roamers:
            self._add_roamer_node(rm)

    def _place(self, node, c, r):
        node.reparentTo(self.zone_root)
        node.setPos(c, r, 0)
        SC.blob_shadow(node, 0.35)

    def _add_roamer_node(self, rm):
        root = self.zone_root.attachNewNode("roamer")
        from . import models
        body = models.enemy_node(rm.id, rm.color, rm.scale)
        body.reparentTo(root)
        SC.blob_shadow(root, 0.35 * rm.scale)
        bar = SC.hp_bar(root, 1.25 * rm.scale, 1.0)
        self._add_roamer_icon(root, rm)
        self.roamer_nodes[id(rm)] = (root, bar)

    def _add_roamer_icon(self, root, rm):
        """Ícone pequeno do inimigo sobre a barra de vida (cartão de frente para a câmera)."""
        path = self.icon_for("enemy", rm.id)
        if not path:
            return
        from panda3d.core import CardMaker, TransparencyAttrib as TA
        cm = CardMaker("roamer-icon")
        cm.setFrame(-0.5, 0.5, -0.5, 0.5)
        card = root.attachNewNode(cm.generate())
        card.setTexture(self.loader.loadTexture(path))
        card.setTransparency(TA.MAlpha)
        card.setBillboardPointEye()
        card.setPos(0, 0, 1.75 * rm.scale)
        card.setScale(0.3)

    # ---- Ações ----
    def sound(self, name):
        """Toca um efeito. Com legendas ligadas, o som importante também aparece como texto curto."""
        self.sfx.play(name)
        caption = SOUND_CAPTIONS.get(name)
        if caption and self.settings.get("captions"):
            self.say(caption, 0.9)

    def say(self, text, seconds=2.2):
        self.msg.setText(text)
        self.msg_left = seconds

    def _announce(self, done):
        for q in done:
            self.say(f"Missão concluída: {C.QUESTS[q['id']]['title']}", 3.5)

    def nearest_interactable(self):
        best, best_d = None, INTERACT_RANGE
        for it in self.interactables:
            if it.get("defeated"):
                continue
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
        kind = it["kind"]
        if kind == "npc":
            res = self.state.talk(it["m"]["id"])
            if res is None:
                self.say(f"{C.NPCS[it['m']['id']]['name']} não tem nada a dizer agora.", 2.0)
                return
            after = None
            if C.NPCS[it["m"]["id"]].get("shop"):
                after = lambda _v=None, t=it: self.open_shop(bench=False, target=t)  # noqa: E731
            self.open_dialog(res["lines"], title=res["name"], color=res["color"], after=after)
            if after is None:
                self._announce(self.state.check_quests())
        elif kind == "chest":
            got = self.state.open_chest(it["m"]["id"], self.zone.id, it["c"], it["r"])
            if got is None:
                self.say("O baú já foi aberto.", 1.5)
            else:
                names = ", ".join(f"{C.ITEMS.get(i, {}).get('name', i)} x{n}" for i, n in got)
                self.say(f"Baú aberto: {names}", 3.0)
                self.sound("coleta")
                it["node"].removeNode()
                it["node"] = SC.chest_mesh("#ffd166", True)
                self._place(it["node"], it["c"], it["r"])
                it["opened"] = True
                self._announce(self.state.check_quests())
        elif kind == "repair":
            if it["done"]:
                self.say("Esta trilha já está reparada.", 1.5)
            else:
                self.start_repair(it)
        elif kind == "boss":
            e = C.ENEMIES[it["m"]["id"]]
            lines = [{"s": e["name"], "t": e["lore"]}, {"s": "Bit", "t": "Preciso passar por você."}]
            self.open_dialog(lines, title=e["name"], color="#ff9a6b",
                             after=lambda _v=None, t=it: self.start_battle(t))
        elif kind == "bench":
            self.open_shop(bench=True, target=it)

    def do_attack(self):
        if self.mode != "play" or self.fight is None:
            return
        events = self.fight.swing(self.px, self.py, self.facing)
        if events:
            self.sound("golpe")
            self._handle_fight_events(events)

    def _handle_fight_events(self, events):
        for ev in events:
            if ev[0] == "touch":
                self.start_roamer_battle(ev[1])
            elif ev[0] == "hit":
                _, rm, dmg = ev
                self._burst((rm.x, rm.z, 0.6), rm.color, 8)
                self._float(f"-{dmg}", (rm.x, rm.z, 1.4), (1, 0.95, 0.4, 1))
            elif ev[0] == "kill":
                _, rm = ev
                self._burst((rm.x, rm.z, 0.5), rm.color, 22)
                self.say(f"{rm.name} derrotado!", 2.0)
                self.sound("coleta")
                self._announce(self.state.check_quests())
            elif ev[0] == "hurt":
                _, rm, dmg = ev
                self.hurt_flash = 0.35
                self.sound("dano")
                self._float(f"-{dmg}", (self.px, self.py, 1.4), (1, 0.3, 0.3, 1))
            elif ev[0] == "defeat":
                self.state.hp = max(1, self.state.max_hp() // 2)
                self.say("Você caiu. Voltou ao início da zona.", 3.0)
                self.sound("derrota")
                sx, sz = self.zone.spawn()
                self.px, self.py = float(sx), float(sz)
                self.fight.iframes = 2.0

    def _burst(self, pos, color, count):
        if self.settings.get("reduced_motion"):
            return
        self.particles += [[np, vel, life, life] for np, vel, life in SC.burst(self.render, pos, color, count)]

    def _float(self, text, pos, color):
        if self.settings.get("reduced_motion"):
            return
        t = self._ot(text, 0, 0, 0.06, align=TextNode.ACenter, color=color)
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
        self.sound("coleta")
        self._announce(self.state.check_quests())

    def _portal(self):
        if self.fade is not None:
            return
        cell = (round(self.px), round(self.py))
        for c, r, m in self.zone.portals():
            if (c, r) == cell and m.get("to") in C.ZONES:
                dest = m["to"]
                self.begin_transition(lambda d=dest: self.load_zone(d, W.load(d).arrival_from(self.zone.id)))
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
    def _sync_hud(self):
        """O HUD do jogo só aparece em exploração, diálogo e menu (telas cheias o escondem)."""
        on = self.mode in ("play", "dialog")  # no menu, o painel ocupa a tela e o HUD sai
        if on == self.hud_on:
            return
        self.hud_on = on
        for node in (self.hud, self.msg, self.prompt, self.floor_hint):
            node.show() if on else node.hide()
        if on and self.state is not None and self.zone is not None:
            self.minimap_img.show()
        else:
            self.minimap_img.hide()

    def step(self, dt):
        self.time += dt
        self._update_fade(dt)
        self._sync_hud()
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
        if self.mode in ("menu", "settings", "shop", "layers"):
            return
        if self.mode == "battle":
            self._update_battle_fx(dt)
            return
        if self.mode == "repair":
            self.repair.tick(dt)
            if self.repair.done:
                self._end_repair(cancelled=False)
            else:
                self._refresh_repair()
            return
        self._update_play(dt)

    def _update_battle_fx(self, dt):
        self.msg_left = max(0.0, self.msg_left - dt)

    def _update_hub(self, dt):
        spin = 4 if self.settings.get("reduced_motion") else 18
        self.hub_angle += dt * spin
        a = math.radians(self.hub_angle)
        if self.mode == "intro":
            # Aproximação em câmera lenta até o Vigia (6 s), com pulso de luz no fundo
            t = getattr(self, "intro_t", 0.0)
            k = min(1.0, t / INTRO_DOLLY_S)
            k = k * k * (3 - 2 * k)  # suavização (smoothstep)
            if self.settings.get("reduced_motion"):
                k = 1.0
            dist = INTRO_FAR + (INTRO_NEAR - INTRO_FAR) * k
            self.camera.setPos(1.6 + math.cos(a * 0.2) * 0.2, -dist, 1.7 + 0.2 * k)
            self.camera.lookAt(INTRO_BIT_X / 2, 0, 1.4)
            # O Vigia respira (ciclo de 3,2 s), mais forte no começo; com movimento reduzido, fica parado
            breath = 0.0 if self.settings.get("reduced_motion") else 0.02 * (1 - k * 0.5)
            wave = breath * math.sin(2 * math.pi * t / 3.2)
            self.vigia.setScale(1 + wave)
            self.player.setScale(1 + wave)  # o Bit respira junto com o Vigia
            pulse = 0.85 + 0.15 * math.sin(2 * math.pi * t / 2.4)
            self.sun.setColor((0.95 * pulse, 0.97 * pulse, 1.0 * pulse, 1))
            self.intro_t = t + dt
        else:
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
            self.step_dist += step
            if self.step_dist >= STEP_DISTANCE:
                self.step_dist = 0.0
                self.sound("passo")
        self.player.setPos(self.px, self.py, 0)
        self.player.setH(math.degrees(math.atan2(-math.sin(self.facing), math.cos(self.facing))))
        self.player_shadow.setPos(self.px, self.py, 0)
        self.sun_np.setPos(self.px, self.py, 16)

        cell = (round(self.px), round(self.py))
        if cell != self.last_cell:
            self.last_cell = cell
            W.reveal(self.zone, self.state, self.px, self.py, radius=4)
            self._refresh_minimap()
        self._collect()
        self._portal()

        for node, _key, _item in self.pickups.values():
            node.setH(self.time * 120)
        events = self.fight.step(self.px, self.py, dt, touch=self.settings.get("battle_on_contact"))
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
        self.camera.setPos(self.px, self.py - CAM_BACK, CAM_HEIGHT)
        self.camera.lookAt(self.px, self.py + CAM_AIM_AHEAD, CAM_AIM_HEIGHT)
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
        if self.hurt_flash > 0 and not self.settings.get("reduced_motion"):
            self.flash.setColor(0.9, 0.1, 0.1, self.hurt_flash * 0.8)
            self.flash.show()
        else:
            self.flash.hide()

    def _update_prompt(self):
        it = self.nearest_interactable()
        if it is None:
            self.prompt.setText("")
            return
        kind = it["kind"]
        if kind == "npc":
            label = f"Falar com {C.NPCS[it['m']['id']]['name']}"
        elif kind == "chest":
            label = "Baú já aberto" if it.get("opened") else "Abrir baú"
        elif kind == "repair":
            label = "Trilha já reparada" if it["done"] else "Reparar trilha"
        elif kind == "boss":
            label = f"Enfrentar {C.ENEMIES[it['m']['id']]['name']}"
        else:
            label = "Usar bancada de criação"
        self.prompt.setText(f"[E] {label}")

    def _refresh_minimap(self):
        rows = W.minimap_grid(self.zone, self.state, self.px, self.py, radius=12)
        self.minimap_img.setImage(SC.minimap_image(rows, size=6))

    def _update_hud(self, dt):
        st = self.state
        self.hud.setText(
            f"{self.zone.name}\n"
            f"Nível {st.level}   HP {st.hp}/{st.max_hp()}   EN {st.en}/{st.max_en()}   Ouro {st.gold}")
        self.floor_hint.setText("WASD mover | F atacar | E interagir | Tab menu | O ajustes | F5 salvar | Esc sair")
        if self.msg_left > 0:
            self.msg_left -= dt
            if self.msg_left <= 0:
                self.msg.setText("")

    def open_layers(self, return_to):
        self.layers_return = return_to
        self.mode = "layers"
        self.panel.hide()
        self._show_title(False)
        self.layers_screen.image_key = None
        self.layers_screen.show()
        self._refresh_layers()

    def close_layers(self):
        self.layers_screen.hide()
        if self.layers_return == "title":
            self.mode = "title"
            self._show_title(True)
            self._refresh_title()
        else:
            self.mode = "play"

    def _layers_key(self, name):
        n = len(LY.LAYERS)
        if name == "escape":
            self.close_layers()
            return
        if name in CONFIRM_KEYS:
            self.travel_to_layer(LY.LAYERS[self.layer_index]["id"])
            return
        if name in ("arrow_right", "d", "arrow_down", "s"):
            self.layer_index = (self.layer_index + 1) % n
        elif name in ("arrow_left", "a", "arrow_up", "w"):
            self.layer_index = (self.layer_index - 1) % n
        self._refresh_layers()

    def travel_to_layer(self, layer_id):
        """Entra na zona jogável da camada (se a camada tiver uma)."""
        zid = C.LAYER_ZONE_IDS.get(layer_id)
        if zid is None:
            self.say("Esta camada ainda não é uma zona jogável.", 2.5)
            return
        self.close_layers()
        self.begin_transition(lambda z=zid: self._enter_zone(z))

    def _enter_zone(self, zid):
        self.mode = "play"
        self._show_title(False)
        self.player.show()
        self.player_shadow.show()
        self.minimap_img.show()
        self.load_zone(zid, None)
        self.say(C.ZONES[zid]["name"], 2.5)

    def _layer_texture(self, layer_id):
        """Textura da camada: a imagem renderizada no Blender, ou a grade própria se ela não existir."""
        from panda3d.core import PNMImage, Texture
        path = Path(__file__).resolve().parent / "assets" / "layers" / f"{layer_id}.png"
        if path.exists():
            return self.loader.loadTexture(str(path))
        tex = Texture(f"layer-{layer_id}")
        tex.load(LY.layer_image(layer_id, cell=8))
        return tex

    def _refresh_layers(self):
        self.layers_screen.render(LY.LAYERS, self.layer_index, LY.legend(), self._layer_texture)

    def _refresh_settings(self):
        self.settings_screen.render(self.settings, self.settings_cursor)

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

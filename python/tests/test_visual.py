"""Regressão visual: captura cada tela num estado fixo e compara com a referência salva.

Referências: tests/visual/refs/*.png. Para atualizar depois de uma mudança visual intencional:
    ANELZERO_UPDATE_REFS=1 xvfb-run -a python3 -m unittest discover -s tests -p "test_visual.py"
A comparação usa uma amostra da imagem (1 de cada 8 pixels) e duas medidas:
  - diferença média por canal (0-255), limite MEAN_TOLERANCE;
  - porcentagem de pixels amostrados com mudança clara (mais de 24 em 0-255), limite PCT_TOLERANCE.
Para depurar uma falha, ANELZERO_VISUAL_DUMP=pasta grava as capturas comparadas.
Telas escuras mudam pouco em média, então a segunda medida pega alterações pequenas e localizadas.
"""

import os
import pathlib
import tempfile
import unittest

from panda3d.core import Filename, PNMImage

from gamehost import HAS_DISPLAY, get_game

REFS = pathlib.Path(__file__).resolve().parent / "visual" / "refs"
MEAN_TOLERANCE = 2.0
PCT_TOLERANCE = 1.5
CHANGED = 24
STEP = 8
UPDATE = os.environ.get("ANELZERO_UPDATE_REFS") == "1"


def _capture(game, path, frames=6):
    for _ in range(frames):
        game.step(1 / 30)
    game.graphicsEngine.renderFrame()
    game.graphicsEngine.renderFrame()
    game.win.saveScreenshot(Filename.from_os_specific(str(path)))


def compare(a_path, b_path):
    """Devolve (diferença média por canal, porcentagem de pixels amostrados muito diferentes)."""
    a, b = PNMImage(), PNMImage()
    a.read(Filename.from_os_specific(str(a_path)))
    b.read(Filename.from_os_specific(str(b_path)))
    if (a.getXSize(), a.getYSize()) != (b.getXSize(), b.getYSize()):
        return float("inf"), 100.0
    total, n, changed = 0.0, 0, 0
    for y in range(0, a.getYSize(), STEP):
        for x in range(0, a.getXSize(), STEP):
            d = [abs(a.getRed(x, y) - b.getRed(x, y)), abs(a.getGreen(x, y) - b.getGreen(x, y)),
                 abs(a.getBlue(x, y) - b.getBlue(x, y))]
            total += sum(d)
            n += 3
            if max(d) * 255 > CHANGED:
                changed += 1
    samples = (a.getYSize() // STEP + 1) * (a.getXSize() // STEP + 1)
    return 255.0 * total / n, 100.0 * changed / samples


def _clear_roamers(game):
    """Zera os inimigos errantes e remove também os nós deles (senão continuam visíveis na cena)."""
    for root, _bar in game.roamer_nodes.values():
        root.removeNode()
    game.roamer_nodes = {}
    game.fight.roamers = []


@unittest.skipUnless(HAS_DISPLAY, "precisa de display (use xvfb-run)")
class VisualRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = get_game()
        cls.tmp = tempfile.mkdtemp(prefix="anelzero-visual-")
        REFS.mkdir(parents=True, exist_ok=True)

    def _check(self, name):
        out = pathlib.Path(self.tmp) / f"{name}.png"
        _capture(self.g, out)
        ref = REFS / f"{name}.png"
        if UPDATE or not ref.exists():
            if not UPDATE and not ref.exists():
                self.skipTest(f"referência {name} ainda não existe: gere com ANELZERO_UPDATE_REFS=1")
            ref.write_bytes(out.read_bytes())
            return
        dump = os.environ.get("ANELZERO_VISUAL_DUMP")
        if dump:
            pathlib.Path(dump).mkdir(parents=True, exist_ok=True)
            (pathlib.Path(dump) / f"{name}.png").write_bytes(out.read_bytes())
        mean, pct = compare(out, ref)
        self.assertLessEqual(mean, MEAN_TOLERANCE, f"{name}: diferença média {mean:.2f} acima de {MEAN_TOLERANCE}")
        self.assertLessEqual(pct, PCT_TOLERANCE, f"{name}: {pct:.2f}% dos pixels mudou (limite {PCT_TOLERANCE}%)")

    def _reset(self, mode="play"):
        from anelzero import state as S
        g = self.g
        g.fade = None
        g.fade_card.hide()
        g.battle = g.repair = g.shop = g.dialog = None
        g.menu = None
        g.time = 0.0
        g.hub_angle = 0.0
        g.settings.data = dict(g.settings.data, master=0.8, music=0.6, sfx=0.8, text_scale=1.0,
                               difficulty="normal", shadows=True, reduced_motion=False, captions=True)
        g._apply_shadows()
        # Limpa o que outros testes deixaram na cena (partículas, textos, mensagens, telas abertas)
        for f in g.floaters:
            f[0].destroy()
        g.floaters = []
        for part in g.particles:
            part[0].removeNode()
        g.particles = []
        g.msg.setText("")
        g.msg_left = 0.0
        g.hurt_flash = 0.0
        g.flash.hide()
        for screen in (g.battle_screen, g.repair_screen, g.shop_screen, g.settings_screen):
            screen.hide()
        g.hud_on = None
        for node in (g.menu_list, g.menu_preview, g.menu_detail, g.menu_footer):
            node.hide()
        g.sfx.stop_music()
        g.sun.setColor((0.95, 0.97, 1, 1))  # a abertura pulsa a luz: restaura antes de cada captura
        g.setBackgroundColor(0.03, 0.04, 0.06, 1)  # o fundo e o céu vêm da última zona carregada
        from anelzero import textscale
        textscale.apply(1.0)  # texto no tamanho normal (outros testes podem ter mudado o tamanho)
        g.tm = 1.0
        g.slots.delete(g.slot)  # sem save: o título não pode mostrar 'Continuar' por causa de outro teste
        g._set_sky("#0b0f14", "#122410")
        # Títulos, faixas, painéis e menus de outras telas: todos escondidos antes de cada captura
        g._show_title(mode == "title")
        g.letter_top.hide()
        g.panel.hide()
        g.panel.setScale(g.getAspectRatio(), 1, 0.34)
        g.panel.setPos(0, 0, -0.66)
        for node in (g.dlg_text, g.dlg_speaker, g.menu_text):
            node.hide()
        g.state = S.new_state()
        g.state.gold = 120
        g.mode = mode

    def test_title(self):
        self._reset("title")
        self.g._show_title(True)
        self.g._refresh_title()
        self._check("titulo")

    def test_zone(self):
        from anelzero import state as S
        self._reset()
        self.g.start_play(S.new_state())
        _clear_roamers(self.g)
        self.g.dialog = None
        self.g.panel.hide()
        self.g.px, self.g.py = 9.0, 9.0
        self._check("zona_cache")

    def test_battle(self):
        self._reset()
        self.g.load_zone("alu", None)
        _clear_roamers(self.g)
        self.g.time = 1.0
        boss = next(it for it in self.g.interactables if it["kind"] == "boss")
        self.g.start_battle(boss)
        self._check("batalha_chefe")

    def test_repair(self):
        self._reset()
        self.g.load_zone("cache", None)
        _clear_roamers(self.g)
        target = next((it for it in self.g.interactables if it["kind"] == "repair" and not it["done"]), None)
        if target is None:
            self.skipTest("sem trilha partida")
        self.g.time = 2.0
        self.g.start_repair(target)
        self._check("reparo")

    def test_shop(self):
        self._reset()
        self.g.load_zone("cache", None)
        self.g.open_shop(bench=False)
        self._check("loja")

    def test_inventory_with_icons(self):
        from anelzero import state as S
        self._reset()
        self.g.start_play(S.new_state())
        _clear_roamers(self.g)
        self.g.dialog = None
        self.g.panel.hide()
        self.g.px, self.g.py = 9.0, 9.0
        for _ in range(3):  # quadros de exploração fixam a câmera antes do menu
            self.g.step(1 / 30)
        self.g.open_menu()
        self.g.menu.next_tab(1)
        self.g.menu.move(1)
        self.g._refresh_menu()
        self._check("inventario_icones")
        self.g.close_menu()

    def test_intro_frame(self):
        self._reset("intro")
        self.g.start_intro()
        for _ in range(30):
            self.g.step(0.1)
        self._check("abertura")
        self.g.fade = None
        self.g.fade_card.hide()

    def test_battle_on_contact(self):
        import random
        from anelzero import rt
        self._reset()
        self.g.load_zone("cache", None)
        _clear_roamers(self.g)
        rm = rt.Roamer("pulga", self.g.px, self.g.py + 0.1, random.Random(1))
        self.g.time = 1.0
        self.g.start_roamer_battle(rm)
        self._check("batalha_ao_toque")
        self.g.battle = None
        self.g.battle_screen.hide()
        self.g.mode = "play"

    def test_skills_menu_with_icons(self):
        from anelzero import state as S
        self._reset()
        self.g.start_play(S.new_state())
        _clear_roamers(self.g)
        self.g.dialog = None
        self.g.panel.hide()
        self.g.px, self.g.py = 9.0, 9.0
        for _ in range(3):
            self.g.step(1 / 30)
        self.g.open_menu()
        self.g.menu.next_tab(2)  # aba Habilidades
        self.g._refresh_menu()
        self._check("habilidades_icones")
        self.g.close_menu()

    def test_settings(self):
        self._reset("title")
        self.g.open_settings("title")
        self._check("ajustes")


if __name__ == "__main__":
    unittest.main()

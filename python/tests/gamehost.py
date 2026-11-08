"""Ponto único de acesso ao jogo para os testes headless.

O Panda3D só aceita um ShowBase por processo, então todos os módulos de teste pegam a mesma instância.
Os saves e ajustes vão para uma pasta temporária, nunca para o ~/.anelzero do usuário.
"""

import atexit
import os
import shutil
import tempfile

HAS_DISPLAY = bool(os.environ.get("DISPLAY"))
_game = None
_tmp = None


def _shutdown():
    global _game
    if _game is not None:
        _game.destroy()
        _game = None
    if _tmp is not None:
        shutil.rmtree(_tmp, ignore_errors=True)


def get_game():
    global _game, _tmp
    if _game is None:
        _tmp = tempfile.mkdtemp(prefix="anelzero-test-")
        os.environ["ANELZERO_SAVE_DIR"] = os.path.join(_tmp, "saves")
        os.environ["ANELZERO_HOME"] = _tmp
        from anelzero.client import Game
        _game = Game()
        atexit.register(_shutdown)
    return _game

"""Mede o custo do mapa de sombra: tempo médio por quadro com sombra ligada e desligada.

Uso (precisa de display virtual):  xvfb-run -a python3 tools/bench_shadows.py [quadros]

Os números dependem da máquina e do renderizador. Em software (llvmpipe/tinydisplay) o valor é
pessimista; em GPU real o custo tende a ser menor. Relate sempre a máquina junto com o resultado.
"""

import os
import platform
import statistics
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def measure(game, frames):
    samples = []
    for _ in range(frames):
        t0 = time.perf_counter()
        game.step(1 / 60)
        game.graphicsEngine.renderFrame()
        samples.append((time.perf_counter() - t0) * 1000)
    return samples


def main():
    frames = int(sys.argv[1]) if len(sys.argv) > 1 else 120
    tmp = tempfile.mkdtemp(prefix="anelzero-bench-")
    os.environ["ANELZERO_HOME"] = tmp
    os.environ["ANELZERO_SAVE_DIR"] = os.path.join(tmp, "saves")
    from anelzero.client import Game
    from anelzero import state as S

    game = Game()
    game.start_play(S.new_state())
    game.fight.roamers = []
    game.px, game.py = 9.0, 9.0
    results = {}
    for on in (False, True, False, True):  # alterna para reduzir o efeito de aquecimento
        game.settings.set("shadows", on)
        game._apply_shadows()
        measure(game, 20)  # aquecimento
        results.setdefault(on, []).extend(measure(game, frames))
    game.destroy()

    print(f"máquina: {platform.system()} {platform.machine()} | python {platform.python_version()} | quadros {frames}")
    for on in (False, True):
        data = results[on]
        print(f"sombra {'ligada ' if on else 'desligada'}: mediana {statistics.median(data):6.2f} ms/quadro"
              f"  (média {statistics.mean(data):6.2f}, p90 {sorted(data)[int(len(data) * 0.9)]:6.2f})")
    off = statistics.median(results[False])
    on_ = statistics.median(results[True])
    print(f"custo da sombra: {on_ - off:+.2f} ms/quadro ({(on_ / off - 1) * 100:+.0f}%)")


if __name__ == "__main__":
    main()

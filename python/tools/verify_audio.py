"""Gera uma amostra WAV de cada efeito e da trilha, mede pico, duração e nível RMS dos arquivos gravados,
e confere se cada um está dentro dos limites. Não precisa de dispositivo de som.

Uso:  python3 tools/verify_audio.py [pasta_de_saida]   (padrão: audio_samples/ ao lado deste repositório)
Sai com código 1 se algum som estiver fora dos limites.
"""

import math
import pathlib
import struct
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from anelzero import audio as A  # noqa: E402

# Limites: pico entre 0,2 e 0,95 (audível e sem clipagem), duração entre 0,03 s e 9 s.
PEAK_MIN, PEAK_MAX = 0.2, 0.95
DUR_MIN, DUR_MAX = 0.03, 9.0


def measure(path):
    with wave.open(str(path), "rb") as w:
        rate = w.getframerate()
        n = w.getnframes()
        raw = w.readframes(n)
    samples = [v / 32767 for (v,) in struct.iter_unpack("<h", raw)]
    peak = max((abs(v) for v in samples), default=0.0)
    rms = math.sqrt(sum(v * v for v in samples) / len(samples)) if samples else 0.0
    return {"peak": peak, "duration": n / rate, "rms": rms, "rate": rate, "channels": 1}


def check(m):
    problems = []
    if not (PEAK_MIN <= m["peak"] <= PEAK_MAX):
        problems.append(f"pico {m['peak']:.2f} fora de [{PEAK_MIN}, {PEAK_MAX}]")
    if not (DUR_MIN <= m["duration"] <= DUR_MAX):
        problems.append(f"duração {m['duration']:.2f} s fora de [{DUR_MIN}, {DUR_MAX}]")
    return problems


def main(argv):
    out = pathlib.Path(argv[1]) if len(argv) > 1 else ROOT / "audio_samples"
    out.mkdir(parents=True, exist_ok=True)
    names = A.EFFECTS + [A.TRACK]
    failures = 0
    print(f"{'som':<10}{'pico':>7}{'duração':>10}{'RMS':>8}  situação")
    for name in names:
        samples = A.intro_track() if name == A.TRACK else A.synth(name)
        path = A.write_wav(out / f"{name}.wav", samples)
        m = measure(path)
        problems = check(m)
        failures += bool(problems)
        status = "ok" if not problems else "; ".join(problems)
        print(f"{name:<10}{m['peak']:>7.2f}{m['duration']:>9.2f}s{m['rms']:>8.3f}  {status}")
    print("todos dentro dos limites" if not failures else f"{failures} som(ns) fora dos limites")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

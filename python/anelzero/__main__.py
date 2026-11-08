"""Ponto de entrada: python -m anelzero [--slot N] [--novo] [--shot ARQUIVO]."""

import argparse

from .client import run


def main():
    ap = argparse.ArgumentParser(prog="anelzero", description="Anel Zero - Dentro do Processador")
    ap.add_argument("--slot", type=int, default=1, help="slot de salvamento (1 a 3)")
    ap.add_argument("--novo", action="store_true", help="começar um jogo novo neste slot")
    ap.add_argument("--shot", metavar="ARQUIVO", help="salva uma captura de tela e encerra")
    ap.add_argument("--frames", type=int, default=40, help="quadros antes da captura")
    ap.add_argument("--pos", metavar="X,Y", help="posição inicial (útil para verificação)")
    args = ap.parse_args()
    start = tuple(float(v) for v in args.pos.split(",")) if args.pos else None
    run(slot=args.slot, shot=args.shot, frames=args.frames, new_game=args.novo, start_pos=start)


if __name__ == "__main__":
    main()

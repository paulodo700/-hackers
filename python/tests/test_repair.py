"""Reparo de trilhas: caminho até o destino, cruzamentos, fusíveis, pontuação, pausa e modo difícil."""

import random
import unittest

from anelzero import repair as R
from anelzero import state as S


def rng(seed):
    return random.Random(seed).random


class Masks(unittest.TestCase):
    def test_full_rotation_returns_to_start(self):
        for m in range(1, 16):
            self.assertEqual(R.rot_mask(m, 4), m)

    def test_straight_and_curve_types(self):
        self.assertEqual(R.type_of(R.N | R.S), "reto")
        self.assertEqual(R.type_of(R.N | R.E), "curva")
        self.assertEqual(R.type_of(R.CROSS), "cruzamento")
        self.assertEqual(R.type_of(R.N), "ponta")


class Generation(unittest.TestCase):
    def test_path_reaches_target(self):
        for n in (4, 5, 6):
            path = R.random_path(n, rng(n))
            self.assertEqual(path[0], (0, 0))
            self.assertEqual(path[-1], (n - 1, n - 1))

    def test_fresh_puzzle_is_not_solved_from_start(self):
        for seed in range(10):
            p = R.build_puzzle(4, rng(seed), 1)
            self.assertFalse(p.solved(), f"seed {seed} começou resolvido")

    def test_fuse_count_matches_request(self):
        p = R.build_puzzle(5, rng(3), 2)
        fuses = sum(1 for row in p.cells for c in row if c.type == "fusivel")
        self.assertLessEqual(fuses, 2)
        self.assertGreaterEqual(fuses, 1)


class Play(unittest.TestCase):
    def test_crossing_does_not_rotate(self):
        g = R.RepairGame(4, 1, rng=rng(1))
        pos = None
        for y in range(g.puzzle.n):
            for x in range(g.puzzle.n):
                if g.puzzle.cells[y][x].type == "cruzamento":
                    pos = (x, y)
        if pos is None:
            self.skipTest("este quebra-cabeça não tem cruzamento")
        before = g.puzzle.cells[pos[1]][pos[0]].rot
        self.assertEqual(g.rotate(*pos), R.CROSSING)
        self.assertEqual(g.puzzle.cells[pos[1]][pos[0]].rot, before)

    def test_rotation_counts_moves(self):
        g = R.RepairGame(4, 1, rng=rng(2))
        g.rotate(0, 0)
        self.assertEqual(g.moves, 1)

    def test_clicking_known_solution_completes_repair(self):
        # Circuito 2x2 com solução conhecida: (0,0) E -> (1,0) S+O -> (1,1) N
        cells = [[R.Cell(), R.Cell()], [R.Cell(), R.Cell()]]
        spec = {(0, 0): (R.E, "ponta", 1), (1, 0): (R.S | R.W, "curva", 1), (1, 1): (R.N, "ponta", 1)}
        for (x, y), (base, typ, rot) in spec.items():
            cells[y][x].base, cells[y][x].type, cells[y][x].rot = base, typ, rot
        g = R.RepairGame(2, 0, rng=rng(1))
        g.puzzle = R.Puzzle(2, cells)
        self.assertFalse(g.puzzle.solved())
        for (x, y), (base, typ, rot) in spec.items():
            needed = (0 - rot) % 4  # cada clique gira 90 graus no sentido horário
            for _ in range(needed):
                if g.done:
                    break
                g.rotate(x, y)
        self.assertTrue(g.done)
        self.assertTrue(g.success)
        self.assertTrue(g.puzzle.solved())

    def test_burned_fuse_locks(self):
        g = R.RepairGame(4, 1, rng=rng(9))
        fuse = None
        for y in range(g.puzzle.n):
            for x in range(g.puzzle.n):
                if g.puzzle.cells[y][x].type == "fusivel":
                    fuse = (x, y)
        if fuse is None:
            self.skipTest("sem fusível neste puzzle")
        on = g.puzzle.powered()
        if fuse in on:
            g.puzzle.lock_fuses(on)
            self.assertTrue(g.puzzle.cells[fuse[1]][fuse[0]].locked)
            self.assertEqual(g.rotate(*fuse), R.LOCKED)


class Scoring(unittest.TestCase):
    def test_fewer_moves_score_higher(self):
        self.assertGreater(R.score(3, 10), R.score(10, 10))

    def test_less_time_scores_higher(self):
        self.assertGreater(R.score(3, 5), R.score(3, 60))

    def test_time_limit_bonus(self):
        self.assertGreater(R.score(3, 10, 120), R.score(3, 10, 0))

    def test_score_never_negative(self):
        self.assertGreaterEqual(R.score(500, 500), 0)


class Timer(unittest.TestCase):
    def test_timeout_ends_game(self):
        g = R.RepairGame(4, 0, time_limit=3, rng=rng(1))
        g.tick(5)
        self.assertTrue(g.done)
        self.assertTrue(g.timed_out)
        self.assertFalse(g.success)

    def test_pause_freezes_clock(self):
        g = R.RepairGame(4, 0, time_limit=30, rng=rng(1))
        g.tick(2)
        g.toggle_pause()
        g.tick(10)
        self.assertAlmostEqual(g.elapsed, 2)
        g.toggle_pause()
        g.tick(1)
        self.assertAlmostEqual(g.elapsed, 3)

    def test_no_pause_without_time_limit(self):
        g = R.RepairGame(4, 0, rng=rng(1))
        self.assertFalse(g.toggle_pause())

    def test_clicks_ignored_while_paused(self):
        g = R.RepairGame(4, 0, time_limit=30, rng=rng(1))
        g.toggle_pause()
        self.assertIsNone(g.rotate(0, 0))


class Hard(unittest.TestCase):
    def test_hard_mode_is_bigger(self):
        easy = R.RepairGame(4, 1, rng=rng(1))
        hard = R.RepairGame(4, 1, hard=True, rng=rng(1))
        self.assertGreater(hard.puzzle.n, easy.puzzle.n)

    def test_toggle_builds_new_puzzle_and_resets_moves(self):
        g = R.RepairGame(4, 1, rng=rng(1))
        g.rotate(0, 0)
        g.toggle_hard()
        self.assertEqual(g.moves, 0)
        self.assertTrue(g.hard)
        self.assertTrue(g.record_key().endswith("-hard"))

    def test_record_key_per_zone(self):
        g = R.RepairGame(4, 1, zone_key="cache", rng=rng(1))
        self.assertEqual(g.record_key(), "cache")


class RecordsInState(unittest.TestCase):
    def test_best_score_is_kept_per_zone(self):
        st = S.GameState()
        self.assertTrue(st.record_repair_score("cache", 500))
        self.assertFalse(st.record_repair_score("cache", 300))
        self.assertTrue(st.record_repair_score("cache", 800))
        self.assertEqual(st.repairBest["cache"], 800)


if __name__ == "__main__":
    unittest.main()

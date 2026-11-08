"""Funções puras das telas: clique no reparo."""

import unittest

from anelzero import panels as P


class CellAt(unittest.TestCase):
    def test_top_left_cell(self):
        self.assertEqual(P.cell_at(-0.8, 0.8, 4, 0.9), (0, 0))

    def test_bottom_right_cell(self):
        self.assertEqual(P.cell_at(0.8, -0.8, 4, 0.9), (3, 3))

    def test_center_of_cell_roundtrip(self):
        size, n = 0.9, 5
        cell = size * 2 / n
        for c in range(n):
            for r in range(n):
                ax = -size + (c + 0.5) * cell
                ay = size - (r + 0.5) * cell
                self.assertEqual(P.cell_at(ax, ay, n, size), (c, r))

    def test_outside_grid_is_none(self):
        self.assertIsNone(P.cell_at(1.5, 0, 4, 0.9))
        self.assertIsNone(P.cell_at(0, 1.5, 4, 0.9))
        self.assertIsNone(P.cell_at(0, -2, 4, 0.9))


if __name__ == "__main__":
    unittest.main()

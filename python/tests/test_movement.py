"""Movimento contínuo: colisão com paredes e deslizamento ao longo delas."""

import unittest

from anelzero import world as W

BOX = W.Zone("caixa", {"map": ["#####", "#...#", "#...#", "#...#", "#####"], "markers": {}})


class Collision(unittest.TestCase):
    def test_centre_of_room_is_free(self):
        self.assertFalse(W.blocked(BOX, 2, 2))

    def test_next_to_wall_is_blocked(self):
        self.assertTrue(W.blocked(BOX, 0.6, 2))  # encostado na parede esquerda (c=0)
        self.assertFalse(W.blocked(BOX, 1.0, 2))  # um passo para dentro já está livre

    def test_cannot_walk_through_wall(self):
        x, z = W.move(BOX, 1.0, 2, -1.0, 0)
        self.assertGreaterEqual(x, 0.8)

    def test_slides_along_wall(self):
        # Diagonal contra a parede esquerda: o eixo z ainda deve andar
        x, z = W.move(BOX, 1.0, 2.0, -0.5, 0.5)
        self.assertGreaterEqual(x, 0.8)
        self.assertGreater(z, 2.0)


if __name__ == "__main__":
    unittest.main()

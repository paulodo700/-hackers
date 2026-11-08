"""Tamanho do texto ao vivo: os textos registrados mudam de escala sem reiniciar."""

import unittest

from panda3d.core import NodePath, PandaNode

from anelzero import textscale as T


class Live(unittest.TestCase):
    def setUp(self):
        T.apply(1.0)

    def test_register_applies_current_multiplier(self):
        T.apply(1.25)
        node = NodePath(PandaNode("t"))
        T.register(node, 0.1)
        self.assertAlmostEqual(node.getScale().getX(), 0.125)

    def test_apply_rescales_existing_nodes(self):
        node = NodePath(PandaNode("t"))
        T.register(node, 0.2)
        T.apply(1.5)
        self.assertAlmostEqual(node.getScale().getX(), 0.3)
        T.apply(0.85)
        self.assertAlmostEqual(node.getScale().getX(), 0.17)

    def test_destroyed_nodes_are_forgotten(self):
        node = NodePath(PandaNode("t"))
        T.register(node, 0.2)
        before = T.count()
        node.removeNode()
        T.apply(1.0)
        self.assertLess(T.count(), before)


if __name__ == "__main__":
    unittest.main()

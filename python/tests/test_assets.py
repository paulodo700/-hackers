"""Assets 3D do Blender: carregador com fallback, e presença dos arquivos entregues."""

import unittest

from anelzero import assets as A


class Loader(unittest.TestCase):
    def test_missing_asset_is_none(self):
        self.assertFalse(A.has_asset("nao_existe"))
        self.assertIsNone(A.load_model(None, "nao_existe"))

    def test_delivered_assets_exist(self):
        for name in ("bit", "piso", "parede", "canto"):
            with self.subTest(asset=name):
                self.assertTrue(A.has_asset(name))

    def test_glb_files_have_glb_magic(self):
        for name in ("bit", "piso", "parede", "canto"):
            with self.subTest(asset=name):
                head = A.asset_path(name).read_bytes()[:4]
                self.assertEqual(head, b"glTF")


if __name__ == "__main__":
    unittest.main()

"""Ajustes: valores padrão, validação, persistência e ciclo de opções."""

import json
import pathlib
import tempfile
import unittest

from anelzero import settings as T


class Sanitize(unittest.TestCase):
    def test_defaults_when_nothing_given(self):
        self.assertEqual(T.sanitize(None), T.DEFAULTS)

    def test_bad_values_fall_back(self):
        out = T.sanitize({"master": "alto", "text_scale": 9, "difficulty": "impossível", "captions": "sim"})
        self.assertEqual(out["master"], T.DEFAULTS["master"])
        self.assertEqual(out["text_scale"], T.DEFAULTS["text_scale"])
        self.assertEqual(out["difficulty"], T.DEFAULTS["difficulty"])
        self.assertEqual(out["captions"], T.DEFAULTS["captions"])

    def test_volume_is_clamped(self):
        self.assertEqual(T.sanitize({"music": 4})["music"], 1.0)
        self.assertEqual(T.sanitize({"sfx": -2})["sfx"], 0.0)

    def test_unknown_keys_ignored(self):
        self.assertNotIn("hack", T.sanitize({"hack": 1}))


class Persistence(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / "settings.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_file_gives_defaults(self):
        st = T.Settings(self.path).load()
        self.assertEqual(st.data, T.DEFAULTS)

    def test_corrupt_file_gives_defaults(self):
        self.path.write_text("{quebrado", encoding="utf-8")
        self.assertEqual(T.Settings(self.path).load().data, T.DEFAULTS)

    def test_save_and_reload(self):
        st = T.Settings(self.path)
        st.set("difficulty", "dificil")
        st.set("text_scale", 1.25)
        st.save()
        back = T.Settings(self.path).load()
        self.assertEqual(back.get("difficulty"), "dificil")
        self.assertEqual(back.get("text_scale"), 1.25)
        self.assertEqual(json.loads(self.path.read_text(encoding="utf-8"))["difficulty"], "dificil")

    def test_set_unknown_key_rejected(self):
        with self.assertRaises(KeyError):
            T.Settings(self.path).set("xyz", 1)


class Choices(unittest.TestCase):
    def test_cycle_wraps(self):
        st = T.Settings(pathlib.Path(tempfile.gettempdir()) / "x.json")
        st.data = dict(T.DEFAULTS)
        seen = [st.cycle("text_scale", T.TEXT_SCALES) for _ in range(len(T.TEXT_SCALES))]
        self.assertEqual(seen[-1], T.TEXT_SCALES[(T.TEXT_SCALES.index(1.0) + len(T.TEXT_SCALES)) % len(T.TEXT_SCALES)])

    def test_effective_volume_multiplies(self):
        st = T.Settings(pathlib.Path(tempfile.gettempdir()) / "y.json")
        st.data = dict(T.DEFAULTS, master=0.5, sfx=0.5)
        self.assertAlmostEqual(st.volume("sfx"), 0.25)


if __name__ == "__main__":
    unittest.main()

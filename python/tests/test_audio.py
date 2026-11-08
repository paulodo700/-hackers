"""Efeitos sonoros: síntese válida, WAV correto, determinismo e volume dentro do limite."""

import math
import pathlib
import tempfile
import unittest
import wave

from anelzero import audio as A


class Synthesis(unittest.TestCase):
    def test_every_effect_has_samples_in_range(self):
        for name in A.EFFECTS:
            with self.subTest(effect=name):
                samples = A.synth(name)
                self.assertGreater(len(samples), 100)
                self.assertTrue(all(math.isfinite(s) for s in samples))
                self.assertLessEqual(max(abs(s) for s in samples), 1.0 + 1e-9)

    def test_effects_are_deterministic(self):
        self.assertEqual(A.synth("pesado"), A.synth("pesado"))

    def test_unknown_effect_raises(self):
        with self.assertRaises(KeyError):
            A.synth("nao_existe")


class Files(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def test_generate_writes_valid_wav_files(self):
        paths = A.generate(self.tmp.name)
        self.assertEqual(set(paths), set(A.EFFECTS))
        for name, path in paths.items():
            with self.subTest(effect=name), wave.open(str(path), "rb") as w:
                self.assertEqual(w.getnchannels(), 1)
                self.assertEqual(w.getsampwidth(), 2)
                self.assertEqual(w.getframerate(), A.RATE)
                self.assertGreater(w.getnframes(), 0)

    def test_generate_does_not_rewrite_existing(self):
        A.generate(self.tmp.name)
        p = pathlib.Path(self.tmp.name) / "passo.wav"
        mtime = p.stat().st_mtime_ns
        A.generate(self.tmp.name)
        self.assertEqual(p.stat().st_mtime_ns, mtime)


if __name__ == "__main__":
    unittest.main()

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


class Track(unittest.TestCase):
    def test_track_is_about_eight_seconds_and_in_range(self):
        samples = A.intro_track()
        self.assertAlmostEqual(len(samples) / A.RATE, 8.0, delta=0.1)
        self.assertLessEqual(max(abs(x) for x in samples), 1.0)

    def test_track_loops_without_a_click(self):
        samples = A.intro_track()
        # Diferença entre a última e a primeira amostra: pequena, para o laço não estalar
        self.assertLess(abs(samples[-1] - samples[0]), 0.1)


class Files(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def test_generate_writes_valid_wav_files(self):
        paths = A.generate(self.tmp.name)
        self.assertEqual(set(paths), set(A.EFFECTS) | {A.TRACK})
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

"""Caixa de diálogo, falas de NPC e baús."""

import unittest

from anelzero import dialog as D
from anelzero import state as S


class Typing(unittest.TestCase):
    def test_reveals_text_over_time(self):
        tw = D.Typewriter("abcdef", cps=10)
        tw.update(0.2)
        self.assertEqual(tw.shown(), "ab")
        self.assertFalse(tw.done())
        tw.update(1.0)
        self.assertTrue(tw.done())
        self.assertEqual(tw.shown(), "abcdef")

    def test_advance_completes_then_moves_on(self):
        d = D.Dialog([{"s": "A", "t": "primeira"}, {"s": "B", "t": "segunda"}])
        self.assertEqual(d.shown_text(), "")
        d.advance()  # completa a digitação
        self.assertEqual(d.shown_text(), "primeira")
        self.assertEqual(d.index, 0)
        d.advance()  # próxima fala
        self.assertEqual(d.index, 1)
        d.update(10)
        d.advance()
        self.assertTrue(d.closed)


class Choices(unittest.TestCase):
    def test_numbered_choice_returns_value(self):
        d = D.Dialog([{"s": "V", "t": "Escolha."}],
                     choices=[{"label": "a", "value": "paz"}, {"label": "b", "value": "guerra"}])
        self.assertIsNone(d.choose(1))  # ainda digitando
        d.update(10)
        self.assertTrue(d.waiting_choice())
        self.assertIsNone(d.choose(5))  # fora do intervalo
        self.assertEqual(d.choose(2), "guerra")
        self.assertTrue(d.closed)

    def test_at_most_three_choices_shown(self):
        d = D.Dialog([{"s": "V", "t": "x"}], choices=[{"label": str(i), "value": i} for i in range(5)])
        self.assertEqual(len(d.choices), 3)

    def test_empty_dialog_rejected(self):
        with self.assertRaises(ValueError):
            D.Dialog([])


class NpcAndChests(unittest.TestCase):
    def test_talk_returns_lines_and_applies_actions(self):
        st = S.GameState()
        got = st.talk("sementa")
        self.assertIsNotNone(got)
        self.assertEqual(got["name"], "Sementa")
        self.assertTrue(got["lines"])

    def test_unknown_npc_returns_none(self):
        self.assertIsNone(S.GameState().talk("ninguem"))

    def test_give_action_adds_items(self):
        st = S.GameState()
        before = st.inv.get("kit_solda", 0)
        st.apply_action({"give": ["kit_solda", 2]})
        self.assertEqual(st.inv["kit_solda"], before + 2)

    def test_named_chest_opens_once(self):
        st = S.GameState()
        first = st.open_chest("regs_c1")
        self.assertTrue(first)
        self.assertIsNone(st.open_chest("regs_c1"))

    def test_extra_chest_gives_zone_item(self):
        st = S.GameState()
        got = st.open_chest("x", "regs", 3, 4)
        self.assertEqual(len(got), 1)


if __name__ == "__main__":
    unittest.main()

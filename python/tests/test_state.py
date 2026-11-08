"""Testes do estado do jogo: atributos, inventário, XP, missões, salvamento e migração."""

import json
import pathlib
import tempfile
import unittest

from anelzero import content as C
from anelzero import state as S
from anelzero import combat as K


class XpAndLevels(unittest.TestCase):
    def test_xp_curve_is_monotonic(self):
        values = [S.xp_for_level(l) for l in range(1, 20)]
        self.assertEqual(values, sorted(values))
        self.assertEqual(S.xp_for_level(1), 40)

    def test_gain_xp_levels_up_and_refills_vitals(self):
        st = S.GameState()
        st.hp = 1
        ups = st.gain_xp(S.xp_for_level(1))
        self.assertEqual(ups, 1)
        self.assertEqual(st.level, 2)
        self.assertEqual(st.skillPoints, 1)
        self.assertEqual(st.hp, st.max_hp())

    def test_gain_xp_multiple_levels_at_once(self):
        st = S.GameState()
        ups = st.gain_xp(sum(S.xp_for_level(l) for l in range(1, 4)))
        self.assertEqual(ups, 3)
        self.assertEqual(st.level, 4)
        self.assertEqual(st.xp, 0)


class Inventory(unittest.TestCase):
    def test_start_inventory_and_add_remove(self):
        st = S.GameState()
        self.assertTrue(st.has_item("pasta_termica"))
        st.add_item("pasta_termica", 3)
        self.assertEqual(st.inv["pasta_termica"], 5)
        self.assertTrue(st.remove_item("pasta_termica", 5))
        self.assertFalse(st.has_item("pasta_termica"))

    def test_unknown_item_is_ignored(self):
        st = S.GameState()
        self.assertEqual(st.add_item("item_que_nao_existe"), 0)
        self.assertNotIn("item_que_nao_existe", st.inv)

    def test_consumable_heals_and_is_consumed(self):
        st = S.GameState()
        st.hp = 1
        before = st.inv["pasta_termica"]
        result = st.use_consumable("pasta_termica")
        self.assertIsNotNone(result)
        self.assertGreater(st.hp, 1)
        self.assertLessEqual(st.hp, st.max_hp())
        self.assertEqual(st.inv["pasta_termica"], before - 1)

    def test_collect_counter_is_bumped(self):
        st = S.GameState()
        st.add_item("pasta_termica", 2)
        self.assertEqual(st.counter("collect_pasta_termica"), 2)


class Derived(unittest.TestCase):
    def test_skill_raises_attack_and_hp(self):
        st = S.GameState()
        base_atk, base_hp = st.atk(), st.max_hp()
        st.skills["lamina"] = 2
        st.skills["vigor"] = 1
        self.assertEqual(st.atk(), base_atk + 4)
        self.assertEqual(st.max_hp(), base_hp + 10)

    def test_clamp_vitals_never_exceeds_max(self):
        st = S.GameState()
        st.hp = 10_000
        st.en = 10_000
        st.clamp_vitals()
        self.assertEqual(st.hp, st.max_hp())
        self.assertEqual(st.en, st.max_en())


class Quests(unittest.TestCase):
    def test_quest_stage_zero_before_start(self):
        st = S.GameState()
        qid = C.QUEST_ORDER[0]
        self.assertEqual(st.quest_status(qid), "none")
        self.assertEqual(st.quest_stage(qid), 0)

    def test_start_quest_only_once(self):
        st = S.GameState()
        qid = C.QUEST_ORDER[0]
        self.assertTrue(st.start_quest(qid))
        self.assertFalse(st.start_quest(qid))
        self.assertEqual(st.active_quest(), qid)

    def test_completing_all_stages_grants_reward_once(self):
        st = S.GameState()
        qid = C.QUEST_ORDER[0]
        st.start_quest(qid)
        for stage in C.QUESTS[qid]["stages"]:
            if "flag" in stage:
                st.set_flag(stage["flag"])
            elif "count" in stage:
                st.bump(stage["count"], stage["n"])
            elif "kill" in stage:
                st.bump(f"kill_{stage['kill']}", stage["n"])
        gold_before = st.gold
        done = st.check_quests()
        self.assertTrue(any(d["id"] == qid for d in done))
        self.assertEqual(st.quest_status(qid), "done")
        self.assertEqual(st.gold, gold_before + C.QUESTS[qid]["reward"].get("gold", 0))
        self.assertEqual(st.check_quests(), [])

    def test_scene_gate_blocks_until_stage(self):
        st = S.GameState()
        qid = C.QUEST_ORDER[0]
        w = {"gate": {"quest": qid, "minStage": 1}}
        self.assertFalse(st.scene_matches(w))
        st.start_quest(qid)
        st.quests[qid] = {"status": "active"}
        for stage in C.QUESTS[qid]["stages"][:1]:
            if "flag" in stage:
                st.set_flag(stage["flag"])
            elif "count" in stage:
                st.bump(stage["count"], stage["n"])
            elif "kill" in stage:
                st.bump(f"kill_{stage['kill']}", stage["n"])
        self.assertTrue(st.scene_matches(w))


class Migration(unittest.TestCase):
    def test_v1_save_gets_skill_points_and_new_fields(self):
        old = {"version": 1, "level": 4, "gold": 50}
        out = S.migrate(old)
        self.assertEqual(out["version"], S.SAVE_VERSION)
        self.assertEqual(out["skillPoints"], 3)
        self.assertEqual(out["skills"], {})
        self.assertEqual(out["visited"], {})
        self.assertEqual(out["gold"], 50)

    def test_v2_save_gets_visited_only(self):
        out = S.migrate({"version": 2, "skills": {"vigor": 1}, "skillPoints": 2})
        self.assertEqual(out["skills"], {"vigor": 1})
        self.assertEqual(out["skillPoints"], 2)
        self.assertEqual(out["visited"], {})


class Slots(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.slots = S.SaveSlots(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_slot_has_no_info(self):
        self.assertIsNone(self.slots.info(1))
        self.assertIsNone(self.slots.load(1))

    def test_save_and_load_round_trip(self):
        st = S.GameState()
        st.gold = 123
        st.gain_xp(200)
        st.set_flag("teste")
        st.mark_visited("regs", 3, 4)
        self.slots.save(2, st)
        back = self.slots.load(2)
        self.assertEqual(back.gold, 123)
        self.assertEqual(back.level, st.level)
        self.assertTrue(back.has_flag("teste"))
        self.assertTrue(back.is_visited("regs", 3, 4))
        self.assertEqual(self.slots.info(2)["gold"], 123)

    def test_delete_slot(self):
        self.slots.save(3, S.GameState())
        self.slots.delete(3)
        self.assertIsNone(self.slots.info(3))

    def test_corrupt_file_is_treated_as_empty(self):
        (pathlib.Path(self.tmp.name) / "slot-1.json").write_text("{não é json", encoding="utf-8")
        self.assertIsNone(self.slots.load(1))

    def test_legacy_save_moves_to_slot_one_once(self):
        legacy = pathlib.Path(self.tmp.name) / "legacy.json"
        legacy.write_text(json.dumps({"version": 1, "level": 7, "gold": 9}), encoding="utf-8")
        self.assertTrue(self.slots.migrate_legacy(legacy))
        loaded = self.slots.load(1)
        self.assertEqual(loaded.level, 7)
        self.assertEqual(loaded.version, S.SAVE_VERSION)
        self.assertFalse(self.slots.migrate_legacy(legacy))


class CombatRules(unittest.TestCase):
    def test_damage_never_below_one(self):
        self.assertEqual(K.dmg_from(1, 999, rng=lambda: 0.5), 1)

    def test_heavy_intent_hits_harder_than_normal(self):
        normal = K.enemy_hit(20, 2, "normal", False, rng=lambda: 0.5)
        heavy = K.enemy_hit(20, 2, "pesado", False, rng=lambda: 0.5)
        self.assertGreater(heavy, normal)

    def test_easy_difficulty_reduces_damage(self):
        normal = K.enemy_hit(20, 2, "normal", False, "normal", rng=lambda: 0.5)
        easy = K.enemy_hit(20, 2, "normal", False, "facil", rng=lambda: 0.5)
        self.assertLess(easy, normal)

    def test_phase_two_at_half_hp_only_once(self):
        self.assertTrue(K.should_enter_phase2(True, 50, 100, False))
        self.assertFalse(K.should_enter_phase2(True, 50, 100, True))
        self.assertFalse(K.should_enter_phase2(False, 10, 100, False))

    def test_swing_hits_front_and_misses_behind(self):
        facing = 0.0  # olhando para +z
        self.assertTrue(K.in_swing_arc(0, 0, facing, 0, 1.0))
        self.assertFalse(K.in_swing_arc(0, 0, facing, 0, -1.0))
        self.assertFalse(K.in_swing_arc(0, 0, facing, 0, 5.0))

    def test_swing_targets_skip_dead_roamers(self):
        class R:
            def __init__(self, x, z, alive):
                self.x, self.z, self.alive = x, z, alive
        roamers = [R(0, 1, True), R(0, 1.2, False)]
        self.assertEqual(len(K.swing_targets(0, 0, 0.0, roamers)), 1)

    def test_contact_damage_has_minimum(self):
        self.assertEqual(K.contact_damage(1, 500, rng=lambda: 0.5), 1)


if __name__ == "__main__":
    unittest.main()

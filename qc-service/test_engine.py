"""Run in the service image with: python -m unittest -v test_engine."""
import unittest

import numpy as np
import pandas as pd

from engine import preview, set_slot
from historical import run


def rows(values, quality=255, start="2026-01-01T00:00Z"):
    return [{"key": str(i), "id": str(i), "time": stamp.isoformat(), "ts": int(stamp.timestamp() * 1000),
             "result": value, "resultQuality": quality, "scope": "window"}
            for i, (stamp, value) in enumerate(zip(pd.date_range(start, periods=len(values), freq="min"), values))]


CHECKS = [{"type": "flagRange", "min": 0, "max": 10},
          {"type": "flagConstants", "window": "3min", "thresh": 0},
          {"type": "flagZScore", "window": "6min", "method": "modified", "thresh": 3.5, "center": False}]


class EngineTests(unittest.TestCase):
    def test_saqc_bad_is_encoded_in_its_slot_not_stored_as_255(self):
        result = preview(rows([100]), CHECKS, [1], "PT1M")
        self.assertEqual(result["results"][0]["resultQuality"], 251)

    def test_multiple_failures_are_preserved(self):
        result = preview(rows(list(range(9)) + [100]), CHECKS, [1, 3], "PT1M")
        self.assertEqual(result["results"][-1]["resultQuality"], 187)

    def test_partial_history_is_not_a_pass(self):
        result = preview(rows([1, 2, 3]), CHECKS, [3], "PT1M")
        self.assertEqual(result["results"][-1]["resultQuality"], 63)
        self.assertIn("history", result["results"][-1]["outcomes"][-1]["reason"].lower())

    def test_coverage_excludes_missing_sentinels(self):
        data = rows([1, 2, 3, 4, 999.9, 999.9, 999.9, 8, 9, 10])
        result = preview(data, CHECKS, [3], "PT1M")
        outcome = result["results"][-1]["outcomes"][-1]
        self.assertEqual(outcome["state"], 0)
        self.assertIn("coverage", outcome["reason"].lower())

    def test_all_no_data_markers_have_whole_mask_zero(self):
        result = preview(rows([None, 999.9, -999, -9999, -999.9, -999.99]), CHECKS, [1, 2, 3], "PT1M")
        self.assertEqual([row["resultQuality"] for row in result["results"]], [0] * 6)

    def test_unselected_slots_and_data_state_are_preserved(self):
        data = rows([100], quality=2 | (3 << 2) | (1 << 8))
        quality = preview(data, CHECKS, [1], "PT1M")["results"][0]["resultQuality"]
        self.assertEqual(quality, 2 | (2 << 2) | (1 << 8))

    def test_new_quality_uses_data_state_plus_check(self):
        result = preview(rows([5], quality=None), CHECKS[:1], [1], "PT1M")
        self.assertEqual(result["results"][0]["resultQuality"], 15)

    def test_typo_and_unsafe_parameters_leave_not_run_with_reason(self):
        for constraint in [{"type": "flagRange", "mn": 0}, {"type": "flagRange", "flag": 100},
                           {"type": "flagZScore", "window": "6m", "center": False},
                           {"type": "flagZScore", "window": "3min", "center": True}]:
            with self.subTest(constraint=constraint):
                result = preview(rows([100], quality=15), [constraint], [1], "PT1M")
                self.assertEqual(result["results"][0]["resultQuality"], 3)
                self.assertTrue(result["warnings"])

    def test_value_edit_invalidates_following_dependencies_outside_selection(self):
        data = rows(list(range(10)))
        for row in data[5:]:
            row["scope"] = "following"
        result = preview(data, CHECKS, [], "PT1M", edited_keys=["4"], target_keys=["4"])
        by_key = {row["key"]: row for row in result["results"]}
        self.assertIn("5", by_key)
        self.assertNotIn(1, by_key["5"]["staleSlots"])
        self.assertIn(3, by_key["5"]["staleSlots"])
        self.assertEqual(by_key["5"]["resultQuality"] & (3 << 6), 0)

    def test_resolved_unselected_check_is_not_invalidated_again(self):
        data = rows([5, 100, 5])
        data[1]["resolvedSlots"] = [1]
        data[1]["resultQuality"] = 251
        result = preview(data, CHECKS, [2], "PT1M", edited_keys=["1"], target_keys=["1"])
        row = next(row for row in result["results"] if row["key"] == "1")
        self.assertEqual(row["resultQuality"] & 12, 8)
        self.assertNotIn(1, row["staleSlots"])

    def test_multiple_edits_invalidate_only_their_causal_windows(self):
        checks = [dict(c) for c in CHECKS]
        checks[2]["window"] = "3min"
        result = preview(rows(list(range(12))), checks, [], "PT1M", edited_keys=["1", "7"])
        by_key = {row["key"]: row for row in result["results"]}
        self.assertIn(3, by_key["2"]["staleSlots"])
        self.assertNotIn(3, by_key["5"]["staleSlots"])
        self.assertIn(3, by_key["8"]["staleSlots"])
        self.assertNotIn(3, by_key["11"]["staleSlots"])

    def test_selection_does_not_modify_unrelated_rows(self):
        result = preview(rows([1, 100, 3]), CHECKS, [1], "PT1M", target_keys=["1"])
        self.assertEqual([row["key"] for row in result["results"]], ["1"])

    def test_strict_selection_keeps_edited_dependencies_outside_its_results(self):
        data = rows(list(range(10)))
        for row in data[5:]:
            row["scope"] = "following"
        data[4]["staleSlots"] = [1, 2, 3]
        data[5]["staleSlots"] = [2, 3]
        result = preview(data, CHECKS, [1], "PT1M", edited_keys=["4"],
                         target_keys=["4"], include_affected=False)
        self.assertEqual([row["key"] for row in result["results"]], ["4"])
        self.assertEqual(data[5]["resultQuality"], 255)
        self.assertEqual(data[5]["staleSlots"], [2, 3])

    def test_empty_explicit_selection_never_falls_back_to_all_or_affected(self):
        result = preview(rows(list(range(10))), CHECKS, [1], "PT1M",
                         edited_keys=["4"], target_keys=[], include_affected=False)
        self.assertEqual(result["results"], [])

    def test_selected_window_check_reads_neighbours_without_returning_their_flags(self):
        data = rows([5] * 12)
        for row in data[:10]:
            row["scope"] = "history"
        result = preview(data, CHECKS, [2], "PT1M", target_keys=["11"], include_affected=False)
        self.assertEqual([row["key"] for row in result["results"]], ["11"])
        self.assertEqual(result["results"][0]["outcomes"][-1]["state"], 2)
        self.assertEqual(data[10]["resultQuality"], 255)

    def test_all_loaded_scope_excludes_affected_following_context(self):
        data = rows(list(range(10)))
        for row in data[5:]:
            row["scope"] = "following"
        result = preview(data, CHECKS, [1], "PT1M", edited_keys=["4"],
                         target_keys=[str(i) for i in range(5)], include_affected=False)
        self.assertEqual([row["key"] for row in result["results"]], [str(i) for i in range(5)])

    def test_structured_and_non_mask_quality_is_rejected(self):
        for value in [{"quality": 100}, 1024, -1, True, "bad"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                preview(rows([5], quality=value), CHECKS, [1], "PT1M")

    def test_explicit_repair_rebuilds_foreign_flags_from_actual_range_results(self):
        data = rows([5, 500, None], quality=201)
        result = preview(data, CHECKS[:1], [1], "PT1M", repair_unknown_quality=True)
        self.assertEqual([row["resultQuality"] for row in result["results"]], [15, 11, 0])
        self.assertTrue(all(not row["staleSlots"] for row in result["results"]))
        self.assertTrue(all(row["resultQuality"] == 201 for row in data))
        self.assertIn("Rebuilt 3 unknown quality flags", result["warnings"][0])

    def test_unknown_quality_repair_does_not_invent_unrun_checks_or_human_review(self):
        for quality in [2017, -1, True, "bad", {"quality": 100}]:
            with self.subTest(quality=quality):
                result = preview(rows([5], quality=quality), CHECKS, [1], "PT1M", repair_unknown_quality=True)
                row = result["results"][0]
                self.assertEqual(row["resultQuality"], 15)
                self.assertEqual(row["staleSlots"], [2, 3])
                self.assertEqual((row["resultQuality"] >> 8) & 3, 0)

    def test_repair_is_limited_to_requested_observations_not_unknown_context(self):
        data = rows([5, 500, 5], quality=201)
        result = preview(data, CHECKS[:1], [1], "PT1M", target_keys=["1"],
                         include_affected=False, repair_unknown_quality=True)
        self.assertEqual([(row["key"], row["resultQuality"]) for row in result["results"]], [("1", 11)])
        self.assertEqual([row["resultQuality"] for row in data], [201, 201, 201])

    def test_repair_clears_reserved_check_and_human_pairs(self):
        result = preview(rows([5], quality=3 | (1 << 2) | (1 << 4)), CHECKS[:1], [1],
                         "PT1M", repair_unknown_quality=True)
        self.assertEqual(result["results"][0]["resultQuality"], 15)
        self.assertTrue(result["warnings"])

    def test_repair_preserves_valid_data_states_and_explicit_human_decisions(self):
        for state in (1, 2, 3):
            quality = state | (2 << 2) | (3 << 4)
            result = preview(rows([5], quality=quality), CHECKS[:1], [1],
                             "PT1M", repair_unknown_quality=True)
            self.assertEqual(result["results"][0]["resultQuality"], state | (3 << 2) | (3 << 4))
            self.assertEqual(result["warnings"], [])

    def test_failed_repair_check_leaves_not_run_instead_of_a_passing_flag(self):
        result = preview(rows([5], quality=201), [{"type": "unsupported"}], [1],
                         "PT1M", repair_unknown_quality=True)
        self.assertEqual(result["results"][0]["resultQuality"], 3)
        self.assertEqual(result["results"][0]["outcomes"][-1]["state"], 0)
        self.assertTrue(result["warnings"])

    def test_duplicates_are_rejected(self):
        data = rows([1, 2])
        data[1]["time"], data[1]["ts"] = data[0]["time"], data[0]["ts"]
        with self.assertRaises(ValueError):
            preview(data, CHECKS, [1], "PT1M")

    def test_buffered_results_match_individual_saqc_calls(self):
        values = np.array([1, 2, 2, 2, 2, 3, 3, 50, 4, 5, 5, 5, 6, 7, 8, 80], float)
        data = rows(values.tolist(), quality=3)
        result = preview(data, CHECKS, [1, 2, 3], "PT1M")
        times = pd.to_datetime([row["time"] for row in data], utc=True).tz_localize(None).to_numpy()
        for i, row in enumerate(result["results"]):
            for outcome in row["outcomes"]:
                if outcome["slot"] == 0 or outcome["state"] == 0:
                    continue
                own = slice(max(0, i - 9 + 1), i + 1)  # max window 6min + 3
                expected_bad = run(CHECKS[outcome["slot"] - 1], times[own], values[own])[-1]
                self.assertEqual(outcome["state"], 2 if expected_bad else 3)

    def test_human_verdict_survives_checks_and_is_independent_of_failed_automatic_checks(self):
        result = preview(rows([100], quality=1023), CHECKS, [1], "PT1M")
        self.assertEqual(result["results"][0]["resultQuality"], 1019)
        self.assertEqual((result["results"][0]["resultQuality"] >> 8) & 3, 3)

    def test_corrected_values_use_filled_bits_and_rechecked_human_verdict_is_preserved(self):
        result = preview(rows([100], quality=1023), CHECKS, [1], "PT1M", edited_keys=["0"])
        self.assertEqual(result["results"][0]["resultQuality"] & 3, 2)
        self.assertEqual((result["results"][0]["resultQuality"] >> 8) & 3, 3)

    def test_human_pair_tracks_the_number_of_checks_and_rejects_bits_beyond_it(self):
        for count in (0, 1, 3, 4):
            constraints = (CHECKS + [{"type": "flagNAN"}])[:count]
            maximum = (1 << (2 * (count + 2))) - 1
            quality = preview(rows([5], quality=maximum), constraints, [], "PT1M")["results"][0]["resultQuality"]
            self.assertEqual(quality, maximum)
            with self.assertRaises(ValueError):
                preview(rows([5], quality=maximum + 1), constraints, [], "PT1M")

    def test_digital_data_and_reviewed_missing_data_are_preserved(self):
        digital = preview(rows([5], quality=1), [], [], "PT1M")["results"][0]["resultQuality"]
        self.assertEqual(digital, 1)
        reviewed_missing = preview(rows([None], quality=8), [], [], "PT1M")["results"][0]["resultQuality"]
        self.assertEqual(reviewed_missing, 8)

    def test_new_function_adapters_match_individual_saqc_buffers(self):
        values = [5, 5, 5, 5, 20, 5, 5, 5, 5, 5]
        data = rows(values, quality=3)
        times = pd.to_datetime([row["time"] for row in data], utc=True).tz_localize(None).to_numpy()
        for constraint in [{"type": "flagJumps", "window": "3min", "thresh": 5},
                           {"type": "flagByVariance", "window": "3min", "thresh": 0.1}]:
            result = preview(data, [constraint], [1], "PT1M")
            self.assertFalse(result["warnings"], result["warnings"])
            for i, row in enumerate(result["results"]):
                outcome = row["outcomes"][-1]
                if outcome["state"]:
                    own = slice(max(0, i - 6 + 1), i + 1)
                    self.assertEqual(outcome["state"], 2 if run(constraint, times[own], np.array(values[own]))[-1] else 3)

    def test_new_recipe_limit_is_enforced_in_python_as_well_as_next(self):
        with self.assertRaises(ValueError):
            preview(rows([5], quality=3), CHECKS + [{"type": "flagNAN"}], [], "PT1M", quality_mode="converted")
        self.assertTrue(preview(rows([5], quality=3), CHECKS, [1], "PT1M", quality_mode="converted")["results"])


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import AsyncMock, patch

from akim_api import analysis, engine
from akim_api.ai import AIAnalysis, ScenarioInput


DEMO_DECISIONS = [
    {"initiative_id": "M7", "district_id": "nura"},
    {"initiative_id": "M8", "district_id": "nura"},
    {"initiative_id": "M10", "district_id": "nura"},
    {"initiative_id": "M12"},
    {"initiative_id": "M5", "district_id": "saryarka"},
]


class EngineTests(unittest.TestCase):
    def test_fixed_baseline_and_sample_scenario(self):
        baseline = engine.preview([])
        self.assertEqual(baseline["projected_score"], 52.56)
        self.assertEqual(baseline["score_delta"], 0)
        self.assertEqual(baseline["budget"], {"total": 100, "spent": 0, "remaining": 100})
        self.assertFalse(baseline["complete"])
        self.assertEqual(baseline["critical_pairs"], 2)

        result = engine.evaluate(DEMO_DECISIONS)
        self.assertEqual(result["budget"], {"total": 100, "spent": 95, "remaining": 5})
        self.assertEqual(result["score"], 56.54)
        self.assertEqual(result["score_delta"], 3.98)
        self.assertEqual(result["critical_pairs"], 0)
        nura = next(item for item in result["districts"] if item["id"] == "nura")
        self.assertEqual(nura["indicators"]["S1"], 48)
        self.assertEqual(nura["indicators"]["S2"], 43.75)
        self.assertEqual(nura["indicators"]["B1"], 67.5)
        self.assertEqual(len(result["synergies"]), 1)
        self.assertEqual(result["synergies"][0]["district_id"], "nura")

    def test_preview_supports_partial_choices_and_marks_unavailable_options(self):
        draft = [{"initiative_id": "M7", "district_id": "nura"}]
        result = engine.preview(draft)
        self.assertFalse(result["complete"])
        self.assertEqual(result["budget"]["spent"], 24)
        self.assertIsNotNone(result["availability"]["M7"]["nura"])
        self.assertIsNone(result["replacement_availability"]["M7"]["nura"])
        self.assertEqual(result["districts"][-1]["indicators"]["S1"], 48)

    def test_citywide_measure_changes_every_district(self):
        result = engine.preview([{"initiative_id": "M12"}])
        for district in result["districts"]:
            self.assertEqual(district["indicators"]["C2"], district["before"]["C2"] + 4.375)

    def test_rejects_wrong_count_duplicates_and_unknown_ids(self):
        with self.assertRaisesRegex(engine.ScenarioError, "ровно 5") as count_error:
            engine.evaluate(DEMO_DECISIONS[:4])
        self.assertEqual(count_error.exception.code, "wrong_decision_count")
        with self.assertRaises(engine.ScenarioError) as duplicate_error:
            engine.preview([DEMO_DECISIONS[0], DEMO_DECISIONS[0]])
        self.assertEqual(duplicate_error.exception.code, "duplicate_initiative")
        with self.assertRaises(engine.ScenarioError) as unknown_error:
            engine.preview([{"initiative_id": "M99"}])
        self.assertEqual(unknown_error.exception.code, "unknown_initiative")

    def test_rejects_scope_errors_budget_domain_limit_and_conflicts(self):
        cases = [
            ([{"initiative_id": "M7"}], "district_required"),
            ([{"initiative_id": "M12", "district_id": "nura"}], "district_not_allowed"),
            ([
                {"initiative_id": "M5", "district_id": "saryarka"},
                {"initiative_id": "M13", "district_id": "nura"},
                {"initiative_id": "M7", "district_id": "esil"},
                {"initiative_id": "M8", "district_id": "esil"},
                {"initiative_id": "M10", "district_id": "nura"},
            ], "budget_exceeded"),
            ([
                {"initiative_id": "M7", "district_id": "nura"},
                {"initiative_id": "M8", "district_id": "nura"},
                {"initiative_id": "M9", "district_id": "esil"},
                {"initiative_id": "M10", "district_id": "nura"},
                {"initiative_id": "M12"},
            ], "domain_limit"),
            ([
                {"initiative_id": "M1", "district_id": "nura"},
                {"initiative_id": "M3", "district_id": "esil"},
                {"initiative_id": "M4", "district_id": "saryarka"},
                {"initiative_id": "M10", "district_id": "nura"},
                {"initiative_id": "M12"},
            ], "incompatible_initiatives"),
            ([
                {"initiative_id": "M4", "district_id": "nura"},
                {"initiative_id": "M7", "district_id": "nura"},
                {"initiative_id": "M8", "district_id": "esil"},
                {"initiative_id": "M10", "district_id": "baikonur"},
                {"initiative_id": "M12"},
            ], "incompatible_initiatives"),
            ([
                {"initiative_id": "M5", "district_id": "nura"},
                {"initiative_id": "M13", "district_id": "nura"},
                {"initiative_id": "M9", "district_id": "esil"},
                {"initiative_id": "M10", "district_id": "baikonur"},
                {"initiative_id": "M12"},
            ], "incompatible_initiatives"),
        ]
        for decisions, expected_code in cases:
            with self.subTest(code=expected_code, decisions=decisions):
                with self.assertRaises(engine.ScenarioError) as caught:
                    engine.preview(decisions)
                self.assertEqual(caught.exception.code, expected_code)


class AnalysisAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_ai_adapter_receives_validated_calculation_and_keeps_score(self):
        result = engine.evaluate(DEMO_DECISIONS)
        score = result["score"]
        ai_text = AIAnalysis(
            summary="Результат рассчитан сервером.", strengths=[], tradeoffs=[], risks=[], recommendations=[]
        )
        settings = type("Settings", (), {"enabled": True})()
        with patch.object(analysis, "AISettings", return_value=settings), \
             patch.object(analysis, "explain_scenario", new_callable=AsyncMock, return_value=ai_text) as explain:
            await analysis.enrich_analysis(result, DEMO_DECISIONS)
        self.assertEqual(result["score"], score)
        self.assertEqual(result["ai_status"], "available")
        self.assertEqual(result["ai_analysis"]["summary"], "Результат рассчитан сервером.")
        payload = explain.await_args.args[0]
        self.assertIsInstance(payload, ScenarioInput)
        self.assertEqual(payload.decisions[3].district_id, None)
        self.assertEqual(len(payload.districts), 5)

    async def test_ai_disabled_and_unavailable_keep_deterministic_explanation(self):
        result = engine.evaluate(DEMO_DECISIONS)
        with patch.object(analysis, "AISettings", side_effect=RuntimeError("bad config")):
            await analysis.enrich_analysis(result, DEMO_DECISIONS)
        self.assertEqual(result["ai_status"], "unavailable")
        self.assertIsNone(result["ai_analysis"])
        self.assertIn("summary", result["model_analysis"])
        self.assertEqual(result["score"], 56.54)

        result = engine.evaluate(DEMO_DECISIONS)
        with patch.object(analysis, "explain_scenario", new_callable=AsyncMock, return_value=None), \
             patch.object(analysis, "AISettings", return_value=type("Settings", (), {"enabled": True})()):
            await analysis.enrich_analysis(result, DEMO_DECISIONS)
        self.assertEqual(result["ai_status"], "unavailable")
        self.assertIsNone(result["ai_analysis"])
        self.assertEqual(result["model_analysis"]["summary"], engine.explanation(result)["summary"])


if __name__ == "__main__":
    unittest.main()

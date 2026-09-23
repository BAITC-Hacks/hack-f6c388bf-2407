import unittest

from httpx import ASGITransport, AsyncClient

from akim_api.main import app


DEMO_REQUEST = {
    "decisions": [
        {"initiative_id": "M7", "district_id": "nura"},
        {"initiative_id": "M8", "district_id": "nura"},
        {"initiative_id": "M10", "district_id": "nura"},
        {"initiative_id": "M12"},
        {"initiative_id": "M5", "district_id": "saryarka"},
    ],
    "include_ai_analysis": False,
}


class ScenarioApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_and_catalog(self):
        health = await self.client.get("/api/v1/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json(), {"status": "ok"})

        response = await self.client.get("/api/v1/scenario/catalog")
        catalog = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(catalog["budget"], 100)
        self.assertEqual(len(catalog["districts"]), 5)
        self.assertEqual(len(catalog["initiatives"]), 14)
        self.assertEqual(catalog["baseline_result"]["projected_score"], 52.56)

    async def test_partial_preview_and_full_evaluation(self):
        preview = await self.client.post(
            "/api/v1/scenario/preview",
            json={"decisions": DEMO_REQUEST["decisions"][:1]},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertFalse(preview.json()["complete"])
        self.assertEqual(preview.json()["budget"]["spent"], 24)

        response = await self.client.post(
            "/api/v1/scenario/evaluate", json=DEMO_REQUEST
        )
        result = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(result["score"], 56.54)
        self.assertEqual(result["score_delta"], 3.98)
        self.assertEqual(result["ai_status"], "disabled")
        self.assertIsNone(result["ai_analysis"])
        self.assertTrue(result["model_analysis"]["summary"])

    async def test_invalid_scenarios_return_explained_422_without_score(self):
        too_few = await self.client.post(
            "/api/v1/scenario/evaluate",
            json={"decisions": DEMO_REQUEST["decisions"][:4]},
        )
        self.assertEqual(too_few.status_code, 422)
        self.assertEqual(too_few.json()["code"], "wrong_decision_count")
        self.assertNotIn("score", too_few.json())

        over_domain = await self.client.post(
            "/api/v1/scenario/preview",
            json={"decisions": [
                {"initiative_id": "M7", "district_id": "nura"},
                {"initiative_id": "M8", "district_id": "nura"},
                {"initiative_id": "M9", "district_id": "esil"},
            ]},
        )
        self.assertEqual(over_domain.status_code, 422)
        self.assertEqual(over_domain.json()["code"], "domain_limit")
        self.assertEqual(over_domain.json()["details"]["limit"], 2)
        self.assertNotIn("score", over_domain.json())

        too_many = await self.client.post(
            "/api/v1/scenario/preview",
            json={"decisions": DEMO_REQUEST["decisions"] + [DEMO_REQUEST["decisions"][0]]},
        )
        self.assertEqual(too_many.status_code, 422)
        self.assertEqual(too_many.json()["code"], "invalid_request")


if __name__ == "__main__":
    unittest.main()

import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import yaml
from jsonschema import Draft202012Validator
from openai import AsyncOpenAI

from akim_api.ai import AIAnalysis, ScenarioInput, explain_scenario
from akim_api.ai import service
from akim_api.ai.settings import AISettings, ROOT_ENV

ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "contracts/examples"


def load(name):
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def settings(**overrides):
    return AISettings(_env_file=None, ai_provider="openai", openai_api_key="test-key",
                      openai_model="test-model", **overrides)


class AIServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        service._CACHE.clear()
        self.payload = load("ai_input.json")
        self.analysis = AIAnalysis.model_validate(load("score_success_with_ai.json")["ai_analysis"])

    async def test_cache_changes_when_calculation_or_model_changes(self):
        with patch.object(service, "call_llm", new_callable=AsyncMock, return_value=self.analysis) as call:
            first = await explain_scenario(self.payload, settings=settings())
            first.strengths.append("Caller mutation")
            second = await explain_scenario(self.payload, settings=settings())
            self.assertNotIn("Caller mutation", second.strengths)
            self.assertEqual(call.await_count, 1)
            changed = {**self.payload, "score": 60.0, "score_delta": 7.44}
            await explain_scenario(changed, settings=settings())
            await explain_scenario(changed, settings=settings().model_copy(update={"openai_model": "other"}))
            self.assertEqual(call.await_count, 3)

    async def test_disabled_flag_provider_and_missing_key_do_not_call(self):
        with patch.object(service, "call_llm", new_callable=AsyncMock) as call:
            self.assertIsNone(await explain_scenario(self.payload, include_ai_analysis=False))
            self.assertIsNone(await explain_scenario(self.payload, settings=AISettings(_env_file=None)))
            self.assertIsNone(await explain_scenario(self.payload, settings=settings().model_copy(update={"ai_provider": "none"})))
            self.assertIsNone(await explain_scenario(self.payload, settings=settings().model_copy(update={"openai_api_key": None})))
            call.assert_not_awaited()

    async def test_invalid_input_is_not_sent(self):
        with patch.object(service, "call_llm", new_callable=AsyncMock) as call:
            self.assertIsNone(await explain_scenario({**self.payload, "secret": "never-send"}, settings=settings()))
            call.assert_not_awaited()

    async def test_failures_are_not_cached_and_logs_redact_exception(self):
        for failure in [RuntimeError("test-key secret response"), None, {"summary": "incomplete"}]:
            with self.subTest(failure=type(failure).__name__):
                mock = AsyncMock(side_effect=failure) if isinstance(failure, Exception) else AsyncMock(return_value=failure)
                with patch.object(service, "call_llm", mock), self.assertLogs(service.logger, level="WARNING") as logs:
                    self.assertIsNone(await explain_scenario(self.payload, settings=settings()))
                self.assertEqual(len(service._CACHE), 0)
                self.assertNotIn("test-key", " ".join(logs.output))

    async def test_total_timeout(self):
        async def slow(*args):
            await asyncio.sleep(1)
        with patch.object(service, "call_llm", slow):
            self.assertIsNone(await explain_scenario(self.payload, settings=settings(ai_timeout_seconds=0.01)))

    async def test_cancellation_propagates(self):
        with patch.object(service, "call_llm", AsyncMock(side_effect=asyncio.CancelledError)):
            with self.assertRaises(asyncio.CancelledError):
                await explain_scenario(self.payload, settings=settings())

    async def test_ttl_and_capacity(self):
        with patch.object(service, "call_llm", AsyncMock(return_value=self.analysis)) as call:
            with patch.object(service, "monotonic", return_value=0):
                await explain_scenario(self.payload, settings=settings(ai_cache_ttl_seconds=1))
            with patch.object(service, "monotonic", return_value=2):
                await explain_scenario(self.payload, settings=settings(ai_cache_ttl_seconds=1))
            self.assertEqual(call.await_count, 2)
            service._CACHE.clear()
            with patch.object(service, "_CACHE_LIMIT", 2):
                for score in [55, 56, 57]:
                    await explain_scenario({**self.payload, "score": score}, settings=settings())
                self.assertEqual(len(service._CACHE), 2)

    async def test_sdk_roundtrip_and_http_errors_without_network(self):
        for status in [200, 401, 429, 500]:
            with self.subTest(status=status):
                service._CACHE.clear()
                requests = []

                def handle(request):
                    requests.append(request)
                    body = json.loads(request.content)
                    self.assertEqual(body["model"], "test-model")
                    self.assertEqual(body["text"]["format"]["type"], "json_schema")
                    self.assertTrue(body["text"]["format"]["strict"])
                    self.assertFalse(body["store"])
                    self.assertNotIn("test-key", request.content.decode())
                    self.assertNotIn("temperature", body)
                    response = {
                        "id": "resp_test", "object": "response", "created_at": 0,
                        "status": "completed", "model": "test-model", "output": [{
                            "id": "msg_test", "type": "message", "role": "assistant",
                            "status": "completed", "content": [{"type": "output_text",
                            "text": self.analysis.model_dump_json(), "annotations": []}],
                        }],
                    }
                    if status != 200:
                        response = {"error": {"message": "fake secret error", "type": "api_error"}}
                    return httpx.Response(status, json=response)

                client = AsyncOpenAI(api_key="test-key", max_retries=0,
                    http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))
                with patch("openai.AsyncOpenAI", return_value=client):
                    result = await explain_scenario(self.payload, settings=settings())
                self.assertEqual(result, self.analysis if status == 200 else None)
                self.assertEqual(len(requests), 1)
                self.assertTrue(client.is_closed())

    async def test_refusal_incomplete_and_malformed_output(self):
        for status, parsed in [("completed", None), ("incomplete", self.analysis)]:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.responses.parse.return_value = SimpleNamespace(status=status, output_parsed=parsed)
            with patch("openai.AsyncOpenAI", return_value=mock_client):
                self.assertIsNone(await explain_scenario(self.payload, settings=settings()))
        with patch.object(service, "call_llm", AsyncMock(side_effect=ValueError("invalid JSON"))):
            self.assertIsNone(await explain_scenario(self.payload, settings=settings()))


class ContractTests(unittest.TestCase):
    def test_examples_match_http_contract(self):
        spec = yaml.safe_load((ROOT / "contracts/openapi.yaml").read_text(encoding="utf-8"))
        for filename, name in [
            ("score_request.json", "ScenarioRequest"),
            ("score_success_with_ai.json", "ScenarioResult"),
            ("score_success_no_ai.json", "ScenarioResult"),
            ("error_422.json", "ValidationError"),
        ]:
            with self.subTest(filename=filename):
                Draft202012Validator({"$ref": f"#/components/schemas/{name}",
                                      "components": spec["components"]}).validate(load(filename))
        catalog_schema = spec["paths"]["/api/v1/scenario/catalog"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        catalog_schema = {**catalog_schema, "components": spec["components"]}
        Draft202012Validator(catalog_schema).validate(load("catalog.json"))
        ScenarioInput.model_validate(load("ai_input.json"))
        actual = AIAnalysis.model_json_schema()
        contract = spec["components"]["schemas"]["AIAnalysis"]
        for field, schema in actual["properties"].items():
            self.assertEqual({k: v for k, v in schema.items() if k != "title"}, contract["properties"][field])

    def test_fixture_lag_synergy_and_score(self):
        result = load("score_success_no_ai.json")
        nura = next(d for d in result["districts"] if d["district_id"] == "nura")
        self.assertEqual(result["budget"], {"total": 100, "spent": 95, "remaining": 5})
        self.assertEqual(nura["after"]["S1"], 48)
        self.assertEqual(nura["after"]["S2"], 43.75)
        self.assertEqual(nura["after"]["B1"], 67.5)
        self.assertEqual(nura["after"]["C2"], 54.375)
        self.assertEqual(result["critical_pairs"], 0)
        self.assertEqual(nura["score"], 52.9625)
        self.assertEqual(result["city_score"], 58.08)
        self.assertEqual(result["score"], 56.54)
        self.assertEqual(result["score_delta"], 3.98)
        without = load("score_success_with_ai.json")
        without["ai_analysis"] = None
        without["ai_status"] = "disabled"
        self.assertEqual(result, without)

    def test_settings_env_priority_and_secret_masking(self):
        self.assertEqual(ROOT_ENV, ROOT / ".env")
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            env = Path(directory) / ".env"
            env.write_text("AI_PROVIDER=openai\nOPENAI_API_KEY=fake-sensitive-key\nOPENAI_MODEL=file-model\nAPI_PORT=8000\n", encoding="utf-8")
            with patch.dict(os.environ, {"OPENAI_MODEL": "environment-model"}):
                config = AISettings(_env_file=env)
            self.assertTrue(config.enabled)
            self.assertEqual(config.openai_model, "environment-model")
            self.assertNotIn("fake-sensitive-key", repr(config))


if __name__ == "__main__":
    unittest.main()

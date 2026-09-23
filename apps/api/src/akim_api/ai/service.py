import asyncio
import hashlib
import json
import logging
from collections import OrderedDict
from time import monotonic

from .client import call_llm
from .prompt import SYSTEM_PROMPT, build_user_message
from .schema import AIAnalysis, ScenarioInput
from .settings import AISettings

logger = logging.getLogger(__name__)
_CACHE: OrderedDict[str, tuple[float, AIAnalysis]] = OrderedDict()
_CACHE_LIMIT = 128


async def explain_scenario(
    scenario: ScenarioInput | dict,
    *,
    include_ai_analysis: bool = True,
    settings: AISettings | None = None,
) -> AIAnalysis | None:
    """Explain a calculated scenario; optional AI failures never discard its score."""
    if not include_ai_analysis:
        return None
    try:
        settings = settings if settings is not None else AISettings()
        if not settings.enabled:
            return None
        scenario = ScenarioInput.model_validate(scenario)
        user = build_user_message(scenario)
        # All input numbers and prompt/model settings matter, not just decisions.
        cache_material = json.dumps([
            SYSTEM_PROMPT, AIAnalysis.model_json_schema(), settings.ai_provider,
            settings.openai_model, settings.ai_max_output_tokens,
            settings.ai_cache_ttl_seconds, user,
        ], sort_keys=True, ensure_ascii=False)
        key = hashlib.sha256(cache_material.encode()).hexdigest()
        now = monotonic()
        for expired in [k for k, (deadline, _) in _CACHE.items() if deadline <= now]:
            del _CACHE[expired]
        if settings.ai_cache_ttl_seconds > 0 and key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key][1].model_copy(deep=True)

        async with asyncio.timeout(settings.ai_timeout_seconds):
            result = await call_llm(SYSTEM_PROMPT, user, settings)
        if result is None:
            logger.warning("AI analysis unavailable: no complete structured response")
            return None
        analysis = AIAnalysis.model_validate(result)
        if settings.ai_cache_ttl_seconds > 0:
            _CACHE[key] = (
                monotonic() + settings.ai_cache_ttl_seconds, analysis.model_copy(deep=True)
            )
            while len(_CACHE) > _CACHE_LIMIT:
                _CACHE.popitem(last=False)
        return analysis
    except Exception as exc:
        # Never log exception text, response bodies, settings, prompts or keys.
        # CancelledError deliberately propagates to preserve request cancellation.
        logger.warning("AI analysis unavailable (%s)", type(exc).__name__)
        return None

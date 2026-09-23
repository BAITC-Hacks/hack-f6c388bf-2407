"""Attach an optional LLM explanation without changing deterministic results."""

import logging
from typing import Any

from .ai import ScenarioInput, explain_scenario
from .ai.settings import AISettings
from .engine import MEASURES, explanation

logger = logging.getLogger(__name__)


def _ai_payload(result: dict[str, Any], decisions: list[dict[str, Any]]) -> dict[str, Any]:
    selected = []
    for decision in decisions:
        measure = MEASURES[decision["initiative_id"]]
        selected.append({
            "initiative_id": measure["id"],
            "district_id": decision.get("district_id"),
            "name_ru": measure["name_ru"],
            "domain": measure["domain"],
            "cost": measure["cost"],
        })

    districts = []
    for district in result["districts"]:
        districts.append({
            "district_id": district["id"],
            "name_ru": district["name_ru"],
            "before": district["before"],
            "after": district["after"],
            "score": district["score"],
        })

    return {
        "budget": result["budget"],
        "score": result["score"],
        "baseline_score": result["baseline_score"],
        "score_delta": result["score_delta"],
        "city_score": result["city_score"],
        "weakest_district": result["weakest_district"],
        "critical_pairs": result["critical_pairs"],
        "districts": districts,
        "decisions": selected,
        "initiative_contributions": [
            {
                "initiative_id": item["initiative_id"],
                "district_id": item["district_id"],
                "realized_effects": item["realized_effects"],
            }
            for item in result["initiative_contributions"]
        ],
        "synergies_applied": [
            {
                "initiatives": item["initiatives"],
                "district_id": item["district_id"],
                "indicator": item["indicator"],
                "value": item["value"],
            }
            for item in result["synergies"]
        ],
    }


async def enrich_analysis(
    result: dict[str, Any],
    decisions: list[dict[str, Any]],
    *,
    include_ai_analysis: bool = True,
) -> None:
    """Mutate a calculated result with AI/fallback prose and a truthful status."""
    result["model_analysis"] = explanation(result)
    result["ai_analysis"] = None
    result["ai_status"] = "disabled"
    if not include_ai_analysis:
        return

    try:
        settings = AISettings()
        if not settings.enabled:
            return
        payload = ScenarioInput.model_validate(_ai_payload(result, decisions))
        analysis = await explain_scenario(payload, settings=settings)
        if analysis is None:
            result["ai_status"] = "unavailable"
            return
        result["ai_analysis"] = analysis.model_dump(mode="json")
        result["ai_status"] = "available"
    except Exception as exc:
        # Keep a complete score and deterministic explanation even for bad config.
        logger.warning("AI analysis unavailable (%s)", type(exc).__name__)
        result["ai_status"] = "unavailable"

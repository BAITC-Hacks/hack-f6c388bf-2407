"""Regenerate reviewed fixtures from the deterministic backend engine."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "contracts" / "examples"
sys.path.insert(0, str(ROOT / "apps" / "api" / "src"))

from akim_api.engine import MEASURES, catalog, evaluate  # noqa: E402

DECISIONS = [
    {"initiative_id": "M7", "district_id": "nura"},
    {"initiative_id": "M8", "district_id": "nura"},
    {"initiative_id": "M10", "district_id": "nura"},
    {"initiative_id": "M12"},
    {"initiative_id": "M5", "district_id": "saryarka"},
]


def save(name: str, value: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def ai_input(result: dict) -> dict:
    selected = [
        {
            **decision,
            "name_ru": MEASURES[decision["initiative_id"]]["name_ru"],
            "domain": MEASURES[decision["initiative_id"]]["domain"],
            "cost": MEASURES[decision["initiative_id"]]["cost"],
        }
        for decision in DECISIONS
    ]
    return {
        key: result[key]
        for key in (
            "budget", "score", "baseline_score", "score_delta", "city_score",
            "weakest_district", "critical_pairs",
        )
    } | {
        "districts": [
            {
                "district_id": district["id"],
                "name_ru": district["name_ru"],
                "before": district["before"],
                "after": district["after"],
                "score": district["score"],
            }
            for district in result["districts"]
        ],
        "decisions": selected,
        "initiative_contributions": [
            {
                "initiative_id": item["initiative_id"],
                "district_id": item["district_id"],
                "realized_effects": item["realized_effects"],
            }
            for item in result["initiative_contributions"]
        ],
        "synergies_applied": result["synergies"],
    }


def generate() -> None:
    result = evaluate(DECISIONS)
    save("catalog.json", catalog())
    save("score_request.json", {"decisions": DECISIONS, "include_ai_analysis": True})
    save("score_success_no_ai.json", result)
    save("ai_input.json", ai_input(result))

    # Editorial copy for interface work. This is not an actual model response.
    with_ai = {**result, "ai_status": "available", "ai_analysis": {
        "summary": "Приоритет отдан социальной инфраструктуре Нуры и качеству воздуха Сарыарки.",
        "strengths": [
            "В Нуре показатели школ и первичной медицины вышли из критической зоны.",
            "Освещение и платформа обращений дают дополнительный эффект безопасности в Нуре.",
        ],
        "tradeoffs": ["Показатели транспорта и озеленения остались без изменений."],
        "risks": [
            "Нура остаётся районом с самым низким итоговым баллом. Улучшение не означает полного решения проблем."
        ],
        "recommendations": [
            "В следующем сценарии сравните этот набор с вариантом поддержки транспорта. Проверьте бюджет и ограничения заново."
        ],
    }}
    save("score_success_with_ai.json", with_ai)
    save("error_422.json", {
        "code": "domain_limit",
        "message": "Можно выбрать не более 2 инициатив одного направления.",
        "details": {"domain": "social", "count": 3, "limit": 2},
    })
    print(json.dumps({
        key: result[key]
        for key in ("budget", "score", "score_delta", "weakest_district", "critical_pairs")
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    generate()

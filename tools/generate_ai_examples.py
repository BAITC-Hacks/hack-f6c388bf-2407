"""Generate ONE reviewed demo fixture, not a production scenario engine.

Run from any directory: python tools/generate_ai_examples.py
The backend owns the general calculator, validation and contribution attribution.
"""

import json
from copy import deepcopy
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "contracts" / "examples"


def save(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def generate():
    city = json.loads((ROOT / "data/city.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "data/initiatives.json").read_text(encoding="utf-8"))
    measures = {m["id"]: m for m in catalog["initiatives"]}
    selected = [("M7", "nura"), ("M8", "nura"), ("M10", "nura"),
                ("M12", None), ("M5", "saryarka")]
    weights = {k: Decimal(str(v)) for k, v in city["indicator_weights"].items()}
    districts = [{"district_id": d["id"], "name_ru": d["name_ru"],
                  "before": deepcopy(d["indicators"]), "after": deepcopy(d["indicators"])}
                 for d in city["districts"]]
    decisions, contributions = [], []
    for initiative_id, district_id in selected:
        m = measures[initiative_id]
        factor = Decimal(city["horizon_quarters"] - m["lag_quarters"]) / city["horizon_quarters"]
        effects = {k: float(Decimal(v) * factor) for k, v in m["effects"].items()}
        decisions.append({"initiative_id": initiative_id, "district_id": district_id,
                          "name_ru": m["name_ru"], "domain": m["domain"], "cost": m["cost"]})
        contributions.append({"initiative_id": initiative_id, "district_id": district_id,
                              "realized_effects": effects})
        for d in districts:
            if district_id is None or d["district_id"] == district_id:
                for indicator, effect in effects.items():
                    d["after"][indicator] += effect
    # The only synergy in this fixed selection is M10+M12 in Nura.
    synergy = next(s for s in catalog["rules"]["synergies"] if s["initiatives"] == ["M10", "M12"])
    next(d for d in districts if d["district_id"] == "nura")["after"][synergy["indicator"]] += synergy["value"]
    synergies = [{"initiatives": synergy["initiatives"], "district_id": "nura",
                  "indicator": synergy["indicator"], "value": synergy["value"]}]
    for d in districts:
        d["after"] = {k: min(100, max(0, v)) for k, v in d["after"].items()}
        d["score"] = float(sum(weights[k] * Decimal(str(v)) for k, v in d["after"].items()))
    populations = {d["id"]: Decimal(str(d["population_share"])) for d in city["districts"]}
    city_score = sum(populations[d["district_id"]] * Decimal(str(d["score"])) for d in districts)
    weakest = min(districts, key=lambda d: d["score"])
    critical = sum(v < 40 for d in districts for v in d["after"].values())
    score = Decimal("0.7") * city_score + Decimal("0.3") * Decimal(str(weakest["score"])) - critical
    baseline = city["baseline"]["astana_quality_of_life_score"]
    spent = sum(d["cost"] for d in decisions)
    result = {"valid": True, "budget": {"total": city["budget"], "spent": spent,
              "remaining": city["budget"] - spent}, "score": float(round(score, 2)),
              "baseline_score": baseline,
              "score_delta": float(round(score - Decimal(str(baseline)), 2)),
              "city_score": float(round(city_score, 2)),
              "weakest_district": {"district_id": weakest["district_id"], "score": weakest["score"]},
              "critical_pairs": critical, "districts": districts,
              "initiative_contributions": contributions, "ai_analysis": None}
    save("catalog.json", {k: city[k] for k in ["budget", "horizon_quarters", "districts", "indicators"]}
         | {"initiatives": catalog["initiatives"], "rules": catalog["rules"]})
    save("score_request.json", {"decisions": [{"initiative_id": i, "district_id": d} for i, d in selected],
                                "include_ai_analysis": True})
    save("score_success_no_ai.json", result)
    save("ai_input.json", {k: v for k, v in result.items() if k not in {"valid", "ai_analysis"}}
         | {"decisions": decisions, "synergies_applied": synergies})
    # Editorial fixture for UI development, never presented as a live model response.
    result["ai_analysis"] = {
        "summary": "Приоритет отдан социальной инфраструктуре Нуры и качеству воздуха Сарыарки.",
        "strengths": ["В Нуре показатели школ и первичной медицины вышли из критической зоны.",
                      "Освещение и платформа обращений дают дополнительный эффект безопасности в Нуре."],
        "tradeoffs": ["Показатели транспорта и озеленения остались без изменений."],
        "risks": ["Нура остаётся районом с самым низким итоговым баллом. Улучшение не означает полного решения проблем."],
        "recommendations": ["В следующем сценарии сравните этот набор с вариантом поддержки транспорта. Проверьте бюджет и ограничения заново."],
    }
    save("score_success_with_ai.json", result)
    save("error_422.json", {"code": "domain_limit", "message": "Не более двух мер одного направления.",
                            "details": {"domain": "social", "limit": 2}})
    print(json.dumps({k: result[k] for k in ["budget", "score", "score_delta", "weakest_district", "critical_pairs"]}))


if __name__ == "__main__":
    generate()

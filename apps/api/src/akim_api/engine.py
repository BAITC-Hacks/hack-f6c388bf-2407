"""Pure, deterministic scenario model. All numbers originate in the shared dataset."""

import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parents[4] / "data"
CITY = json.loads((DATA / "city.json").read_text(encoding="utf-8"))
CATALOG = json.loads((DATA / "initiatives.json").read_text(encoding="utf-8"))
MEASURES = {item["id"]: item for item in CATALOG["initiatives"]}
DISTRICTS = {item["id"]: item for item in CITY["districts"]}
RULES = CATALOG["rules"]


class ScenarioError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def validate(decisions: list[dict], *, final: bool = False) -> None:
    count = RULES["required_decision_count"]
    if len(decisions) > count or (final and len(decisions) != count):
        raise ScenarioError("wrong_decision_count", f"Для симуляции нужно ровно {count} решений.")
    ids = [decision["initiative_id"] for decision in decisions]
    if len(set(ids)) != len(ids):
        raise ScenarioError("duplicate_initiative", "Каждую инициативу можно выбрать только один раз.")
    domains: Counter = Counter()
    spent = 0
    for decision in decisions:
        measure = MEASURES.get(decision["initiative_id"])
        if measure is None:
            raise ScenarioError("unknown_initiative", "Этой инициативы нет в каталоге.")
        district = decision.get("district_id")
        if measure["scope"] == "district":
            if district is None:
                raise ScenarioError("district_required", "Выберите район для инициативы.")
            if district not in DISTRICTS:
                raise ScenarioError("unknown_district", "Выберите район из списка.")
        elif district is not None:
            raise ScenarioError("district_not_allowed", "Городская мера применяется ко всем районам.")
        spent += measure["cost"]
        domains[measure["domain"]] += 1
    if spent > CITY["budget"]:
        raise ScenarioError("budget_exceeded", f"Не хватает {spent - CITY['budget']} ед. бюджета.")
    if any(count > RULES["max_per_domain"] for count in domains.values()):
        raise ScenarioError("domain_limit", "Можно выбрать не более 2 инициатив одного направления.")
    by_id = {decision["initiative_id"]: decision for decision in decisions}
    for pair in RULES["incompatible_pairs"]:
        first, second = pair["initiatives"]
        if first not in by_id or second not in by_id:
            continue
        if pair["scope"] == "citywide" or by_id[first].get("district_id") == by_id[second].get("district_id"):
            raise ScenarioError("incompatible_initiatives", pair["reason_ru"])


def _calculate(decisions: list[dict]) -> dict[str, Any]:
    districts = deepcopy(CITY["districts"])
    by_district = {district["id"]: district for district in districts}
    contributions = []
    for decision in decisions:
        measure = MEASURES[decision["initiative_id"]]
        factor = (CITY["horizon_quarters"] - measure["lag_quarters"]) / CITY["horizon_quarters"]
        effects = {key: value * factor for key, value in measure["effects"].items()}
        targets = districts if measure["scope"] == "citywide" else [by_district[decision["district_id"]]]
        for district in targets:
            for indicator, effect in effects.items():
                district["indicators"][indicator] += effect
        contributions.append({**decision, "name_ru": measure["name_ru"], "cost": measure["cost"], "realized_effects": effects})
    active_synergies = []
    by_id = {decision["initiative_id"]: decision for decision in decisions}
    for synergy in RULES["synergies"]:
        first, second = synergy["initiatives"]
        if first in by_id and second in by_id:
            district_id = by_id[first]["district_id"]
            by_district[district_id]["indicators"][synergy["indicator"]] += synergy["value"]
            active_synergies.append({**synergy, "district_id": district_id})
    critical_indicators = []
    for district in districts:
        for key, value in district["indicators"].items():
            district["indicators"][key] = min(100, max(0, value))
            if district["indicators"][key] < 40:
                critical_indicators.append({"district_id": district["id"], "indicator": key, "value": district["indicators"][key]})
        district["score"] = sum(CITY["indicator_weights"][key] * value for key, value in district["indicators"].items())
        district["baseline_score"] = CITY["baseline"]["district_scores"][district["id"]]
        district["delta"] = round(district["score"] - district["baseline_score"], 4)
    city_score = sum(district["population_share"] * district["score"] for district in districts)
    weakest = min(districts, key=lambda district: district["score"])
    score = 0.7 * city_score + 0.3 * weakest["score"] - len(critical_indicators)
    spent = sum(MEASURES[decision["initiative_id"]]["cost"] for decision in decisions)
    domain_metrics = {}
    for domain in dict.fromkeys(item["domain"] for item in CITY["indicators"]):
        codes = [item["code"] for item in CITY["indicators"] if item["domain"] == domain]
        weight = sum(CITY["indicator_weights"][code] for code in codes)
        domain_metrics[domain] = round(sum(district["population_share"] * sum(district["indicators"][code] * CITY["indicator_weights"][code] for code in codes) / weight for district in districts), 4)
    return {
        "budget": {"total": CITY["budget"], "spent": spent, "remaining": CITY["budget"] - spent},
        "score": round(score, 4),
        "baseline_score": CITY["baseline"]["astana_quality_of_life_score"],
        "score_delta": round(score - BASELINE_RAW_SCORE, 4),
        "city_score": round(city_score, 4),
        "weakest_district": {"district_id": weakest["id"], "score": round(weakest["score"], 4)},
        "critical_pairs": len(critical_indicators),
        "critical_indicators": critical_indicators,
        "districts": districts,
        "domain_metrics": domain_metrics,
        "initiative_contributions": contributions,
        "synergies": active_synergies,
    }


BASELINE_RAW_SCORE = 0.7 * sum(district["population_share"] * CITY["baseline"]["district_scores"][district["id"]] for district in CITY["districts"]) + 0.3 * min(CITY["baseline"]["district_scores"].values()) - CITY["baseline"]["critical_pairs"]


def availability(decisions: list[dict]) -> dict:
    result = {}
    for measure in MEASURES.values():
        targets = [None] if measure["scope"] == "citywide" else list(DISTRICTS)
        options = {}
        for target in targets:
            candidate = {"initiative_id": measure["id"], "district_id": target}
            try:
                validate([*decisions, candidate])
                options[target or "citywide"] = None
            except ScenarioError as error:
                options[target or "citywide"] = error.message
        result[measure["id"]] = options
    return result


def explanation(result: dict) -> dict:
    weakest = DISTRICTS[result["weakest_district"]["district_id"]]["name_ru"]
    improvements = sorted(result["districts"], key=lambda item: item["delta"], reverse=True)
    best = improvements[0]
    strengths = [f"Наибольший рост у района {best['name_ru']}: +{best['delta']:.2f} к районной оценке.", f"В пределах бюджета: использовано {result['budget']['spent']} из {CITY['budget']} единиц."]
    if result["synergies"]:
        strengths.append(f"Сработали синергии: {len(result['synergies'])}. Их бонусы уже учтены в показателях.")
    risks = [f"Самый уязвимый район — {weakest}. Его оценка влияет на 30% итогового Score."]
    if result["critical_pairs"]:
        risks.append(f"Осталось критических показателей ниже 40: {result['critical_pairs']}. Каждый снижает Score на 1 балл.")
    else:
        strengths.append("В сценарии нет критических показателей ниже 40.")
    tradeoffs = ["Эффекты ограничены горизонтом в 8 кварталов: строительство с большим лагом успевает реализовать только часть потенциала."]
    if any(item["initiative_id"] == "M11" for item in result["initiative_contributions"]):
        tradeoffs.append("Безопасные переходы повышают B2, но снижают разгрузку дорог T1 на 1,75 в выбранном районе.")
    recommendations = [f"Сравните альтернативы для района {weakest}: выбирайте меры для его самых слабых показателей."]
    if result["critical_pairs"]:
        recommendations.append("В первую очередь проверьте социальную инфраструктуру Нуры: устранение критического значения убирает штраф.")
    if result["budget"]["remaining"]:
        recommendations.append(f"Остаток {result['budget']['remaining']} ед. не даёт бонуса. Попробуйте заменить одну меру, сохранив ровно пять решений.")
    return {"summary": "Расчёт учитывает население, слабейший район, лаги и критические значения. Это объяснение правил модели, а не ответ AI.", "strengths": strengths, "risks": risks, "tradeoffs": tradeoffs, "recommendations": recommendations}


def preview(decisions: list[dict]) -> dict:
    validate(decisions)
    result = _calculate(decisions)
    score = result.pop("score")
    replacements = {decision["initiative_id"]: availability([other for other in decisions if other["initiative_id"] != decision["initiative_id"]])[decision["initiative_id"]] for decision in decisions}
    return {**result, "projected_score": score, "complete": len(decisions) == RULES["required_decision_count"], "availability": availability(decisions), "replacement_availability": replacements}


def evaluate(decisions: list[dict]) -> dict:
    validate(decisions, final=True)
    result = _calculate(decisions)
    return {**result, "valid": True, "ai_analysis": None, "ai_status": "disabled", "model_analysis": explanation(result)}


def catalog() -> dict:
    return {**CITY, **CATALOG, "baseline_result": preview([])}

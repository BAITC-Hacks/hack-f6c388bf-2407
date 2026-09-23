"""Pure, deterministic scenario model. All numbers originate in the shared dataset."""

import json
from collections import Counter
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parents[4] / "data"
CITY = json.loads((DATA / "city.json").read_text(encoding="utf-8"))
CATALOG = json.loads((DATA / "initiatives.json").read_text(encoding="utf-8"))
MEASURES = {item["id"]: item for item in CATALOG["initiatives"]}
DISTRICTS = {item["id"]: item for item in CITY["districts"]}
RULES = CATALOG["rules"]

CITY_EVENT = {
    "id": "snowstorm",
    "title_ru": "Аномальный снегопад",
    "description_ru": "Снегопад перегружает дороги и аварийные службы. Проверьте, выдержит ли ваш план городской стресс.",
    "effects": {"T1": -6, "C1": -5, "C2": -2},
    "responses": [
        {"id": "hold", "name_ru": "Сохранить резерв", "cost": 0, "description_ru": "Не менять план и принять полный удар события.", "mitigation": {}},
        {"id": "reroute", "name_ru": "Перенастроить маршруты", "cost": 4, "description_ru": "Временные маршруты и усиленная диспетчеризация.", "mitigation": {"T1": 3, "C2": 1}},
        {"id": "emergency", "name_ru": "Мобилизовать городские службы", "cost": 8, "description_ru": "Снегоуборочная техника, аварийные бригады и единый штаб.", "mitigation": {"T1": 5, "C1": 4, "C2": 2}},
    ],
}


class ScenarioError(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def validate(decisions: list[dict], *, final: bool = False) -> None:
    count = RULES["required_decision_count"]
    if len(decisions) > count or (final and len(decisions) != count):
        raise ScenarioError(
            "wrong_decision_count",
            f"Для симуляции нужно ровно {count} решений.",
            {"required": count, "received": len(decisions)},
        )
    ids = [decision["initiative_id"] for decision in decisions]
    if len(set(ids)) != len(ids):
        duplicate = next(item for item, total in Counter(ids).items() if total > 1)
        raise ScenarioError(
            "duplicate_initiative", "Каждую инициативу можно выбрать только один раз.",
            {"initiative_id": duplicate},
        )
    domains: Counter = Counter()
    spent = 0
    for decision in decisions:
        measure = MEASURES.get(decision["initiative_id"])
        if measure is None:
            raise ScenarioError(
                "unknown_initiative", "Этой инициативы нет в каталоге.",
                {"initiative_id": decision["initiative_id"]},
            )
        district = decision.get("district_id")
        if measure["scope"] == "district":
            if district is None:
                raise ScenarioError(
                    "district_required", "Выберите район для инициативы.",
                    {"initiative_id": measure["id"]},
                )
            if district not in DISTRICTS:
                raise ScenarioError(
                    "unknown_district", "Выберите район из списка.",
                    {"initiative_id": measure["id"], "district_id": district},
                )
        elif district is not None:
            raise ScenarioError(
                "district_not_allowed", "Городская мера применяется ко всем районам.",
                {"initiative_id": measure["id"]},
            )
        spent += measure["cost"]
        domains[measure["domain"]] += 1
    if spent > CITY["budget"]:
        raise ScenarioError(
            "budget_exceeded", f"Не хватает {spent - CITY['budget']} ед. бюджета.",
            {"spent": spent, "budget": CITY["budget"], "over": spent - CITY["budget"]},
        )
    over_limit = next(
        ((domain, total) for domain, total in domains.items()
         if total > RULES["max_per_domain"]),
        None,
    )
    if over_limit:
        domain, total = over_limit
        raise ScenarioError(
            "domain_limit", "Можно выбрать не более 2 инициатив одного направления.",
            {"domain": domain, "count": total, "limit": RULES["max_per_domain"]},
        )
    by_id = {decision["initiative_id"]: decision for decision in decisions}
    for pair in RULES["incompatible_pairs"]:
        first, second = pair["initiatives"]
        if first not in by_id or second not in by_id:
            continue
        if pair["scope"] == "citywide" or by_id[first].get("district_id") == by_id[second].get("district_id"):
            raise ScenarioError(
                "incompatible_initiatives", pair["reason_ru"],
                {"initiatives": [first, second], "scope": pair["scope"]},
            )


def _calculate(
    decisions: list[dict],
    *,
    horizon: int | None = None,
    external_effects: dict[str, float] | None = None,
    extra_cost: int = 0,
) -> dict[str, Any]:
    elapsed = CITY["horizon_quarters"] if horizon is None else horizon
    districts = deepcopy(CITY["districts"])
    by_district = {district["id"]: district for district in districts}
    contributions = []
    for district in districts:
        district["district_id"] = district["id"]
        district["before"] = deepcopy(district["indicators"])
    for decision in decisions:
        measure = MEASURES[decision["initiative_id"]]
        factor = max(0, elapsed - measure["lag_quarters"]) / CITY["horizon_quarters"]
        effects = {key: value * factor for key, value in measure["effects"].items()}
        targets = districts if measure["scope"] == "citywide" else [by_district[decision["district_id"]]]
        for district in targets:
            for indicator, effect in effects.items():
                district["indicators"][indicator] += effect
        contributions.append({
            "initiative_id": measure["id"],
            "district_id": decision.get("district_id"),
            "name_ru": measure["name_ru"],
            "domain": measure["domain"],
            "cost": measure["cost"],
            "realized_effects": effects,
        })
    active_synergies = []
    by_id = {decision["initiative_id"]: decision for decision in decisions}
    for synergy in RULES["synergies"]:
        first, second = synergy["initiatives"]
        ready_at = max(MEASURES[first]["lag_quarters"], MEASURES[second]["lag_quarters"])
        if first in by_id and second in by_id and elapsed >= ready_at:
            district_id = by_id[first]["district_id"]
            by_district[district_id]["indicators"][synergy["indicator"]] += synergy["value"]
            active_synergies.append({
                "initiatives": synergy["initiatives"],
                "district_id": district_id,
                "indicator": synergy["indicator"],
                "value": synergy["value"],
            })
    if external_effects:
        for district in districts:
            for indicator, effect in external_effects.items():
                district["indicators"][indicator] += effect
    critical_indicators = []
    for district in districts:
        for key, value in district["indicators"].items():
            district["indicators"][key] = min(100, max(0, value))
            if district["indicators"][key] < 40:
                critical_indicators.append({"district_id": district["id"], "indicator": key, "value": district["indicators"][key]})
        district["score"] = sum(CITY["indicator_weights"][key] * value for key, value in district["indicators"].items())
        district["baseline_score"] = CITY["baseline"]["district_scores"][district["id"]]
        district["delta"] = round(district["score"] - district["baseline_score"], 4)
        district["after"] = deepcopy(district["indicators"])
    city_score = sum(district["population_share"] * district["score"] for district in districts)
    weakest = min(districts, key=lambda district: district["score"])
    strongest = max(districts, key=lambda district: district["score"])
    city_component = 0.7 * city_score
    weakest_component = 0.3 * weakest["score"]
    critical_penalty = len(critical_indicators)
    score = city_component + weakest_component - critical_penalty
    displayed_score = round(score, 2)
    spent = sum(MEASURES[decision["initiative_id"]]["cost"] for decision in decisions) + extra_cost
    domain_metrics = {}
    for domain in dict.fromkeys(item["domain"] for item in CITY["indicators"]):
        codes = [item["code"] for item in CITY["indicators"] if item["domain"] == domain]
        weight = sum(CITY["indicator_weights"][code] for code in codes)
        domain_metrics[domain] = round(sum(district["population_share"] * sum(district["indicators"][code] * CITY["indicator_weights"][code] for code in codes) / weight for district in districts), 4)
    return {
        "budget": {"total": CITY["budget"], "spent": spent, "remaining": CITY["budget"] - spent},
        "score": displayed_score,
        "baseline_score": CITY["baseline"]["astana_quality_of_life_score"],
        "score_delta": round(displayed_score - CITY["baseline"]["astana_quality_of_life_score"], 2),
        "city_score": round(city_score, 2),
        "fairness_index": round(max(0, 100 - (strongest["score"] - weakest["score"])), 2),
        "district_gap": round(strongest["score"] - weakest["score"], 2),
        "score_breakdown": {
            "city_component": round(city_component, 2),
            "weakest_component": round(weakest_component, 2),
            "critical_penalty": critical_penalty,
        },
        "weakest_district": {"district_id": weakest["id"], "score": round(weakest["score"], 4)},
        "critical_pairs": len(critical_indicators),
        "critical_indicators": critical_indicators,
        "districts": districts,
        "domain_metrics": domain_metrics,
        "initiative_contributions": contributions,
        "synergies": active_synergies,
    }


def _timeline(decisions: list[dict]) -> list[dict[str, Any]]:
    points = []
    for quarter in (0, 2, 4, 6, 8):
        result = _calculate(decisions, horizon=quarter)
        points.append({
            "quarter": quarter,
            "score": result["score"],
            "score_delta": result["score_delta"],
            "domain_metrics": result["domain_metrics"],
        })
    return points


def _what_if(decisions: list[dict]) -> dict[str, dict[str, dict[str, float] | None]]:
    current = _calculate(decisions)["score"]
    result: dict[str, dict[str, dict[str, float] | None]] = {}
    for measure in MEASURES.values():
        targets = [None] if measure["scope"] == "citywide" else list(DISTRICTS)
        result[measure["id"]] = {}
        for target in targets:
            key = target or "citywide"
            candidate = {"initiative_id": measure["id"]}
            if target:
                candidate["district_id"] = target
            try:
                validate([*decisions, candidate])
            except ScenarioError:
                result[measure["id"]][key] = None
                continue
            projected = _calculate([*decisions, candidate])["score"]
            result[measure["id"]][key] = {
                "projected_score": projected,
                "score_change": round(projected - current, 2),
            }
    return result


def _stress_test(decisions: list[dict], base: dict[str, Any]) -> dict[str, Any]:
    responses = []
    for response in CITY_EVENT["responses"]:
        available = base["budget"]["remaining"] >= response["cost"]
        item = {key: value for key, value in response.items() if key != "mitigation"}
        item["available"] = available
        if available:
            effects = dict(CITY_EVENT["effects"])
            for indicator, value in response["mitigation"].items():
                effects[indicator] = effects.get(indicator, 0) + value
            stressed = _calculate(decisions, external_effects=effects, extra_cost=response["cost"])
            item.update({
                "score": stressed["score"],
                "score_delta": round(stressed["score"] - base["score"], 2),
                "fairness_index": stressed["fairness_index"],
                "critical_pairs": stressed["critical_pairs"],
                "budget": stressed["budget"],
            })
        responses.append(item)
    return {
        "id": CITY_EVENT["id"],
        "title_ru": CITY_EVENT["title_ru"],
        "description_ru": CITY_EVENT["description_ru"],
        "seed": "ASTANA-2026",
        "responses": responses,
    }


def _option_for(measure: dict[str, Any], district_id: str | None) -> dict[str, Any]:
    option = {"initiative_id": measure["id"]}
    if district_id:
        option["district_id"] = district_id
    return option


@lru_cache(maxsize=1)
def _optimized_scenarios() -> dict[str, Any]:
    """Deterministic beam search over measures and their district assignments."""
    states: list[tuple[list[dict[str, Any]], int, dict[str, Any]]] = [([], -1, _calculate([]))]
    measures = list(MEASURES.values())
    for depth in range(RULES["required_decision_count"]):
        expanded: list[tuple[list[dict[str, Any]], int, dict[str, Any]]] = []
        for decisions, last_index, _metrics in states:
            for index in range(last_index + 1, len(measures)):
                if len(measures) - index < RULES["required_decision_count"] - depth:
                    break
                measure = measures[index]
                targets = [None] if measure["scope"] == "citywide" else list(DISTRICTS)
                for target in targets:
                    candidate = [*decisions, _option_for(measure, target)]
                    try:
                        validate(candidate)
                    except ScenarioError:
                        continue
                    expanded.append((candidate, index, _calculate(candidate)))
        by_score = sorted(expanded, key=lambda state: state[2]["score"], reverse=True)[:180]
        by_balance = sorted(
            expanded,
            key=lambda state: state[2]["score"] + 0.10 * state[2]["fairness_index"],
            reverse=True,
        )[:180]
        unique: dict[str, tuple[list[dict[str, Any]], int, dict[str, Any]]] = {}
        for state in [*by_score, *by_balance]:
            unique[json.dumps(state[0], sort_keys=True)] = state
        states = list(unique.values())
    best_score = max(states, key=lambda state: state[2]["score"])
    best_balance = max(states, key=lambda state: state[2]["score"] + 0.10 * state[2]["fairness_index"])

    def present(state: tuple[list[dict[str, Any]], int, dict[str, Any]], kind: str) -> dict[str, Any]:
        decisions, _index, metrics = state
        return {
            "kind": kind,
            "decisions": decisions,
            "score": metrics["score"],
            "fairness_index": metrics["fairness_index"],
            "budget": metrics["budget"],
        }

    return {"max_score": present(best_score, "max_score"), "balanced": present(best_balance, "balanced")}


def _best_swap(decisions: list[dict], base_score: float) -> dict[str, Any] | None:
    best: tuple[list[dict[str, Any]], dict[str, Any]] | None = None
    for index, _removed in enumerate(decisions):
        kept = [item for position, item in enumerate(decisions) if position != index]
        for measure in MEASURES.values():
            if any(item["initiative_id"] == measure["id"] for item in kept):
                continue
            targets = [None] if measure["scope"] == "citywide" else list(DISTRICTS)
            for target in targets:
                candidate = [*kept, _option_for(measure, target)]
                try:
                    validate(candidate, final=True)
                except ScenarioError:
                    continue
                metrics = _calculate(candidate)
                if best is None or metrics["score"] > best[1]["score"]:
                    best = (candidate, metrics)
    if best is None or best[1]["score"] <= base_score:
        return None
    removed_ids = set(item["initiative_id"] for item in decisions) - set(item["initiative_id"] for item in best[0])
    added_ids = set(item["initiative_id"] for item in best[0]) - set(item["initiative_id"] for item in decisions)
    return {
        "kind": "best_swap",
        "decisions": best[0],
        "score": best[1]["score"],
        "fairness_index": best[1]["fairness_index"],
        "budget": best[1]["budget"],
        "gain": round(best[1]["score"] - base_score, 2),
        "removed_id": next(iter(removed_ids), None),
        "added_id": next(iter(added_ids), None),
    }


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
    return {
        **result,
        "projected_score": score,
        "complete": len(decisions) == RULES["required_decision_count"],
        "availability": availability(decisions),
        "replacement_availability": replacements,
        "timeline": _timeline(decisions),
        "what_if": _what_if(decisions),
    }


def evaluate(decisions: list[dict]) -> dict:
    validate(decisions, final=True)
    result = _calculate(decisions)
    fairness = result["fairness_index"]
    if result["critical_pairs"]:
        strategy = "Рост с зоной риска"
    elif fairness >= 90:
        strategy = "Сбалансированный реформатор"
    elif result["score_delta"] >= 4:
        strategy = "Ускоренное развитие"
    else:
        strategy = "Осторожная модернизация"
    return {
        **result,
        "valid": True,
        "ai_analysis": None,
        "ai_status": "disabled",
        "model_analysis": explanation(result),
        "timeline": _timeline(decisions),
        "stress_test": _stress_test(decisions, result),
        "optimization": {**_optimized_scenarios(), "best_swap": _best_swap(decisions, result["score"])},
        "strategy_title": strategy,
    }


def catalog() -> dict:
    return {**CITY, **CATALOG, "baseline_result": preview([])}

"""AI boundary. These models do not calculate or validate game rules."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DistrictId = Literal["esil", "almaty", "saryarka", "baikonur", "nura"]
Indicator = Literal["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"]
InitiativeId = Annotated[str, Field(pattern=r"^M(1[0-4]|[1-9])$")]
Metric = Annotated[float, Field(ge=0, le=100)]
Text = Annotated[str, Field(min_length=1, max_length=700)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class AIAnalysis(StrictModel):
    summary: Text
    strengths: list[Text] = Field(max_length=5)
    tradeoffs: list[Text] = Field(max_length=5)
    risks: list[Text] = Field(max_length=5)
    recommendations: list[Text] = Field(max_length=5)


class Budget(StrictModel):
    total: int = Field(ge=0)
    spent: int = Field(ge=0)
    remaining: int = Field(ge=0)

    @model_validator(mode="after")
    def check_balance(self):
        if self.spent + self.remaining != self.total:
            raise ValueError("Budget does not balance")
        return self


class Decision(StrictModel):
    initiative_id: InitiativeId
    district_id: DistrictId | None = None
    name_ru: Text
    domain: Literal["transport", "ecology", "social", "safety", "services"]
    cost: int = Field(ge=0)


class DistrictResult(StrictModel):
    district_id: DistrictId
    name_ru: Text
    before: dict[Indicator, Metric] = Field(min_length=10, max_length=10)
    after: dict[Indicator, Metric] = Field(min_length=10, max_length=10)
    score: Metric


class WeakestDistrict(StrictModel):
    district_id: DistrictId
    score: Metric


class Contribution(StrictModel):
    initiative_id: InitiativeId
    district_id: DistrictId | None = None
    realized_effects: dict[Indicator, float]


class Synergy(StrictModel):
    initiatives: list[InitiativeId] = Field(min_length=2, max_length=2)
    district_id: DistrictId
    indicator: Indicator
    value: float


class ScenarioInput(StrictModel):
    """Explicit handoff from backend, after successful deterministic evaluation."""

    budget: Budget
    score: float
    baseline_score: float
    score_delta: float
    city_score: Metric
    weakest_district: WeakestDistrict
    critical_pairs: int = Field(ge=0, le=50)
    districts: list[DistrictResult] = Field(min_length=5, max_length=5)
    decisions: list[Decision] = Field(min_length=5, max_length=5)
    initiative_contributions: list[Contribution] = Field(min_length=5, max_length=5)
    synergies_applied: list[Synergy]

    @model_validator(mode="after")
    def unique_districts(self):
        if len({district.district_id for district in self.districts}) != 5:
            raise ValueError("Expected five distinct districts")
        return self

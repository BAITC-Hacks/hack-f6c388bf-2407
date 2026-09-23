from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictStr

from .engine import ScenarioError, catalog, evaluate, preview

app = FastAPI(
    title="Аким на 5 часов API",
    version="0.1.0",
    description="API симулятора распределения городского бюджета.",
)


@app.get("/api/v1/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    initiative_id: StrictStr
    district_id: StrictStr | None = None


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decisions: list[Decision] = Field(max_length=14)
    include_ai_analysis: bool = True


@app.exception_handler(ScenarioError)
async def scenario_error(_request: Request, error: ScenarioError):
    return JSONResponse(status_code=422, content={"code": error.code, "message": error.message})


@app.exception_handler(RequestValidationError)
async def request_error(_request: Request, _error: RequestValidationError):
    return JSONResponse(status_code=422, content={"code": "invalid_request", "message": "Неверный формат сценария. Обновите страницу и повторите выбор."})


@app.get("/api/v1/scenario/catalog", tags=["scenario"])
def get_catalog():
    return catalog()


@app.post("/api/v1/scenario/preview", tags=["scenario"])
def preview_scenario(body: ScenarioRequest):
    return preview([decision.model_dump(exclude_none=True) for decision in body.decisions])


@app.post("/api/v1/scenario/evaluate", tags=["scenario"])
def evaluate_scenario(body: ScenarioRequest):
    result = evaluate([decision.model_dump(exclude_none=True) for decision in body.decisions])
    if body.include_ai_analysis:
        from .analysis import enrich_analysis

        enrich_analysis(result)
    return result

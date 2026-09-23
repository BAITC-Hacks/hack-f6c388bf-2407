from fastapi import FastAPI

app = FastAPI(
    title="Аким на 5 часов API",
    version="0.1.0",
    description="API симулятора распределения городского бюджета.",
)


@app.get("/api/v1/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# Scenario catalog and evaluation routes will be implemented against
# contracts/openapi.yaml. Keep calculation and validation in the backend.

# Backend API

Python 3.11+ / FastAPI. API models and endpoints must follow the root `contracts/openapi.yaml`. The scenario engine must remain deterministic; AI is only an explanation layer.

Local development command (from `apps/api` after installing the project):

```powershell
python -m uvicorn akim_api.main:app --reload --app-dir src
```

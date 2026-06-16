#!/usr/bin/env python3
"""
Expose une API FastAPI pour la prédiction de conversion des leads.

Endpoints:
- GET /health
- POST /predict

Usage:
    python ia/api.py
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

try:
    from fastapi import Body, Depends, FastAPI, HTTPException, Security  # type: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
    from fastapi.security import APIKeyHeader  # type: ignore
    from pydantic import BaseModel  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Les packages `fastapi`, `uvicorn` et `pydantic` sont requis. "
        "Installe-les avec `pip install fastapi uvicorn pydantic`."
    ) from exc

try:
    from catboost import CatBoostClassifier  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Le package `catboost` est requis. Installe-le avec `pip install catboost`."
    ) from exc

try:
    from .predict_lead import DEFAULT_REPORT, load_training_config, predict_lead  # type: ignore
except ImportError:
    from predict_lead import DEFAULT_REPORT, load_training_config, predict_lead


# ── Pydantic input model (Problem 10) ───────────────────────────────────────
class LeadFeatures(BaseModel):
    source: str = "unknown"
    company: str = ""
    has_company: int = 0
    owner_role: str = "SALES"
    interaction_count: int = 0
    call_count: int = 0
    email_interaction_count: int = 0
    meeting_interaction_count: int = 0
    task_count: int = 0
    completed_task_count: int = 0
    open_task_count: int = 0
    overdue_task_count: int = 0
    call_task_count: int = 0
    email_task_count: int = 0
    meeting_task_count: int = 0
    todo_task_count: int = 0
    avg_task_progress: float = 0.0
    days_since_last_activity: int = 0
    days_since_creation: int = 0


# ── API Key auth (Problem 2) ─────────────────────────────────────────────────
_API_KEY_HEADER = APIKeyHeader(name="X-IA-API-Key", auto_error=False)
_IA_API_SECRET = os.getenv("IA_API_SECRET", "")


def verify_api_key(api_key: str | None = Security(_API_KEY_HEADER)) -> None:
    if not _IA_API_SECRET:
        return  # Auth disabled when IA_API_SECRET is not set (dev mode)
    if api_key != _IA_API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Singleton model loaded once at startup (Problem 1) ───────────────────────
_preloaded_model: CatBoostClassifier | None = None
_preloaded_config: tuple[list[str], list[str], float, Path] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    global _preloaded_model, _preloaded_config
    report_path = Path(DEFAULT_REPORT).resolve()
    _preloaded_config = load_training_config(report_path)
    _preloaded_model = CatBoostClassifier()
    _preloaded_model.load_model(str(_preloaded_config[3]))
    yield


app = FastAPI(
    title="CRM Lead Prediction API",
    version="1.0.0",
    description="API FastAPI pour scorer un lead avec le modèle CatBoost.",
    lifespan=lifespan,
)

# ── CORS restreint (Problem 2) ───────────────────────────────────────────────
_allowed_origins = os.getenv("IA_ALLOWED_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-IA-API-Key"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model_loaded": str(_preloaded_model is not None)}


@app.post("/predict")
def predict(
    payload: LeadFeatures,
    _: None = Depends(verify_api_key),
) -> dict[str, Any]:
    try:
        prediction = predict_lead(
            payload.model_dump(),
            Path(DEFAULT_REPORT).resolve(),
            preloaded_model=_preloaded_model,
            preloaded_config=_preloaded_config,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Prediction failed") from exc

    return {
        "probability": prediction["probability"],
        "score": prediction["score"],
        "label": prediction["label"],
        "threshold": prediction["threshold"],
    }


if __name__ == "__main__":
    try:
        import uvicorn  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "Le package `uvicorn` est requis. Installe-le avec "
            "`pip install uvicorn`."
        ) from exc

    uvicorn.run(app, host="0.0.0.0", port=8000)

"""Metadata and system routes."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import schemas
from backend.database import get_db
from backend.services import products as svc

router = APIRouter(tags=["meta"])

_DEFINITIONS_PATH = Path(__file__).parent.parent.parent / "indicator_definitions.json"


@router.get("/api/indicators", response_model=list[schemas.IndicatorDefinition])
def get_indicator_definitions():
    """Return indicator metadata for frontend tooltips."""
    if not _DEFINITIONS_PATH.exists():
        return []
    with open(_DEFINITIONS_PATH) as f:
        raw = json.load(f)
    # File has a top-level "indicators" key; fall back to treating the whole
    # dict as a flat map if that key is absent (forward-compat).
    if isinstance(raw, dict) and "indicators" in raw:
        raw = raw["indicators"]
    if isinstance(raw, dict):
        result = []
        for k, v in raw.items():
            if not isinstance(v, dict):
                continue
            label = v.get("name") or v.get("label") or k
            result.append(schemas.IndicatorDefinition(
                key=k,
                label=label,
                description=v.get("description", ""),
                unit=v.get("unit"),
                tooltip=v.get("importance") or v.get("tooltip"),
            ))
        return result
    return [schemas.IndicatorDefinition(**item) for item in raw]


@router.get("/api/pipeline-runs", response_model=list[schemas.PipelineRunSummary])
def get_pipeline_runs(limit: int = 10, db: Session = Depends(get_db)):
    return svc.get_pipeline_runs(db, limit)


@router.get("/health")
def health():
    return {"status": "ok"}

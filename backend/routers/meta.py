"""Metadata and system routes."""

import json
import os
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
    # Normalise — the existing file uses a dict or list format
    if isinstance(raw, dict):
        return [schemas.IndicatorDefinition(key=k, **v) for k, v in raw.items()]
    return [schemas.IndicatorDefinition(**item) for item in raw]


@router.get("/api/pipeline-runs", response_model=list[schemas.PipelineRunSummary])
def get_pipeline_runs(limit: int = 10, db: Session = Depends(get_db)):
    return svc.get_pipeline_runs(db, limit)


@router.get("/health")
def health():
    return {"status": "ok"}

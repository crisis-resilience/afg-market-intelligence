"""Metadata and system routes."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend import schemas
from backend.database import get_db
from backend.services import products as svc

logger = logging.getLogger(__name__)

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
def health(response: Response, db: Session = Depends(get_db)):
    """
    Liveness + readiness probe.

    This is the gate the whole deploy hangs on: Dockerfile.backend's
    HEALTHCHECK, docker-compose.prod.yml's `service_healthy` condition, and
    deploy/vm/deploy.sh's rollback decision all read it. So it has to fail
    when the app is genuinely unusable, not merely when the process is dead.

    It therefore issues a real `SELECT 1`. The previous version returned a
    static {"status": "ok"} the moment uvicorn was listening -- which would
    report healthy against an unreachable or half-migrated database, letting
    a broken deploy sail past the health check and never roll back.

    Returns 503 (not 200) when the database is unreachable, so anything
    reading only the HTTP status -- a load balancer, `curl -f`, an uptime
    monitor -- sees the failure without parsing the body.
    """
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.error(f"Health check failed: database unreachable: {exc}")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unhealthy", "database": "unreachable"}

    return {"status": "healthy", "database": "connected"}

"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import discovery, meta, products


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

app = FastAPI(
    title="AFG Market Intelligence API",
    description="Afghanistan market opportunity discovery tool for Afghan exporters",
    version="2.0.0",
    docs_url="/docs" if _env_flag("API_DOCS_ENABLED", True) else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _env_flag("API_DOCS_ENABLED", True) else None,
)

# Comma-separated list of allowed browser origins, e.g.
#   CORS_ORIGINS=https://afg-market.example.org
# Defaults to the local dev frontend rather than "*": in the deployed setup
# Caddy serves the API and the UI from one origin (see deploy/caddy/Caddyfile),
# so production needs no cross-origin allowance at all and the default being
# restrictive means forgetting to set this can't silently expose the API to
# every origin on the internet.
#
# "*" is still accepted explicitly for a genuinely public, unauthenticated
# read-only API -- which this currently is -- but it has to be a deliberate
# choice recorded in the environment, not the built-in default.
_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(meta.router)
app.include_router(discovery.router)

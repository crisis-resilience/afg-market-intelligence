"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import meta, products

app = FastAPI(
    title="AFG Market Intelligence API",
    description="Afghanistan export trade intelligence for UNDP policy analysts",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to specific frontend origin in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(meta.router)

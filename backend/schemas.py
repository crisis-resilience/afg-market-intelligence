"""Pydantic response schemas for all API endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    hs_codes: list[str]
    description: Optional[str]
    # Enriched by the service layer
    has_data: bool = False
    last_year: Optional[int] = None
    total_export_value_usd: Optional[float] = None
    top_market_name: Optional[str] = None


class GrowthMetrics(BaseModel):
    yoy_growth_pct: Optional[float]
    cagr_pct: Optional[float]
    absolute_growth_usd: Optional[float]
    growth_pct: Optional[float]
    first_year: Optional[int]
    last_year: Optional[int]


class PriceMetrics(BaseModel):
    unit_price_usd: Optional[float]
    market_avg_price_usd: Optional[float]
    price_vs_market_pct: Optional[float]
    price_competitiveness: Optional[str]


class MarketIndicator(BaseModel):
    market_code: str
    market_name: Optional[str]
    afg_export_value_usd: Optional[float]
    global_market_size_usd: Optional[float]
    market_share_pct: Optional[float]
    afg_supplier_rank: Optional[int]
    growth: GrowthMetrics
    price: PriceMetrics


class CompetitorRow(BaseModel):
    supplier_code: str
    supplier_name: str
    trade_value_usd: Optional[float]
    trade_quantity: Optional[float]
    market_share_pct: Optional[float]


class MarketDetail(BaseModel):
    market_code: str
    market_name: Optional[str]
    product_id: int
    product_name: str
    indicator: Optional[MarketIndicator]
    competitors: list[CompetitorRow]
    trade_history: list[TradeHistoryPoint]


class TradeHistoryPoint(BaseModel):
    year: int
    trade_value_usd: Optional[float]
    trade_quantity: Optional[float]


class ProductDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    hs_codes: list[str]
    description: Optional[str]
    markets: list[MarketIndicator]


class IndicatorDefinition(BaseModel):
    key: str
    label: str
    description: str
    unit: Optional[str] = None
    tooltip: Optional[str] = None


class PipelineRunSummary(BaseModel):
    id: int
    run_at: str
    status: str
    products_updated: int


# Forward reference resolution
MarketDetail.model_rebuild()

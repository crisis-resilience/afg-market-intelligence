"""SQLAlchemy ORM models — mirror the Alembic migration schema."""

from sqlalchemy import (
    ARRAY, Column, ForeignKey, Integer, Numeric, Text, TIMESTAMP
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False, unique=True)
    category = Column(Text, nullable=False)
    hs_codes = Column(ARRAY(Text), nullable=False)
    description = Column(Text)

    trade_flows = relationship("TradeFlow", back_populates="product", cascade="all, delete-orphan")
    competitor_flows = relationship("CompetitorFlow", back_populates="product", cascade="all, delete-orphan")
    indicators = relationship("Indicator", back_populates="product", cascade="all, delete-orphan")


class Market(Base):
    __tablename__ = "markets"

    id = Column(Integer, primary_key=True)
    country_code = Column(Text, nullable=False, unique=True)
    country_name = Column(Text)
    region = Column(Text)


class TradeFlow(Base):
    __tablename__ = "trade_flows"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    importer_code = Column(Text, nullable=False)
    importer_name = Column(Text)
    year = Column(Integer, nullable=False)
    trade_value_usd = Column(Numeric(20, 2))
    trade_quantity = Column(Numeric(20, 4))
    quantity_unit = Column(Text)
    net_weight_kg = Column(Numeric(20, 4))
    fetched_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="trade_flows")


class CompetitorFlow(Base):
    __tablename__ = "competitor_flows"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    market_code = Column(Text, nullable=False)
    year = Column(Integer, nullable=False)
    supplier_code = Column(Text, nullable=False)
    supplier_name = Column(Text, nullable=False)
    trade_value_usd = Column(Numeric(20, 2))
    trade_quantity = Column(Numeric(20, 4))

    product = relationship("Product", back_populates="competitor_flows")


class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    market_code = Column(Text, nullable=False)
    computed_for_year = Column(Integer, nullable=False)
    global_market_size_usd = Column(Numeric(20, 2))
    afg_export_value_usd = Column(Numeric(20, 2))
    yoy_growth_pct = Column(Numeric(10, 4))
    cagr_pct = Column(Numeric(10, 4))
    absolute_growth_usd = Column(Numeric(20, 2))
    growth_pct = Column(Numeric(10, 4))
    first_year = Column(Integer)
    last_year = Column(Integer)
    market_share_pct = Column(Numeric(10, 6))
    afg_supplier_rank = Column(Integer)
    unit_price_usd = Column(Numeric(20, 6))
    market_avg_price_usd = Column(Numeric(20, 6))
    price_vs_market_pct = Column(Numeric(10, 4))
    price_competitiveness = Column(Text)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="indicators")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True)
    run_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    status = Column(Text, nullable=False)
    products_updated = Column(Integer, default=0)
    errors_json = Column(JSONB)

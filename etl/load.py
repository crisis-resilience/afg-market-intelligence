"""
Database loader — upserts ETL output rows into PostgreSQL.

All operations are idempotent: re-running the ETL for the same (product, year)
overwrites existing rows rather than creating duplicates.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


# ── Public loaders ────────────────────────────────────────────────────────────

def upsert_product(engine: Engine, name: str, category: str, hs_codes: list[str],
                   description: str) -> int:
    """Insert or update a product row; return its id."""
    sql = text("""
        INSERT INTO products (name, category, hs_codes, description)
        VALUES (:name, :category, :hs_codes, :description)
        ON CONFLICT (name)
        DO UPDATE SET
            category    = EXCLUDED.category,
            hs_codes    = EXCLUDED.hs_codes,
            description = EXCLUDED.description
        RETURNING id
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, {
            "name": name,
            "category": category,
            "hs_codes": hs_codes,
            "description": description,
        }).fetchone()
    return row[0]


def upsert_market(engine: Engine, country_code: str, country_name: str | None) -> None:
    """Insert a market row if it does not already exist."""
    sql = text("""
        INSERT INTO markets (country_code, country_name)
        VALUES (:code, :name)
        ON CONFLICT (country_code) DO UPDATE SET
            country_name = COALESCE(EXCLUDED.country_name, markets.country_name)
    """)
    with engine.begin() as conn:
        conn.execute(sql, {"code": country_code, "name": country_name})


def bulk_upsert_trade_flows(engine: Engine, rows: list[dict]) -> int:
    """
    Upsert trade_flows rows in a single transaction.
    Conflict key: (product_id, importer_code, year).
    Returns number of rows processed.
    """
    if not rows:
        return 0
    sql = text("""
        INSERT INTO trade_flows
            (product_id, importer_code, importer_name, year,
             trade_value_usd, trade_quantity, quantity_unit, net_weight_kg)
        VALUES
            (:product_id, :importer_code, :importer_name, :year,
             :trade_value_usd, :trade_quantity, :quantity_unit, :net_weight_kg)
        ON CONFLICT (product_id, importer_code, year) DO UPDATE SET
            importer_name   = EXCLUDED.importer_name,
            trade_value_usd = EXCLUDED.trade_value_usd,
            trade_quantity  = EXCLUDED.trade_quantity,
            quantity_unit   = EXCLUDED.quantity_unit,
            net_weight_kg   = EXCLUDED.net_weight_kg,
            fetched_at      = NOW()
    """)
    with engine.begin() as conn:
        conn.execute(sql, rows)
    return len(rows)


def bulk_upsert_competitor_flows(engine: Engine, rows: list[dict]) -> int:
    """
    Upsert competitor_flows rows.
    Conflict key: (product_id, market_code, supplier_code, year).
    """
    if not rows:
        return 0
    sql = text("""
        INSERT INTO competitor_flows
            (product_id, market_code, year,
             supplier_code, supplier_name, trade_value_usd, trade_quantity)
        VALUES
            (:product_id, :market_code, :year,
             :supplier_code, :supplier_name, :trade_value_usd, :trade_quantity)
        ON CONFLICT (product_id, market_code, supplier_code, year) DO UPDATE SET
            supplier_name   = EXCLUDED.supplier_name,
            trade_value_usd = EXCLUDED.trade_value_usd,
            trade_quantity  = EXCLUDED.trade_quantity
    """)
    with engine.begin() as conn:
        conn.execute(sql, rows)
    return len(rows)


def bulk_upsert_indicators(engine: Engine, rows: list[dict]) -> int:
    """
    Upsert pre-computed indicator rows.
    Conflict key: (product_id, market_code, computed_for_year).
    """
    if not rows:
        return 0
    sql = text("""
        INSERT INTO indicators (
            product_id, market_code, computed_for_year,
            global_market_size_usd, afg_export_value_usd,
            yoy_growth_pct, cagr_pct, absolute_growth_usd, growth_pct,
            first_year, last_year,
            market_share_pct, afg_supplier_rank,
            unit_price_usd, market_avg_price_usd,
            price_vs_market_pct, price_competitiveness,
            computed_at
        ) VALUES (
            :product_id, :market_code, :computed_for_year,
            :global_market_size_usd, :afg_export_value_usd,
            :yoy_growth_pct, :cagr_pct, :absolute_growth_usd, :growth_pct,
            :first_year, :last_year,
            :market_share_pct, :afg_supplier_rank,
            :unit_price_usd, :market_avg_price_usd,
            :price_vs_market_pct, :price_competitiveness,
            NOW()
        )
        ON CONFLICT (product_id, market_code, computed_for_year) DO UPDATE SET
            global_market_size_usd = EXCLUDED.global_market_size_usd,
            afg_export_value_usd   = EXCLUDED.afg_export_value_usd,
            yoy_growth_pct         = EXCLUDED.yoy_growth_pct,
            cagr_pct               = EXCLUDED.cagr_pct,
            absolute_growth_usd    = EXCLUDED.absolute_growth_usd,
            growth_pct             = EXCLUDED.growth_pct,
            first_year             = EXCLUDED.first_year,
            last_year              = EXCLUDED.last_year,
            market_share_pct       = EXCLUDED.market_share_pct,
            afg_supplier_rank      = EXCLUDED.afg_supplier_rank,
            unit_price_usd         = EXCLUDED.unit_price_usd,
            market_avg_price_usd   = EXCLUDED.market_avg_price_usd,
            price_vs_market_pct    = EXCLUDED.price_vs_market_pct,
            price_competitiveness  = EXCLUDED.price_competitiveness,
            computed_at            = NOW()
    """)
    with engine.begin() as conn:
        conn.execute(sql, rows)
    return len(rows)


def log_pipeline_run(engine: Engine, status: str, products_updated: int,
                     errors: list[dict]) -> None:
    sql = text("""
        INSERT INTO pipeline_runs (run_at, status, products_updated, errors_json)
        VALUES (NOW(), :status, :products_updated, :errors_json::jsonb)
    """)
    import json
    with engine.begin() as conn:
        conn.execute(sql, {
            "status": status,
            "products_updated": products_updated,
            "errors_json": json.dumps(errors),
        })

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-24
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.Text, nullable=False, unique=True),
        sa.Column("category", sa.Text, nullable=False),
        sa.Column("hs_codes", postgresql.ARRAY(sa.Text), nullable=False),
        sa.Column("description", sa.Text),
    )

    op.create_table(
        "markets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("country_code", sa.Text, nullable=False, unique=True),
        sa.Column("country_name", sa.Text),
        sa.Column("region", sa.Text),
    )

    op.create_table(
        "trade_flows",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("importer_code", sa.Text, nullable=False),
        sa.Column("importer_name", sa.Text),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("trade_value_usd", sa.Numeric(20, 2)),
        sa.Column("trade_quantity", sa.Numeric(20, 4)),
        sa.Column("quantity_unit", sa.Text),
        sa.Column("net_weight_kg", sa.Numeric(20, 4)),
        sa.Column("fetched_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("product_id", "importer_code", "year", name="uq_trade_flows"),
    )
    op.create_index("ix_trade_flows_product_year", "trade_flows", ["product_id", "year"])

    op.create_table(
        "competitor_flows",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("market_code", sa.Text, nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("supplier_code", sa.Text, nullable=False),
        sa.Column("supplier_name", sa.Text, nullable=False),
        sa.Column("trade_value_usd", sa.Numeric(20, 2)),
        sa.Column("trade_quantity", sa.Numeric(20, 4)),
        sa.UniqueConstraint("product_id", "market_code", "supplier_code", "year",
                            name="uq_competitor_flows"),
    )
    op.create_index("ix_competitor_flows_product_market", "competitor_flows",
                    ["product_id", "market_code", "year"])

    op.create_table(
        "indicators",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("market_code", sa.Text, nullable=False),
        sa.Column("computed_for_year", sa.Integer, nullable=False),
        sa.Column("global_market_size_usd", sa.Numeric(20, 2)),
        sa.Column("afg_export_value_usd", sa.Numeric(20, 2)),
        sa.Column("yoy_growth_pct", sa.Numeric(10, 4)),
        sa.Column("cagr_pct", sa.Numeric(10, 4)),
        sa.Column("absolute_growth_usd", sa.Numeric(20, 2)),
        sa.Column("growth_pct", sa.Numeric(10, 4)),
        sa.Column("first_year", sa.Integer),
        sa.Column("last_year", sa.Integer),
        sa.Column("market_share_pct", sa.Numeric(10, 6)),
        sa.Column("afg_supplier_rank", sa.Integer),
        sa.Column("unit_price_usd", sa.Numeric(20, 6)),
        sa.Column("market_avg_price_usd", sa.Numeric(20, 6)),
        sa.Column("price_vs_market_pct", sa.Numeric(10, 4)),
        sa.Column("price_competitiveness", sa.Text),
        sa.Column("computed_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("product_id", "market_code", "computed_for_year",
                            name="uq_indicators"),
    )
    op.create_index("ix_indicators_product", "indicators", ["product_id"])

    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("run_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("products_updated", sa.Integer, default=0),
        sa.Column("errors_json", postgresql.JSONB),
    )


def downgrade() -> None:
    op.drop_table("pipeline_runs")
    op.drop_table("indicators")
    op.drop_table("competitor_flows")
    op.drop_table("trade_flows")
    op.drop_table("markets")
    op.drop_table("products")

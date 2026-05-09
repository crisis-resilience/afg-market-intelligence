"""market_context table and opportunity score columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-country, per-year World Bank indicators (product-independent)
    op.create_table(
        "market_context",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("country_code", sa.Text, nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("gdp_usd", sa.Numeric(20, 2)),
        sa.Column("gdp_per_capita_usd", sa.Numeric(20, 2)),
        sa.Column("lpi_score", sa.Numeric(5, 3)),           # 1–5
        sa.Column("regulatory_quality", sa.Numeric(6, 4)),  # WGI -2.5 to 2.5
        sa.Column("political_stability", sa.Numeric(6, 4)), # WGI -2.5 to 2.5
        sa.Column("fetched_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("country_code", "year", name="uq_market_context"),
    )
    op.create_index("ix_market_context_country", "market_context", ["country_code"])

    # Opportunity score + contextual columns on existing indicators table
    op.add_column("indicators", sa.Column("opportunity_score", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("distance_km", sa.Integer))
    op.add_column("indicators", sa.Column("has_fta", sa.Boolean))
    op.add_column("indicators", sa.Column("language_similarity", sa.Numeric(4, 3)))
    op.add_column("indicators", sa.Column("gdp_per_capita_usd", sa.Numeric(20, 2)))
    op.add_column("indicators", sa.Column("lpi_score", sa.Numeric(5, 3)))
    op.add_column("indicators", sa.Column("regulatory_quality", sa.Numeric(6, 4)))
    op.add_column("indicators", sa.Column("political_stability", sa.Numeric(6, 4)))
    op.add_column("indicators", sa.Column("score_market_size", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_market_growth", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_market_quality", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_price_competitiveness", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_afg_foothold", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_distance", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_language", sa.Numeric(5, 2)))
    op.add_column("indicators", sa.Column("score_fta", sa.Numeric(5, 2)))

    # Index for efficient discovery queries (rank all markets by score)
    op.create_index(
        "ix_indicators_score",
        "indicators",
        ["product_id", "computed_for_year", "opportunity_score"],
    )


def downgrade() -> None:
    op.drop_index("ix_indicators_score", "indicators")

    for col in [
        "opportunity_score", "distance_km", "has_fta", "language_similarity",
        "gdp_per_capita_usd", "lpi_score", "regulatory_quality", "political_stability",
        "score_market_size", "score_market_growth", "score_market_quality",
        "score_price_competitiveness", "score_afg_foothold", "score_distance",
        "score_language", "score_fta",
    ]:
        op.drop_column("indicators", col)

    op.drop_index("ix_market_context_country", "market_context")
    op.drop_table("market_context")

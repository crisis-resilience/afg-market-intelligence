"""tariff rate columns on indicators

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Effective tariff rate (%) charged by the destination market on imports from Afghanistan
    op.add_column("indicators", sa.Column("tariff_rate_pct", sa.Numeric(6, 3)))
    op.add_column("indicators", sa.Column("tariff_indicator", sa.Text))  # 'AHS' or 'MFN' (which series the rate came from)
    op.add_column("indicators", sa.Column("score_tariff", sa.Numeric(5, 2)))


def downgrade() -> None:
    op.drop_column("indicators", "score_tariff")
    op.drop_column("indicators", "tariff_indicator")
    op.drop_column("indicators", "tariff_rate_pct")

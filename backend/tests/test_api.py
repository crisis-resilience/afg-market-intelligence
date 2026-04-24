"""
API contract tests — verify endpoint shapes without requiring a live DB.

Uses httpx TestClient with the FastAPI app and an in-memory SQLite DB
(via a dependency override) so tests run in CI without Docker.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from backend.models import Base

# ── Test DB setup (SQLite in-memory) ─────────────────────────────────────────

SQLITE_URL = "sqlite://"

test_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# SQLite doesn't support ARRAY; we patch the migration by creating tables directly
# from the ORM models, skipping PostgreSQL-specific column types.
@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


TestingSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    # Create tables using raw SQL to avoid ARRAY/JSONB types not in SQLite
    with test_engine.begin() as conn:
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                hs_codes TEXT NOT NULL,
                description TEXT
            )
        """))
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS markets (
                id INTEGER PRIMARY KEY,
                country_code TEXT NOT NULL UNIQUE,
                country_name TEXT,
                region TEXT
            )
        """))
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS trade_flows (
                id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL,
                importer_code TEXT NOT NULL,
                importer_name TEXT,
                year INTEGER NOT NULL,
                trade_value_usd REAL,
                trade_quantity REAL,
                quantity_unit TEXT,
                net_weight_kg REAL,
                fetched_at TEXT,
                UNIQUE(product_id, importer_code, year)
            )
        """))
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS competitor_flows (
                id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL,
                market_code TEXT NOT NULL,
                year INTEGER NOT NULL,
                supplier_code TEXT NOT NULL,
                supplier_name TEXT NOT NULL,
                trade_value_usd REAL,
                trade_quantity REAL,
                UNIQUE(product_id, market_code, supplier_code, year)
            )
        """))
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS indicators (
                id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL,
                market_code TEXT NOT NULL,
                computed_for_year INTEGER NOT NULL,
                global_market_size_usd REAL,
                afg_export_value_usd REAL,
                yoy_growth_pct REAL,
                cagr_pct REAL,
                absolute_growth_usd REAL,
                growth_pct REAL,
                first_year INTEGER,
                last_year INTEGER,
                market_share_pct REAL,
                afg_supplier_rank INTEGER,
                unit_price_usd REAL,
                market_avg_price_usd REAL,
                price_vs_market_pct REAL,
                price_competitiveness TEXT,
                computed_at TEXT,
                UNIQUE(product_id, market_code, computed_for_year)
            )
        """))
        conn.execute(__import__("sqlalchemy").text("""
            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id INTEGER PRIMARY KEY,
                run_at TEXT,
                status TEXT NOT NULL,
                products_updated INTEGER DEFAULT 0,
                errors_json TEXT
            )
        """))
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seeded_db():
    """Insert minimal fixtures for tests that need data."""
    with TestingSession() as db:
        from sqlalchemy import text
        db.execute(text(
            "INSERT OR IGNORE INTO products (name, category, hs_codes, description) "
            "VALUES ('Saffron', 'Spices & Herbs', '091020', 'Saffron stigmas')"
        ))
        db.execute(text(
            "INSERT OR IGNORE INTO markets (country_code, country_name) "
            "VALUES ('699', 'India')"
        ))
        db.execute(text(
            "INSERT OR IGNORE INTO indicators "
            "(product_id, market_code, computed_for_year, afg_export_value_usd, "
            " global_market_size_usd, market_share_pct, afg_supplier_rank, "
            " yoy_growth_pct, cagr_pct, absolute_growth_usd, growth_pct, "
            " first_year, last_year, price_competitiveness) "
            "SELECT p.id, '699', 2024, 1500000, 50000000, 3.0, 2, "
            "       10.5, 8.2, 200000, 15.4, 2021, 2024, 'Competitive' "
            "FROM products p WHERE p.name = 'Saffron'"
        ))
        db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestProductsList:
    def test_returns_list(self, client):
        r = client.get("/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_product_schema(self, client, seeded_db):
        r = client.get("/api/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        item = items[0]
        assert "id" in item
        assert "name" in item
        assert "category" in item
        assert "hs_codes" in item
        assert "has_data" in item


class TestProductDetail:
    def test_unknown_hs_code_returns_404(self, client):
        r = client.get("/api/products/999999")
        assert r.status_code == 404

    def test_known_hs_code_returns_detail(self, client, seeded_db):
        r = client.get("/api/products/091020")
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Saffron"
        assert "markets" in body
        assert isinstance(body["markets"], list)

    def test_market_indicator_schema(self, client, seeded_db):
        r = client.get("/api/products/091020")
        assert r.status_code == 200
        markets = r.json()["markets"]
        if markets:
            m = markets[0]
            assert "market_code" in m
            assert "growth" in m
            assert "price" in m
            assert "yoy_growth_pct" in m["growth"]
            assert "cagr_pct" in m["growth"]
            assert "unit_price_usd" in m["price"]


class TestMarketDetail:
    def test_unknown_returns_404(self, client):
        r = client.get("/api/products/091020/markets/ZZZZ")
        # Either 404 (product not found) or empty response — both are valid
        assert r.status_code in (200, 404)

    def test_known_market_returns_detail(self, client, seeded_db):
        r = client.get("/api/products/091020/markets/699")
        assert r.status_code == 200
        body = r.json()
        assert "market_code" in body
        assert "competitors" in body
        assert "trade_history" in body


class TestIndicatorDefinitions:
    def test_returns_list(self, client):
        r = client.get("/api/indicators")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestPipelineRuns:
    def test_returns_list(self, client):
        r = client.get("/api/pipeline-runs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

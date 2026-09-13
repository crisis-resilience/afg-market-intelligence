# AFG Market Diversification Tool

A market discovery platform that helps Afghan businesses and UNDP trade analysts identify and rank the best new export markets for Afghan products — modelled on the US government's [trade.gov Market Diversification Tool](https://www.trade.gov/market-diversification-tool) but built specifically for the Afghan export context.

## What it does

A user selects a product (by HS code or name), and the tool returns a ranked list of markets scored by a composite **Opportunity Score** (0–100). Each market is scored across eight dimensions:

| Dimension | Weight | Source |
|-----------|--------|--------|
| Market size (global imports of this product) | 20% | UN Comtrade |
| Market growth (CAGR of global imports in this market) | 18% | UN Comtrade |
| Market quality (governance, logistics) | 13% | World Bank WDI/WGI |
| Price competitiveness | 13% | UN Comtrade |
| Tariff rate on Afghan goods | 12% | WITS (World Bank) |
| Existing Afghan foothold | 10% | UN Comtrade (mirror stats) |
| Geographic proximity to Kabul | 10% | CEPII GeoDist |
| Language / cultural similarity | 4% | DICL |

**FTA / preferential trade access is computed and stored but deliberately not weighted.** WITS's Afghanistan-specific (`partner=004`) tariff schedule returns "NoRecordsFound" for effectively every reporter, so `has_fta` is false for ~100% of rows — a weight that could never move the score. Its former 2% share was folded into Tariff (10% → 12%). See the comment on `OPPORTUNITY_SCORE_WEIGHTS` in `config.py`.

A dimension whose underlying data is genuinely missing scores `NULL` rather than defaulting to a neutral 50; it is dropped from the composite and the remaining weights are renormalised to sum to 1.0.

The tool also surfaces **practical next steps** per market (documentation, tariff claims, buyer contacts, trade fairs) as its key differentiator over existing tools.

---

## Architecture

```
UN Comtrade API + World Bank API
        ↓
  etl/  (fetch → transform → load)
        ↓
  PostgreSQL (trade data + opportunity scores)
        ↓
  backend/  (FastAPI — serves ranked markets + market profiles)
        ↓
  frontend/  (Next.js — discovery wizard UI)
```

**Stack:** Python · FastAPI · PostgreSQL · Alembic · Next.js · Docker Compose · Caddy · GitHub Actions · GHCR

---

## Quick start

### Prerequisites

- Docker and Docker Compose
- UN Comtrade API key ([register here](https://unstats.un.org/wiki/display/comtrade/UN+Comtrade+API))

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set COMTRADE_API_KEY and POSTGRES_PASSWORD
```

### 2. Start services

```bash
docker-compose up -d
```

This starts PostgreSQL and the FastAPI backend. On first start, the backend container runs `alembic upgrade head` automatically.

### 3. Run the ETL pipeline

```bash
# Full run — all 38 products + World Bank indicators
docker-compose exec backend python -m etl.run

# Specific products only
docker-compose exec backend python -m etl.run --products Saffron "Dried Grapes (Raisins)"

# Skip World Bank fetch (use cached data)
docker-compose exec backend python -m etl.run --skip-world-bank

# Skip WITS tariff fetch (faster runs; reuses each product's previously-stored tariffs)
docker-compose exec backend python -m etl.run --skip-tariffs

# Dry run — fetch and transform but don't write to DB
python -m etl.run --dry-run
```

### 4. Explore the API

With the backend running at `http://localhost:8000`:

```
GET /api/discover/091020              → Ranked markets for Saffron
GET /api/discover/091020?limit=10     → Top 10 markets only
GET /api/discover/091020?min_score=60 → Markets scoring 60+
GET /api/discover/091020/markets/699  → Full profile for India market
GET /api/products                     → All products
GET /api/products/091020              → Product detail with market indicators
GET /api/indicators                   → Indicator definitions / tooltips
GET /health                           → Health check
```

Interactive API docs: `http://localhost:8000/docs`

---

## Development

### Install dependencies

`requirements.txt` is a **generated lockfile** — every transitive dependency is pinned so that the image CI tests and the image production runs contain identical packages. Edit `requirements.in` (runtime) or `requirements-dev.in` (test tooling), never the `.txt` files:

```bash
pip install -r requirements.txt -r requirements-dev.txt

# After changing a .in file:
pip install pip-tools
pip-compile --strip-extras requirements.in     -o requirements.txt
pip-compile --strip-extras requirements-dev.in -o requirements-dev.txt
```

CI recompiles both and fails if the committed lockfiles have drifted.

### Run tests

```bash
pytest              # 253 tests; the SQLite/pure-Python ones need nothing
```

Most tests use an in-memory SQLite DB or plain Python objects. Three suites
(`etl/tests/test_load.py`, `test_pipeline_integration.py`, `test_verify.py`)
exercise the real PostgreSQL upsert SQL and skip automatically without a
database. To run them too:

```bash
docker compose up -d db_test
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/afg_market_test
pytest
```

CI always runs them, against a Postgres service container, and fails if they skip.

### Lint

```bash
ruff check .
```

### Database migrations

```bash
# Apply all migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"
```

---

## Project structure

```
afg-market-intelligence/
├── config.py                    # Products (38, 39 unique HS codes), score weights, reference lookups
├── requirements.txt
├── pyproject.toml               # Ruff + pytest config
├── alembic.ini
├── .env.example
├── docker-compose.yml
├── Dockerfile.backend
│
├── etl/
│   ├── fetch.py                 # Comtrade + World Bank + WITS API clients
│   ├── transform.py             # Data normalisation + opportunity score computation
│   ├── load.py                  # Idempotent PostgreSQL upserts
│   ├── run.py                   # ETL orchestrator (CLI entry point)
│   └── verify.py                # DB sanity checks + optional live spot-checks
│
├── migrations/
│   └── versions/               # 0001–0011; see HANDOVER.md §3 for what each adds
│
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models.py                # ORM models
│   ├── schemas.py                # Pydantic response schemas
│   ├── country_names.py         # UN M49 code → country name resolution
│   ├── routers/
│   │   ├── discovery.py         # GET /api/discover/*
│   │   ├── products.py          # GET /api/products/*
│   │   └── meta.py              # GET /api/indicators, /health
│   ├── services/
│   │   ├── discovery.py         # Ranked-market queries + next-step logic
│   │   └── products.py          # Product/market indicator queries
│   └── tests/                   # API contract tests (SQLite, no Docker)
│
├── tests/                       # config/HS-code validation + Comtrade fetch layer
├── etl/tests/                   # transform, scoring, load, verify, integration
│
├── frontend/                    # Next.js app (product grid, discovery, market profile)
│
├── reference/                   # Checked-in source data (CEPII, DICL, HS nomenclature)
│                                #   + the scripts that regenerate the extracts
│
├── deploy/                      # Production deployment (see docs/VM_DEPLOYMENT.md)
│   ├── caddy/Caddyfile          # TLS termination + routing
│   └── vm/
│       ├── deploy.sh            # Pinned as the CI deploy key's forced command
│       └── run-etl.sh           # Pinned as the ETL key's forced command
│
├── docker-compose.yml           # Local dev stack
├── docker-compose.prod.yml      # Production stack (prebuilt images, no exposed DB)
│
├── indicator_definitions.json   # Metric definitions for UI tooltips
│
└── .github/workflows/
    ├── ci-cd.yml                # Test → build+publish images → integration → deploy
    └── etl.yml                  # Monthly ETL on the VM, over SSH (1st, 02:00 UTC)
```

---

## Products covered (38 products, 39 unique HS codes)

| Category | Products |
|----------|----------|
| Tree Nuts | Almonds (in-shell, shelled), Walnuts (in-shell, shelled), Pistachios (in-shell, shelled), Pine Nuts |
| Spices & Herbs | Saffron, Cumin Seeds, Fenugreek, Asafoetida, Liquorice Root, Liquorice Extract |
| Dried Fruits | Dried Grapes (Raisins), Dried Apricots, Dried Figs, Dried Pomegranate |
| Fresh Fruits | Fresh Grapes, Fresh Pomegranate, Watermelons, Melons, Apricots, Mulberries (Fresh), Mulberries (Prepared/Frozen) |
| Carpets & Textiles | Knotted Carpets, Woven Carpets (incl. Kilims) |
| Luxury Fibres | Raw Cashmere, Processed Cashmere, Cashmere Sweaters, Karakul Sheepskin |
| Minerals & Stones | Lapis Lazuli (Unworked), Lapis Lazuli (Worked), Lapis Lazuli (Articles), Marble & Travertine (Crude), Marble & Travertine (Cut), Talc |
| Oilseeds | Sesame Seeds, Flaxseed / Linseed |

**Note on Pomegranate (Fresh & Dried):** pomegranate has no dedicated 6-digit HS code in the Harmonized System, despite being one of Afghanistan's major fruit exports. Trade data for these two products is pulled from the closest catch-all categories instead — `081090` ("other fresh fruit, n.e.c.") for Fresh Pomegranate and `081340` ("other dried fruit, n.e.c.") for Dried Pomegranate — so the reported figures include other minor fruits reported under the same catch-all, not pomegranate exclusively.

**Note on Kilims:** kilims do not have their own HS6 code either. Comtrade's `570210` ("woven, not tufted or flocked" carpets) explicitly names kelim/kilim rugs as part of that single category, alongside other flat-woven carpets. Rather than duplicate identical data under two product names, kilims are tracked under **Woven Carpets** rather than as a separate entry.

**Note on Liquorice Root:** the dedicated liquorice-root code (`121110`) is valid but essentially unused by reporters (only 2 global records across 2021-2024). Real root trade is captured instead via `121190`, a broader "other plants n.e.c." catch-all that also includes unrelated goods (ginseng, coca leaf, poppy straw, ephedra), so figures aren't liquorice-exclusive. **Liquorice Extract** (processed liquorice, `130212`) is tracked as a separate product and does not have this issue — it is a precise, liquorice-specific code.

**Note on Mulberries:** no "dried mulberries" code exists anywhere in the Harmonized System — mulberries only appear grouped with raspberries, blackberries and loganberries under a **fresh** heading (`081020`) or a **cooked/frozen** heading (`081120`), never in the dried-fruit chapter. Tracked as two separate products rather than one "Dried Mulberries" entry, since neither code is actually for dried fruit.

**Note on Lapis Lazuli:** lapis lazuli has no HS6 code of its own. It falls under Comtrade's general precious/semi-precious stone categories, which vary by processing stage, so it is tracked as three separate products: `710310` (unworked/roughly shaped), `710399` (worked, not strung/mounted/set), and `711620` (finished articles). Figures for each include other precious/semi-precious stones reported under the same code, not lapis lazuli exclusively.

---

## Data sources & methodology

All three sources are driven by `config.py` → `YEARS`, currently `[2021, 2022, 2023, 2024, 2025]`. Each source resolves that requested range differently — see below.

### Trade data — UN Comtrade (mirror statistics)
Afghanistan does not report directly to UN Comtrade. Instead, the pipeline uses **mirror statistics**: it queries other countries' import records where Afghanistan is listed as the exporting partner. This is the standard methodology for Afghanistan trade data.

Requested directly for all 5 years in `YEARS`; a given year can come back empty if a reporter hasn't submitted data to Comtrade yet.

### Market context — World Bank Development Indicators
The ETL fetches per-country, per-year indicators from the World Bank API, requested as a single `2021:2025` date range:
- **GDP** (`NY.GDP.MKTP.CD`) and **GDP per capita** (`NY.GDP.PCAP.CD`) — market wealth / purchasing power
- **Logistics Performance Index** (`LP.LPI.OVRL.XQ`) — supply-chain connectivity
- **Regulatory Quality** (`GOV_WGI_RQ.SC`, WGI) — ease of doing business, on WGI's 0-100 "score" scale
- **Political Stability** (`GOV_WGI_PV.SC`, WGI) — market risk, on WGI's 0-100 "score" scale

Both WGI fields deliberately use the `.SC` variant, not the `.EST` (-2.5 to +2.5 "estimate") variant — a plain 0-100 range is clearer to reason about and display.

Coverage isn't even across the requested range: LPI is only published in select years, and the WGI indicators typically lag 1–2 years behind the current year. For each market profile, `lpi_score`, `regulatory_quality`, and `political_stability` each resolve independently to the latest year ≤ the profile's `computed_for_year` with a non-null value — `lpi_score_year`, `regulatory_quality_year`, and `political_stability_year` record which year each one actually came from, since they frequently differ from each other and from `computed_for_year`. `gdp_per_capita_usd` doesn't need this: it's published annually with no gaps, so a missing value there means the fetch failed rather than the data not existing — the WB fetch uses a 60s timeout per 20-country batch for exactly this reason (a 30s timeout was previously dropping GDP-per-capita for large batches of countries on slow responses).

### Tariffs — WITS (World Integrated Trade Solution)
For each market, the ETL queries the WITS TRN (UNCTAD TRAINS) REST API:
- Tries **Afghanistan-specific applied rates** first (partner = Afghanistan; captures preferential rates from FTAs) — reported as `AHS`
- Falls back to **MFN rates** (partner = World) when no Afghanistan-specific data is available — reported as `MFN`

WITS tariff data typically lags 2–3 years behind trade data, so the ETL walks backward through `YEARS` (2025 → 2021) per market until it finds a reported schedule. The `tariff_indicator` field on each market profile tells you which series the rate came from, and `tariff_year` tells you the actual year WITS reported that rate for — which is frequently earlier than the market profile's `computed_for_year`, since it reflects whenever that country last reported to TRAINS within the requested window (not necessarily 2025).

**A fetched rate is only kept if Afghanistan actually trades there.** WITS reports MFN/Applied tariff schedules for a product even when a market doesn't trade it at all — its own site says so directly ("MFN and Applied Tariff are provided for both traded and non-traded goods") — and the tariff API gives no "is this traded" flag to filter that out. So the ETL derives it from Comtrade instead: a rate is discarded (stored as `NULL`) unless `afg_export_value_usd` shows real Afghan exports to that market, this year or (falling back, same logic as the foothold score) historically. This applies the same way whether WITS reported the rate as `AHS` or `MFN` — that only says which regime the number came from, not whether Afghanistan actually trades there.

A discarded rate makes `score_tariff = NULL`, excluded from `opportunity_score` with the remaining weights renormalised — changed 2026-09-02 from a neutral-50 default. Deliberately not a guessed 0 either: `score_afg_foothold` already carries the "no Afghan trade history" penalty as a confirmed fact for its own dimension; not knowing the tariff is a genuinely different situation (we don't know what applies, not that it's bad), so excluding it avoids asserting either a false-favorable or false-punitive number and avoids double-counting the same underlying fact across two dimensions.

### Reference data

Built at import time in `config.py` from checked-in extracts in `reference/` — these were hand-typed dictionaries until 2026-08 and are now real published datasets:

- **Distance from Kabul** — great-circle capital-to-capital km, from CEPII's GeoDist (Mayer & Zignago, 2011). Regenerate with `reference/build_distance_reference.py`.
- **Language similarity** — an 0.8/0.2 blend of DICL's `lp` (linguistic proximity) and `cnl` (common native language) indices against Dari/Pashto (Gurevich, Herman, Toubal & Yotov, 2025). Regenerate with `reference/build_language_reference.py`.
- **FTA status** — no longer a lookup at all. Derived live from WITS's own AHS/MFN partner-segment indicator (`tariff_indicator == 'AHS'`), reusing the tariff fetch.

HS codes are validated against Comtrade's own HS2017/HS2022 nomenclature and the WCO/UNSD correlation table — `tests/test_config.py` fails if a product's code isn't a real leaf code covering every year in `YEARS`.

### Opportunity score

Each dimension is normalised to 0–100, then weighted per `config.py` → `OPPORTUNITY_SCORE_WEIGHTS`.

Normalisation follows the OECD (2008) *Handbook on Constructing Composite Indicators*, Step 5: log-transform first where the raw quantity is positively skewed (§5.1), then Min-Max (§5.3) against a **fixed external reference bound** (§5.4) rather than the observed sample min/max. The bounds are deliberately not recomputed per ETL run — a data-derived bound would make `opportunity_score` incomparable month to month, which is exactly the instability the Handbook warns about.

| Dimension | Scoring |
|-----------|---------|
| Market size | `100 × ln(size / F) / ln(max / F)`, F = `MARKET_SIZE_LOG_FLOOR_USD` (500) |
| Market growth | Min-Max on `[-W, +W]`, W = `CAGR_SCORE_BAND_PCT` (75). 0% CAGR → 50 |
| Market quality | Mean of available sub-scores: LPI (1–5 → 0–100), regulatory quality and political stability (already 0–100 on the WGI `.SC` scale) |
| Price competitiveness | Categorical: Substantially Below Market → 100, Below → 75, Near → 50, Above → 25 |
| Tariff | `100 × (1 − ln1p(rate) / ln1p(ceiling))`, ceiling = `TARIFF_SCORE_LOG_CEILING_PCT` (35) |
| Afghan foothold | `100 × ln1p(value) / ln1p(product max)`; a historical-only export scores at 0.7×, capped at 90 |
| Distance | `100 × (1 − ln1p(km) / ln1p(20015))` — gravity-model treatment: cost scales with the *ratio* of distance |
| Language | `LANGUAGE_SIMILARITY × 100` |

Each constant's derivation against live data is documented inline in `config.py`, including what was rejected and why.

**Missing data is not guessed.** Market size, growth, quality, tariff and distance return `NULL` when their underlying data is genuinely absent. A `NULL` dimension is dropped from the composite and the remaining weights renormalised to sum to 1.0, rather than defaulting to a neutral 50 — asserting "average" with zero information would be a fabricated input, and for tariff specifically would double-count what `score_afg_foothold` already records.

---

## Environment variables

Full annotated list in `.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `COMTRADE_API_KEY` | Yes | UN Comtrade subscription key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Docker only | Password for the `postgres` user |
| `SITE_ADDRESS` | Production | Caddy's site address — a domain gets automatic HTTPS |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Defaults to `http://localhost:3000`, not `*` |
| `ETL_LOG_FILE` | No | Where the ETL writes its log file; falls back to stdout only if unwritable |
| `TEST_DATABASE_URL` | No | Enables the Postgres-backed test suites |

---

## CI/CD and deployment

**`.github/workflows/ci-cd.yml`** runs on every push and PR:

| Job | What it does |
|-----|--------------|
| Test & Lint | `ruff` + the full `pytest` suite, including the Postgres-backed ones — and fails if those *skip* |
| Verify dependency locks | Recompiles `requirements*.txt` with `pip-compile` and fails on drift |
| Lint & Build (frontend) | `eslint` + `next build` |
| Build & publish images | Builds both images; publishes to GHCR tagged `sha-<commit>` on non-PR builds. Asserts no `.env`, `.git` or secret material is in any layer |
| Integration (Docker) | Runs the **real images** against real Postgres: migrations forward, twice (idempotency), and in reverse; `/health` in both its healthy and database-down states; a real `/api/products` query; `docker-compose.prod.yml` validation |
| Deploy to VM | On pushes to `main` only — SSHes in and deploys the tested commit |

**Deployment is to a single VM**, running the images CI built rather than rebuilding on the box. The deploy key is pinned server-side to `deploy/vm/deploy.sh` by an SSH forced command and accepts nothing but a commit SHA that is already an ancestor of `origin/main` — a leaked key can't open a shell or deploy arbitrary code. `deploy.sh` health-checks after bringing the stack up and **rolls back automatically** if the check fails.

The monthly ETL runs **on the VM**, triggered over SSH by its own separate key, so PostgreSQL never publishes a port.

**Setup guide: [`docs/VM_DEPLOYMENT.md`](docs/VM_DEPLOYMENT.md).**

---

## Roadmap

- [x] ETL pipeline (Comtrade + World Bank + WITS tariffs)
- [x] Opportunity scoring model (8 weighted dimensions, configurable weights)
- [x] FastAPI backend with discovery + products endpoints
- [x] Market-entry next steps per market (incl. tariff-aware guidance)
- [x] Next.js frontend — product grid, discovery, market profile
- [x] CI/CD pipeline with automated VM deployment and rollback
- [ ] Database backups (nothing in this repo does this yet — see `docs/VM_DEPLOYMENT.md` §10)
- [ ] Natural language → HS code classifier ("I sell dried figs")
- [ ] Buyer contact directory integration
- [ ] Simplified "business owner" view (vs. analyst view)

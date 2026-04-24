"""
ETL orchestrator — runs the full pipeline for all products in config.PRODUCTS.

Usage:
    python -m etl.run                   # full run
    python -m etl.run --products Saffron "Dried Grapes (Raisins)"
    python -m etl.run --dry-run         # fetch & transform only, skip DB writes
"""

import argparse
import logging
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

# Ensure repo root is on sys.path when run as a module
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import PRODUCTS, TOP_N_MARKETS, YEARS
from etl import fetch, load, transform

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("etl_run.log"),
    ],
)
logger = logging.getLogger(__name__)


def _engine():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return create_engine(url, pool_pre_ping=True)


def _top_market_codes(mirror_df, global_df, top_n: int) -> list[str]:
    """Return codes for the top N markets by latest-year import value."""
    if mirror_df.empty or global_df.empty:
        return []
    import pandas as pd
    latest_year = max(YEARS)
    world_totals = global_df[
        (global_df["partnerCode"] == "0") & (global_df["year"] == latest_year)
    ].copy()
    world_totals["primaryValue"] = pd.to_numeric(world_totals["primaryValue"], errors="coerce")
    top = (
        world_totals.groupby("reporterCode")["primaryValue"]
        .sum()
        .nlargest(top_n)
        .index.tolist()
    )
    return [str(c) for c in top]


def run_product(engine, product_name: str, cfg: dict, dry_run: bool) -> dict:
    hs_codes = cfg["codes"]
    logger.info(f"▶  {product_name}  ({', '.join(hs_codes)})")
    errors = []

    # 1. Upsert product row, get its id
    product_id = None
    if not dry_run:
        product_id = load.upsert_product(
            engine,
            name=product_name,
            category=cfg.get("category", "Other"),
            hs_codes=hs_codes,
            description=cfg.get("description", ""),
        )

    # 2. Fetch mirror exports (Afghanistan's side)
    import pandas as pd
    mirror_frames = []
    for hs in hs_codes:
        try:
            df = fetch.fetch_mirror_exports(hs, YEARS)
            if not df.empty:
                mirror_frames.append(df)
        except Exception as e:
            logger.error(f"  fetch_mirror_exports failed for HS {hs}: {e}")
            errors.append({"hs": hs, "stage": "fetch_mirror", "error": str(e)})

    mirror_df = pd.concat(mirror_frames, ignore_index=True) if mirror_frames else pd.DataFrame()

    # 3. Fetch global import picture (one call per HS code)
    global_frames = []
    for hs in hs_codes:
        try:
            df = fetch.fetch_global_imports(hs, YEARS)
            if not df.empty:
                global_frames.append(df)
        except Exception as e:
            logger.error(f"  fetch_global_imports failed for HS {hs}: {e}")
            errors.append({"hs": hs, "stage": "fetch_global", "error": str(e)})

    global_df = pd.concat(global_frames, ignore_index=True) if global_frames else pd.DataFrame()

    if mirror_df.empty and global_df.empty:
        logger.warning(f"  No data fetched for {product_name} — skipping")
        return {"product": product_name, "status": "no_data", "errors": errors}

    # 4. Determine top markets
    market_codes = _top_market_codes(mirror_df, global_df, TOP_N_MARKETS)
    logger.info(f"  Top markets: {market_codes}")

    if dry_run:
        logger.info(f"  [dry-run] Skipping DB writes for {product_name}")
        return {"product": product_name, "status": "dry_run", "errors": errors}

    # 5. Upsert market rows
    for code in market_codes:
        name = _resolve_market_name(global_df, code)
        load.upsert_market(engine, code, name)

    # 6. Transform + load trade flows
    flow_rows = transform.to_trade_flows(mirror_df, product_id)
    n_flows = load.bulk_upsert_trade_flows(engine, flow_rows)
    logger.info(f"  Upserted {n_flows} trade_flow rows")

    # 7. Transform + load competitor flows
    comp_rows = transform.to_competitor_flows(global_df, product_id, market_codes)
    n_comp = load.bulk_upsert_competitor_flows(engine, comp_rows)
    logger.info(f"  Upserted {n_comp} competitor_flow rows")

    # 8. Compute + load indicators
    ind_rows = transform.compute_indicators(product_id, market_codes, mirror_df, global_df, YEARS)
    n_ind = load.bulk_upsert_indicators(engine, ind_rows)
    logger.info(f"  Upserted {n_ind} indicator rows")

    return {"product": product_name, "status": "success", "errors": errors}


def _resolve_market_name(global_df, code: str) -> str | None:
    if "reporterDesc" in global_df.columns:
        match = global_df[global_df["reporterCode"] == code]["reporterDesc"]
        if not match.empty:
            return str(match.iloc[0])
    if "reporterISO" in global_df.columns:
        match = global_df[global_df["reporterCode"] == code]["reporterISO"]
        if not match.empty:
            return str(match.iloc[0])
    return None


def main():
    parser = argparse.ArgumentParser(description="AFG Market Intelligence ETL")
    parser.add_argument(
        "--products", nargs="+", metavar="NAME",
        help="Run only these products (default: all)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and transform but do not write to DB",
    )
    args = parser.parse_args()

    target = args.products or list(PRODUCTS.keys())
    unknown = [p for p in target if p not in PRODUCTS]
    if unknown:
        logger.error(f"Unknown products: {unknown}")
        sys.exit(1)

    engine = None if args.dry_run else _engine()

    results = []
    all_errors = []
    for name in target:
        result = run_product(engine, name, PRODUCTS[name], dry_run=args.dry_run)
        results.append(result)
        all_errors.extend(result.get("errors", []))

    successes = sum(1 for r in results if r["status"] == "success")
    logger.info(f"\n{'─'*60}")
    logger.info(f"ETL complete: {successes}/{len(results)} products succeeded")
    if all_errors:
        logger.warning(f"  {len(all_errors)} errors logged (see etl_run.log for details)")

    if engine and not args.dry_run:
        status = "success" if not all_errors else "partial"
        load.log_pipeline_run(engine, status, successes, all_errors)


if __name__ == "__main__":
    main()

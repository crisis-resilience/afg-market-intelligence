"""
Transform raw Comtrade API responses into DB-ready row shapes.

Each public function returns a list of dicts that map 1-to-1 to a DB table.
This keeps all column-name translation in one place, decoupled from both the
API client and the DB loader.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

from config import AFGHANISTAN_NUMERIC, PRICE_COMPETITIVENESS

logger = logging.getLogger(__name__)


# ── Trade flows (Afghanistan mirror exports per importer per year) ─────────────

def to_trade_flows(mirror_df: pd.DataFrame, product_id: int) -> list[dict]:
    """
    Convert normalised mirror-export data to trade_flows DB rows.

    mirror_df columns (from fetch.fetch_mirror_exports):
        hs_code, year, importer_code, importer_name,
        trade_value_usd, trade_quantity, quantity_unit, net_weight_kg
    """
    rows = []
    for _, r in mirror_df.iterrows():
        rows.append({
            "product_id": product_id,
            "importer_code": str(r["importer_code"]),
            "importer_name": r.get("importer_name"),
            "year": int(r["year"]),
            "trade_value_usd": _float_or_none(r.get("trade_value_usd")),
            "trade_quantity": _float_or_none(r.get("trade_quantity")),
            "quantity_unit": r.get("quantity_unit"),
            "net_weight_kg": _float_or_none(r.get("net_weight_kg")),
        })
    return rows


# ── Competitor flows (all suppliers to each market) ───────────────────────────

def to_competitor_flows(global_df: pd.DataFrame, product_id: int, market_codes: list[str]) -> list[dict]:
    """
    Extract competitor (supplier) rows for the top markets from the global import DataFrame.

    global_df is the raw response from fetch.fetch_global_imports — it contains
    all reporter × partner combinations. We exclude partnerCode='0' (world aggregate)
    to get actual supplier relationships.

    Only rows where reporterCode is in market_codes are included.
    """
    if global_df.empty:
        return []

    supplier_mask = (
        (global_df["partnerCode"] != "0")
        & (global_df["reporterCode"].isin(market_codes))
    )
    suppliers = global_df[supplier_mask].copy()

    if suppliers.empty:
        return []

    rows = []
    for _, r in suppliers.iterrows():
        supplier_name = (
            r.get("partnerDesc")
            or r.get("partnerISO")
            or str(r["partnerCode"])
        )
        qty = _float_or_none(r.get("qty") if "qty" in r.index else None)
        if qty is None and "netWgt" in r.index:
            qty = _float_or_none(r.get("netWgt"))

        rows.append({
            "product_id": product_id,
            "market_code": str(r["reporterCode"]),
            "year": int(r["year"]),
            "supplier_code": str(r["partnerCode"]),
            "supplier_name": supplier_name,
            "trade_value_usd": _float_or_none(r.get("primaryValue")),
            "trade_quantity": qty,
        })
    return rows


# ── Indicators (one row per product × market, latest year) ────────────────────

def compute_indicators(
    product_id: int,
    market_codes: list[str],
    mirror_df: pd.DataFrame,
    global_df: pd.DataFrame,
    years: list[int],
) -> list[dict]:
    """
    Compute all indicators for each (product, market) pair.

    Returns a list of dicts mapping to the indicators DB table.
    """
    if mirror_df.empty or global_df.empty:
        return []

    latest_year = max(years)
    rows = []

    # World-total imports per market per year (partnerCode == '0')
    world_totals = global_df[global_df["partnerCode"] == "0"].copy()
    world_totals["primaryValue"] = pd.to_numeric(world_totals["primaryValue"], errors="coerce")

    for market_code in market_codes:
        afg_to_market = mirror_df[mirror_df["importer_code"] == market_code].copy()
        if afg_to_market.empty:
            continue

        market_world = world_totals[world_totals["reporterCode"] == market_code].copy()

        # Global market size (latest year)
        global_market_size = _sum_year(market_world, "primaryValue", latest_year)

        # Afghanistan's export value to this market (latest year)
        afg_value_latest = _sum_year(afg_to_market, "trade_value_usd", latest_year)

        # Growth metrics
        growth = _growth_metrics(afg_to_market, years)

        # Market share
        market_share_pct = (
            (afg_value_latest / global_market_size * 100)
            if global_market_size and global_market_size > 0
            else None
        )

        # Afghanistan's rank among all suppliers to this market
        afg_rank = _afg_rank(global_df, market_code, afg_value_latest, latest_year)

        # Unit price
        unit_price = _unit_price(afg_to_market, latest_year)

        # Market average price and competitiveness
        market_avg_price, price_vs_market_pct, competitiveness = _price_competitiveness(
            global_df, market_code, unit_price, latest_year
        )

        rows.append({
            "product_id": product_id,
            "market_code": market_code,
            "computed_for_year": latest_year,
            "global_market_size_usd": _float_or_none(global_market_size),
            "afg_export_value_usd": _float_or_none(afg_value_latest),
            "yoy_growth_pct": _float_or_none(growth["yoy"]),
            "cagr_pct": _float_or_none(growth["cagr"]),
            "absolute_growth_usd": _float_or_none(growth["absolute"]),
            "growth_pct": _float_or_none(growth["pct"]),
            "first_year": growth["first_year"],
            "last_year": growth["last_year"],
            "market_share_pct": _float_or_none(market_share_pct),
            "afg_supplier_rank": afg_rank,
            "unit_price_usd": _float_or_none(unit_price),
            "market_avg_price_usd": _float_or_none(market_avg_price),
            "price_vs_market_pct": _float_or_none(price_vs_market_pct),
            "price_competitiveness": competitiveness,
        })

    return rows


# ── Private helpers ───────────────────────────────────────────────────────────

def _float_or_none(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _sum_year(df: pd.DataFrame, col: str, year: int) -> float | None:
    sub = df[df["year"] == year]
    if sub.empty or col not in sub.columns:
        return None
    total = pd.to_numeric(sub[col], errors="coerce").sum()
    return float(total) if total > 0 else None


def _growth_metrics(afg_df: pd.DataFrame, years: list[int]) -> dict:
    empty = {"yoy": None, "cagr": None, "absolute": None, "pct": None,
             "first_year": None, "last_year": None}
    yearly = (
        afg_df.groupby("year")["trade_value_usd"]
        .sum()
        .reset_index()
        .sort_values("year")
    )
    yearly = yearly[yearly["year"].isin(years)]
    if len(yearly) < 2:
        return empty

    first_year = int(yearly["year"].iloc[0])
    last_year = int(yearly["year"].iloc[-1])
    first_val = float(yearly["trade_value_usd"].iloc[0])
    last_val = float(yearly["trade_value_usd"].iloc[-1])

    yoy = None
    if len(yearly) >= 2:
        prev_val = float(yearly["trade_value_usd"].iloc[-2])
        if prev_val > 0:
            yoy = (last_val - prev_val) / prev_val * 100

    n = last_year - first_year
    cagr = None
    if n > 0 and first_val > 0:
        cagr = ((last_val / first_val) ** (1 / n) - 1) * 100

    absolute = last_val - first_val
    pct = (absolute / first_val * 100) if first_val > 0 else None

    return {
        "yoy": yoy, "cagr": cagr, "absolute": absolute, "pct": pct,
        "first_year": first_year, "last_year": last_year,
    }


def _afg_rank(global_df: pd.DataFrame, market_code: str,
              afg_value: float | None, year: int) -> int | None:
    if afg_value is None:
        return None
    suppliers = global_df[
        (global_df["reporterCode"] == market_code)
        & (global_df["partnerCode"] != "0")
        & (global_df["year"] == year)
    ].copy()
    if suppliers.empty:
        return None
    suppliers["_val"] = pd.to_numeric(suppliers["primaryValue"], errors="coerce")
    higher = (suppliers["_val"] > afg_value).sum()
    return int(higher) + 1


def _unit_price(afg_df: pd.DataFrame, year: int) -> float | None:
    sub = afg_df[afg_df["year"] == year]
    if sub.empty:
        return None
    value = pd.to_numeric(sub["trade_value_usd"], errors="coerce").sum()
    qty = pd.to_numeric(sub.get("trade_quantity", pd.Series(dtype=float)), errors="coerce").sum()
    if qty and qty > 0:
        return float(value / qty)
    # Fall back to net weight
    wt = pd.to_numeric(sub.get("net_weight_kg", pd.Series(dtype=float)), errors="coerce").sum()
    if wt and wt > 0:
        return float(value / wt)
    return None


def _price_competitiveness(
    global_df: pd.DataFrame,
    market_code: str,
    afg_price: float | None,
    year: int,
) -> tuple[float | None, float | None, str | None]:
    if afg_price is None or global_df.empty:
        return None, None, None

    suppliers = global_df[
        (global_df["reporterCode"] == market_code)
        & (global_df["partnerCode"] != "0")
        & (global_df["year"] == year)
    ].copy()
    if suppliers.empty:
        return None, None, None

    suppliers["_val"] = pd.to_numeric(suppliers["primaryValue"], errors="coerce")
    suppliers["_qty"] = pd.to_numeric(
        suppliers.get("qty", pd.Series(dtype=float)), errors="coerce"
    )
    suppliers["_price"] = suppliers.apply(
        lambda r: r["_val"] / r["_qty"] if r["_qty"] > 0 else None, axis=1
    )
    valid = suppliers["_price"].dropna()
    if valid.empty:
        return None, None, None

    market_avg = float(valid.mean())
    pct_diff = (afg_price - market_avg) / market_avg * 100 if market_avg > 0 else None

    label = None
    if pct_diff is not None:
        thresholds = PRICE_COMPETITIVENESS
        if pct_diff < thresholds["highly_competitive"]:
            label = "Highly Competitive"
        elif pct_diff < thresholds["competitive"]:
            label = "Competitive"
        elif pct_diff < thresholds["average"]:
            label = "Average"
        else:
            label = "Above Market"

    return market_avg, pct_diff, label

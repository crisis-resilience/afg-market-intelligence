"""
Data fetch layer: UN Comtrade + World Bank Development Indicators.

Comtrade improvements over the original client:
- Single generic fetch function replaces 6 near-identical functions
- Exponential backoff retry on rate-limit / network errors
- Proper SSL verification via certifi (no global monkey-patch)
"""

import logging
import os
import time

import certifi
import comtradeapicall
import pandas as pd
import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# Afghanistan's UN Comtrade numeric reporter code
AFGHANISTAN_NUMERIC = "4"

# Delay between successive API calls (seconds) to stay within rate limits
_API_DELAY = 1.0

# Patch comtradeapicall to use certifi bundle if it uses requests internally.
# This replaces the unsafe ssl._create_unverified_context monkey-patch used in
# the original comtrade_client.py.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())


def _get_api_key() -> str | None:
    key = os.environ.get("COMTRADE_API_KEY")
    if not key:
        logger.warning("COMTRADE_API_KEY not set — API calls will likely fail")
    return key


class ComtradeRateLimitError(Exception):
    pass


def _call_comtrade(
    period: str,
    hs_code: str,
    flow_code: str,
    reporter_code: str | None,
    partner_code: str | None,
) -> pd.DataFrame:
    """
    Single wrapper around comtradeapicall.getFinalData.

    flow_code: 'M' = imports, 'X' = exports
    reporter_code: None → all reporters
    partner_code: None → all partners
    """
    api_key = _get_api_key()
    response = comtradeapicall.getFinalData(
        subscription_key=api_key,
        typeCode="C",
        freqCode="A",
        clCode="HS",
        period=period,
        reporterCode=reporter_code,
        cmdCode=hs_code,
        flowCode=flow_code,
        partnerCode=partner_code,
        partner2Code=None,
        customsCode=None,
        motCode=None,
    )
    time.sleep(_API_DELAY)

    if response is None:
        return pd.DataFrame()
    if isinstance(response, pd.DataFrame):
        return response if not response.empty else pd.DataFrame()
    if isinstance(response, list):
        return pd.DataFrame(response) if response else pd.DataFrame()
    return pd.DataFrame()


@retry(
    retry=retry_if_exception_type((ComtradeRateLimitError, ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=2, max=16),
    stop=stop_after_attempt(4),
    reraise=True,
)
def fetch_mirror_exports(hs_code: str, years: list[int]) -> pd.DataFrame:
    """
    Fetch Afghanistan's exports via mirror data (all countries' imports FROM Afghanistan).

    Since Afghanistan does not report to UN Comtrade, we query the opposite side:
    all countries' import flows where Afghanistan is the partner/exporter.

    Returns a DataFrame with columns:
        hs_code, year, importer_code, trade_value_usd, trade_quantity, net_weight_kg
    """
    hs_clean = hs_code.replace(".", "")
    period = ",".join(str(y) for y in years)
    logger.info(f"fetch_mirror_exports: HS {hs_clean}, years {period}")

    raw = _call_comtrade(
        period=period,
        hs_code=hs_clean,
        flow_code="M",
        reporter_code=None,          # all importing countries
        partner_code=AFGHANISTAN_NUMERIC,  # Afghanistan as exporter
    )

    if raw.empty:
        logger.warning(f"No mirror export data returned for HS {hs_clean}")
        return pd.DataFrame()

    return _normalise_mirror(raw, hs_clean)


@retry(
    retry=retry_if_exception_type((ComtradeRateLimitError, ConnectionError, TimeoutError)),
    wait=wait_exponential(multiplier=1, min=2, max=16),
    stop=stop_after_attempt(4),
    reraise=True,
)
def fetch_global_imports(hs_code: str, years: list[int]) -> pd.DataFrame:
    """
    Fetch the full global import picture for an HS code: all reporters × all partners.

    This single API call replaces three separate functions in the original client:
      - fetch_unified_global_imports
      - fetch_market_imports_batch (world totals via partnerCode='0')
      - fetch_market_imports_by_partner_batch (supplier breakdowns)

    Returns a DataFrame with raw Comtrade columns plus a normalised 'year' int column.
    Callers use transform.py to extract the slices they need.
    """
    hs_clean = hs_code.replace(".", "")
    period = ",".join(str(y) for y in years)
    logger.info(f"fetch_global_imports: HS {hs_clean}, years {period}")

    raw = _call_comtrade(
        period=period,
        hs_code=hs_clean,
        flow_code="M",
        reporter_code=None,   # all importers
        partner_code=None,    # all suppliers (including World '0')
    )

    if raw.empty:
        logger.warning(f"No global import data returned for HS {hs_clean}")
        return pd.DataFrame()

    # Normalise year column
    if "refYear" in raw.columns:
        raw["year"] = pd.to_numeric(raw["refYear"], errors="coerce").astype("Int64")
    elif "period" in raw.columns:
        raw["year"] = pd.to_numeric(raw["period"], errors="coerce").astype("Int64")

    raw["reporterCode"] = raw["reporterCode"].astype(str)
    raw["partnerCode"] = raw["partnerCode"].astype(str)

    return raw[raw["year"].isin(years)].copy()


# ── World Bank Development Indicators ────────────────────────────────────────

_WB_BASE = "https://api.worldbank.org/v2"

# Indicator codes we fetch from WDI and WGI
_WB_INDICATORS = {
    "gdp_usd": "NY.GDP.MKTP.CD",
    "gdp_per_capita_usd": "NY.GDP.PCAP.CD",
    "lpi_score": "LP.LPI.OVRL.XQ",
    "regulatory_quality": "RQ.EST",
    "political_stability": "PV.EST",
}

_WB_SESSION = requests.Session()
_WB_SESSION.verify = certifi.where()


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError, requests.RequestException)),
    wait=wait_exponential(multiplier=1, min=2, max=16),
    stop=stop_after_attempt(4),
    reraise=True,
)
def _fetch_wb_indicator(country_code: str, indicator_code: str, years: list[int]) -> dict[int, float]:
    """Fetch a single World Bank indicator for one country across multiple years."""
    year_range = f"{min(years)}:{max(years)}"
    url = f"{_WB_BASE}/country/{country_code}/indicator/{indicator_code}"
    params = {"format": "json", "date": year_range, "per_page": 100}
    resp = _WB_SESSION.get(url, params=params, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    if not isinstance(data, list) or len(data) < 2:
        return {}

    result: dict[int, float] = {}
    for entry in data[1] or []:
        yr_str = entry.get("date")
        value = entry.get("value")
        if yr_str and value is not None:
            try:
                result[int(yr_str)] = float(value)
            except (ValueError, TypeError):
                pass
    return result


def fetch_world_bank_indicators(country_codes: list[str], years: list[int]) -> list[dict]:
    """
    Fetch World Bank development indicators for a list of countries.

    country_codes: ISO-3 alpha codes (e.g. ['IND', 'PAK', 'DEU'])
    Returns a list of dicts mapping to the market_context DB table.
    """
    rows = []
    for iso3 in country_codes:
        per_indicator: dict[str, dict[int, float]] = {}
        for field, wb_code in _WB_INDICATORS.items():
            try:
                per_indicator[field] = _fetch_wb_indicator(iso3, wb_code, years)
            except Exception as exc:
                logger.warning(f"World Bank {wb_code} failed for {iso3}: {exc}")
                per_indicator[field] = {}

        # Collect all years that have at least one value
        all_years = set()
        for year_map in per_indicator.values():
            all_years.update(year_map.keys())

        for yr in sorted(all_years):
            rows.append({
                "country_code": iso3,
                "year": yr,
                "gdp_usd": per_indicator["gdp_usd"].get(yr),
                "gdp_per_capita_usd": per_indicator["gdp_per_capita_usd"].get(yr),
                "lpi_score": per_indicator["lpi_score"].get(yr),
                "regulatory_quality": per_indicator["regulatory_quality"].get(yr),
                "political_stability": per_indicator["political_stability"].get(yr),
            })

        time.sleep(0.2)  # gentle rate-limit respect

    logger.info(f"World Bank fetch complete: {len(rows)} rows for {len(country_codes)} countries")
    return rows


# ── Internal helpers ──────────────────────────────────────────────────────────

def _normalise_mirror(df: pd.DataFrame, hs_code: str) -> pd.DataFrame:
    """Standardise column names from a mirror-export API response."""
    out = pd.DataFrame()

    # Year
    if "refYear" in df.columns:
        out["year"] = pd.to_numeric(df["refYear"], errors="coerce").astype("Int64")
    elif "period" in df.columns:
        out["year"] = pd.to_numeric(df["period"], errors="coerce").astype("Int64")

    # Importer (reporter in mirror query = the importing country)
    if "reporterCode" in df.columns:
        out["importer_code"] = df["reporterCode"].astype(str)
    elif "reporterISO" in df.columns:
        out["importer_code"] = df["reporterISO"]
    else:
        logger.warning("No reporter column found in mirror response")
        out["importer_code"] = None

    # Importer name (best-effort)
    if "reporterDesc" in df.columns:
        out["importer_name"] = df["reporterDesc"]
    else:
        out["importer_name"] = None

    # Trade value
    if "primaryValue" in df.columns:
        out["trade_value_usd"] = pd.to_numeric(df["primaryValue"], errors="coerce")
    elif "cifvalue" in df.columns:
        out["trade_value_usd"] = pd.to_numeric(df["cifvalue"], errors="coerce")

    # Quantity
    if "qty" in df.columns:
        out["trade_quantity"] = pd.to_numeric(df["qty"], errors="coerce")
    else:
        out["trade_quantity"] = None

    if "qtyUnitAbbr" in df.columns:
        out["quantity_unit"] = df["qtyUnitAbbr"]
    else:
        out["quantity_unit"] = None

    # Net weight
    if "netWgt" in df.columns:
        out["net_weight_kg"] = pd.to_numeric(df["netWgt"], errors="coerce")
    else:
        out["net_weight_kg"] = None

    out["hs_code"] = hs_code
    return out.dropna(subset=["year", "importer_code", "trade_value_usd"])

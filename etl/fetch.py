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


# ── WITS tariff data ─────────────────────────────────────────────────────────
# WITS (World Integrated Trade Solution) by World Bank.
# Returns SDMX/JSON. Endpoint format:
#   reporter/{ISO3}/year/{YYYY}/partner/{ISO3}/product/{HS6 or 'all'}/indicator/{CODE}
#
# Indicator codes:
#   AHS-SMPL-AVG = Effectively applied tariff, simple average (preferential rates included)
#   MFN-SMPL-AVG = Most-Favoured Nation tariff, simple average (no preference)
#
# We try AHS first (with Afghanistan as partner) → falls back to MFN if no data.

_WITS_BASE = "http://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN"

_WITS_SESSION = requests.Session()
_WITS_SESSION.verify = certifi.where()


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError, requests.RequestException)),
    wait=wait_exponential(multiplier=1, min=2, max=16),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _fetch_wits_tariffs(reporter_iso3: str, year: int, partner_iso3: str | None,
                        indicator: str) -> dict[str, float]:
    """
    Fetch WITS tariff data for one (reporter, year, partner, indicator).
    Returns {hs_code: tariff_pct}.

    partner_iso3=None → MFN rates (no preferential treatment, no partner needed).
    """
    partner_segment = partner_iso3 if partner_iso3 else "000"  # 000 = world / MFN
    url = (
        f"{_WITS_BASE}/reporter/{reporter_iso3}/year/{year}"
        f"/partner/{partner_segment}/product/all/indicator/{indicator}"
    )
    resp = _WITS_SESSION.get(url, params={"format": "JSON"}, timeout=30)
    if resp.status_code == 404:
        return {}
    resp.raise_for_status()

    try:
        data = resp.json()
    except ValueError:
        return {}

    return _parse_wits_response(data)


def _parse_wits_response(data: dict) -> dict[str, float]:
    """
    Walk the SDMX-JSON structure to extract {hs_code: rate} mappings.
    SDMX-JSON nests dimensions deeply; we navigate dataSets → series → observations.
    """
    try:
        structure = data["structure"]
        dimensions = structure["dimensions"]["series"]
        # Find the index of the PRODUCTCODE dimension and its values
        product_dim_idx = None
        product_values: list[str] = []
        for i, dim in enumerate(dimensions):
            if dim.get("id") == "PRODUCTCODE":
                product_dim_idx = i
                product_values = [v["id"] for v in dim["values"]]
                break
        if product_dim_idx is None:
            return {}

        result: dict[str, float] = {}
        for series_key, series in data["dataSets"][0]["series"].items():
            key_parts = series_key.split(":")
            product_idx = int(key_parts[product_dim_idx])
            hs_code = product_values[product_idx]
            # observations is {"0": [value, ...]} where 0 = first time period
            obs = series.get("observations", {}).get("0")
            if obs and obs[0] is not None:
                result[hs_code] = float(obs[0])
        return result
    except (KeyError, IndexError, ValueError, TypeError):
        return {}


def fetch_tariff_rates(market_iso3_codes: list[str], hs_codes: list[str],
                       year: int, partner_iso3: str = "AFG") -> list[dict]:
    """
    Fetch tariff rates for the given (market, hs_code) combinations.

    For each market, makes ONE API call (`product=all`) and filters to our HS codes.
    Tries AHS (effectively applied, with Afghanistan as partner) first;
    falls back to MFN (general rate) if AHS is unavailable.

    Returns list of dicts:
      {market_code: ISO3, hs_code: str, tariff_rate_pct: float, indicator: 'AHS'|'MFN'}
    """
    rows = []
    hs_set = {h.replace(".", "") for h in hs_codes}

    for market_iso3 in market_iso3_codes:
        # Try AHS (preferential rates, Afghanistan-specific) first
        try:
            tariffs = _fetch_wits_tariffs(market_iso3, year, partner_iso3, "AHS-SMPL-AVG")
            indicator_used = "AHS"
        except Exception as exc:
            logger.warning(f"WITS AHS fetch failed for {market_iso3}: {exc}")
            tariffs = {}
            indicator_used = "AHS"

        # Fall back to MFN (general rates) if AHS returned nothing
        if not tariffs:
            try:
                tariffs = _fetch_wits_tariffs(market_iso3, year, None, "MFN-SMPL-AVG")
                indicator_used = "MFN"
            except Exception as exc:
                logger.warning(f"WITS MFN fetch failed for {market_iso3}: {exc}")
                tariffs = {}

        for hs in hs_set:
            rate = tariffs.get(hs)
            if rate is not None:
                rows.append({
                    "market_iso3": market_iso3,
                    "hs_code": hs,
                    "tariff_rate_pct": float(rate),
                    "indicator": indicator_used,
                })

        time.sleep(0.3)  # respectful spacing

    logger.info(f"WITS tariff fetch complete: {len(rows)} rates across {len(market_iso3_codes)} markets")
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

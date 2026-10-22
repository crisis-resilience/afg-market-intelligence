"""
Recommended next steps from the playbook (backend/playbook/next_steps.yaml).

The playbook holds the wording, the links and the conditions; this module only
fills in the product/market details and decides which lines apply. Products
not listed in the playbook's `enabled_products` get None here, and the caller
keeps the older rule-based steps for them.
"""

from __future__ import annotations

import string
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from backend.country_names import name_in_sentence
from config import ISO3_TO_ISO2, NUMERIC_TO_ISO3

PLAYBOOK_PATH = Path(__file__).resolve().parent.parent / "playbook" / "next_steps.yaml"

# Placeholders the playbook may use (documented at the top of the YAML file)
PLACEHOLDERS = {"product", "product_lc", "market", "Market", "markets", "hs6", "iso2", "tariff", "tariff_type"}

# Conditions the playbook may use in `when:` (also documented there)
CONDITIONS = {"product_type", "eu", "tariff_known", "tariff_at_least", "tariff_below", "near", "price_below_market", "perishable"}

# Same overland threshold the older rule-based steps used
NEAR_KM = 3000
BELOW_MARKET = ("Substantially Below Market", "Below Market")


@lru_cache(maxsize=1)
def load_playbook(path: Path = PLAYBOOK_PATH) -> dict:
    """Read and check the playbook once; a mistake in it fails loudly here."""
    with open(path, encoding="utf-8") as f:
        book = yaml.safe_load(f)

    def check_when(when: dict | None, where: str) -> None:
        unknown = set(when or {}) - CONDITIONS
        if unknown:
            raise ValueError(f"{where}: unknown condition(s) {sorted(unknown)}")

    def check_text(value: str, where: str) -> None:
        used = {name for _, name, _, _ in string.Formatter().parse(value) if name}
        unknown = used - PLACEHOLDERS
        if unknown:
            raise ValueError(f"{where}: unknown placeholder(s) {sorted(unknown)}")

    for step in book["steps"]:
        key = step["key"]
        check_text(step["title"], f"step {key} title")
        check_text(step["text"], f"step {key} text")
        for extra in step.get("extra", []):
            check_when(extra.get("when"), f"step {key} extra")
            check_text(extra["text"], f"step {key} extra")
        for link in step.get("links", []):
            check_when(link.get("when"), f"step {key} link")
            check_text(link["label"], f"step {key} link label")
            check_text(link["url"], f"step {key} link url")
    check_text(book["more_link"]["label"], "more_link label")
    check_text(book["more_link"]["url"], "more_link url")
    return book


def _possessive(name: str) -> str:
    return f"{name}’" if name.endswith("s") else f"{name}’s"


def _matches(when: dict | None, facts: dict[str, Any]) -> bool:
    for cond, wanted in (when or {}).items():
        if cond == "product_type":
            if facts["product_type"] not in wanted:
                return False
        elif cond == "tariff_at_least":
            if facts["tariff"] is None or facts["tariff"] < wanted:
                return False
        elif cond == "tariff_below":
            if facts["tariff"] is None or facts["tariff"] >= wanted:
                return False
        elif facts[cond] != wanted:
            return False
    return True


def build_next_steps(
    row,
    *,
    product_name: str,
    category: str | None,
    hs_code: str,
    market_code: str,
    market_name: str,
) -> dict | None:
    """
    Steps for one product and market, or None if the product isn't enabled.

    Returns {"steps": [...], "more_link": {...} | None, "disclaimer": str}.
    Links needing the 2-letter country code are dropped if the market has none.
    """
    book = load_playbook()
    if product_name not in book.get("enabled_products", []):
        return None

    iso3 = NUMERIC_TO_ISO3.get(str(market_code))
    iso2 = ISO3_TO_ISO2.get(iso3) if iso3 else None

    tariff_raw = row.get("tariff_rate_pct")
    tariff = float(tariff_raw) if tariff_raw is not None else None
    distance = row.get("distance_km")

    facts = {
        "product_type": book["product_overrides"].get(product_name)
        or book["product_types"].get(category or ""),
        "eu": iso2 is not None and iso2 in book["eu_members"],
        "tariff_known": tariff is not None,
        "tariff": tariff,
        "near": distance is not None and float(distance) < NEAR_KM,
        "price_below_market": row.get("price_competitiveness") in BELOW_MARKET,
        "perishable": product_name in book.get("perishable_products", []),
    }
    in_text = name_in_sentence(market_name) or market_name
    values = {
        "product": product_name,
        "product_lc": product_name.lower(),
        "market": in_text,
        "Market": in_text[:1].upper() + in_text[1:],
        "markets": _possessive(in_text),
        "hs6": hs_code.replace(".", "").strip()[:6],
        "iso2": (iso2 or "").lower(),
        "tariff": f"{tariff:.1f}%" if tariff is not None else "",
        "tariff_type": "preferential" if row.get("tariff_indicator") == "AHS" else "MFN",
    }

    def fill(template: str) -> str:
        return template.format_map(values)

    def link_ok(link: dict) -> bool:
        return _matches(link.get("when"), facts) and (iso2 is not None or "{iso2}" not in link["url"])

    steps = []
    for order, step in enumerate(book["steps"], start=1):
        sentences = [step["text"]] + [e["text"] for e in step.get("extra", []) if _matches(e.get("when"), facts)]
        steps.append({
            "order": order,
            "key": step["key"],
            "title": fill(step["title"]),
            "description": " ".join(fill(s).strip() for s in sentences),
            "links": [
                {"label": fill(link["label"]), "url": fill(link["url"])}
                for link in step.get("links", [])
                if link_ok(link)
            ],
            "to_confirm": bool(step.get("to_confirm", False)),
        })

    more = book["more_link"]
    return {
        "steps": steps,
        "more_link": {"label": fill(more["label"]), "url": fill(more["url"])} if link_ok(more) else None,
        "disclaimer": book["disclaimer"].strip(),
    }

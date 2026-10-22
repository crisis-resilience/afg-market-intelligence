"""Tests for the next-steps playbook (backend/playbook/next_steps.yaml)."""

import copy

import pytest

from backend.services import next_steps
from backend.services.next_steps import build_next_steps, load_playbook
from config import PRODUCTS

GTH = "https://globaltradehelpdesk.org/en/export-091020-from-af-to-"


def _row(**overrides) -> dict:
    row = {
        "tariff_rate_pct": None,
        "tariff_indicator": None,
        "distance_km": 5000,
        "price_competitiveness": "Near Market",
    }
    row.update(overrides)
    return row


def _saffron(market_code: str, market_name: str, **row) -> dict:
    return build_next_steps(
        _row(**row), product_name="Saffron", category="Spices & Herbs",
        hs_code="091020", market_code=market_code, market_name=market_name,
    )


def _step(result: dict, key: str) -> dict:
    return next(s for s in result["steps"] if s["key"] == key)


def _urls(step: dict) -> list[str]:
    return [link["url"] for link in step["links"]]


class TestPlaybookFile:
    def test_loads_and_passes_its_own_checks(self):
        book = load_playbook()
        assert [s["key"] for s in book["steps"]] == ["documents", "tariff", "requirements", "transport", "buyers"]

    def test_every_product_category_has_a_product_type(self):
        # Step 1 asks for plant/animal health certificates by product type;
        # a new category without one would silently get neither.
        book = load_playbook()
        for name, cfg in PRODUCTS.items():
            ptype = book["product_overrides"].get(name) or book["product_types"].get(cfg["category"])
            assert ptype in {"plant", "animal", "textile", "mineral"}, name

    def test_enabled_products_exist(self):
        for name in load_playbook()["enabled_products"]:
            assert name in PRODUCTS, name

    def test_unknown_placeholder_is_rejected(self, tmp_path):
        book = copy.deepcopy(load_playbook())
        book["steps"][0]["text"] = "Ship {prodcut} today"  # typo
        path = tmp_path / "book.yaml"
        path.write_text(__import__("yaml").safe_dump(book), encoding="utf-8")
        with pytest.raises(ValueError, match="unknown placeholder"):
            load_playbook.__wrapped__(path)

    def test_unknown_condition_is_rejected(self, tmp_path):
        book = copy.deepcopy(load_playbook())
        book["steps"][1]["extra"][0]["when"] = {"is_eu": True}  # should be `eu`
        path = tmp_path / "book.yaml"
        path.write_text(__import__("yaml").safe_dump(book), encoding="utf-8")
        with pytest.raises(ValueError, match="unknown condition"):
            load_playbook.__wrapped__(path)


class TestSaffronToFrance:
    @pytest.fixture
    def result(self):
        # 251 is France's Comtrade code (not ISO's 250)
        return _saffron("251", "France", tariff_rate_pct=0.0, tariff_indicator="MFN")

    def test_five_steps_in_order(self, result):
        assert [s["order"] for s in result["steps"]] == [1, 2, 3, 4, 5]

    def test_links_open_on_this_product_and_market(self, result):
        assert _urls(_step(result, "tariff"))[0] == GTH + "fr/assess-requirements/tariffs"
        assert _urls(_step(result, "requirements")) == [
            GTH + "fr/assess-requirements/regulations",
            GTH + "fr/assess-requirements/regulations/notified-regulatory-changes",
        ]
        assert _urls(_step(result, "transport")) == [GTH + "fr/identify-partners/freight-forwarders"]
        assert result["more_link"]["url"] == GTH + "fr/market-overview"
        assert result["more_link"]["label"] == "See everything for Saffron to France on the Global Trade Helpdesk"

    def test_documents_step_asks_for_plant_health(self, result):
        docs = _step(result, "documents")
        assert "phytosanitary" in docs["description"]
        assert "veterinary" not in docs["description"]
        assert "being confirmed" not in docs["description"]
        assert not any(s["to_confirm"] for s in result["steps"])

    def test_eu_market_gets_everything_but_arms(self, result):
        tariff = _step(result, "tariff")
        assert "Everything But Arms" in tariff["description"]
        assert any("everything-arms-eba" in u for u in _urls(tariff))
        assert any("registered-exporter-system" in u for u in _urls(tariff))
        assert "On record: 0.0% (MFN rate)." in tariff["description"]

    def test_far_market_has_no_overland_line(self, result):
        assert "overland" not in _step(result, "transport")["description"]


class TestSaffronToIndia:
    @pytest.fixture
    def result(self):
        return _saffron("699", "India", tariff_rate_pct=30.0, tariff_indicator="MFN",
                        distance_km=1050, price_competitiveness="Below Market")

    def test_non_eu_market_has_no_eu_lines_or_links(self, result):
        tariff = _step(result, "tariff")
        assert "Everything But Arms" not in tariff["description"]
        assert _urls(tariff) == [GTH + "in/assess-requirements/tariffs"]

    def test_high_tariff_line(self, result):
        assert "That is high" in _step(result, "tariff")["description"]

    def test_near_market_mentions_overland(self, result):
        assert "within overland range" in _step(result, "transport")["description"]

    def test_price_advantage_line(self, result):
        assert "below the market average" in _step(result, "buyers")["description"]

    def test_lower_case_product_mid_sentence(self, result):
        assert "Companies trading saffron in India" in [link["label"] for link in _step(result, "buyers")["links"]]


class TestEdgeCases:
    def test_product_not_enabled_returns_none(self):
        # Every real product is enabled now; a product outside the list (e.g.
        # one newly added to config.PRODUCTS) keeps the rule-based steps.
        assert build_next_steps(
            _row(), product_name="Some New Product", category="Minerals & Stones",
            hs_code="252620", market_code="251", market_name="France",
        ) is None

    def test_market_without_country_code_drops_helpdesk_links(self):
        result = _saffron("999", "Nowhere")
        assert result["more_link"] is None
        assert _step(result, "tariff")["links"] == []
        # links that don't need the country code stay
        assert _urls(_step(result, "documents")) == ["https://acci.org.af/en/"]

    def test_unknown_tariff_skips_the_on_record_line(self):
        assert "On record" not in _step(_saffron("251", "France"), "tariff")["description"]

    def test_animal_product_asks_for_veterinary_certificate(self, monkeypatch):
        book = copy.deepcopy(load_playbook())
        book["enabled_products"] = ["Karakul Sheepskin"]
        monkeypatch.setattr(next_steps, "load_playbook", lambda: book)
        result = build_next_steps(
            _row(), product_name="Karakul Sheepskin", category="Luxury Fibres",
            hs_code="410510", market_code="251", market_name="France",
        )
        docs = _step(result, "documents")
        assert "veterinary" in docs["description"]
        assert "phytosanitary" not in docs["description"]


class TestProductTypeLines:
    """Each product type gets its own step 3 line (and minerals a step 4 one), and only its own."""

    LINES = {
        "plant": "pesticide residues",
        "textile": "fibre content",
        "animal": "cleaned or treated",
        "mineral": "heavy or fragile",
    }

    def _build(self, monkeypatch, product, category, hs):
        book = copy.deepcopy(load_playbook())
        book["enabled_products"] = [product]
        monkeypatch.setattr(next_steps, "load_playbook", lambda: book)
        return build_next_steps(
            _row(), product_name=product, category=category,
            hs_code=hs, market_code="251", market_name="France",
        )

    @pytest.mark.parametrize("product, category, hs, ptype", [
        ("Knotted Carpets", "Carpets & Textiles", "570110", "textile"),
        ("Cashmere Sweaters", "Luxury Fibres", "611012", "textile"),
        ("Karakul Sheepskin", "Luxury Fibres", "410510", "animal"),
        ("Talc", "Minerals & Stones", "252620", "mineral"),
        ("Dried Figs", "Dried Fruits", "080420", "plant"),
    ])
    def test_requirements_line_matches_product_type(self, monkeypatch, product, category, hs, ptype):
        rules = _step(self._build(monkeypatch, product, category, hs), "requirements")["description"]
        for other, phrase in self.LINES.items():
            assert (phrase in rules) == (other == ptype), f"{product}: {other} line"

    def test_only_minerals_get_the_heavy_freight_line(self, monkeypatch):
        stone = _step(self._build(monkeypatch, "Talc", "Minerals & Stones", "252620"), "transport")
        carpet = _step(self._build(monkeypatch, "Knotted Carpets", "Carpets & Textiles", "570110"), "transport")
        assert "Stone is heavy" in stone["description"]
        assert "Stone is heavy" not in carpet["description"]


class TestBatchOne:
    def test_spices_and_herbs_are_enabled(self):
        enabled = set(load_playbook()["enabled_products"])
        assert {"Cumin Seeds", "Fenugreek", "Asafoetida", "Liquorice Root", "Liquorice Extract"} <= enabled

    def test_cumin_gets_plant_guidance_and_its_own_links(self):
        result = build_next_steps(
            _row(), product_name="Cumin Seeds", category="Spices & Herbs",
            hs_code="090931", market_code="586", market_name="Pakistan",
        )
        assert "phytosanitary" in _step(result, "documents")["description"]
        assert _urls(_step(result, "tariff")) == [
            "https://globaltradehelpdesk.org/en/export-090931-from-af-to-pk/assess-requirements/tariffs"
        ]


class TestBatchTwo:
    def test_tree_nuts_and_dried_fruits_are_enabled(self):
        enabled = set(load_playbook()["enabled_products"])
        batch = {name for name, cfg in PRODUCTS.items() if cfg["category"] in ("Tree Nuts", "Dried Fruits")}
        assert len(batch) == 11
        assert batch <= enabled


class TestBatchThree:
    def test_fresh_fruits_and_oilseeds_are_enabled(self):
        enabled = set(load_playbook()["enabled_products"])
        batch = {name for name, cfg in PRODUCTS.items() if cfg["category"] in ("Fresh Fruits", "Oilseeds")}
        assert len(batch) == 9
        assert batch <= enabled


class TestPerishable:
    def _transport(self, product, category, hs):
        result = build_next_steps(
            _row(), product_name=product, category=category,
            hs_code=hs, market_code="784", market_name="United Arab Emirates",
        )
        return _step(result, "transport")["description"]

    def test_fresh_fruit_gets_the_cold_chain_line(self):
        assert "refrigerated transport" in self._transport("Fresh Grapes", "Fresh Fruits", "080610")

    def test_frozen_and_dried_products_do_not(self):
        assert "refrigerated transport" not in self._transport("Mulberries (Prepared/Frozen)", "Fresh Fruits", "081120")
        assert "refrigerated transport" not in self._transport("Dried Figs", "Dried Fruits", "080420")

    def test_perishable_products_exist(self):
        for name in load_playbook()["perishable_products"]:
            assert name in PRODUCTS, name


class TestCountryNamesInSentences:
    def test_names_that_take_the(self):
        result = _saffron("826", "United Kingdom", distance_km=1000)
        assert "ships to the United Kingdom" in _step(result, "transport")["description"]
        assert _step(result, "requirements")["description"].startswith("The United Kingdom sets rules")
        assert _step(result, "transport")["description"].count("The United Kingdom is within overland range") == 1
        assert result["more_link"]["label"] == "See everything for Saffron to the United Kingdom on the Global Trade Helpdesk"

    def test_other_names_are_unchanged(self):
        result = _saffron("251", "France")
        assert _step(result, "requirements")["description"].startswith("France sets rules")


class TestBatchesFourAndFive:
    def test_every_product_is_enabled(self):
        # With batches 4 (carpets, cashmere, sheepskin) and 5 (lapis, marble,
        # talc) every product in config.PRODUCTS uses the playbook.
        assert set(PRODUCTS) <= set(load_playbook()["enabled_products"])

    def test_raw_cashmere_and_sheepskin_get_veterinary_lines(self):
        for product, hs in [("Raw Cashmere", "510211"), ("Karakul Sheepskin", "410510")]:
            result = build_next_steps(
                _row(), product_name=product, category="Luxury Fibres",
                hs_code=hs, market_code="381", market_name="Italy",
            )
            assert "veterinary" in _step(result, "documents")["description"], product

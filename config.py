"""
Configuration for Afghanistan Trade Intelligence Tool.
This file is the single source of truth for product definitions.
The ETL pipeline seeds the database from PRODUCTS on each run.
"""

AFGHANISTAN_CODE = 'AFG'
AFGHANISTAN_NUMERIC = '4'

YEARS = [2021, 2022, 2023, 2024]

TOP_N_MARKETS = 10

# Price competitiveness thresholds (% difference vs market average)
PRICE_COMPETITIVENESS = {
    'highly_competitive': -10,   # more than 10% below market avg
    'competitive': 0,            # up to 10% below market avg
    'average': 10,               # within 10% above market avg
    # above 10% → 'Above Market'
}

# Products keyed by primary HS code (6-digit, no dots).
# 'codes' lists all HS codes that roll up into one product entry.
PRODUCTS = {
    # ── Tree nuts ──────────────────────────────────────────────────────────
    'Almonds In-Shell': {
        'codes': ['080211'],
        'category': 'Tree Nuts',
        'description': 'Almonds, in-shell (fresh or dried)',
    },
    'Almonds Shelled': {
        'codes': ['080212'],
        'category': 'Tree Nuts',
        'description': 'Almonds, shelled (fresh or dried)',
    },
    'Walnuts In-Shell': {
        'codes': ['080231'],
        'category': 'Tree Nuts',
        'description': 'Walnuts, in-shell',
    },
    'Walnuts Shelled': {
        'codes': ['080232'],
        'category': 'Tree Nuts',
        'description': 'Walnuts, shelled',
    },
    'Pistachios In-Shell': {
        'codes': ['080253'],
        'category': 'Tree Nuts',
        'description': 'Pistachios, in-shell',
    },
    'Pistachios Shelled': {
        'codes': ['080254'],
        'category': 'Tree Nuts',
        'description': 'Pistachios, shelled',
    },
    'Pine Nuts': {
        'codes': ['080290'],
        'category': 'Tree Nuts',
        'description': 'Other nuts, fresh or dried (incl. pine nuts)',
    },

    # ── Spices & herbs ─────────────────────────────────────────────────────
    'Saffron': {
        'codes': ['091020'],
        'category': 'Spices & Herbs',
        'description': 'Saffron (stigmas, crushed or ground)',
    },
    'Cumin Seeds': {
        'codes': ['090920'],
        'category': 'Spices & Herbs',
        'description': 'Cumin seeds',
    },
    'Fenugreek': {
        'codes': ['121190'],
        'category': 'Spices & Herbs',
        'description': 'Fenugreek and other plants used in pharmacy/perfumery',
    },
    'Asafoetida': {
        'codes': ['130219'],
        'category': 'Spices & Herbs',
        'description': 'Other vegetable saps and extracts (incl. asafoetida/hing)',
    },
    'Liquorice Root': {
        'codes': ['121110'],
        'category': 'Spices & Herbs',
        'description': 'Liquorice roots',
    },

    # ── Dried fruits ───────────────────────────────────────────────────────
    'Dried Grapes (Raisins)': {
        'codes': ['080620'],
        'category': 'Dried Fruits',
        'description': 'Dried grapes, including raisins and sultanas',
    },
    'Dried Apricots': {
        'codes': ['081310'],
        'category': 'Dried Fruits',
        'description': 'Dried apricots',
    },
    'Dried Figs': {
        'codes': ['080420'],
        'category': 'Dried Fruits',
        'description': 'Dried figs',
    },
    'Dried Pomegranate': {
        'codes': ['081390'],
        'category': 'Dried Fruits',
        'description': 'Other dried fruits (incl. dried pomegranate)',
    },
    'Dried Mulberries': {
        'codes': ['081320'],
        'category': 'Dried Fruits',
        'description': 'Dried prunes and mulberries',
    },

    # ── Fresh fruits ───────────────────────────────────────────────────────
    'Fresh Grapes': {
        'codes': ['080610'],
        'category': 'Fresh Fruits',
        'description': 'Fresh grapes',
    },
    'Fresh Pomegranate': {
        'codes': ['081080'],
        'category': 'Fresh Fruits',
        'description': 'Other fresh fruit (incl. pomegranate)',
    },
    'Melons': {
        'codes': ['080790'],
        'category': 'Fresh Fruits',
        'description': 'Other melons (fresh)',
    },
    'Apricots': {
        'codes': ['080910'],
        'category': 'Fresh Fruits',
        'description': 'Fresh apricots',
    },

    # ── Carpets & textiles ─────────────────────────────────────────────────
    'Knotted Carpets': {
        'codes': ['570110'],
        'category': 'Carpets & Textiles',
        'description': 'Knotted carpets of wool or fine animal hair (hand-made)',
    },
    'Woven Carpets': {
        'codes': ['570210'],
        'category': 'Carpets & Textiles',
        'description': 'Woven carpets of wool or fine animal hair (hand-made)',
    },
    'Kilims': {
        'codes': ['570391'],
        'category': 'Carpets & Textiles',
        'description': 'Kelim, sumak, karamanie and similar flat-woven rugs',
    },

    # ── Luxury fibres ──────────────────────────────────────────────────────
    'Raw Cashmere': {
        'codes': ['510211'],
        'category': 'Luxury Fibres',
        'description': 'Cashmere (Kashmir goat hair), not carded or combed',
    },
    'Processed Cashmere': {
        'codes': ['510212'],
        'category': 'Luxury Fibres',
        'description': 'Cashmere (Kashmir goat hair), carded or combed',
    },
    'Cashmere Sweaters': {
        'codes': ['611012'],
        'category': 'Luxury Fibres',
        'description': 'Sweaters/pullovers of cashmere (fine animal hair)',
    },
    'Karakul Sheepskin': {
        'codes': ['410510'],
        'category': 'Luxury Fibres',
        'description': 'Tanned or dressed sheepskin leather',
    },

    # ── Minerals & stones ──────────────────────────────────────────────────
    'Lapis Lazuli': {
        'codes': ['711299'],
        'category': 'Minerals & Stones',
        'description': 'Precious/semi-precious stones (incl. lapis lazuli), unworked',
    },
    'Marble & Travertine': {
        'codes': ['251621'],
        'category': 'Minerals & Stones',
        'description': 'Marble and travertine, crude or rough',
    },
    'Talc': {
        'codes': ['252620'],
        'category': 'Minerals & Stones',
        'description': 'Talc, crushed or powdered',
    },

    # ── Oilseeds ───────────────────────────────────────────────────────────
    'Sesame Seeds': {
        'codes': ['120740'],
        'category': 'Oilseeds',
        'description': 'Sesame seeds',
    },
    'Flaxseed / Linseed': {
        'codes': ['120400'],
        'category': 'Oilseeds',
        'description': 'Linseed (flaxseed), whether or not broken',
    },
}

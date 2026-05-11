"""
Market discovery router — HS code → ranked opportunity markets.
"""


from fastapi import APIRouter, Depends, HTTPException, Query

from backend.database import get_db
from backend.schemas import DiscoveryResult, MarketProfile
from backend.services import discovery as svc

router = APIRouter(prefix="/api/discover", tags=["discovery"])


@router.get("/{hs_code}", response_model=DiscoveryResult)
def discover_markets(
    hs_code: str,
    limit: int = Query(50, ge=1, le=200, description="Max markets to return"),
    min_score: float | None = Query(None, ge=0, le=100, description="Filter by minimum opportunity score"),
    db=Depends(get_db),
):
    """
    Rank all scored markets for the given HS code by opportunity score.

    Returns up to `limit` markets ordered highest-score-first.
    Useful for the discovery wizard: user selects a product → sees ranked market list.
    """
    result = svc.get_ranked_markets(db, hs_code, limit=limit, min_score=min_score)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No product found for HS code {hs_code}")
    return result


@router.get("/{hs_code}/markets/{market_code}", response_model=MarketProfile)
def market_profile(
    hs_code: str,
    market_code: str,
    db=Depends(get_db),
):
    """
    Detailed market profile: opportunity score breakdown, trade indicators,
    competitor shares, and practical next-step guidance.
    """
    result = svc.get_market_profile(db, hs_code, market_code)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for HS code {hs_code} in market {market_code}",
        )
    return result

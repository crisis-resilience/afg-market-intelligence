"""Product-related API routes."""


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import schemas
from backend.database import get_db
from backend.services import products as svc

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[schemas.ProductSummary])
def list_products(db: Session = Depends(get_db)):
    return svc.list_products(db)


@router.get("/{hs_code}", response_model=schemas.ProductDetail)
def get_product(hs_code: str, db: Session = Depends(get_db)):
    result = svc.get_product(db, hs_code)
    if not result:
        raise HTTPException(status_code=404, detail=f"No product found for HS code {hs_code}")
    return result


@router.get("/{hs_code}/markets", response_model=list[schemas.MarketIndicator])
def get_markets(hs_code: str, db: Session = Depends(get_db)):
    return svc.get_markets(db, hs_code)


@router.get("/{hs_code}/markets/{market_code}", response_model=schemas.MarketDetail)
def get_market_detail(hs_code: str, market_code: str, db: Session = Depends(get_db)):
    result = svc.get_market_detail(db, hs_code, market_code)
    if not result:
        raise HTTPException(status_code=404, detail="Product or market not found")
    return result

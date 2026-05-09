"""
Main analysis pipeline for Afghanistan Trade Intelligence Tool.
Orchestrates data fetching, indicator calculations, and output generation.
"""

import argparse
import json
import logging
import os
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from comtrade_client import (
    fetch_afghanistan_exports_batch,
    fetch_market_imports_batch,
    fetch_market_imports_by_partner_batch,
    fetch_unified_global_imports,
    set_api_key,
)
from config import PRODUCTS, TOP_N_MARKETS, YEARS

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('analysis.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from comtrade_client import get_country_name
from indicators import (
    calculate_growth_rate,
    calculate_market_share,
    calculate_unit_price,
    compare_to_competitors,
    compare_to_competitors_in_market,
    get_competitor_shares,
    get_market_rank,
    identify_top_global_import_markets,
)


def analyze_product(product_name: str, hs_codes: list[str]) -> dict:
    """
    Analyze a single product across all its HS codes.
    
    Parameters:
    -----------
    product_name : str
        Name of the product (e.g., 'Almonds')
    hs_codes : List[str]
        List of HS codes for this product
    
    Returns:
    --------
    dict
        Dictionary with analysis results
    """
    print(f"\n{'='*60}")
    print(f"Analyzing: {product_name}")
    print(f"HS Codes: {', '.join(hs_codes)}")
    print(f"{'='*60}")
    
    # Fetch Afghanistan exports for all HS codes in batch
    print("\n  Fetching Afghanistan export data for all HS codes...")
    all_exports = fetch_afghanistan_exports_batch(hs_codes, YEARS)

    # Save raw Afghanistan export data to CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    afg_export_filename = f"output/raw_afghanistan_exports_{hs_codes[0]}_{timestamp}.csv"
    all_exports.to_csv(afg_export_filename, index=False)
    print(f"  💾 Raw Afghanistan export data saved: {afg_export_filename}")

    if all_exports.empty:
        print(f"  ✗ No export data available for {product_name}")
        logger.warning(f"No export data available for {product_name}")
        return {
            'product': product_name,
            'hs_codes': hs_codes,
            'status': 'no_data',
            'markets': []
        }

    print(f"  ✅ Successfully fetched {len(all_exports)} raw export records")
    print("  📊 Raw data sample:")
    print(f"     {all_exports.head(2).to_string() if len(all_exports) > 0 else 'No data'}")

    # Use the batch result directly
    df_exports = all_exports.copy()

    # Aggregate by partner and year (sum across HS codes)
    df_exports = df_exports.groupby(['year', 'partner']).agg({
        'trade_value': 'sum',
        'trade_quantity': 'sum'
    }).reset_index()

    # Create separate dataframe for latest year calculations
    latest_year = max(YEARS)  # 2024
    df_exports_latest = df_exports[df_exports['year'] == latest_year].copy()

    print("\n  📈 After aggregation:")
    print(f"  ✓ Total records: {len(df_exports)} (across all years)")
    print(f"  ✓ Latest year ({latest_year}) records: {len(df_exports_latest)}")
    print(f"  ✓ Total export value (all years): ${df_exports['trade_value'].sum():,.0f}")
    print(f"  ✓ Latest year export value: ${df_exports_latest['trade_value'].sum():,.0f}")
    print("  📊 Top export destinations (latest year):")
    top_exports_latest = df_exports_latest.groupby('partner')['trade_value'].sum().sort_values(ascending=False).head(5)
    for country_code, value in top_exports_latest.items():
        print(f"     • {get_country_name(country_code)}: ${value:,.0f}")
    
    # SINGLE UNIFIED API CALL: Fetch ALL global import data once
    print("\n  🚀 Fetching unified global import data...")
    unified_global_data = fetch_unified_global_imports(hs_codes[0], YEARS)
    print(f"  ✅ Unified global data fetched: {len(unified_global_data)} records")

    # Save raw unified global import data to CSV
    unified_filename = f"output/raw_unified_global_imports_{hs_codes[0]}_{timestamp}.csv"
    unified_global_data.to_csv(unified_filename, index=False)
    print(f"  💾 Raw unified global import data saved: {unified_filename}")

    # Identify top global import markets for this product (using cached unified data)
    print(f"\n  🔍 Identifying top {TOP_N_MARKETS} global import markets...")
    top_markets = identify_top_global_import_markets(hs_codes[0], YEARS, top_n=TOP_N_MARKETS, unified_data=unified_global_data)

    if top_markets.empty:
        print("  ⚠ No global import markets found")
        logger.warning(f"No global import markets found for {product_name}")
        return {
            'product': product_name,
            'hs_codes': hs_codes,
            'status': 'no_markets',
            'markets': []
        }

    print(f"  ✅ Found {len(top_markets)} top global import markets:")
    for idx, row in top_markets.iterrows():
        rank = row['rank']
        country_code = row['partner']
        value = row['trade_value']
        print(f"     #{rank}: {get_country_name(country_code)} - ${value:,.0f} import value")

    # Collect all market codes for batch processing
    all_market_codes = top_markets['partner'].tolist()

    # EXTRACT data for ALL markets from cached unified data (no additional API calls)
    print("\n  📊 Extracting market data from unified dataset...")
    batch_market_imports = fetch_market_imports_batch(all_market_codes, hs_codes[0], YEARS, unified_data=unified_global_data)
    batch_supplier_data = fetch_market_imports_by_partner_batch(all_market_codes, hs_codes[0], YEARS, unified_data=unified_global_data)

    print(f"  ✅ Batch data fetched: {len(batch_market_imports)} market records, {len(batch_supplier_data)} supplier records")

    # Analyze each top market (now using cached batch data)
    market_analyses = []

    for idx, market_row in top_markets.iterrows():
        market_code = market_row['partner']
        global_import_value = market_row['trade_value']  # Global market size

        # Get Afghanistan's export value to this market (LATEST YEAR ONLY)
        afg_exports_to_market_latest = df_exports_latest[df_exports_latest['partner'] == market_code]
        afg_export_value = afg_exports_to_market_latest['trade_value'].sum() if not afg_exports_to_market_latest.empty else 0

        market_name = get_country_name(market_code)
        print(f"\n    🔬 Analyzing market: {market_name}")
        print(f"      🌍 Global market size (2024): ${global_import_value:,.0f}")
        print(f"      🇦🇫 Afghanistan exports (2024): ${afg_export_value:,.0f}")
        print(f"      📊 Afghanistan market share (2024): {afg_export_value/global_import_value:.2%}" if global_import_value > 0 else "      Afghanistan market share: N/A")

        # Calculate growth rate (uses historical data across all years)
        growth = calculate_growth_rate(df_exports, market_code, YEARS)

        # Calculate market share using latest year data only
        market_share = None
        if not batch_market_imports.empty:
            market_share = calculate_market_share(df_exports_latest, batch_market_imports, market_code, year=latest_year)
            print(f"      📈 Market share calculation (2024): {market_share:.2%}" if market_share else "      ⚠️ Could not calculate market share")
        else:
            print("      ❌ No market import data available")
            logger.warning(f"Could not fetch import data for market {market_code}, product {product_name}")

        # Get supplier data from batch results
        all_suppliers = batch_supplier_data[batch_supplier_data['partner_code'] == market_code].copy()
        all_suppliers = all_suppliers.drop(columns=['partner_code']) if 'partner_code' in all_suppliers.columns else all_suppliers

        # Get market rank
        market_rank = None
        competitor_shares = pd.DataFrame()
        if not all_suppliers.empty:
            market_rank = get_market_rank(df_exports, all_suppliers, market_code, year=latest_year)
            competitor_shares = get_competitor_shares(all_suppliers, market_code, top_n=5, year=latest_year)
            print(f"      🏆 Afghanistan's rank: #{market_rank}" if market_rank else "      ⚠️ Could not determine rank")
            print(f"      🏅 Top competitors found: {len(competitor_shares)}")
        else:
            print("      ❌ No competitor data available")
            logger.warning(f"Could not fetch supplier data for market {market_code}, product {product_name}")
        
        # Calculate price competitiveness
        print("      Calculating price competitiveness...")
        
        # Afghanistan's unit price
        afg_unit_price = calculate_unit_price(df_exports, partner=market_code, year=latest_year)
        
        # Compare to market prices (competitors in this specific market)
        market_price_comparison = {}
        if afg_unit_price is not None and not all_suppliers.empty:
            # Use competitor data from this market for price comparison
            market_price_comparison = compare_to_competitors_in_market(
                afg_unit_price, all_suppliers, market_code)
            print(f"      💰 Afghanistan price: ${afg_unit_price:.2f}")
            if market_price_comparison.get('market_avg_price'):
                print(f"      📊 Market average price: ${market_price_comparison['market_avg_price']:.2f}")
                print(f"      📈 Price competitiveness: {market_price_comparison.get('competitiveness', 'N/A')}")
        else:
            print("      ⚠️ Insufficient data for price comparison")
        
        # Compare to competitors
        competitor_comparison = {}
        if afg_unit_price is not None and not all_suppliers.empty:
            # Note: For accurate competitor price comparison, we need quantity data
            # which may not be available in all_suppliers. This is a limitation
            # that could be addressed by fetching quantity data separately.
            try:
                competitor_comparison = compare_to_competitors(
                    afg_unit_price, 
                    all_suppliers, 
                    top_n=5
                )
            except Exception as e:
                logger.warning(f"Error comparing to competitors for {market_code}: {e}")
                competitor_comparison = {}
        
        market_analysis = {
            'market_code': market_code,
            'market_name': market_name,
            'export_value': float(afg_export_value),
            'global_market_size': float(global_import_value),
            'rank': int(market_row['rank']),
            'growth_rate': growth,
            'market_share': float(market_share) if market_share is not None else None,
            'market_rank': int(market_rank) if market_rank is not None else None,
            'unit_price': float(afg_unit_price) if afg_unit_price is not None else None,
            'market_price_comparison': market_price_comparison,
            'competitor_comparison': competitor_comparison,
            'competitor_shares': competitor_shares.to_dict('records') if not competitor_shares.empty else []
        }
        
        market_analyses.append(market_analysis)
        
        print(f"      ✓ Market share: {market_share:.2f}%" if market_share else "      ⚠ Market share: N/A")
        print(f"      ✓ Market rank: {market_rank}" if market_rank else "      ⚠ Market rank: N/A")

    # Product analysis summary
    successful_markets = len([m for m in market_analyses if m.get('market_share') is not None])
    total_export_value = sum(m['export_value'] for m in market_analyses)
    print(f"\n  🎯 {product_name} Analysis Complete:")
    print(f"     ✅ Markets analyzed: {len(market_analyses)}")
    print(f"     📊 Markets with share data: {successful_markets}")
    print(f"     💰 Total Afghanistan exports: ${total_export_value:,.0f}")

    return {
        'product': product_name,
        'hs_codes': hs_codes,
        'status': 'success',
        'total_export_value': float(df_exports['trade_value'].sum()),
        'markets': market_analyses
    }


def generate_summary_csv(results: list[dict], output_dir: str = 'output'):
    """
    Generate a summary CSV file with all indicators.
    
    Parameters:
    -----------
    results : List[Dict]
        List of product analysis results
    output_dir : str
        Output directory path
    """
    rows = []
    
    for product_result in results:
        if product_result['status'] != 'success':
            continue
        
        product_name = product_result['product']
        
        for market in product_result['markets']:
            row = {
                'product': product_name,
                'market_code': market['market_code'],
                'market_name': market.get('market_name', get_country_name(str(market['market_code']))),
                'export_value': market['export_value'],
                'global_market_size': market.get('global_market_size'),
                'market_rank': market['rank'],
                'market_share_pct': market['market_share'],
                'afghanistan_rank': market['market_rank'],
                'yoy_growth_pct': market['growth_rate'].get('yoy_growth'),
                'cagr_pct': market['growth_rate'].get('cagr'),
                'growth_percentage': market['growth_rate'].get('growth_percentage'),
                'unit_price': market['unit_price'],
                'market_avg_price': market['market_price_comparison'].get('market_avg_price'),
                'price_vs_market_pct': market['market_price_comparison'].get('afg_vs_market_pct'),
                'price_competitiveness': market['market_price_comparison'].get('competitiveness'),
                'avg_competitor_price': market['competitor_comparison'].get('avg_competitor_price'),
                'price_rank': market['competitor_comparison'].get('afg_rank')
            }
            rows.append(row)
    
    if rows:
        df_summary = pd.DataFrame(rows)
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, 'results_summary.csv')
        df_summary.to_csv(output_path, index=False)
        print(f"\n✓ Summary CSV saved to: {output_path}")
        logger.info(f"Summary CSV saved: {output_path}")
        return output_path
    else:
        print("\n⚠ No data to write to summary CSV")
        logger.warning("No data available for summary CSV")
        return None


def generate_detailed_json(results: list[dict], output_dir: str = 'output'):
    """
    Generate a detailed JSON file with full results.
    
    Parameters:
    -----------
    results : List[Dict]
        List of product analysis results
    output_dir : str
        Output directory path
    """
    output_data = {
        'analysis_date': datetime.now().isoformat(),
        'years_analyzed': YEARS,
        'top_n_markets': TOP_N_MARKETS,
        'products': results
    }
    
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'results_detailed.json')
    
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2, default=str)
    
    print(f"✓ Detailed JSON saved to: {output_path}")
    logger.info(f"Detailed JSON saved: {output_path}")
    return output_path


def main(debug: bool = False):
    """Main execution function."""
    logger.info("Starting Afghanistan Trade Intelligence analysis")

    # Set API key from environment variable (.env file or system env)
    api_key = os.environ.get('COMTRADE_API_KEY')
    if not api_key:
        logger.error("COMTRADE_API_KEY environment variable not set")
        print("❌ Error: COMTRADE_API_KEY environment variable not set")
        print("   Option 1: Create a .env file in the project root with:")
        print("            COMTRADE_API_KEY=your_api_key_here")
        print("   Option 2: Set it using: export COMTRADE_API_KEY='your_api_key_here'")
        print("   Get your key from: https://unstats.un.org/wiki/display/comtrade/UN+Comtrade+API")
        return
    
    set_api_key(api_key)
    logger.info("UN Comtrade API key set from environment variable")
    print("✅ UN Comtrade API key loaded from environment")


    # Debug mode: only analyze Almonds HS 080211
    if debug:
        print("\n" + "="*60)
        print("🧪 AFGHANISTAN TRADE INTELLIGENCE TOOL - DEBUG MODE")
        print("="*60)
        print("🎯 DEBUG MODE: Analyzing only Almonds (HS 080211)")
        print("📊 Purpose: Test complete analysis pipeline with single product")
        print("🌐 Data Source: UN Comtrade API")
        print(f"📅 Analysis Period: {min(YEARS)} - {max(YEARS)}")
        print(f"🎯 Top Markets per Product: {TOP_N_MARKETS}")
        print("="*60)

        # Analyze only Almonds with single HS code
        all_results = []
        print("\n🚀 Starting analysis...")
        result = analyze_product("Almonds", ["080211"])
        all_results.append(result)

        # Debug mode summary
        if result['status'] == 'success':
            print(f"\n✅ DEBUG COMPLETE: {result['product']} analysis successful!")
        else:
            print(f"\n❌ DEBUG ISSUE: {result['product']} analysis failed with status: {result['status']}")
    else:
        print("\n" + "="*60)
        print("AFGHANISTAN TRADE INTELLIGENCE TOOL")
        print("="*60)
        print("Data Source: UN Comtrade API")
        print(f"Analysis Period: {min(YEARS)} - {max(YEARS)}")
        print(f"Products: {len(PRODUCTS)}")
        print(f"Top Markets per Product: {TOP_N_MARKETS}")
        print("="*60)

        # Analyze each product
        all_results = []

        for product_name, product_info in PRODUCTS.items():
            hs_codes = product_info['codes']
            result = analyze_product(product_name, hs_codes)
            all_results.append(result)
    
    # Generate outputs
    print("\n" + "="*60)
    print("GENERATING OUTPUTS")
    print("="*60)
    
    summary_path = generate_summary_csv(all_results)
    detailed_path = generate_detailed_json(all_results)
    
    # Print summary statistics
    print("\n" + "="*60)
    print("📊 ANALYSIS SUMMARY")
    print("="*60)

    successful_products = [r for r in all_results if r['status'] == 'success']
    failed_products = [r for r in all_results if r['status'] != 'success']

    print(f"✅ Products analyzed successfully: {len(successful_products)}/{len(all_results)}")
    if failed_products:
        print(f"❌ Products with issues: {len(failed_products)}")
        for product in failed_products:
            print(f"   • {product['product']}: {product['status']}")

    if successful_products:
        total_markets = sum(len(r['markets']) for r in successful_products)
        total_export_value = sum(r.get('total_export_value', 0) for r in successful_products)

        print(f"\n🌍 Total markets analyzed: {total_markets}")
        print(f"💰 Total Afghanistan export value: ${total_export_value:,.0f}")

        # Show top products by export value
        product_values = [(r['product'], r.get('total_export_value', 0)) for r in successful_products]
        product_values.sort(key=lambda x: x[1], reverse=True)

        print("\n🏆 Top products by export value:")
        for product, value in product_values[:3]:  # Top 3
            print(f"   • {product}: ${value:,.0f}")

    print("\n💾 Outputs saved:")
    print(f"   📄 CSV Summary: {summary_path}")
    print(f"   📄 JSON Details: {detailed_path}")

    print("\n🎉 Analysis complete!")
    logger.info("Analysis complete")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Afghanistan Trade Intelligence Tool')
    parser.add_argument('--debug', action='store_true',
                       help='Run in debug mode (only analyze Almonds HS 080211)')
    args = parser.parse_args()

    main(debug=args.debug)

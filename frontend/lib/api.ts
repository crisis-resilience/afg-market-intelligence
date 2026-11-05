import type { ProductSummary, DiscoveryResult, MarketProfile } from './types'

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`API request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function getProducts(): Promise<ProductSummary[]> {
  return (await apiFetch<ProductSummary[]>('/api/products')) ?? []
}

// Every scored market (the API's default is the top 50 by the stored score):
// the app re-ranks them with the user's weights, so a market outside the
// stored top 50 can still rank high. 200 is the API's maximum; the most any
// product has is 75 (Dried Grapes, October 2026 ETL).
export async function getDiscoveryResult(hsCode: string): Promise<DiscoveryResult | null> {
  return apiFetch<DiscoveryResult>(`/api/discover/${hsCode}?limit=200`)
}

export async function getMarketProfile(
  hsCode: string,
  marketCode: string,
): Promise<MarketProfile | null> {
  return apiFetch<MarketProfile>(`/api/discover/${hsCode}/markets/${marketCode}`)
}

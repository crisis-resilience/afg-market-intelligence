import type { ProductSummary, DiscoveryResult, MarketProfile } from './types'

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

export async function getProducts(): Promise<ProductSummary[]> {
  return (await apiFetch<ProductSummary[]>('/api/products')) ?? []
}

export async function getDiscoveryResult(
  hsCode: string,
  minScore?: number,
): Promise<DiscoveryResult | null> {
  const params = minScore != null ? `?min_score=${minScore}` : ''
  return apiFetch<DiscoveryResult>(`/api/discover/${hsCode}${params}`)
}

export async function getMarketProfile(
  hsCode: string,
  marketCode: string,
): Promise<MarketProfile | null> {
  return apiFetch<MarketProfile>(`/api/discover/${hsCode}/markets/${marketCode}`)
}

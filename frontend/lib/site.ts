// The public website (site/ in this repo, hosted separately on Cloudflare
// Pages) that this app's header and footer link back to.
//
// The SITE_URL environment variable sets it; the dev docker-compose.yml points
// it at the local website preview (scripts/serve_site.py). Without it, links
// go to DEFAULT_SITE_URL — change that here when the real domain is known.
//
// Read on the server at request time, so the same built image works with any
// address -- call it from server components only (the browser can't see it).
const DEFAULT_SITE_URL = 'https://example.org'

export function siteUrl(): string {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

export const siteLink = (path: string) => `${siteUrl()}${path}`

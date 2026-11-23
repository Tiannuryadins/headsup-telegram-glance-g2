// CoinGecko public API — read-only, no key, CORS-enabled.
// Track 2 (Crypto & DeFi) data for the glance screen. Cached 60 s.

export interface Price {
  symbol: string
  usd: number
  change24h: number
}

const URL =
  'https://api.coingecko.com/api/v3/simple/price' +
  '?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'

let cache: { at: number; prices: Price[] } | null = null

export async function fetchPrices(): Promise<Price[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.prices
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(URL, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const j = await res.json()
    const prices: Price[] = [
      { symbol: 'BTC', usd: j.bitcoin.usd, change24h: j.bitcoin.usd_24h_change },
      { symbol: 'ETH', usd: j.ethereum.usd, change24h: j.ethereum.usd_24h_change },
      { symbol: 'SOL', usd: j.solana.usd, change24h: j.solana.usd_24h_change },
    ]
    cache = { at: Date.now(), prices }
    return prices
  } finally {
    clearTimeout(t)
  }
}

export function formatPrice(p: Price): string {
  const sign = p.change24h >= 0 ? '+' : ''
  const usd =
    p.usd >= 1000
      ? p.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : p.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${p.symbol} $${usd} ${sign}${p.change24h.toFixed(1)}%`
}

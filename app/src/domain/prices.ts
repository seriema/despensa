/** Price analysis: what a product costs now, and whether it moved meaningfully. Pure functions. */
import type { PricePoint } from './types'

/** The price you'd actually pay at a point in time (sale price if any). */
export const paid = (p: PricePoint) => p.sale ?? p.list

export const latest = (h: PricePoint[] | undefined) => (h && h.length ? h[h.length - 1] : undefined)

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface PriceAlert {
  productId: number
  kind: 'list-up' | 'list-down' | 'discount-gone'
  pct: number // change of latest list price vs. median of earlier list prices
  from: number
  to: number
  date: string
  /** What we compared against, so the UI can say "vs. median of N buys, <from>–<to>". */
  baseN: number
  baseFrom: string
  baseTo: string
  /** Latest observation was on sale (list price rose, but you may still pay less today). */
  saleNow?: number
}

/**
 * Flags only meaningful moves: latest list price vs. the median of the previous (up to 5) list prices.
 * Small wiggles under `thresholdPct` are ignored on purpose (user asked: no 0.01 % noise).
 * "discount-gone": previous observation was on sale, latest isn't, and the effective price rose ≥ threshold.
 */
export function detectAlert(productId: number, h: PricePoint[], thresholdPct: number): PriceAlert | undefined {
  if (h.length < 2) return
  const last = h[h.length - 1]
  const prev = h.slice(-6, -1)
  const base = median(prev.map((p) => p.list))
  const pct = ((last.list - base) / base) * 100
  const ctx = { baseN: prev.length, baseFrom: prev[0].date, baseTo: prev[prev.length - 1].date, saleNow: last.sale }
  if (Math.abs(pct) >= thresholdPct) {
    return { productId, kind: pct > 0 ? 'list-up' : 'list-down', pct, from: base, to: last.list, date: last.date, ...ctx }
  }
  const before = h[h.length - 2]
  if (before.sale && !last.sale) {
    const eff = ((paid(last) - paid(before)) / paid(before)) * 100
    if (eff >= thresholdPct)
      return { productId, kind: 'discount-gone', pct: eff, from: paid(before), to: paid(last), date: last.date, ...ctx, baseN: 1, baseFrom: before.date, baseTo: before.date }
  }
}

/** Day-of-month ranges. 30–31 is split out because Brazilian salaries land at month end. */
export const DOM_BUCKETS: [number, number][] = [[1, 5], [6, 14], [15, 24], [25, 29], [30, 31]]

export interface TimingBucket { pct: number; orders: number; lines: number }

/**
 * "When is it cheapest to buy?" measured in money, not in number of discounts.
 * For every order line: paid price vs. the median paid price of the SAME product in other orders
 * within ±8 months (local baseline, so 2 years of inflation doesn't make recent orders look bad).
 * Averages are weighted by the baseline price, so a 10 % jump on meat counts more than on a sponge.
 * Result: % above (+) or below (−) your usual price, per day-of-month range and per weekday.
 * Only `source: 'order'` points are used. With few orders per range this is a hint, not proof.
 */
export function priceTiming(prices: Record<number, PricePoint[]>) {
  const dom = DOM_BUCKETS.map(() => ({ s: 0, w: 0, dates: new Set<string>(), lines: 0 }))
  const dow = Array.from({ length: 7 }, () => ({ s: 0, w: 0, dates: new Set<string>(), lines: 0 }))
  const DAY = 864e5
  for (const h of Object.values(prices)) {
    const pts = h.filter((p) => p.source === 'order')
    pts.forEach((p, i) => {
      const t = Date.parse(p.date)
      const others = pts.filter((q, j) => j !== i && Math.abs(Date.parse(q.date) - t) <= 240 * DAY).map(paid)
      if (!others.length) return
      const base = median(others)
      const rel = paid(p) / base - 1
      const d = new Date(p.date + 'T12:00:00')
      const b = dom[DOM_BUCKETS.findIndex(([a, z]) => d.getDate() >= a && d.getDate() <= z)]
      for (const acc of [b, dow[d.getDay()]]) {
        acc.s += rel * base; acc.w += base; acc.lines++; acc.dates.add(p.date)
      }
    })
  }
  const out = (a: (typeof dom)[number]): TimingBucket => ({ pct: a.w ? (a.s / a.w) * 100 : 0, orders: a.dates.size, lines: a.lines })
  return { byDom: dom.map(out), byDow: dow.map(out) }
}

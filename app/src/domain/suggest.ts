/**
 * Building the first 2-month list without junk.
 *
 * Plain "everything you ever bought" would include the one bag of Doritos. Instead each NEED
 * (a product type, any brand – see data/groups.ts) is checked for signals of a staple:
 *   - bought repeatedly (≥ 4 orders across all its brands), and
 *   - still being bought (last purchase within ~9 months), and
 *   - not an impulse category (snacks, alcohol, sweets) – offered, but not pre-selected.
 * Grouping first matters: 3 brands of paper towel bought twice each = one regular need.
 * Fresh produce gets a per-order amount (it isn't stocked).
 * Target = consumption rate × 2 months, rounded up.
 *
 * These are rules, not an AI model: transparent and predictable, and every suggestion shows its reason.
 */
import type { Item } from './types'

const IMPULSE = /Biscoitos e Salgadinhos|Bebidas Alcoólicas|Doces e Sobremesas/

export type Reason = 'regular' | 'rare' | 'stopped' | 'impulse'

export function reasonFor(i: Item, today: string): Reason {
  const s = i.stats
  if (!s) return 'rare'
  if (IMPULSE.test(i.dept) && i.match === 'exact') return 'impulse'
  const monthsSinceLast = (Date.parse(today) - Date.parse(s.last)) / (30.44 * 864e5)
  if (monthsSinceLast > 9) return 'stopped'
  if (s.orders < 4) return 'rare'
  return 'regular'
}

/**
 * How long a need keeps at home, in weeks (user can override per item).
 * Fresh produce ~1 week, fridge items ~3 weeks, pantry / cleaning / frozen meat 8 weeks (the 2-month buffer).
 */
export function keepsWeeksOf(i: Item): number {
  if (i.keepsWeeks) return i.keepsWeeks
  if (i.room === 'fresh' || /Hortifruti/.test(i.dept)) return 1
  if (/Frios|Laticinios|Iogurtes|Padaria/.test(i.dept)) return 3
  return 8
}

/** Short-life items are bought in the store between monthly orders (fresh top-up), not in the big order. */
export const isShortLife = (i: Item) => keepsWeeksOf(i) < 3

/** Target = weekly use × how long it keeps (max 8 weeks = the 2-month buffer), at least 1 pack. */
export function suggestedTarget(i: Item): number {
  const s = i.stats
  if (!s) return 1
  const perWeek = s.perMonth / 4.35
  return Math.max(1, Math.ceil(perWeek * Math.min(8, keepsWeeksOf(i))))
}

export function suggestFromHistory(items: Item[], today: string): Item[] {
  return items.map((i) => ({ ...i, target: suggestedTarget(i), active: reasonFor(i, today) === 'regular' }))
}

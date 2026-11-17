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

export function suggestedTarget(i: Item): number {
  const s = i.stats
  if (!s) return 1
  if (i.room === 'fresh') return Math.max(1, Math.round(s.totalQty / s.orders)) // typical amount per order
  return Math.max(1, Math.ceil(s.perMonth * 2))
}

export function suggestFromHistory(items: Item[], today: string): Item[] {
  return items.map((i) => ({ ...i, target: suggestedTarget(i), active: reasonFor(i, today) === 'regular' }))
}

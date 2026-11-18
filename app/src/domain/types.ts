/** Core domain types. Kept framework-free so they can be reused by sync/back-end code later. */

export type Lang = 'en' | 'pt' | 'sv'

/** Rooms in the order the inventory walk visits them. Ids are stable; labels come from i18n. */
export const ROOMS = ['fridge', 'pantry', 'storage', 'bathroom', 'laundry', 'fresh'] as const
export type RoomId = (typeof ROOMS)[number]

/** One observed price for a Krill product. `sale` is set when Krill charged less than list price. */
export interface PricePoint {
  date: string // YYYY-MM-DD
  list: number // Krill "preco"
  sale?: number // Krill "preco_venda" / oferta when lower than list
  source: 'order' | 'daily' // order history vs. daily price check
}

/** A concrete Krill product (one brand, one size). */
export interface Product {
  id: number // Krill produto_id
  name: string
  dept: string
  deptId?: number
  sectionId?: number // Krill leaf category ("Leite Integral"), used to find alternatives
  section?: string
  brandId?: number
  image?: string
  available: boolean // per latest check
  discontinued: boolean // Krill no longer returns the product
  unit: string
}

/**
 * A line on the household's 2-month list: a NEED, e.g. "Leite integral 1L".
 *  - match 'cheapest': any of `productIds` (plus live alternatives from the same Krill section)
 *    – the app picks the cheapest available, by unit price when sizes differ.
 *  - match 'exact': always productIds[0].
 * `deny` = products never to buy for this need; brand bans live in Settings.denyBrands.
 */
export interface Item {
  id: string
  name: string
  dept: string
  room: RoomId
  target: number // 2-month target, in packages
  active: boolean // on the list; inactive = only offered under "add from history"
  match: 'cheapest' | 'exact'
  productIds: number[]
  deny: number[]
  sectionId?: number
  keywords?: string[] // narrow a broad Krill section (e.g. "com sal" within Manteiga)
  image?: string
  stats?: BuyStats
}

/** Purchase statistics from order history (aggregated over a need's products). */
export interface BuyStats {
  orders: number
  totalQty: number
  first: string
  last: string
  perMonth: number
}

export interface Settings {
  lang: Lang
  address: { cep: string; street: string; number: string; complement: string; district: string; city: string }
  freeDeliveryThreshold: number
  alertThresholdPct: number
  onboarded: boolean
  countView: 'list' | 'card'
  denyBrands: number[] // Krill marca_id never to buy, for any need
}

export interface InventoryState {
  startedAt?: string
  finishedAt?: string
  have: Record<string, number> // itemId -> packages counted at home (uncounted = 0)
  position: number
}

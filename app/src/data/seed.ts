/**
 * Prototype seed, built from real data extracted from the household's Krill account (2026-11-17):
 *  - staples.txt: products bought ≥3 times, with price history from orders
 *  - images.txt:  Krill image file per product
 *  - catalog.txt: live check that day – category, brand, availability, today's price
 *  - groups.ts:   how products are grouped into needs
 * In the real app the Krill client produces the same structures (history import + daily checks).
 */
import rawStaples from './staples.txt?raw'
import rawImages from './images.txt?raw'
import rawCatalog from './catalog.txt?raw'
import { EXTRA_PRODUCTS, GROUPS } from './groups'
import type { BuyStats, Item, PricePoint, Product, RoomId } from '../domain/types'
import { suggestFromHistory } from '../domain/suggest'

/** Krill department → room. A first guess; the user can move items. */
export const DEPT_ROOM: Record<string, RoomId> = {
  'Frios e Laticinios': 'fridge',
  'Carnes, Aves e Peixes': 'fridge',
  Congelados: 'fridge',
  'Iogurtes, Leites Fermentados e Sobremesas': 'fridge',
  Hortifruti: 'fresh', // fresh produce can't be stocked for 2 months
  'Mercearia Alimentos Básicos': 'pantry',
  Matinais: 'pantry',
  'Molhos, Condimentos e Conservas': 'pantry',
  'Doces e Sobremesas': 'pantry',
  'Biscoitos e Salgadinhos': 'pantry',
  'Padaria Industrializados': 'pantry',
  Leites: 'pantry',
  Bebidas: 'storage',
  'Bebidas Alcoólicas': 'storage',
  'Bazar e Utilidades': 'storage',
  'Pet Shop': 'storage',
  'Higiene e Cuidados Pessoais': 'bathroom',
  Limpeza: 'laundry',
}

/** "Today" for the prototype = date of the data extract, so results are reproducible. */
export const DATA_DATE = '2026-11-17'

export interface Seed {
  products: Record<number, Product>
  prices: Record<number, PricePoint[]> // productId -> history (oldest first)
  candidates: Item[] // every need from history; `active` = suggested for the 2-month list
}

const lines = (raw: string) => raw.split('\n').filter((l) => l.trim() && !l.startsWith('#'))

export function buildSeed(): Seed {
  const images = Object.fromEntries(lines(rawImages).map((l) => l.split('|')))
  const products: Seed['products'] = {}
  const prices: Seed['prices'] = {}
  const perProduct: Record<number, { orders: number; qty: number; dates: string[] }> = {}

  for (const line of lines(rawStaples)) {
    const [id, unit, dept, orders, totalQty, desc, hist] = line.split('|')
    const pid = +id
    prices[pid] = hist.split(',').map((x) => {
      const [date, p] = x.split(':')
      const [list, sale] = p.split('/').map(Number)
      return { date, list, sale: sale && sale < list ? sale : undefined, source: 'order' as const }
    })
    products[pid] = { id: pid, name: desc.trim(), dept, unit, image: images[id], available: true, discontinued: false }
    perProduct[pid] = { orders: +orders, qty: +totalQty, dates: prices[pid].map((p) => p.date) }
  }

  // Live check: category, brand, availability, today's price (added as a 'daily' price point).
  for (const line of lines(rawCatalog)) {
    const [id, ids, names, brand, avail, price] = line.split('|')
    const p = products[+id]
    if (!p) continue
    if (!ids || ids === '?') { p.discontinued = true; p.available = false; continue }
    const [deptId, sectionId] = ids.split('>').map(Number)
    Object.assign(p, { deptId, sectionId, section: names, brandId: +brand, available: avail === '1' })
    const [list, offer] = price.split('/').map(Number)
    prices[+id].push({ date: DATA_DATE, list, sale: offer && offer < list ? offer : undefined, source: 'daily' })
  }
  for (const e of EXTRA_PRODUCTS) {
    products[e.id] = { id: e.id, name: e.name, dept: e.dept, deptId: e.deptId, sectionId: e.sectionId, section: e.section, unit: 'UN', available: true, discontinued: false }
    prices[e.id] = [{ date: DATA_DATE, list: e.price, source: 'daily' }]
  }

  /** Aggregate purchase stats over a need's products (orders = distinct order dates). */
  const statsFor = (ids: number[]): BuyStats | undefined => {
    const known = ids.filter((i) => perProduct[i])
    if (!known.length) return
    const dates = [...new Set(known.flatMap((i) => perProduct[i].dates))].sort()
    const totalQty = known.reduce((a, i) => a + perProduct[i].qty, 0)
    const months = Math.max(3, (Date.parse(DATA_DATE) - Date.parse(dates[0])) / (30.44 * 864e5))
    return { orders: dates.length, totalQty, first: dates[0], last: dates[dates.length - 1], perMonth: totalQty / months }
  }

  const grouped = new Set(GROUPS.flatMap((g) => g.members))
  const candidates: Item[] = GROUPS.map((g) => {
    const first = products[g.members.find((m) => products[m]) ?? g.members[0]]
    return {
      id: 'g-' + g.key,
      name: g.name,
      dept: first?.dept ?? '',
      room: g.room ?? DEPT_ROOM[first?.dept ?? ''] ?? 'storage',
      target: 1,
      active: false,
      match: g.match ?? 'cheapest',
      productIds: g.members,
      deny: [],
      sectionId: g.sectionId,
      keywords: g.keywords,
      image: g.members.map((m) => products[m]?.image).find(Boolean),
      stats: statsFor(g.members),
    }
  })
  // Everything else from history becomes its own exact-product need.
  for (const p of Object.values(products)) {
    if (grouped.has(p.id) || !perProduct[p.id]) continue
    candidates.push({
      id: 'p-' + p.id, name: p.name, dept: p.dept, room: DEPT_ROOM[p.dept] ?? 'storage', target: 1, active: false,
      match: 'exact', productIds: [p.id], deny: [], sectionId: p.sectionId, image: p.image, stats: statsFor([p.id]),
    })
  }
  return { products, prices, candidates: suggestFromHistory(candidates, DATA_DATE) }
}

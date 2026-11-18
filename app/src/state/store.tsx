/**
 * App state: one reducer + React context, persisted to localStorage.
 * Later this layer gets a sync adapter (Supabase) so both phones share list/inventory/orders.
 * localStorage can throw (private mode, some WebViews) – every access is wrapped.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { InventoryState, Item, Settings } from '../domain/types'
import { ROOMS } from '../domain/types'
import { buildSeed } from '../data/seed'
import { chooseProduct, parseSize, sizeLabel } from '../domain/choose'
import { STRINGS } from '../i18n'

const KEY = 'despensa:v3' // bump when the stored shape changes
const seed = buildSeed()
/** Read-only reference data in the prototype (the real app refreshes these from Krill). */
export const PRICES = seed.prices
export const PRODUCTS = seed.products
/** Every need from history, for the setup review and "add from history". */
export const CANDIDATES = seed.candidates

export interface State {
  items: Item[]
  settings: Settings
  inventory: InventoryState
  extraBuys: Record<string, number> // itemId -> extra packages added as top-ups
}

const initial: State = {
  items: seed.candidates,
  settings: {
    lang: 'en',
    address: { cep: '', street: '', number: '', complement: '', district: '', city: '' }, // entered in onboarding; stays on the device
    freeDeliveryThreshold: 600,
    alertThresholdPct: 5,
    onboarded: false,
    countView: 'list',
    leftHanded: false,
    denyBrands: [],
  },
  inventory: { have: {}, position: 0 },
  extraBuys: {},
}

type Action =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'setHave'; itemId: string; value: number }
  | { type: 'position'; value: number }
  | { type: 'startInventory' }
  | { type: 'finishInventory' }
  | { type: 'updateItem'; itemId: string; patch: Partial<Item> }
  | { type: 'toggleDenyProduct'; itemId: string; productId: number }
  | { type: 'toggleDenyBrand'; brandId: number }
  | { type: 'extraBuy'; itemId: string; delta: number }
  | { type: 'setItems'; items: Item[] }
  | { type: 'reset' }

const toggle = (xs: number[], x: number) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } }
    case 'setHave':
      return { ...s, inventory: { ...s.inventory, have: { ...s.inventory.have, [a.itemId]: Math.max(0, a.value) } } }
    case 'position':
      return { ...s, inventory: { ...s.inventory, position: a.value } }
    case 'startInventory':
      return { ...s, extraBuys: {}, inventory: { have: {}, position: 0, startedAt: new Date().toISOString() } }
    case 'finishInventory':
      return { ...s, inventory: { ...s.inventory, finishedAt: new Date().toISOString() } }
    case 'updateItem':
      return { ...s, items: s.items.map((i) => (i.id === a.itemId ? { ...i, ...a.patch } : i)) }
    case 'toggleDenyProduct':
      return { ...s, items: s.items.map((i) => (i.id === a.itemId ? { ...i, deny: toggle(i.deny, a.productId) } : i)) }
    case 'toggleDenyBrand':
      return { ...s, settings: { ...s.settings, denyBrands: toggle(s.settings.denyBrands, a.brandId) } }
    case 'extraBuy': {
      const v = Math.max(0, (s.extraBuys[a.itemId] ?? 0) + a.delta)
      return { ...s, extraBuys: { ...s.extraBuys, [a.itemId]: v } }
    }
    case 'setItems':
      return { ...s, items: a.items }
    case 'reset':
      return initial
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      // Merge new settings fields (e.g. address.number, v0.6) into data saved by older versions.
      const settings = { ...initial.settings, ...saved.settings, address: { ...initial.settings.address, ...saved.settings?.address } }
      return { ...initial, ...saved, settings }
    }
  } catch {
    /* storage unavailable – start fresh */
  }
  return initial
}

const Ctx = createContext<{ s: State; d: React.Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s])
  return <Ctx.Provider value={{ s, d }}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}

export const useT = () => STRINGS[useStore().s.settings.lang]

/** Active items in walk order (room order, then name). */
export function useWalkItems() {
  const { s } = useStore()
  return useMemo(
    () =>
      s.items
        .filter((i) => i.active)
        .sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room) || a.name.localeCompare(b.name)),
    [s.items],
  )
}

/** Counted stock. Counting starts at 0: people count what they see (user feedback v0.2). */
export const haveOf = (s: State, i: Item) => s.inventory.have[i.id] ?? 0
export const counted = (s: State, i: Item) => i.id in s.inventory.have
export const buyOf = (s: State, i: Item) =>
  (i.active ? Math.max(0, i.target - haveOf(s, i)) : 0) + (s.extraBuys[i.id] ?? 0)

/** Which product the app would buy for a need right now (cheapest allowed + available). */
export const choiceFor = (s: State, i: Item) => chooseProduct(i, PRODUCTS, PRICES, s.settings.denyBrands, lastBoughtOf(i))

/**
 * What one shopping-list line really means. Targets are counted in packages of the product the
 * household knows (last bought). If the chosen product has a different pack size (4-pack vs single
 * sponge, 20 vs 30 eggs), convert so the same AMOUNT is bought: qty = ceil(packages × refSize / chosenSize).
 */
export function lineOf(s: State, i: Item) {
  const c = choiceFor(s, i)
  const packages = buyOf(s, i)
  const refId = lastBoughtOf(i) ?? i.productIds[0]
  const ref = PRODUCTS[refId] && parseSize(PRODUCTS[refId].name)
  const got = c.chosen && parseSize(c.chosen.product.name)
  const qty = ref && got && ref.base === got.base && c.chosen!.product.id !== refId ? Math.ceil((packages * ref.amount) / got.amount - 1e-9) : packages
  return { choice: c, packages, qty, price: c.chosen?.price ?? 0, total: qty * (c.chosen?.price ?? 0) }
}

/** The product actually bought most recently for a need (from order history), if any. */
export function lastBoughtOf(i: Item): number | undefined {
  let best: { id: number; date: string } | undefined
  for (const id of i.productIds) {
    const last = PRICES[id]?.filter((p) => p.source === 'order').at(-1)
    if (last && (!best || last.date > best.date)) best = { id, date: last.date }
  }
  return best?.id
}

/** The product the household's counts refer to: the one bought last time (or the first known). */
export const refProductOf = (i: Item) => PRODUCTS[lastBoughtOf(i) ?? i.productIds[0]]
/** Pack size the user is counting in, e.g. "500 g" – shown while counting so "1" is unambiguous. */
export const packLabelOf = (i: Item) => {
  const p = refProductOf(i)
  return p ? sizeLabel(p.name) : undefined
}

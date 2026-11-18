/**
 * Picking the product to buy for a need, and comparing package sizes fairly.
 * Pure functions; the Krill client supplies live alternatives/prices in the real app.
 */
import type { Item, PricePoint, Product } from './types'

export interface Size { amount: number; base: 'kg' | 'L' | 'un' }

/** Parse package size from a Krill name: "500g", "1kg", "900ml", "1l", "Com 30un", "4 Unidades". */
export function parseSize(name: string): Size | undefined {
  const n = name.toLowerCase().replace(',', '.')
  let m = n.match(/(\d+(?:\.\d+)?)\s?kg\b/)
  if (m) return { amount: +m[1], base: 'kg' }
  m = n.match(/(\d+(?:\.\d+)?)\s?g\b/)
  if (m) return { amount: +m[1] / 1000, base: 'kg' }
  m = n.match(/(\d+(?:\.\d+)?)\s?ml\b/)
  if (m) return { amount: +m[1] / 1000, base: 'L' }
  m = n.match(/(\d+(?:\.\d+)?)\s?l\b/)
  if (m) return { amount: +m[1], base: 'L' }
  m = n.match(/(\d+)\s?(?:un\b|unidades)/)
  if (m && +m[1] > 1) return { amount: +m[1], base: 'un' }
  if (/\bun\.?$/.test(n.trim())) return { amount: 1, base: 'un' } // "Esponja Multiuso Brilhus Un"
}

/** Human label for a pack size: "500 g", "1 kg", "900 ml", "12 un". */
export function sizeLabel(name: string): string | undefined {
  const z = parseSize(name)
  if (!z) return
  const n = (x: number) => String(+x.toFixed(2)).replace('.', ',')
  if (z.base === 'kg') return z.amount < 1 ? `${n(z.amount * 1000)} g` : `${n(z.amount)} kg`
  if (z.base === 'L') return z.amount < 1 ? `${n(z.amount * 1000)} ml` : `${n(z.amount)} L`
  return `${z.amount} un`
}

export interface Option {
  product: Product
  price: number // what you'd pay per package today (offer price if on offer)
  onSale: boolean
  perBase?: { value: number; base: Size['base'] }
  blocked?: 'product' | 'brand'
  unavailable?: boolean
  /** Pack is more than 2× or less than ½ the size the household is used to (never swap a 500 g for a 10 kg). */
  wrongSize?: boolean
}

export interface Choice {
  chosen?: Option
  options: Option[] // all known options, best first (blocked/unavailable last)
  comparedBy: 'unit' | 'package'
}

/** Latest known price of a product: daily check if any, else last order. */
export function todayPrice(h: PricePoint[] | undefined) {
  const l = h?.[h.length - 1]
  return l ? { price: l.sale ?? l.list, onSale: !!l.sale } : undefined
}

export function chooseProduct(
  item: Item,
  products: Record<number, Product>,
  prices: Record<number, PricePoint[]>,
  denyBrands: number[],
  /** Product bought last time. Kept unless another is ≥ 2 % cheaper – avoids switching brands for pennies. */
  preferId?: number,
): Choice {
  const ids = item.match === 'exact' ? item.productIds.slice(0, 1) : item.productIds
  const refId = preferId ?? item.productIds[0]
  const refSize = products[refId] && parseSize(products[refId].name)
  const opts: Option[] = []
  for (const id of ids) {
    const product = products[id]
    const tp = todayPrice(prices[id])
    if (!product || !tp) continue
    const size = parseSize(product.name)
    opts.push({
      product,
      price: tp.price,
      onSale: tp.onSale,
      perBase: size ? { value: tp.price / size.amount, base: size.base } : undefined,
      blocked: item.deny.includes(id) ? 'product' : product.brandId && denyBrands.includes(product.brandId) ? 'brand' : undefined,
      unavailable: !product.available || product.discontinued,
      wrongSize: !!(refSize && size && size.base === refSize.base && (size.amount > refSize.amount * 2 || size.amount < refSize.amount / 2)),
    })
  }
  const usable = opts.filter((o) => !o.blocked && !o.unavailable && !o.wrongSize)
  // Compare per kg/L/unit only when every usable option has a size in the same dimension.
  const byUnit = usable.length > 1 && usable.every((o) => o.perBase && o.perBase.base === usable[0].perBase!.base)
  const key = (o: Option) => (byUnit ? o.perBase!.value : o.price)
  usable.sort((a, b) => key(a) - key(b))
  const pref = usable.find((o) => o.product.id === preferId)
  if (pref && usable[0] !== pref && key(usable[0]) > key(pref) * 0.98) {
    usable.splice(usable.indexOf(pref), 1)
    usable.unshift(pref)
  }
  const rest = opts.filter((o) => !usable.includes(o))
  return { chosen: usable[0], options: [...usable, ...rest], comparedBy: byUnit ? 'unit' : 'package' }
}

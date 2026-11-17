/**
 * The household's 2-month list of NEEDS and their targets.
 * Used in first-run setup (with a choice of starting point) and in Settings.
 * Tap a need to see its products: switch "any brand – cheapest" / "this exact product",
 * and block products or whole brands ("never buy").
 * Only needs ON the list are shown; the rest live in the collapsed "Add from order history".
 */
import { useState } from 'react'
import { ROOMS, type Item, type RoomId } from '../domain/types'
import { reasonFor, suggestFromHistory, suggestedTarget, type Reason } from '../domain/suggest'
import { BASIC_LIST } from '../data/groups'
import { DATA_DATE } from '../data/seed'
import { CANDIDATES, choiceFor, useStore, useT } from '../state/store'
import { fmt } from '../i18n'
import { ProductImg, Stepper, brl } from '../ui/common'

const shortDate = (d: string) => d.slice(0, 7)
const BASE_LABEL = { kg: 'kg', L: 'L', un: 'un' }

export function ListEditor({ setup = false }: { setup?: boolean }) {
  const { s, d } = useStore()
  const t = useT()
  const [drawer, setDrawer] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const on = s.items.filter((i) => i.active)
  const off = s.items.filter((i) => !i.active)
  const upd = (i: Item, patch: Partial<Item>) => d({ type: 'updateItem', itemId: i.id, patch })

  /** Starting points offered during setup. */
  const startFrom = (kind: 'history' | 'basic' | 'empty') => {
    if (kind === 'history') return d({ type: 'setItems', items: suggestFromHistory(CANDIDATES, DATA_DATE) })
    const basic = new Map(kind === 'basic' ? BASIC_LIST : [])
    d({ type: 'setItems', items: CANDIDATES.map((c) => {
      const key = c.id.replace(/^g-/, '')
      return { ...c, active: basic.has(key), target: basic.get(key) ?? c.target }
    }) })
  }

  const statsText = (i: Item) => {
    const st = i.stats
    if (!st) return ''
    return i.room === 'fresh'
      ? fmt(t.statsFresh, { n: st.orders, q: Math.round(st.totalQty / st.orders) })
      : fmt(t.statsLine, { n: st.orders, r: st.perMonth.toFixed(1).replace('.', s.settings.lang === 'en' ? '.' : ','), d: shortDate(st.last) })
  }

  /** Expanded panel: how this need is matched to products. */
  const details = (i: Item) => {
    const c = choiceFor(s, i)
    return (
      <div className="need-detail">
        <div className="seg tiny">
          <button className={i.match === 'cheapest' ? 'on' : ''} onClick={() => upd(i, { match: 'cheapest' })}>{t.anyBrand}</button>
          <button className={i.match === 'exact' ? 'on' : ''} onClick={() => upd(i, { match: 'exact' })}>{t.exactProduct}</button>
        </div>
        <select value={i.room} onChange={(e) => upd(i, { room: e.target.value as RoomId })}>
          {ROOMS.map((x) => <option key={x} value={x}>{t.rooms[x]}</option>)}
        </select>
        {c.options.map((o) => {
          const p = o.product
          const chosen = c.chosen?.product.id === p.id
          const status = o.blocked === 'product' ? t.blockedP : o.blocked === 'brand' ? t.blockedB : p.discontinued ? t.noLongerSold : o.unavailable ? t.notAvailable : ''
          return (
            <div key={p.id} className={'opt' + (chosen ? ' chosen' : '') + (status ? ' dim' : '')}>
              <ProductImg image={p.image} dept={p.dept} size={36} />
              <div className="nm">
                <div className="nm-t">{chosen ? '★ ' : ''}{p.name}</div>
                <small className="muted">
                  {brl(o.price)}{o.onSale ? ' 🏷' : ''}
                  {o.perBase && c.comparedBy === 'unit' ? ` · ${brl(o.perBase.value)}/${BASE_LABEL[o.perBase.base]}` : ''}
                  {status && <b className="need"> · {status}</b>}
                </small>
              </div>
              <button className="x" title={t.blockProduct} onClick={() => d({ type: 'toggleDenyProduct', itemId: i.id, productId: p.id })}>{o.blocked === 'product' ? '↺' : '🚫'}</button>
              {p.brandId ? <button className="x" title={t.blockBrand} onClick={() => d({ type: 'toggleDenyBrand', brandId: p.brandId! })}>{o.blocked === 'brand' ? '↺' : '🏷🚫'}</button> : null}
            </div>
          )
        })}
        <p className="small muted">🚫 = {t.blockProduct} · 🏷🚫 = {t.blockBrand}</p>
      </div>
    )
  }

  const reasons: Reason[] = ['regular', 'rare', 'impulse', 'stopped']

  return (
    <div className="list-editor">
      {setup && (
        <div className="seg small-seg">
          <button onClick={() => startFrom('history')}>{t.fromHistory}</button>
          <button onClick={() => startFrom('basic')}>{t.basicList}</button>
          <button onClick={() => startFrom('empty')}>{t.startEmpty}</button>
        </div>
      )}
      <p className="small muted">{fmt(t.itemsCount, { n: on.length })}</p>

      {ROOMS.filter((r) => on.some((i) => i.room === r)).map((r) => (
        <div key={r}>
          <h5 className="room-h">{t.rooms[r]}</h5>
          {on.filter((i) => i.room === r).map((i) => {
            const c = choiceFor(s, i)
            const nOpts = c.options.filter((o) => !o.blocked && !o.unavailable).length
            return (
              <div key={i.id} className="edit-block">
                <div className="edit-row">
                  <ProductImg image={c.chosen?.product.image ?? i.image} dept={i.dept} size={40} />
                  <div className="nm clickable" onClick={() => setOpen(open === i.id ? null : i.id)}>
                    <div className="nm-t">{i.name} <span className="chev">{open === i.id ? '▴' : '▾'}</span></div>
                    <small className="muted">{statsText(i)}</small>
                    <small className={'tag' + (c.chosen ? '' : ' warn')}>
                      {!c.chosen ? '⚠ ' + t.noOptionAvailable : i.match === 'cheapest' ? `★ ${t.anyBrand} (${nOpts})` : t.exactProduct}
                    </small>
                  </div>
                  <Stepper size="small" value={i.target} onChange={(v) => upd(i, { target: Math.max(1, v) })} />
                  <button className="x" aria-label={t.remove} onClick={() => upd(i, { active: false })}>✕</button>
                </div>
                {open === i.id && details(i)}
              </div>
            )
          })}
        </div>
      ))}

      <button className="link" onClick={() => setDrawer(!drawer)}>＋ {t.addFromHistory} ({off.length}) {drawer ? '▴' : '▾'}</button>
      {drawer &&
        reasons.map((rsn) => {
          const group = off.filter((i) => reasonFor(i, DATA_DATE) === rsn)
          if (!group.length) return null
          return (
            <div key={rsn}>
              <h5 className="room-h">{t[`reason_${rsn}`]}</h5>
              {group.map((i) => (
                <div key={i.id} className="edit-row off">
                  <ProductImg image={i.image} dept={i.dept} size={32} />
                  <div className="nm"><div className="nm-t">{i.name}</div><small className="muted">{statsText(i)}</small></div>
                  <button className="btn small primary" onClick={() => upd(i, { active: true, target: suggestedTarget(i) })}>＋</button>
                </div>
              ))}
            </div>
          )
        })}
    </div>
  )
}

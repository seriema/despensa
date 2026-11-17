/**
 * Shopping list = target − counted stock (+ manual top-ups). For each need the app shows which
 * product it will buy (cheapest allowed + available) and why.
 * "Fill Krill cart" is simulated in the prototype; the real version uses the Krill cart API
 * (docs/KRILL_API.md) and then shows this same review screen. The user always confirms.
 */
import { useEffect, useMemo, useState } from 'react'
import { ROOMS, type Item } from '../domain/types'
import { detectAlert } from '../domain/prices'
import { PRICES, PRODUCTS, buyOf, choiceFor, lastBoughtOf, lineOf, useStore, useT } from '../state/store'
import { fmt } from '../i18n'
import { Card, Modal, ProductImg, Stepper, brl, pct } from '../ui/common'

export function Buy() {
  const { s, d } = useStore()
  const t = useT()
  const [phase, setPhase] = useState<'list' | 'filling' | 'review'>('list')
  const [progress, setProgress] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState('')

  const lines = useMemo(
    () => s.items.filter((i) => buyOf(s, i) > 0).sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room)),
    [s],
  )
  const choice = (i: Item) => choiceFor(s, i)
  const lineTotal = (i: Item) => lineOf(s, i).total
  const total = lines.reduce((sum, i) => sum + lineTotal(i), 0)
  const threshold = s.settings.freeDeliveryThreshold
  const missing = Math.max(0, threshold - total)
  const notCounted = !s.inventory.finishedAt && Object.keys(s.inventory.have).length === 0

  // Top-up ideas: needs whose chosen product is on a real discount (≥5 %) today.
  const topUps = s.items
    .filter((i) => i.active && i.room !== 'fresh')
    .filter((i) => {
      const c = choice(i).chosen
      const l = c && PRICES[c.product.id]?.at(-1)
      return c?.onSale && l && l.sale! <= l.list * 0.95
    })
    .slice(0, 6)

  useEffect(() => {
    if (phase !== 'filling') return
    if (progress >= lines.length) return setPhase('review')
    const h = setTimeout(() => setProgress((p) => p + 1), 90)
    return () => clearTimeout(h)
  }, [phase, progress, lines.length])

  if (!lines.length) return <p className="pad muted">{t.nothingToBuy}</p>

  if (phase === 'filling') {
    return (
      <div className="pad center-col">
        <div className="spinner" />
        <h3>{t.filling}</h3>
        <p className="muted">{progress} / {lines.length}</p>
        <p className="small">{lines[Math.min(progress, lines.length - 1)].name}</p>
      </div>
    )
  }

  if (phase === 'review') {
    const missingNeeds = lines.filter((i) => !choice(i).chosen)
    // "Switched": the app will buy a different product than the one bought LAST TIME for this need.
    // (Comparing to the need's generic name would flag every line – user feedback v0.3.)
    const switched = lines.flatMap((i) => {
      const c = choiceFor(s, i)
      const prevId = lastBoughtOf(i)
      if (!c.chosen || !prevId || prevId === c.chosen.product.id) return []
      const prev = c.options.find((o) => o.product.id === prevId)
      // Saving per package of the product bought last time (per kg/L/unit when pack sizes differ).
      const saving = prev && (c.comparedBy === 'unit' && prev.perBase && c.chosen.perBase
        ? (prev.perBase.value - c.chosen.perBase.value) * (prev.price / prev.perBase.value)
        : prev.price - c.chosen.price)
      const why = !prev || prev.unavailable ? t.whyUnavailable : prev.blocked ? t.whyBlocked : fmt(t.whyCheaper, { x: brl(Math.max(0, saving ?? 0)) })
      return [{ i, from: PRODUCTS[prevId]?.name ?? String(prevId), to: c.chosen.product.name, why }]
    })
    const changed = lines
      .map((i) => ({ i, c: choice(i).chosen }))
      .map(({ i, c }) => ({ i, c, a: c && detectAlert(c.product.id, PRICES[c.product.id] ?? [], s.settings.alertThresholdPct) }))
      .filter((x) => x.a && x.a.pct > 0)
    const okTotal = lines.filter((i) => choice(i).chosen).reduce((sum, i) => sum + lineTotal(i), 0)
    return (
      <div className="pad">
        <h2>{t.cartReview}</h2>
        <p className="banner ok">✓ {t.cartReady}</p>
        <div className="kpis">
          <div><small>{t.estTotal}</small><b>{brl(okTotal)}</b></div>
          <div><small>{t.freeDelivery}</small><b>{okTotal >= threshold ? '✓' : brl(threshold - okTotal)}</b></div>
        </div>
        {missingNeeds.length > 0 && (
          <Card>
            <h4>⚠ {t.unavailable}</h4>
            {missingNeeds.map((i) => <div key={i.id} className="row"><span>{i.name}</span><span>{buyOf(s, i)}×</span></div>)}
          </Card>
        )}
        {switched.length > 0 && (
          <Card>
            <h4>⇄ {t.switchedProduct}</h4>
            {switched.map((x) => (
              <div key={x.i.id} className="switch-row small">
                <b>{x.i.name}</b>
                <span className="muted">{x.from}</span>
                <span>→ {x.to} <em className="okc">· {x.why}</em></span>
              </div>
            ))}
          </Card>
        )}
        {changed.length > 0 && (
          <Card>
            <h4>↑ {t.priceChanged}</h4>
            {changed.map(({ i, a }) => (
              <div key={i.id} className="row"><span>{i.name}</span><span className="up">{brl(a!.from)} → {brl(a!.to)} ({pct(a!.pct)})</span></div>
            ))}
          </Card>
        )}
        <button className="btn primary big full" onClick={() => setConfirm(true)}>{t.openCheckout}</button>
        <button className="link center" onClick={() => { setPhase('list'); setProgress(0) }}>‹ {t.back}</button>
        <p className="small muted center">{t.prototypeNote}</p>
        {confirm && (
          <Modal onClose={() => setConfirm(false)}>
            <h3>{t.confirmTitle}</h3>
            <p>{t.confirmText}</p>
            <div className="row gap">
              <button className="btn ghost" onClick={() => setConfirm(false)}>{t.cancel}</button>
              <button className="btn primary" onClick={() => { setConfirm(false); setToast(t.prototypeNote) }}>{t.confirm}</button>
            </div>
          </Modal>
        )}
        {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
      </div>
    )
  }

  return (
    <div className="pad">
      <h2>{t.shoppingList}</h2>
      {notCounted && <p className="banner warn">{t.notCountedYet}</p>}
      <Card className="delivery">
        <div className="row"><span>{t.estTotal}</span><b>{brl(total)}</b></div>
        <div className="meter"><div style={{ width: `${Math.min(100, (total / threshold) * 100)}%` }} className={missing ? '' : 'full'} /></div>
        <small className={missing ? 'muted' : 'okc'}>{missing ? fmt(t.freeDeliveryLeft, { x: missing.toFixed(2).replace('.', ',') }) : '✓ ' + t.freeDeliveryOk}</small>
      </Card>

      {ROOMS.filter((r) => lines.some((i) => i.room === r)).map((r) => (
        <Card key={r}>
          <h4>{t.rooms[r]}</h4>
          {lines.filter((i) => i.room === r).map((i) => {
            const c = choice(i)
            return (
              <div key={i.id} className="line">
                <span className="qty">{lineOf(s, i).qty}×</span>
                <ProductImg image={c.chosen?.product.image ?? i.image} dept={i.dept} size={34} />
                <span className="nm">
                  {i.name}
                  <br />
                  <small className={c.chosen ? 'muted' : 'need'}>
                    {c.chosen
                      ? (i.match === 'cheapest' && c.options.filter((o) => !o.blocked && !o.unavailable).length > 1 ? '★ ' + t.cheapestOf.replace('{n}', String(c.options.filter((o) => !o.blocked && !o.unavailable).length)) + ': ' : '') +
                        c.chosen.product.name
                      : t.noOptionAvailable}
                  </small>
                </span>
                <span className="pr">{brl(lineTotal(i))}</span>
              </div>
            )
          })}
        </Card>
      ))}

      {missing > 0 && topUps.length > 0 && (
        <Card>
          <h4>{t.topUps}</h4>
          {topUps.map((i) => {
            const c = choice(i).chosen!
            const l = PRICES[c.product.id].at(-1)!
            return (
              <div key={i.id} className="line">
                <span className="nm">{i.name}<br /><small className="okc">{brl(l.list)} → {brl(c.price)}</small></span>
                <Stepper size="small" value={s.extraBuys[i.id] ?? 0} onChange={(v) => d({ type: 'extraBuy', itemId: i.id, delta: v - (s.extraBuys[i.id] ?? 0) })} />
              </div>
            )
          })}
        </Card>
      )}

      <button className="btn primary big full sticky" onClick={() => { setProgress(0); setPhase('filling') }}>🛒 {t.fillCart} · {brl(total)}</button>
    </div>
  )
}

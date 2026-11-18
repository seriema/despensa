/**
 * Shopping list = target − counted stock (+ manual top-ups). For each need the app shows which
 * product it will buy (cheapest allowed + available) and why.
 * "Fill Krill cart" is simulated in the prototype; the real version uses the Krill cart API
 * (docs/KRILL_API.md) and then shows this same review screen. The user always confirms.
 */
import { useEffect, useMemo, useState } from 'react'
import { ROOMS, type Item } from '../domain/types'
import { detectAlert } from '../domain/prices'
import { isShortLife } from '../domain/suggest'
import { PRICES, PRODUCTS, buyOf, choiceFor, lastBoughtOf, lineOf, useStore, useT } from '../state/store'
import { fmt } from '../i18n'
import { Card, Modal, ProductImg, Stepper, brl, pct } from '../ui/common'

export function Buy({ goCountFresh }: { goCountFresh: () => void }) {
  const { s, d } = useStore()
  const t = useT()
  const [phase, setPhase] = useState<'list' | 'filling' | 'review'>('list')
  const [progress, setProgress] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState('')
  const [accepted, setAccepted] = useState<Set<string>>(new Set()) // swaps the user said OK to
  // Two rhythms: the monthly store order, and an in-store checklist for short-life items between orders.
  const [mode, setMode] = useState<'monthly' | 'fresh'>('monthly')
  const [ticked, setTicked] = useState<Set<string>>(new Set()) // fresh checklist: already in the basket

  const lines = useMemo(
    () => s.items.filter((i) => buyOf(s, i) > 0 && !isShortLife(i)).sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room)),
    [s],
  )
  const freshLines = useMemo(
    () => s.items.filter((i) => i.active && isShortLife(i) && buyOf(s, i) > 0).sort((a, b) => a.name.localeCompare(b.name)),
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

  const modeSwitch = (
    <div className="seg mode-seg">
      <button className={mode === 'monthly' ? 'on' : ''} onClick={() => setMode('monthly')}>🛒 {t.monthlyOrder}</button>
      <button className={mode === 'fresh' ? 'on' : ''} onClick={() => setMode('fresh')}>🥬 {t.freshTopUp} {freshLines.length ? `(${freshLines.length})` : ''}</button>
    </div>
  )

  if (mode === 'fresh' && phase === 'list') {
    const est = freshLines.reduce((a, i) => a + lineOf(s, i).total, 0)
    return (
      <div className="pad">
        {modeSwitch}
        <p className="small muted">{t.freshTopUpHint}</p>
        <button className="btn ghost full" onClick={goCountFresh}>📋 {t.countFresh}</button>
        {freshLines.length === 0 ? <p className="muted">{t.nothingToBuy}</p> : (
          <Card>
            <div className="row"><h4>{t.inStoreChecklist}</h4><small className="muted">≈ {brl(est)} · {t.atStore} Krill</small></div>
            {freshLines.map((i) => {
              const done = ticked.has(i.id)
              const l = lineOf(s, i)
              return (
                <label key={i.id} className={'line check' + (done ? ' done' : '')}>
                  <input type="checkbox" checked={done} onChange={() => { const n = new Set(ticked); if (done) n.delete(i.id); else n.add(i.id); setTicked(n) }} />
                  <span className="qty">{l.packages}×</span>
                  <ProductImg image={i.image} dept={i.dept} size={34} />
                  <span className="nm">{i.name}</span>
                  <span className="pr muted">≈ {brl(l.total)}</span>
                </label>
              )
            })}
          </Card>
        )}
        <p className="small muted">{t.storeRecommendLater}</p>
      </div>
    )
  }

  if (!lines.length) return <div className="pad">{modeSwitch}<p className="muted">{t.nothingToBuy}</p></div>

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
      const line = lineOf(s, i)
      const why = !prev || prev.unavailable ? t.whyUnavailable : prev.blocked ? t.whyBlocked : t.whyCheaperShort
      return [{ i, prev: PRODUCTS[prevId], next: c.chosen.product, qty: line.qty, packages: line.packages, why }]
    })
    const pending = switched.filter((x) => !accepted.has(x.i.id))
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
        {/* One question per swap: "this is what you're getting – OK?" (feedback v0.4).
            "Not this one" blocks that product for the need, so the next option is picked. */}
        {pending.length > 0 && (
          <Card>
            <div className="row">
              <h4>{t.switchedProduct}</h4>
              {pending.length > 1 && (
                <button className="btn small ghost" onClick={() => setAccepted(new Set([...accepted, ...pending.map((x) => x.i.id)]))}>✓ {t.okAll}</button>
              )}
            </div>
            {pending.map((x) => (
              <div key={x.i.id} className="swap">
                <div className="swap-pics">
                  <figure>
                    <ProductImg image={x.prev?.image} dept={x.i.dept} size={40} />
                    <figcaption>{t.lastTime}</figcaption>
                  </figure>
                  <span className="arrow">→</span>
                  <figure>
                    <ProductImg image={x.next.image} dept={x.i.dept} size={56} />
                    <figcaption>{t.thisTime}</figcaption>
                  </figure>
                </div>
                <div className="swap-text">
                  <b>{x.qty}× {x.next.name}</b>
                  <small className="muted">{t.was}: {x.packages}× {x.prev?.name} · {x.why}</small>
                </div>
                <div className="swap-actions">
                  <button className="btn small ghost" onClick={() => d({ type: 'toggleDenyProduct', itemId: x.i.id, productId: x.next.id })}>{t.notThis}</button>
                  <button className="btn small primary" onClick={() => setAccepted(new Set(accepted).add(x.i.id))}>✓ {t.okSwap}</button>
                </div>
              </div>
            ))}
          </Card>
        )}
        {changed.length > 0 && (
          <Card>
            <h4>{t.priceChanged}</h4>
            {changed.map(({ i, a }) => (
              <div key={i.id} className="pc-row">
                <span className="nm">{i.name}</span>
                <span className="pc-now">{brl(a!.to)}</span>
                <span className="pc-was">{t.was} {brl(a!.from)} · <b className="up">{pct(a!.pct)}</b></span>
              </div>
            ))}
          </Card>
        )}
        {/* Checkout waits until every swap is answered – otherwise a wrong product only shows up at the door. */}
        <button className="btn primary big full" disabled={pending.length > 0} onClick={() => setConfirm(true)}>
          {pending.length > 0 ? fmt(t.reviewSwapsFirst, { n: pending.length }) : t.openCheckout}
        </button>
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
      {modeSwitch}
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

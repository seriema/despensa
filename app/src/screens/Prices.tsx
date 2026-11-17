/**
 * Spending + price watching. Built from real order history for now; daily price snapshots
 * (PricePoint.source = 'daily') will feed the same functions later.
 */
import { useMemo, useState } from 'react'
import { ORDERS } from '../data/orders'
import { DOM_BUCKETS, detectAlert, latest, paid, priceTiming, type TimingBucket } from '../domain/prices'
import { PRICES, PRODUCTS, useStore, useT } from '../state/store'
import { fmt } from '../i18n'
import { BarChart, Card, Sparkline, brl, pct } from '../ui/common'

const money = (n: number) => n.toFixed(2).replace('.', ',')

export function Prices() {
  const { s } = useStore()
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const byId = useMemo(() => new Map(Object.values(PRODUCTS).map((p) => [p.id, p])), [])

  // Last 24 months of spending (months without orders shown as 0).
  const months = useMemo(() => {
    const out: { label: string; value: number; tip: string }[] = []
    const now = new Date(2026, 10, 1)
    for (let k = 23; k >= 0; k--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - k, 1)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      const value = ORDERS.filter((o) => o.createdAt.startsWith(key)).reduce((a, o) => a + o.paidTotal, 0)
      out.push({ label: dt.toLocaleDateString(s.settings.lang === 'en' ? 'en-GB' : s.settings.lang === 'pt' ? 'pt-BR' : 'sv-SE', { month: 'narrow' }), value, tip: key })
    }
    return out
  }, [s.settings.lang])

  const alerts = useMemo(
    () =>
      Object.entries(PRICES)
        .map(([id, h]) => detectAlert(+id, h, s.settings.alertThresholdPct))
        .filter((a): a is NonNullable<typeof a> => !!a && a.date >= '2026-04-01')
        .sort((a, b) => b.pct - a.pct),
    [s.settings.alertThresholdPct],
  )

  const timing = useMemo(() => priceTiming(PRICES), [])
  const fees = ORDERS.reduce((a, o) => a + o.deliveryFee, 0)
  const avg = ORDERS.reduce((a, o) => a + o.paidTotal, 0) / ORDERS.length

  return (
    <div className="pad">
      <div className="kpis">
        <div><small>{t.avgOrder}</small><b>{brl(avg)}</b></div>
        <div><small>{t.orders}</small><b>{ORDERS.length}</b></div>
        <div><small>{t.deliveryFeesPaid}</small><b>{brl(fees)}</b></div>
      </div>

      <Card>
        <h4>{t.monthlySpend}</h4>
        <BarChart data={months} fmtV={brl} refLine={{ value: s.settings.freeDeliveryThreshold, label: `R$ ${s.settings.freeDeliveryThreshold}` }} />
      </Card>

      <Card>
        <h4>{t.alerts} (≥{s.settings.alertThresholdPct}%)</h4>
        {alerts.length === 0 && <p className="muted">{t.noAlerts}</p>}
        {/* Rises first, capped – the user cares about Krill jacking prices up, not every wiggle. */}
        {(showAllAlerts ? alerts : alerts.filter((a) => a.pct > 0).slice(0, 8)).map((a) => (
          <div key={a.productId} className="alert-row">
            <div className="nm">
              {byId.get(a.productId)?.name ?? a.productId}
              <small className="muted cmp">
                {a.kind === 'list-up' ? t.listUp : a.kind === 'list-down' ? t.listDown : t.discountGone} · {a.date}
                <br />
                {/* What the % compares against – answers "since when?" */}
                {a.baseN > 1
                  ? fmt(t.vsMedian, { p: money(a.from), n: a.baseN, from: a.baseFrom, to: a.baseTo })
                  : fmt(t.vsLast, { p: money(a.from), from: a.baseFrom })}
                {a.saleNow && a.kind !== 'discount-gone' ? <span className="okc"> · {fmt(t.onSaleNow, { x: money(a.saleNow) })}</span> : null}
              </small>
            </div>
            <Sparkline h={PRICES[a.productId]} />
            <span className={a.pct > 0 ? 'up' : 'down'}>{pct(a.pct)}<br /><small>{brl(a.to)}</small></span>
          </div>
        ))}
        {!showAllAlerts && alerts.length > 8 && (
          <button className="link" onClick={() => setShowAllAlerts(true)}>{t.showAllChanges} ({alerts.length}) ▾</button>
        )}
      </Card>

      <Card>
        <h4>{t.timingTitle}</h4>
        <p className="small muted">{t.timingText}</p>
        <h5 className="room-h">{t.timingDom}</h5>
        {timing.byDom.map((b, k) => <Diverging key={k} label={DOM_BUCKETS[k].join('–')} b={b} t={t} />)}
        <h5 className="room-h">{t.timingDow}</h5>
        {[1, 2, 3, 4, 5, 6, 0].map((k) => <Diverging key={k} label={t.dow[k]} b={timing.byDow[k]} t={t} />)}
        <p className="small muted">{fmt(t.basedOn, { n: ORDERS.length })}</p>
      </Card>

      <Card>
        <button className="link" onClick={() => setShowAll(!showAll)}>{t.allItems} ({Object.keys(PRODUCTS).length}) {showAll ? '▴' : '▾'}</button>
        {showAll &&
          Object.values(PRODUCTS).map((i) => {
            const h = PRICES[i.id] ?? []
            const l = latest(h)
            return (
              <div key={i.id} className="alert-row">
                <div className="nm">{i.name}<small className="muted"> · {h.length}×</small></div>
                <Sparkline h={h} />
                <span>{l ? brl(paid(l)) : '–'}</span>
              </div>
            )
          })}
      </Card>
    </div>
  )
}

/** One row of a diverging bar: cheaper than usual grows left, pricier grows right. Scale: ±10 %. */
function Diverging({ label, b, t }: { label: string; b: TimingBucket; t: ReturnType<typeof useT> }) {
  const w = Math.min(50, (Math.abs(b.pct) / 10) * 50)
  return (
    <div className="div-row">
      <span className="div-l">{label}</span>
      <div className="div-track">
        <div className="div-mid" />
        {b.orders > 0 && <div className={'div-bar ' + (b.pct < 0 ? 'neg' : 'pos')} style={b.pct < 0 ? { right: '50%', width: w + '%' } : { left: '50%', width: w + '%' }} />}
      </div>
      <span className="div-v">{b.orders ? (b.pct > 0 ? '+' : '') + b.pct.toFixed(1) + '%' : '–'}<small className="muted"> {b.orders ? fmt(t.nOrders, { n: b.orders }) : t.noData}</small></span>
    </div>
  )
}

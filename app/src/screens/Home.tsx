import { isShortLife } from '../domain/suggest'
import { useMemo } from 'react'
import { DOM_BUCKETS, detectAlert, priceTiming } from '../domain/prices'
import { PRICES, buyOf, choiceFor, lineOf, useStore, useT, useWalkItems } from '../state/store'
import { fmt } from '../i18n'
import { Card, brl, pct } from '../ui/common'

export function Home({ go }: { go: (tab: 'count' | 'buy' | 'prices') => void }) {
  const { s, d } = useStore()
  const t = useT()
  const walk = useWalkItems()
  const toBuy = s.items.filter((i) => buyOf(s, i) > 0 && !isShortLife(i)) // monthly order only
  const total = toBuy.reduce((a, i) => a + lineOf(s, i).total, 0)
  const inProgress = s.inventory.startedAt && !s.inventory.finishedAt
  const alerts = useMemo(
    () =>
      s.items
        .filter((i) => i.active)
        .map((i) => ({ i, id: choiceFor(s, i).chosen?.product.id }))
        .map(({ i, id }) => ({ i, a: id ? detectAlert(id, PRICES[id] ?? [], s.settings.alertThresholdPct) : undefined }))
        .filter((x) => x.a && x.a.pct > 0 && x.a.date >= '2026-04-01')
        .slice(0, 3),
    [s],
  )
  // Cheapest / priciest day-of-month range so far (only ranges with ≥3 orders count).
  const timing = useMemo(() => {
    const b = priceTiming(PRICES).byDom.map((x, k) => ({ ...x, label: DOM_BUCKETS[k].join('–') })).filter((x) => x.orders >= 3)
    b.sort((x, y) => x.pct - y.pct)
    return { cheap: b[0], dear: b[b.length - 1], n: b.reduce((a, x) => a + x.orders, 0) }
  }, [])
  const last = s.inventory.finishedAt ? new Date(s.inventory.finishedAt).toLocaleDateString() : t.never

  return (
    <div className="pad">
      <button
        className="btn primary hero full"
        onClick={() => {
          if (!inProgress) d({ type: 'startInventory' })
          go('count')
        }}
      >
        📋 {inProgress ? t.continueCount : t.startCount}
        <small>{walk.length} {t.itemsOnList} · {t.lastCount}: {last}</small>
      </button>

      <Card className="clickable">
        <div onClick={() => go('buy')}>
          <div className="row"><span>{toBuy.length} {t.toBuy}</span><b>{brl(total)}</b></div>
          <div className="meter"><div style={{ width: `${Math.min(100, (total / s.settings.freeDeliveryThreshold) * 100)}%` }} className={total >= s.settings.freeDeliveryThreshold ? 'full' : ''} /></div>
        </div>
      </Card>

      <Card className="advice">
        <h4>💡 {t.buyAdvice}</h4>
        <p className="small">
          {fmt(t.adviceText, {
            cheap: timing.cheap.label, cp: timing.cheap.pct.toFixed(1), dear: timing.dear.label, dp: '+' + timing.dear.pct.toFixed(1),
          })}
        </p>
      </Card>

      <Card>
        <h4 onClick={() => go('prices')} className="clickable">{t.alerts} ›</h4>
        {alerts.length === 0 && <p className="muted small">{t.noAlerts}</p>}
        {alerts.map(({ i, a }) => (
          <div key={i.id} className="row small"><span className="nm">{i.name}<small className="muted"> · {a!.kind === 'discount-gone' ? t.discountGone : t.listUp}</small></span><span className="up">{pct(a!.pct)}</span></div>
        ))}
      </Card>
    </div>
  )
}

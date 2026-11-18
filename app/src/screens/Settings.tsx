import { useState } from 'react'
import type { Lang } from '../domain/types'
import { LANG_NAMES } from '../i18n'
import { PRODUCTS, useStore, useT } from '../state/store'
import { Card } from '../ui/common'
import { ListEditor } from './ListEditor'
import { AddressForm } from './AddressForm'

export function Settings() {
  const { s, d } = useStore()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const set = (patch: Partial<typeof s.settings>) => d({ type: 'settings', patch })

  return (
    <div className="pad">
      <Card>
        <h4>{t.language}</h4>
        <div className="seg">
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <button key={l} className={s.settings.lang === l ? 'on' : ''} onClick={() => set({ lang: l })}>{LANG_NAMES[l]}</button>
          ))}
        </div>
      </Card>

      <Card>
        <h4>{t.handedness}</h4>
        <div className="seg">
          <button className={!s.settings.leftHanded ? 'on' : ''} onClick={() => d({ type: 'settings', patch: { leftHanded: false } })}>{t.rightHand}</button>
          <button className={s.settings.leftHanded ? 'on' : ''} onClick={() => d({ type: 'settings', patch: { leftHanded: true } })}>{t.leftHand}</button>
        </div>
        <p className="small muted">{t.handednessHint}</p>
      </Card>

      <Card>
        <h4>{t.address}</h4>
      <AddressForm />
      </Card>

      <Card>
        <label className="row"><span>{t.threshold}</span>
          <input className="input num" type="number" value={s.settings.freeDeliveryThreshold} onChange={(e) => set({ freeDeliveryThreshold: +e.target.value || 0 })} />
        </label>
        <label className="row"><span>{t.alertPct}</span>
          <input className="input num" type="number" value={s.settings.alertThresholdPct} onChange={(e) => set({ alertThresholdPct: +e.target.value || 0 })} />
        </label>
      </Card>

      <Card>
        <div className="row"><span>{t.krillAccount}</span><span className="okc">✓ {t.connected}</span></div>
      </Card>

      <Card>
        <button className="link" onClick={() => setEditing(!editing)}>{t.editList} {editing ? '▴' : '▾'}</button>
        {editing && <ListEditor />}
      </Card>

      <Card>
        <h4>🚫 {t.blockedList}</h4>
        {s.settings.denyBrands.length === 0 && s.items.every((i) => !i.deny.length) && <p className="small muted">{t.nothingBlocked}</p>}
        {s.items.flatMap((i) => i.deny.map((pid) => (
          <div key={i.id + pid} className="row small">
            <span className="nm">{PRODUCTS[pid]?.name ?? pid} <small className="muted">({i.name})</small></span>
            <button className="link" onClick={() => d({ type: 'toggleDenyProduct', itemId: i.id, productId: pid })}>{t.unblock}</button>
          </div>
        )))}
        {s.settings.denyBrands.map((b) => (
          <div key={'b' + b} className="row small">
            <span className="nm">🏷 {t.sameBrandAs} {Object.values(PRODUCTS).find((p) => p.brandId === b)?.name ?? '#' + b}</span>
            <button className="link" onClick={() => d({ type: 'toggleDenyBrand', brandId: b })}>{t.unblock}</button>
          </div>
        ))}
      </Card>

      <button className="btn ghost full" onClick={() => set({ onboarded: false })}>{t.replayTutorial}</button>
      <button className="btn ghost full danger" onClick={() => d({ type: 'reset' })}>{t.resetDemo}</button>
      <p className="small muted center">{t.prototypeNote}</p>
    </div>
  )
}

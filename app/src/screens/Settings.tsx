import { useState } from 'react'
import type { Lang } from '../domain/types'
import { LANG_NAMES } from '../i18n'
import { PRODUCTS, migrate, useStore, useT, type State } from '../state/store'
import { fmt, type Strings } from '../i18n'
import { Card, Modal } from '../ui/common'
import { ListEditor } from './ListEditor'
import { AddressForm } from './AddressForm'

/** Backup file format. `schema` lets future versions (incl. the Android app) migrate old files. */
interface Backup { app: 'despensa'; schema: number; exportedAt: string; state: State }

async function exportBackup(s: State, setMsg: (m: string) => void, t: Strings) {
  const data: Backup = { app: 'despensa', schema: 3, exportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), state: s }
  const name = `despensa-backup-${data.exportedAt.slice(0, 10)}.json`
  const file = new File([JSON.stringify(data, null, 1)], name, { type: 'application/json' })
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  try {
    // On Android this opens the share sheet (Drive, WhatsApp, Files…). If sharing isn't possible, download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e // user closed the share sheet
        download()
      }
    } else download()
    setMsg(fmt(t.exportDone, { f: name }))
  } catch {
    setMsg(t.exportFailed)
  }
}

async function importBackup(f: File | undefined, setPending: (b: (Backup & { items: State['items'] }) | null) => void, setMsg: (m: string) => void, t: Strings) {
  if (!f) return
  try {
    const b = JSON.parse(await f.text()) as Backup
    if (b.app !== 'despensa' || !b.state?.items) throw new Error('not a Despensa backup')
    const state = migrate(b.state)
    setPending({ ...b, state, items: state.items })
  } catch {
    setMsg(t.importFailed)
  }
}

export function Settings() {
  const { s, d } = useStore()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<(Backup & { items: State['items'] }) | null>(null)
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
          {(['left', 'right', 'below'] as const).map((side) => (
            <button key={side} className={s.settings.buttonSide === side ? 'on' : ''} onClick={() => d({ type: 'settings', patch: { buttonSide: side } })}>{t.sides[side]}</button>
          ))}
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

      <Card>
        <h4>💾 {t.backup}</h4>
        <p className="small muted">{t.backupHint}</p>
        <div className="row gap">
          <button className="btn ghost" onClick={() => exportBackup(s, setMsg, t)}>{t.exportBtn}</button>
          <label className="btn ghost">
            {t.importBtn}
            <input type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0], setPending, setMsg, t)} />
          </label>
        </div>
        {msg && <p className="small">{msg}</p>}
      </Card>
      {pending && (
        <Modal onClose={() => setPending(null)}>
          <h3>{t.importConfirmTitle}</h3>
          <p>{fmt(t.importConfirmText, { n: pending.items.filter((i) => i.active).length, d: pending.exportedAt })}</p>
          <div className="row gap">
            <button className="btn ghost" onClick={() => setPending(null)}>{t.cancel}</button>
            <button className="btn primary" onClick={() => { d({ type: 'restore', state: pending.state }); setPending(null); setMsg(t.importDone) }}>{t.importBtn}</button>
          </div>
        </Modal>
      )}
      <button className="btn ghost full" onClick={() => set({ onboarded: false })}>{t.replayTutorial}</button>
      <button className="btn ghost full danger" onClick={() => d({ type: 'reset' })}>{t.resetDemo}</button>
      <p className="small muted center">{t.prototypeNote}</p>
    </div>
  )
}

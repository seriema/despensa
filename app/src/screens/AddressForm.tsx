/**
 * Delivery address: type the CEP first and the rest is prefilled (still editable – the lookup can be
 * wrong, and it never includes the house number). Used in onboarding and Settings.
 */
import { useRef, useState } from 'react'
import { lookupCep, maskCep, normalizeCep } from '../domain/cep'
import { useStore, useT } from '../state/store'

export function AddressForm() {
  const { s, d } = useStore()
  const t = useT()
  const a = s.settings.address
  const [status, setStatus] = useState<'idle' | 'looking' | 'found' | 'notfound' | 'offline'>('idle')
  const streetRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<typeof a>) => d({ type: 'settings', patch: { address: { ...a, ...patch } } })

  const onCep = async (raw: string) => {
    const cep = maskCep(raw)
    set({ cep })
    if (!normalizeCep(cep)) return setStatus('idle')
    setStatus('looking')
    try {
      const r = await lookupCep(cep)
      if (!r) return setStatus('notfound')
      d({ type: 'settings', patch: { address: { cep, street: r.street, district: r.district, city: `${r.city} – ${r.state}` } } })
      setStatus('found')
      // Street usually comes without the number: put the cursor at the end so it can be typed.
      setTimeout(() => { const el = streetRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, 0)
    } catch {
      setStatus('offline')
    }
  }

  return (
    <div className="address-form">
      <input className="input" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder={t.addr.cep} value={a.cep} onChange={(e) => onCep(e.target.value)} />
      {status !== 'idle' && <p className={'small ' + (status === 'found' ? 'okc' : 'muted')}>{t.cepStatus[status]}</p>}
      <input ref={streetRef} className="input" autoComplete="address-line1" placeholder={t.addr.street} value={a.street} onChange={(e) => set({ street: e.target.value })} />
      <input className="input" placeholder={t.addr.district} value={a.district} onChange={(e) => set({ district: e.target.value })} />
      <input className="input" autoComplete="address-level2" placeholder={t.addr.city} value={a.city} onChange={(e) => set({ city: e.target.value })} />
    </div>
  )
}

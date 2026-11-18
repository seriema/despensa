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
  const numberRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<typeof a>) => d({ type: 'settings', patch: { address: { ...a, ...patch } } })

  const onCep = async (raw: string) => {
    const cep = maskCep(raw)
    set({ cep })
    if (!normalizeCep(cep)) return setStatus('idle')
    setStatus('looking')
    try {
      const r = await lookupCep(cep)
      if (!r) return setStatus('notfound')
      d({ type: 'settings', patch: { address: { ...a, cep, street: r.street, district: r.district, city: `${r.city} – ${r.state}` } } })
      setStatus('found')
      // The lookup never knows the house number – go straight to that field.
      setTimeout(() => numberRef.current?.focus(), 0)
    } catch {
      setStatus('offline')
    }
  }

  return (
    <div className="address-form">
      <input className="input" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder={t.addr.cep} value={a.cep} onChange={(e) => onCep(e.target.value)} />
      {status !== 'idle' && <p className={'small ' + (status === 'found' ? 'okc' : 'muted')}>{t.cepStatus[status]}</p>}
      <input className="input" autoComplete="address-line1" placeholder={t.addr.street} value={a.street} onChange={(e) => set({ street: e.target.value })} />
      <div className="addr-row">
        <input ref={numberRef} className="input" inputMode="numeric" placeholder={t.addr.number} value={a.number} onChange={(e) => set({ number: e.target.value })} />
        <input className="input" autoComplete="address-line2" placeholder={t.addr.complement} value={a.complement} onChange={(e) => set({ complement: e.target.value })} />
      </div>
      <input className="input" placeholder={t.addr.district} value={a.district} onChange={(e) => set({ district: e.target.value })} />
      <input className="input" autoComplete="address-level2" placeholder={t.addr.city} value={a.city} onChange={(e) => set({ city: e.target.value })} />
    </div>
  )
}

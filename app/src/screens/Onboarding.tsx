/** First-run walkthrough: language → how it works → address → Krill login → history import. */
import { useState } from 'react'
import { ORDERS } from '../data/orders'
import type { Lang } from '../domain/types'
import { LANG_NAMES, fmt } from '../i18n'
import { useStore, useT } from '../state/store'
import { ListEditor } from './ListEditor'

export function Onboarding() {
  const { s, d } = useStore()
  const t = useT()
  const [step, setStep] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const a = s.settings.address
  const next = () => setStep(step + 1)

  const steps = [
    <>
      <div className="ob-logo">🛒</div>
      <h1>{t.welcome}</h1>
      <p>{t.welcomeText}</p>
      <h4>{t.chooseLang}</h4>
      <div className="col">
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
          <button key={l} className={'btn ' + (s.settings.lang === l ? 'primary' : 'ghost')} onClick={() => d({ type: 'settings', patch: { lang: l } })}>{LANG_NAMES[l]}</button>
        ))}
      </div>
    </>,
    <>
      <h1>{t.obHowTitle}</h1>
      <ol className="how">
        <li><span>🎯</span>{t.obHow0}</li>
        <li><span>📋</span>{t.obHow1}</li>
        <li><span>🧮</span>{t.obHow2}</li>
        <li><span>🛒</span>{t.obHow3}</li>
        <li><span>📈</span>{t.obHow4}</li>
      </ol>
    </>,
    <>
      <h1>{t.obAddressTitle}</h1>
      <p>{t.obAddressText}</p>
      {(['street', 'district', 'city', 'cep'] as const).map((k) => (
        <input key={k} className="input" placeholder={t.addr[k]} value={a[k]} onChange={(e) => d({ type: 'settings', patch: { address: { ...a, [k]: e.target.value } } })} />
      ))}
    </>,
    <>
      <h1>{t.obKrillTitle}</h1>
      <p>{t.obKrillText}</p>
      <button className={'btn full ' + (loggedIn ? 'ghost' : 'primary')} onClick={() => setLoggedIn(true)}>
        {loggedIn ? `✓ ${t.connected}` : t.obKrillBtn}
      </button>
    </>,
    <>
      <h1>{t.obImportTitle}</h1>
      <p>{fmt(t.obImportText, { o: ORDERS.length, p: s.items.length })}</p>
      <p className="muted small">2024-09 → 2026-11</p>
    </>,
    <>
      <h1>{t.setupTitle}</h1>
      <p className="small">{t.setupText}</p>
      <ListEditor setup />
    </>,
  ]
  const last = step === steps.length - 1

  return (
    <div className="onboarding">
      <div className="dots">{steps.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
      <div className="ob-body">{steps[step]}</div>
      <div className="walk-nav">
        {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>‹ {t.back}</button> : <span />}
        <button
          className="btn primary big"
          disabled={step === 3 && !loggedIn}
          onClick={() => (last ? d({ type: 'settings', patch: { onboarded: true } }) : next())}
        >
          {last ? t.getStarted : t.continue}
        </button>
      </div>
    </div>
  )
}

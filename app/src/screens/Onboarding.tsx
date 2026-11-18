/** First-run walkthrough: language → how it works → address → Krill login → history import. */
import { useEffect, useState } from 'react'
import { ORDERS } from '../data/orders'
import type { Lang } from '../domain/types'
import { LANG_NAMES, fmt } from '../i18n'
import { useStore, useT } from '../state/store'
import { ListEditor } from './ListEditor'
import { AddressForm } from './AddressForm'
import { useSwipe } from '../ui/common'

export function Onboarding() {
  const { s, d } = useStore()
  const t = useT()
  const [step, setStep] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [imported, setImported] = useState(0) // simulated history import progress (orders read)
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
      <AddressForm />
    </>,
    <>
      <h1>{t.obKrillTitle}</h1>
      <p>{t.obKrillText}</p>
      <button
        className={'btn full ' + (loggedIn ? 'ghost' : 'primary')}
        disabled={connecting}
        onClick={() => { setConnecting(true); setTimeout(() => { setConnecting(false); setLoggedIn(true) }, 1200) }}
      >
        {connecting ? t.connecting : loggedIn ? `✓ ${t.connected} (${t.demo})` : t.obKrillBtn}
      </button>
      {/* Honest about the prototype: the real login opens Krill's own page inside the Android app. */}
      <p className="small muted">{t.demoConnectNote}</p>
    </>,
    <>
      <h1>{t.obImportTitle}</h1>
      {imported < ORDERS.length ? (
        <div className="import-progress">
          <div className="spinner" />
          <p>{fmt(t.importing, { i: imported + 1, n: ORDERS.length })}</p>
          <p className="small muted">{ORDERS[imported].createdAt.slice(0, 10)}</p>
          <div className="meter"><div style={{ width: `${(imported / ORDERS.length) * 100}%` }} /></div>
        </div>
      ) : (
        <>
          <p>{fmt(t.obImportText, { o: ORDERS.length, p: s.items.length })}</p>
          <p className="muted small">2024-09 → 2026-11 · {t.demo}</p>
        </>
      )}
    </>,
    <>
      <h1>{t.setupTitle}</h1>
      <p className="small">{t.setupText}</p>
      <ListEditor setup />
    </>,
  ]
  const last = step === steps.length - 1
  // Simulated history import: "reads" one order every 80 ms while the import step is shown.
  useEffect(() => {
    if (step !== 4 || imported >= ORDERS.length) return
    const h = setTimeout(() => setImported((n) => n + 1), 80)
    return () => clearTimeout(h)
  }, [step, imported])
  const blocked = (step === 3 && !loggedIn) || (step === 4 && imported < ORDERS.length)
  const forward = () => { if (!blocked && !last) next() }
  const swipe = useSwipe(forward, () => step > 0 && setStep(step - 1))

  return (
    <div className="onboarding">
      <div className="dots">{steps.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
      <div className="ob-body" {...swipe}>{steps[step]}</div>
      <div className="walk-nav">
        {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>‹ {t.back}</button> : <span />}
        <button
          className="btn primary big"
          disabled={blocked}
          onClick={() => (last ? d({ type: 'settings', patch: { onboarded: true } }) : next())}
        >
          {last ? t.getStarted : t.continue}
        </button>
      </div>
    </div>
  )
}

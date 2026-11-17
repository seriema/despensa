/** App shell: onboarding gate + bottom tab bar. No router needed at this size. */
import { useState } from 'react'
import { StoreProvider, useStore, useT } from './state/store'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Inventory } from './screens/Inventory'
import { Buy } from './screens/Buy'
import { Prices } from './screens/Prices'
import { Settings } from './screens/Settings'

type Tab = 'home' | 'count' | 'buy' | 'prices' | 'settings'

function Shell() {
  const { s } = useStore()
  const t = useT()
  const [tab, setTab] = useState<Tab>('home')
  if (!s.settings.onboarded) return <Onboarding />

  const tabs: [Tab, string, string][] = [
    ['home', '🏠', t.tabHome],
    ['count', '📋', t.tabInventory],
    ['buy', '🛒', t.tabList],
    ['prices', '📈', t.tabPrices],
    ['settings', '⚙️', t.tabSettings],
  ]
  return (
    <div className="app">
      <header className="top">
        <b>{t.appName}</b>
        <small>{tabs.find((x) => x[0] === tab)?.[2]}</small>
      </header>
      <main>
        {tab === 'home' && <Home go={setTab} />}
        {tab === 'count' && <Inventory onDone={() => setTab('buy')} />}
        {tab === 'buy' && <Buy />}
        {tab === 'prices' && <Prices />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabs">
        {tabs.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

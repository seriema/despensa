/**
 * The monthly inventory walk. Two layouts (toggle, remembered in settings):
 *  - List: one room at a time, all its items visible, compact −/+ per row. Fast scanning.
 *  - Cards: one item per screen with a big photo; swipe left/right or use the buttons.
 * Counting starts at 0. Every item shows the PACK it is counted in ("500 g", "12 un"), taken from the
 * product bought last time, so "2" is never ambiguous (feedback v0.4).
 */
import { ROOMS, type Item, type RoomId } from '../domain/types'
import { buyOf, haveOf, packLabelOf, refProductOf, useStore, useT, useWalkItems } from '../state/store'
import { ProductImg, Stepper, useSwipe } from '../ui/common'

export function Inventory({ onDone }: { onDone: () => void }) {
  const { s, d } = useStore()
  const t = useT()
  const items = useWalkItems()
  const pos = Math.min(s.inventory.position, Math.max(0, items.length - 1))
  const go = (p: number) => d({ type: 'position', value: Math.max(0, Math.min(items.length - 1, p)) })
  const swipe = useSwipe(() => go(pos + 1), () => go(pos - 1))
  if (!items.length) return <p className="pad">{t.nothingToBuy}</p>

  const current = items[pos]
  const room = current.room
  const roomsPresent = ROOMS.filter((r) => items.some((i) => i.room === r))
  const roomIdx = roomsPresent.indexOf(room)
  const jumpRoom = (r: RoomId) => go(items.findIndex((i) => i.room === r))
  const view = s.settings.countView
  const setHave = (id: string, v: number) => d({ type: 'setHave', itemId: id, value: v })
  const finish = () => { d({ type: 'finishInventory' }); onDone() }
  const missingIn = (r: RoomId) => items.filter((i) => i.room === r && buyOf(s, i) > 0).length
  const imageOf = (i: Item) => refProductOf(i)?.image ?? i.image

  const header = (
    <div className="count-head">
      <div className="room-chips">
        {roomsPresent.map((r) => (
          <button key={r} className={'chip' + (r === room ? ' on' : '')} onClick={() => jumpRoom(r)}>
            {t.rooms[r]} <small>{missingIn(r) ? `−${missingIn(r)}` : '✓'}</small>
          </button>
        ))}
      </div>
      <div className="seg tiny">
        <button className={view === 'list' ? 'on' : ''} aria-label={t.listView} onClick={() => d({ type: 'settings', patch: { countView: 'list' } })}>☰</button>
        <button className={view === 'card' ? 'on' : ''} aria-label={t.cardView} onClick={() => d({ type: 'settings', patch: { countView: 'card' } })}>▢</button>
      </div>
    </div>
  )

  if (view === 'list') {
    const roomItems = items.filter((i) => i.room === room)
    const lastRoom = roomIdx === roomsPresent.length - 1
    return (
      <div className="inventory">
        {header}
        <p className="small muted hint">{t.countHint}</p>
        <div className="count-list">
          {roomItems.map((i) => {
            const buy = buyOf(s, i)
            const pack = packLabelOf(i)
            return (
              <div key={i.id} className={'count-row' + (buy ? ' short' : '')}>
                <ProductImg image={imageOf(i)} dept={i.dept} size={44} />
                <div className="nm">
                  <div className="nm-t">{i.name}</div>
                  <small className="muted">
                    {pack && <span className="pack">{pack}</span>} {t.target} {i.target}
                    {buy ? <b className="need"> · {t.buy} {buy}</b> : ''}
                  </small>
                </div>
                <Stepper size="mid" value={haveOf(s, i)} onChange={(v) => setHave(i.id, v)} />
              </div>
            )
          })}
        </div>
        <div className="walk-nav">
          <button className="btn ghost" disabled={roomIdx === 0} onClick={() => jumpRoom(roomsPresent[roomIdx - 1])}>‹</button>
          {lastRoom ? (
            <button className="btn primary big" onClick={finish}>{t.finish}</button>
          ) : (
            <button className="btn primary big" onClick={() => jumpRoom(roomsPresent[roomIdx + 1])}>{t.rooms[roomsPresent[roomIdx + 1]]} ›</button>
          )}
        </div>
      </div>
    )
  }

  // Card view – compact enough for a ~384×740 viewport (Galaxy S24) without scrolling.
  const isLast = pos === items.length - 1
  const buy = buyOf(s, current)
  const ref = refProductOf(current)
  const pack = packLabelOf(current)
  return (
    <div className="inventory card-mode">
      {header}
      <div className="progress"><div style={{ width: `${((pos + 1) / items.length) * 100}%` }} /></div>
      <div className="count-card" key={current.id} {...swipe}>
        <div className="room-label">{t.rooms[room]} · {pos + 1}/{items.length}</div>
        <ProductImg image={imageOf(current)} dept={current.dept} size={120} />
        <h2 className="item-name">{current.name}</h2>
        {ref && <div className="ref-name">{pack && <span className="pack">{pack}</span>} {ref.name}</div>}
        <div className="target-row">
          <span>{t.target}: <b>{current.target}</b></span>
          <span className={buy ? 'need' : 'ok'}>{buy ? `${t.buy}: ${buy}` : t.allGood}</span>
        </div>
        <Stepper value={haveOf(s, current)} onChange={(v) => setHave(current.id, v)} />
      </div>
      <div className="walk-nav">
        <button className="btn ghost" disabled={pos === 0} onClick={() => go(pos - 1)}>‹ {t.back}</button>
        {isLast ? (
          <button className="btn primary big" onClick={finish}>{t.finish}</button>
        ) : (
          <button className="btn primary big" onClick={() => go(pos + 1)}>{t.next} ›</button>
        )}
      </div>
    </div>
  )
}

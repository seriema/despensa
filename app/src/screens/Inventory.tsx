/**
 * The monthly inventory walk. Two layouts (toggle, remembered in settings):
 *  - List: one room at a time, all its items visible, compact −/+ per row. Fast scanning.
 *  - Cards: one item per screen with a big photo and big buttons. Good for unfamiliar items.
 * Every item starts at its target, so the user only taps − for what's missing.
 * Position/room is persisted, so closing the app mid-walk resumes where you were.
 */
import { ROOMS, type RoomId } from '../domain/types'
import { buyOf, haveOf, useStore, useT, useWalkItems } from '../state/store'
import { ProductImg, Stepper } from '../ui/common'

export function Inventory({ onDone }: { onDone: () => void }) {
  const { s, d } = useStore()
  const t = useT()
  const items = useWalkItems()
  if (!items.length) return <p className="pad">{t.nothingToBuy}</p>

  const pos = Math.min(s.inventory.position, items.length - 1)
  const current = items[pos]
  const room = current.room
  const roomsPresent = ROOMS.filter((r) => items.some((i) => i.room === r))
  const roomIdx = roomsPresent.indexOf(room)
  const go = (p: number) => d({ type: 'position', value: Math.max(0, Math.min(items.length - 1, p)) })
  const jumpRoom = (r: RoomId) => go(items.findIndex((i) => i.room === r))
  const view = s.settings.countView
  const setHave = (id: string, v: number) => d({ type: 'setHave', itemId: id, value: v })
  const finish = () => { d({ type: 'finishInventory' }); onDone() }
  const missingIn = (r: RoomId) => items.filter((i) => i.room === r && buyOf(s, i) > 0).length

  const header = (
    <>
      <div className="count-top">
        <div className="seg tiny">
          <button className={view === 'list' ? 'on' : ''} onClick={() => d({ type: 'settings', patch: { countView: 'list' } })}>☰ {t.listView}</button>
          <button className={view === 'card' ? 'on' : ''} onClick={() => d({ type: 'settings', patch: { countView: 'card' } })}>▢ {t.cardView}</button>
        </div>
      </div>
      <div className="room-chips">
        {roomsPresent.map((r) => (
          <button key={r} className={'chip' + (r === room ? ' on' : '')} onClick={() => jumpRoom(r)}>
            {t.rooms[r]} <small>{missingIn(r) ? `−${missingIn(r)}` : '✓'}</small>
          </button>
        ))}
      </div>
    </>
  )

  if (view === 'list') {
    const roomItems = items.filter((i) => i.room === room)
    const lastRoom = roomIdx === roomsPresent.length - 1
    return (
      <div className="inventory">
        {header}
        <h3 className="room-title">{t.rooms[room]} <small className="muted">{t.roomHint[room]}</small></h3>
        <p className="small muted">{t.countHint}</p>
        <div className="count-list">
          {roomItems.map((i) => {
            const buy = buyOf(s, i)
            return (
              <div key={i.id} className={'count-row' + (buy ? ' short' : '')}>
                <ProductImg image={i.image} dept={i.dept} size={48} />
                <div className="nm">
                  <div className="nm-t">{i.name}</div>
                  <small className="muted">{t.target} {i.target}{buy ? <b className="need"> · {t.buy} {buy}</b> : ''}</small>
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

  // Card view
  const isLast = pos === items.length - 1
  const buy = buyOf(s, current)
  return (
    <div className="inventory">
      {header}
      <div className="progress"><div style={{ width: `${((pos + 1) / items.length) * 100}%` }} /></div>
      <div className="count-card" key={current.id}>
        <div className="room-label">{t.rooms[room]} · {pos + 1}/{items.length}</div>
        <ProductImg image={current.image} dept={current.dept} size={150} />
        <h2 className="item-name">{current.name}</h2>
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
